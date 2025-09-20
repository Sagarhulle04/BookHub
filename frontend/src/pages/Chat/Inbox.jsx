import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { resetUnreadForConversation, setUnreadByConversation } from '../../store/slices/uiSlice';
import { markConversationRead } from '../../store/thunks/chatThunks';
import chatService from '../../services/chatService';
import userService from '../../services/userService';
import { MessageCircle } from 'lucide-react';

const Inbox = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { unreadByConversation } = useSelector((state) => state.ui);
  const [conversations, setConversations] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('chats'); // chats | people
  const [loading, setLoading] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await chatService.listConversations();
        setConversations(data || []);
        // Hydrate Redux unreadByConversation from server unreadCount
        if (Array.isArray(data)) {
          const obj = {};
          for (const c of data) {
            if (c && c._id != null) obj[c._id] = { count: Math.max(0, Number(c.unreadCount || 0)) };
          }
          dispatch(setUnreadByConversation(obj));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    (async () => {
      try {
        const [fRes, gRes] = await Promise.all([
          userService.getFollowers(user._id, 1),
          userService.getFollowing(user._id, 1)
        ]);
        setFollowers((fRes?.users || fRes?.followers || []));
        setFollowing((gRes?.users || gRes?.following || []));
      } finally {
        setLoadingPeople(false);
      }
    })();
  }, [user?._id]);

  // Listen to SSE events for real-time conversation updates
  useEffect(() => {
    const apiBase = 'http://localhost:5001';
    const evt = new EventSource(`${apiBase}/api/notifications/stream`, { withCredentials: true });
    
    const handleNewMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.conversationId) {
          // Skip if it's my own message (already handled by the sender)
          if (data.senderId && user?._id && String(data.senderId) === String(user._id)) return;
          
          // Update the conversation list to move the conversation to the top
          setConversations(prev => {
            const updatedConversations = [...prev];
            const conversationIndex = updatedConversations.findIndex(conv => conv._id === data.conversationId);
            
            if (conversationIndex !== -1) {
              // Remove the conversation from its current position
              const [conversation] = updatedConversations.splice(conversationIndex, 1);
              
              // Update the conversation with new message info
              const updatedConversation = {
                ...conversation,
                lastMessage: {
                  text: data.text,
                  book: data.bookId ? { _id: data.bookId } : undefined,
                  status: data.statusId ? { _id: data.statusId } : undefined,
                  taggedStatus: data.taggedStatusId ? { _id: data.taggedStatusId } : undefined,
                  sender: { _id: data.senderId, username: data.senderUsername },
                  createdAt: data.createdAt
                },
                unreadCount: (conversation.unreadCount || 0) + 1
              };
              
              // Add it to the top
              updatedConversations.unshift(updatedConversation);
              
              // Update Redux unread count
              dispatch(setUnreadByConversation({
                ...unreadByConversation,
                [data.conversationId]: { count: updatedConversation.unreadCount }
              }));
            }
            
            return updatedConversations;
          });
        }
      } catch (_) {}
    };

    const handleAllMessagesDeleted = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.conversationId) {
          // Update the conversation list to reflect the deleted messages
          setConversations(prev => prev.map(conv => {
            if (conv._id === data.conversationId) {
              // Clear the last message for this conversation
              return { ...conv, lastMessage: null };
            }
            return conv;
          }));
        }
      } catch (_) {}
    };

    evt.addEventListener('chat_message', handleNewMessage);
    evt.addEventListener('chat_all_messages_deleted', handleAllMessagesDeleted);
    
    return () => {
      evt.removeEventListener('chat_message', handleNewMessage);
      evt.removeEventListener('chat_all_messages_deleted', handleAllMessagesDeleted);
      evt.close();
    };
  }, [user?._id, unreadByConversation, dispatch]);

  const people = useMemo(() => {
    const byId = new Map();
    for (const p of [...followers, ...following]) {
      if (!p?._id) continue;
      byId.set(String(p._id), p);
    }
    return Array.from(byId.values());
  }, [followers, following]);

  const startConversation = async (otherUserId) => {
    try {
      const convo = await chatService.openConversation(otherUserId);
      const id = convo?._id || convo?.id;
      if (id) navigate(`/chat/${id}`);
    } catch (_) {}
  };


  // Debounced search for users
  useEffect(() => {
    if (activeTab !== 'people') return;
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await userService.searchUsers(q, 1);
        const list = res?.users || res?.results || [];
        setSearchResults(Array.isArray(list) ? list : []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [activeTab, query]);

  if (loading) {
    return <div className="p-4">Loading chats...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Messages</h1>
        <div className="bg-white border border-gray-200 rounded-full p-1">
          <button onClick={() => setActiveTab('chats')} className={`px-3 py-1 text-sm rounded-full ${activeTab==='chats' ? 'bg-primary-600 text-white' : 'text-gray-700'}`}>
            <MessageCircle className="w-4 h-4 inline mr-1" />
            Chats
          </button>
          <button onClick={() => setActiveTab('people')} className={`px-3 py-1 text-sm rounded-full ${activeTab==='people' ? 'bg-primary-600 text-white' : 'text-gray-700'}`}>People</button>
        </div>
      </div>

      {activeTab === 'chats' && (
        <>
          {(!conversations || conversations.length === 0) && (
            <div className="text-gray-600">No conversations yet</div>
          )}
          <div className="space-y-3">
            {conversations.map((c) => {
              const others = (c.participants || []).filter(p => String(p._id) !== String(user?._id));
              const other = others[0] || c.participants?.[0];
              const unread = (unreadByConversation?.[c._id]?.count ?? c.unreadCount ?? 0) || 0;
              const isUnread = unread > 0;
              const lastText = c.lastMessage?.text ? c.lastMessage.text : (c.lastMessage?.book ? 'Shared a book' : (c.lastMessage?.status ? 'Shared a status' : ''));
              return (
                <a
                  key={c._id}
                  href={`/chat/${c._id}`}
                  onClick={() => dispatch(markConversationRead(c._id))}
                  className={`block p-3 rounded-lg border hover:bg-gray-50 ${isUnread ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={other?.profilePicture || '/default-avatar.png'} alt={other?.username} className="w-8 h-8 rounded-full object-cover" />
                      <div className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>{other?.username || 'Conversation'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-600 text-white">{unread}</span>
                      )}
                      {c.lastMessage?.createdAt ? (
                        <div className="text-xs text-gray-500">{new Date(c.lastMessage.createdAt).toLocaleString()}</div>
                      ) : null}
                    </div>
                  </div>
                  {lastText ? (
                    <div className={`text-sm mt-1 line-clamp-1 ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{lastText}</div>
                  ) : null}
                </a>
              );
            })}
          </div>
        </>
      )}


      {activeTab === 'people' && (
        <div>
          <div className="mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people by name or username"
              className="w-full input-field"
            />
          </div>
          {loadingPeople ? (
            <div className="text-gray-600">Loading people…</div>
          ) : query.trim().length >= 2 ? (
            <div>
              {searching ? (
                <div className="text-gray-600">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="text-gray-600">No users found</div>
              ) : (
                <div className="space-y-2">
                  {searchResults.filter(u => u._id !== user?._id).map((p) => (
                    <div key={p._id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200">
                      <div className="flex items-center gap-3">
                        <img src={p.profilePicture || '/default-avatar.png'} alt={p.username} className="w-8 h-8 rounded-full object-cover" />
                        <div className="text-sm font-medium">{p.username}</div>
                      </div>
                      <button onClick={() => startConversation(p._id)} className="px-3 py-1.5 text-sm rounded-full bg-primary-600 text-white hover:bg-primary-700">Message</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : people.length === 0 ? (
            <div className="text-gray-600">No followers or following yet</div>
          ) : (
            <div className="space-y-2">
              {people.map((p) => (
                <div key={p._id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200">
                  <div className="flex items-center gap-3">
                    <img src={p.profilePicture || '/default-avatar.png'} alt={p.username} className="w-8 h-8 rounded-full object-cover" />
                    <div className="text-sm font-medium">{p.username}</div>
                  </div>
                  <button onClick={() => startConversation(p._id)} className="px-3 py-1.5 text-sm rounded-full bg-primary-600 text-white hover:bg-primary-700">Message</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Inbox;


