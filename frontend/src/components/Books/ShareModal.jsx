import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import chatService from '../../services/chatService';
import userService from '../../services/userService';

const ShareModal = ({ book, isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [conversations, setConversations] = useState([]);
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const convos = await chatService.listConversations();
        setConversations(convos || []);
        if (user?._id) {
          const [fRes, gRes] = await Promise.all([
            userService.getFollowers(user._id, 1),
            userService.getFollowing(user._id, 1)
          ]);
          const byId = new Map();
          for (const p of [...(fRes?.users || fRes?.followers || []), ...(gRes?.users || gRes?.following || [])]) {
            if (!p?._id) continue;
            byId.set(String(p._id), p);
          }
          setPeople(Array.from(byId.values()));
        }
      } catch (_) {}
    })();
  }, [isOpen, user?._id]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, query]);

  if (!isOpen) return null;

  const shareWithConversation = async (conversationId) => {
    try {
      await chatService.sendMessage(conversationId, { text: '', bookId: book._id });
      onClose?.();
      navigate(`/chat/${conversationId}`);
    } catch (_) {}
  };

  const shareWithUser = async (userId) => {
    try {
      const convo = await chatService.openConversation(userId);
      const id = convo?._id || convo?.id;
      if (id) {
        await chatService.sendMessage(id, { text: '', bookId: book._id });
        onClose?.();
        navigate(`/chat/${id}`);
      }
    } catch (_) {}
  };

  const visiblePeople = query.trim().length >= 2 ? searchResults : people;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Share “{book.title}”</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people"
          className="w-full input-field mb-3"
        />

        <div className="text-xs font-semibold text-gray-500 mb-2">Recent chats</div>
        <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
          {(!conversations || conversations.length === 0) ? (
            <div className="text-gray-500 text-sm">No recent chats</div>
          ) : conversations.map((c) => {
            const other = (c.participants || []).find(p => String(p._id) !== String(user?._id));
            if (!other) return null;
            return (
              <button key={c._id} onClick={() => shareWithConversation(c._id)} className="w-full flex items-center gap-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-left">
                <img src={other.profilePicture || '/default-avatar.png'} alt={other.username} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <div className="text-sm font-medium">{other.username}</div>
                  <div className="text-xs text-gray-500">Tap to share</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-xs font-semibold text-gray-500 mb-2">People</div>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {searching ? (
            <div className="text-gray-500 text-sm">Searching…</div>
          ) : (!visiblePeople || visiblePeople.length === 0) ? (
            <div className="text-gray-500 text-sm">No people found</div>
          ) : visiblePeople.filter(p => p._id !== user?._id).map((p) => (
            <button key={p._id} onClick={() => shareWithUser(p._id)} className="w-full flex items-center gap-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-left">
              <img src={p.profilePicture || '/default-avatar.png'} alt={p.username} className="w-8 h-8 rounded-full object-cover" />
              <div>
                <div className="text-sm font-medium">{p.username}</div>
                <div className="text-xs text-gray-500">Tap to share</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;


