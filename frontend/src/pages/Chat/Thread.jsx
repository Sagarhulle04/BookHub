import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Image, Send, X, Phone, Video, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import chatService from '../../services/chatService';
import userService from '../../services/userService';
import statusService from '../../services/statusService';
import { markConversationRead } from '../../store/thunks/chatThunks';
import StatusMention from '../../components/Chat/StatusMention';

const Thread = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [messages, setMessages] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const firstUnreadRef = useRef(null);
  const [other, setOther] = useState(null);
  const [presence, setPresence] = useState({ online: false, lastSeenLabel: '' });
  const [showStatusMention, setShowStatusMention] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [reMentionLoading, setReMentionLoading] = useState({});
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const headerMenuRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    try {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    } catch (_) {}
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await chatService.listMessages(id);
        const list = data.messages || [];
        setMessages(list);
        // compute first unread element by lastReadAt
        if (data.lastReadAt) {
          const threshold = new Date(data.lastReadAt).getTime();
          const idx = list.findIndex(m => m.createdAt && new Date(m.createdAt).getTime() > threshold);
          if (idx >= 0) firstUnreadRef.current = list[idx]?._id;
        }
      } finally {
        setLoading(false);
        // Always start at bottom (latest messages) when entering chat
        setTimeout(() => {
          scrollToBottom(false);
          // Mark initial load as complete
          setIsInitialLoad(false);
        }, 0);
      }
    })();
  }, [id]);

  // Only scroll to bottom when new messages are added (not on initial load)
  useEffect(() => {
    if (loading || isInitialLoad) return;
    // Only auto-scroll if we have messages and this is not the initial load
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length, loading, isInitialLoad]);

  // Mark conversation as read when opening the thread
  useEffect(() => {
    if (!id) return;
    dispatch(markConversationRead(id));
  }, [id, dispatch]);

  // Load conversation participants to display recipient info (fetch full profile for lastActive)
  useEffect(() => {
    (async () => {
      try {
        const convos = await chatService.listConversations();
        const convo = Array.isArray(convos) ? convos.find(c => (c._id || c.id) === id) : null;
        if (convo && Array.isArray(convo.participants)) {
          const otherUser = convo.participants.find(p => String(p._id) !== String(user?._id));
          if (otherUser) {
            try {
              const full = otherUser.username ? await userService.getUserByUsername(otherUser.username) : null;
              const enriched = full && full.username === otherUser.username
                ? { ...otherUser, fullName: full.fullName, lastActive: full.lastActive, profilePicture: full.profilePicture }
                : otherUser;
              setOther(enriched);
            } catch (_) {
              setOther(otherUser);
            }
          }
        }
      } catch (_) {}
    })();
  }, [id, user?._id]);

  // Listen to SSE chat_message for realtime update
  useEffect(() => {
    const apiBase = 'http://localhost:5001';
    const evt = new EventSource(`${apiBase}/api/notifications/stream`, { withCredentials: true });
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.conversationId === id) {
          // Skip appending the same message twice: ignore SSE echo of my own sent message
          if (data.senderId && user?._id && String(data.senderId) === String(user._id)) return;
          
          const newMessage = {
            _id: data.messageId || Math.random().toString(36).slice(2),
            text: data.text,
            book: data.bookId ? { _id: data.bookId } : undefined,
            status: data.statusId ? { _id: data.statusId } : undefined,
            taggedStatus: data.taggedStatusId ? { 
              _id: data.taggedStatusId,
              user: { username: data.senderUsername || 'Unknown User' }
            } : undefined,
            sender: { _id: data.senderId },
            createdAt: data.createdAt
          };
          
          setMessages((prev) => {
            // Check if we already have this message (optimistic update)
            const existingMessage = prev.find(m => 
              m.text === newMessage.text && 
              m.sender._id === newMessage.sender._id &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(newMessage.createdAt).getTime()) < 5000 // Within 5 seconds
            );
            
            if (existingMessage) {
              // Replace optimistic message with real message
              return prev.map(m => 
                m._id === existingMessage._id ? { ...newMessage, isOptimistic: false } : m
              );
            } else {
              // Add new message
              return [...prev, newMessage];
            }
          });
          scrollToBottom(true);
          // Mark other participant online immediately when they send a message
          if (other?._id && data.senderId && String(data.senderId) === String(other._id)) {
            setOther((prev) => ({ ...prev, lastActive: new Date().toISOString() }));
          }
        }
      } catch (_) {}
    };
    const deleteHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.conversationId === id) {
          setMessages((prev) => prev.map(x => x._id === data.messageId ? { ...x, isDeleted: true, text: '', book: null } : x));
        }
      } catch (_) {}
    };
    const deleteAllHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.conversationId === id) {
          setMessages([]);
        }
      } catch (_) {}
    };

    const typingHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.conversationId === id && data.senderId !== user._id) {
          setOtherTyping(data.isTyping);
        }
      } catch (_) {}
    };

    evt.addEventListener('chat_message', handler);
    evt.addEventListener('chat_message_deleted', deleteHandler);
    evt.addEventListener('chat_all_messages_deleted', deleteAllHandler);
    evt.addEventListener('chat_typing', typingHandler);
    return () => {
      evt.removeEventListener('chat_message', handler);
      evt.removeEventListener('chat_message_deleted', deleteHandler);
      evt.removeEventListener('chat_all_messages_deleted', deleteAllHandler);
      evt.removeEventListener('chat_typing', typingHandler);
      evt.close();
    };
  }, [id, user?._id, other?._id]);

  const send = async () => {
    if (!text.trim() && !selectedStatus) return;
    
    // Store the current text and status for optimistic update
    const currentText = text;
    const currentStatus = selectedStatus;
    
    // Clear input immediately for better UX
    setText('');
    setSelectedStatus(null);
    
    // Create optimistic message for immediate display
    const optimisticMessage = {
      _id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      text: currentText,
      status: currentStatus ? { _id: currentStatus._id } : undefined,
      sender: { _id: user._id, username: user.username },
      createdAt: new Date().toISOString(),
      isOptimistic: true // Flag to identify optimistic messages
    };
    
    // Add optimistic message immediately
    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom(true);
    
    try {
      // Handle re-mention case - create a new status with the original image and mention the original user
      if (currentStatus?.isReMention) {
        const reMentionText = `@${currentStatus.user.username} ${currentText}`.trim();
        const msg = await chatService.sendMessage(id, { 
          text: reMentionText
        });
        
        // Replace optimistic message with real message
        setMessages((prev) => prev.map(m => 
          m._id === optimisticMessage._id ? { ...msg, isOptimistic: false } : m
        ));
        return;
      }
      
      const msg = await chatService.sendMessage(id, { 
        text: currentText, 
        statusId: currentStatus?._id 
      });
      
      // Replace optimistic message with real message
      setMessages((prev) => prev.map(m => 
        m._id === optimisticMessage._id ? { ...msg, isOptimistic: false } : m
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter(m => m._id !== optimisticMessage._id));
      // Restore input on error
      setText(currentText);
      setSelectedStatus(currentStatus);
      toast.error('Failed to send message');
    }
  };

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    setShowStatusMention(false);
  };

  const removeSelectedStatus = () => {
    setSelectedStatus(null);
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      // Send typing start event
      sendTypingEvent(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingEvent(false);
    }, 2000);
  };

  const sendTypingEvent = (isTyping) => {
    try {
      const apiBase = 'http://localhost:5001';
      fetch(`${apiBase}/api/chats/${id}/typing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isTyping })
      }).catch(() => {}); // Ignore errors
    } catch (_) {}
  };

  const handleReMentionFromMessage = async (taggedStatus) => {
    const statusId = taggedStatus._id;
    
    try {
      // Set loading state
      setReMentionLoading(prev => ({ ...prev, [statusId]: true }));
      
      // Create a new status on the current user's account with the original image
      const newStatus = await statusService.createReMentionStatus(
        taggedStatus._id,
        `Re-mentioning @${taggedStatus.user?.username || 'Unknown User'}`
      );
      
      // Show success toast notification
      toast.success('You have added a status');
      
    } catch (error) {
      console.error('Error creating re-mention status:', error);
      toast.error('Failed to create status');
    } finally {
      // Clear loading state
      setReMentionLoading(prev => ({ ...prev, [statusId]: false }));
    }
  };

  const handleCall = () => {
    toast.error('Call feature is not available yet');
  };

  const handleVideoCall = () => {
    toast.error('Video call feature is not available yet');
  };

  const handleDeleteAllMessages = async () => {
    if (deleteAllLoading) return; // Prevent multiple clicks
    
    setDeleteAllLoading(true);
    try {
      // Delete all messages in the conversation
      const response = await chatService.deleteAllMessages(id);
      console.log('Delete all messages response:', response);
      
      // Clear messages from the UI
      setMessages([]);
      
      // Show success toast with better styling
      toast.success('All messages deleted successfully', {
        duration: 3000,
        style: {
          background: '#10B981',
          color: '#fff',
          fontWeight: '500',
        },
      });
      
      // Close the dropdown menu
      setShowHeaderMenu(false);
    } catch (error) {
      console.error('Error deleting all messages:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error('Failed to delete messages', {
        duration: 4000,
        style: {
          background: '#EF4444',
          color: '#fff',
          fontWeight: '500',
        },
      });
    } finally {
      setDeleteAllLoading(false);
    }
  };

  // Compute presence (online/last seen) and refresh periodically
  useEffect(() => {
    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const isYesterday = (d, now) => {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return isSameDay(d, y);
    };
    const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const formatDate = (d) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const compute = (o) => {
      if (!o) return { online: false, lastSeenLabel: '' };
      const lastActiveDate = o.lastActive ? new Date(o.lastActive) : null;
      const now = new Date();
      // Online if active within last 90 seconds
      const online = lastActiveDate ? (now.getTime() - lastActiveDate.getTime() < 90 * 1000) : false;
      let label = '';
      if (online) {
        label = 'Online';
      } else if (!lastActiveDate) {
        label = '';
      } else if (isSameDay(lastActiveDate, now)) {
        label = `Last seen today at ${formatTime(lastActiveDate)}`;
      } else if (isYesterday(lastActiveDate, now)) {
        label = `Last seen yesterday at ${formatTime(lastActiveDate)}`;
      } else {
        // For older dates, show relative time like "2 days ago", "1 week ago"
        const diffTime = now.getTime() - lastActiveDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 7) {
          label = `Last seen ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        } else if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          label = `Last seen ${weeks} week${weeks === 1 ? '' : 's'} ago`;
        } else if (diffDays < 365) {
          const months = Math.floor(diffDays / 30);
          label = `Last seen ${months} month${months === 1 ? '' : 's'} ago`;
        } else {
          const years = Math.floor(diffDays / 365);
          label = `Last seen ${years} year${years === 1 ? '' : 's'} ago`;
        }
      }
      return { online, lastSeenLabel: label };
    };
    setPresence((prev) => compute(other));
    const fetchAndUpdate = async () => {
      try {
        if (other?.username) {
          const full = await userService.getUserByUsername(other.username);
          setOther((prev) => ({ ...prev, lastActive: full?.lastActive || prev?.lastActive }));
          setPresence(compute(full || other));
        }
      } catch (_) {}
    };
    const interval = setInterval(fetchAndUpdate, 30000); // Changed from 2000ms to 30000ms (30 seconds)
    const onFocus = () => { fetchAndUpdate(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    fetchAndUpdate();
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [other?.username, other?.lastActive]);

  // Close header menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setShowHeaderMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll when typing indicator appears
  useEffect(() => {
    if (otherTyping) {
      scrollToBottom(true);
    }
  }, [otherTyping]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] p-2 sm:p-4">
      {/* Recipient Header */}
      {other && (
        <div className="mb-4 pb-3 border-b border-gray-300">
          <div className="flex items-center justify-between">
            {/* User Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img 
                src={other.profilePicture || '/default-avatar.png'} 
                alt={other.username} 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0" 
              />
              <div className="min-w-0 flex-1">
                <div className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {other.fullName || other.username}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">@{other.username}</span>
                  <span>•</span>
                  {presence.online ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span>Online</span>
                    </span>
                  ) : (
                    presence.lastSeenLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                        <span className="truncate">{presence.lastSeenLabel}</span>
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Icons */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={handleCall}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Call"
              >
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
              <button
                onClick={handleVideoCall}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Video Call"
              >
                <Video className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
              <div className="relative" ref={headerMenuRef}>
                <button
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                </button>
                
                {/* Dropdown Menu */}
                {showHeaderMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 sm:w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                      onClick={handleDeleteAllMessages}
                      disabled={deleteAllLoading}
                      className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {deleteAllLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          Deleting...
                        </>
                      ) : (
                        'Delete all messages'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
        {messages.map((m) => {
          const isMine = m?.sender?._id && user?._id && String(m.sender._id) === String(user._id);
          return (
            <div key={m._id} data-mid={m._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}> 
              <div className={`group relative max-w-[70%] p-3 rounded-lg ${isMine ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-900'}`}>
                {m.book ? (
                  <a href={`/books/${m.book._id}`} className={`${isMine ? 'text-white underline' : 'text-primary-600 underline'}`}>Shared a book</a>
                ) : m.status ? (
                  <div className="mb-2">
                    <div className={`text-sm ${isMine ? 'text-white' : 'text-gray-800'} mb-2`}>
                      Shared a status
                    </div>
                    <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-200">
                      {m.status.mediaType === 'image' ? (
                        <img
                          src={m.status.mediaUrl}
                          alt="Status"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {m.status.text && (
                      <p className={`text-xs mt-1 ${isMine ? 'text-white/80' : 'text-gray-600'}`}>
                        {m.status.text}
                      </p>
                    )}
                  </div>
                ) : m.taggedStatus ? (
                  <div className="mb-2">
                    <div className={`text-sm ${isMine ? 'text-white' : 'text-gray-800'} mb-2`}>
                      {isMine ? 'You were tagged in a status' : `${m.sender.username} tagged you in a status`}
                    </div>
                    <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-200">
                      {m.taggedStatus.mediaType === 'image' ? (
                        <img
                          src={m.taggedStatus.mediaUrl}
                          alt="Tagged Status"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {m.taggedStatus.text && (
                      <p className={`text-xs mt-1 ${isMine ? 'text-white/80' : 'text-gray-600'}`}>
                        {m.taggedStatus.text}
                      </p>
                    )}
                    {!isMine && (
                      <button
                        onClick={() => handleReMentionFromMessage(m.taggedStatus)}
                        disabled={reMentionLoading[m.taggedStatus._id]}
                        className={`mt-2 px-3 py-1 text-xs rounded-full ${isMine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-primary-600 text-white hover:bg-primary-700'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {reMentionLoading[m.taggedStatus._id] ? 'Creating...' : 'Re-mention'}
                      </button>
                    )}
                  </div>
                ) : null}
                {m.isDeleted ? (
                  <div className={`text-xs italic ${isMine ? 'text-white/80' : 'text-gray-500'}`}>Message deleted</div>
                ) : m.text ? (
                  <div className={`text-sm ${isMine ? 'text-white' : 'text-gray-800'}`}>{m.text}</div>
                ) : null}
                {m.createdAt ? (
                  <div className={`mt-1 text-[10px] flex items-center gap-1 ${isMine ? 'text-white/80' : 'text-gray-600'}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.isOptimistic && (
                      <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin opacity-60"></div>
                    )}
                  </div>
                ) : null}
                {/* Message actions */}
                <button
                  className={`absolute top-1 ${isMine ? 'left-1' : 'right-1'} w-6 h-6 flex items-center justify-center rounded-full bg-black/10 ${isMine ? 'text-white' : 'text-gray-600'} hover:bg-black/20 transition opacity-0 group-hover:opacity-100`}
                  onClick={() => setMenuOpenId(menuOpenId === m._id ? null : m._id)}
                  title="More"
                >
                  ⋮
                </button>
                
                {menuOpenId === m._id && (
                  <div
                    className={`absolute top-1 ${isMine ? 'left-0 -translate-x-full mr-4' : 'right-0 translate-x-full ml-4'} z-10 min-w-[140px] bg-white text-gray-800 border border-gray-200 rounded-lg shadow-md p-2 text-xs space-y-2`}
                    onMouseLeave={() => setMenuOpenId(null)}
                  >
                    <button
                      className="block w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-50"
                      onClick={async () => {
                        try {
                          await chatService.deleteMessageForMe(id, m._id);
                          setMessages((prev) => prev.filter(x => x._id !== m._id));
                        } finally {
                          setMenuOpenId(null);
                        }
                      }}
                    >
                      Delete for me
                    </button>
                    {isMine && (
                      <button
                        className="block w-full text-left px-2 py-1.5 rounded-md text-red-600 hover:bg-red-50"
                        onClick={async () => {
                          try {
                            await chatService.deleteMessageForEveryone(id, m._id);
                            setMessages((prev) => prev.map(x => x._id === m._id ? { ...x, isDeleted: true, text: '', book: null } : x));
                          } finally {
                            setMenuOpenId(null);
                          }
                        }}
                      >
                        Delete for everyone
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
        
        {/* Typing Indicator */}
        {otherTyping && (
          <div className="flex justify-start mb-2">
            <div className="bg-white border border-gray-300 rounded-lg p-3 max-w-[70%]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-xs text-gray-500 ml-1">
                  {other?.username || 'Someone'} is typing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {selectedStatus && (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
            <div className="w-8 h-8 rounded overflow-hidden bg-gray-200">
              {selectedStatus.mediaType === 'image' ? (
                <img
                  src={selectedStatus.mediaUrl}
                  alt="Status"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedStatus.isReMention ? `Re-mentioning @${selectedStatus.user?.username || 'Unknown User'}` : `${selectedStatus.user?.username || 'Unknown User'}'s status`}
              </p>
              {selectedStatus.text && (
                <p className="text-xs text-gray-600 truncate">
                  {selectedStatus.text}
                </p>
              )}
            </div>
            <button
              onClick={removeSelectedStatus}
              className="p-1 hover:bg-gray-200 rounded-full"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}
        
        <div className="flex gap-2">
          <input 
            className="flex-1 input-field text-sm sm:text-base" 
            value={text} 
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }} 
            placeholder="Type a message" 
          />
          <button
            onClick={() => setShowStatusMention(true)}
            className="px-2 sm:px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            title="Share status"
          >
            <Image className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
          <button className="btn-primary flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-3 sm:px-4" onClick={send}>
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
      
      {showStatusMention && (
        <StatusMention
          onSelect={handleStatusSelect}
          onClose={() => setShowStatusMention(false)}
        />
      )}
    </div>
  );
};

export default Thread;


