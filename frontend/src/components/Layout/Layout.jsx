import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import StatusBar from './StatusBar';
import { Home, Search, BookOpen, Heart, Bookmark, Upload, Bell, User, LogOut, Settings, MessageCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { addNotification, setNotifications, setUnreadCount, incrementUnreadChats, resetUnreadChats, addUnreadChatSender, resetUnreadChatSenders, setUnreadChatSenders, incrementUnreadForConversation, setUnreadByConversation } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import SuggestedFollows from './SuggestedFollows';
import notificationService from '../../services/notificationService';
import userService from '../../services/userService';
import chatService from '../../services/chatService';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useThrottledRequest } from '../../hooks/useThrottledRequest';

const Layout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount, unreadChats, unreadChatSenderIds } = useSelector((state) => state.ui);
  const unreadByConversation = useSelector((state) => state.ui.unreadByConversation);
  const unreadConversationsCount = Object.values(unreadByConversation || {}).filter((x) => (x?.count || 0) > 0).length;
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  
  // Check if status bar should be shown (only when user is logged in and on home page)
  const showStatusBar = user && location.pathname === '/';
  
  // Profile menu state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);
  
  // Logout functionality
  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  // Load stored notifications when component mounts
  useEffect(() => {
    const loadStoredNotifications = async () => {
      if (user) {
        try {
          const response = await notificationService.getNotifications(1, 50);
          dispatch(setNotifications(response.notifications));
          dispatch(setUnreadCount(response.unreadCount));
          // Hydrate unread-by-conversation from server so badges persist after refresh
          try {
            const convos = await chatService.listConversations();
            if (Array.isArray(convos)) {
              const obj = {};
              for (const c of convos) {
                if (c && c._id != null) obj[c._id] = { count: Math.max(0, Number(c.unreadCount || 0)) };
              }
              dispatch(setUnreadByConversation(obj));
            }
          } catch (_) {}
        } catch (error) {
          console.error('Failed to load notifications:', error);
        }
      }
    };

    loadStoredNotifications();
  }, [user, dispatch]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileMenu && !event.target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  // Subscribe to server-sent notifications
  useEffect(() => {
    const apiBase = 'http://localhost:5001';
    const sseUrl = `${apiBase}/api/notifications/stream`;
    const evtSource = new EventSource(sseUrl, { withCredentials: true });
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        const myId = user?._id;
        
        // Filter notifications by recipientId
        if (data.recipientId) {
          if (!myId || String(data.recipientId) !== String(myId)) return; // not for me
        }
        
        dispatch(addNotification({ id: Date.now() + Math.random(), ...data }));
      } catch (_) {}
    };
    evtSource.addEventListener('notification', handler);
    const chatHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Count as unread chat if it's not sent by me and belongs to a visible conversation
        const myId = user?._id;
        if (data.senderId && myId && String(data.senderId) !== String(myId)) {
          dispatch(incrementUnreadChats(1));
          dispatch(addUnreadChatSender(String(data.senderId)));
          const cid = data.conversationId ? String(data.conversationId) : undefined;
          if (cid) dispatch(incrementUnreadForConversation(cid));
          // Client-side only increments; server will be marked read on open
        }
      } catch (_) {}
    };
    evtSource.addEventListener('chat_message', chatHandler);
    evtSource.addEventListener('follow', handler);
    // Optional: listen to ping to keep-alive
    const noop = () => {};
    evtSource.addEventListener('ping', noop);
    return () => {
      evtSource.removeEventListener('notification', handler);
      evtSource.removeEventListener('follow', handler);
      evtSource.removeEventListener('chat_message', chatHandler);
      evtSource.close();
    };
  }, [dispatch, user?._id]);

  // Throttled request hook for ping
  const throttledRequest = useThrottledRequest(30000); // 30 seconds throttle

  // Presence heartbeat: ping server every 30s when logged in
  useEffect(() => {
    if (!user?._id) return;
    let timer;
    const tick = async () => { 
      try { 
        await throttledRequest(() => userService.ping(), 'user-ping'); 
      } catch (_) {} 
    };
    tick();
    timer = setInterval(tick, 30000); // 30 seconds interval
    return () => clearInterval(timer);
  }, [user?._id, throttledRequest]);
  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Sidebar + Content */}
      <div className="w-full px-0 sm:px-4 md:px-6">
        {/* Static Left Sidebar */}
        <aside className={`hidden md:flex fixed left-0 top-0 h-screen w-60 lg:w-64 pt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-4 overflow-hidden flex-col`}>
          {/* Profile Section */}
          {user ? (
            <div className="mb-6">
              <div className="relative profile-menu-container">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-3 p-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors w-full"
                >
                  <img
                    src={user.profilePicture || '/default-avatar.png'}
                    alt={user.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{user.username}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </button>

                {/* Profile Dropdown */}
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-0 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  >
                    <div className="py-1">
                      <button
                        onClick={() => {
                          navigate('/profile');
                          setShowProfileMenu(false);
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          navigate('/liked');
                          setShowProfileMenu(false);
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Heart size={16} />
                        <span>Liked Books</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          navigate('/bookmarks');
                          setShowProfileMenu(false);
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Bookmark size={16} />
                        <span>Bookmarks</span>
                      </button>
                      
                      {user.role === 'admin' && (
                        <button
                          onClick={() => {
                            navigate('/admin/upload');
                            setShowProfileMenu(false);
                          }}
                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Settings size={16} />
                          <span>Admin Panel</span>
                        </button>
                      )}
                      
                      <div className="border-t border-gray-200 my-1"></div>
                      
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors text-center"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}

          <nav className="space-y-2 flex-1 overflow-hidden">
            <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Home className="h-5 w-5" />
              <span>Home</span>
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Search className="h-5 w-5" />
              <span>Search</span>
            </NavLink>
            <NavLink to="/books" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <BookOpen className="h-5 w-5" />
              <span>Books</span>
            </NavLink>
            <NavLink to="/liked" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Heart className="h-5 w-5" />
              <span>Liked</span>
            </NavLink>
            <NavLink to="/bookmarks" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Bookmark className="h-5 w-5" />
              <span>Bookmarks</span>
            </NavLink>
            <NavLink to="/upload" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Upload className="h-5 w-5" />
              <span>Upload</span>
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="relative">
                <MessageCircle className="h-5 w-5" />
                {unreadConversationsCount > 0 && (
                  <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white">{unreadConversationsCount}</span>
                )}
              </div>
              <span>Messages</span>
            </NavLink>
          </nav>
        </aside>

        {/* Mobile Top Bar */}
        <div className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => navigate('/')} role="button" tabIndex={0}>
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">BookHub</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileNotifications(true)}
              className="p-2 rounded-full text-gray-700 hover:bg-gray-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              onClick={() => { navigate('/chat'); }}
              className="p-2 rounded-full text-gray-700 hover:bg-gray-100 relative"
              aria-label="Messages"
            >
              <MessageCircle className="h-5 w-5" />
              {unreadConversationsCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white">{unreadConversationsCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="py-4 md:py-6 max-w-full md:max-w-[80%] mx-auto px-3 sm:px-0 md:ml-60 lg:ml-64 md:mr-60 lg:mr-64">
          {showStatusBar && <StatusBar />}
          <Outlet />
        </main>

        {/* Right Notifications Sidebar */}
        <aside className={`hidden md:flex fixed right-0 top-0 h-[80vh] w-60 lg:w-64 pt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-4 overflow-hidden flex-col`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-gray-700" />
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            <div className="space-y-2 h-full">
              {!notifications || notifications.length === 0 ? (
                <div className="text-sm text-gray-500">No notifications</div>
              ) : (
                [...notifications].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)).map((n) => {
                  // Handle different notification types
                  let displayMessage = n.message;
                  if (!displayMessage || displayMessage.trim() === '') {
                    switch (n.type) {
                      case 'status_tagged':
                        displayMessage = `${n.sender?.username || 'Someone'} tagged you in a status`;
                        break;
                      case 'status_posted':
                        displayMessage = `${n.sender?.username || 'Someone'} posted a new status`;
                        break;
                      case 'follow':
                        displayMessage = `${n.sender?.username || 'Someone'} started following you`;
                        break;
                      case 'book_liked':
                        displayMessage = `${n.sender?.username || 'Someone'} liked your book`;
                        break;
                      case 'book_bookmarked':
                        displayMessage = `${n.sender?.username || 'Someone'} bookmarked your book`;
                        break;
                      case 'comment':
                        displayMessage = `${n.sender?.username || 'Someone'} commented on your book`;
                        break;
                      default:
                        displayMessage = 'You have a new notification';
                    }
                  }
                  
                  return (
                    <div key={n._id || n.id} className={`p-3 rounded-lg border transition-colors ${n.isRead ? 'border-gray-100 hover:border-gray-200' : 'border-blue-200 bg-blue-50 hover:border-blue-300'}`}>
                      <p className="text-sm text-gray-900">{displayMessage}</p>
                      {n.createdAt && (
                        <p className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                      )}
                      {n.sender && (
                        <p className="text-xs text-gray-400 mt-1">from {n.sender.username}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="mt-4">
            <SuggestedFollows />
          </div>
        </aside>

        {/* Mobile Notifications Modal */}
        {showMobileNotifications && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowMobileNotifications(false)}>
            <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
                 onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-gray-700" />
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowMobileNotifications(false)}>✕</button>
              </div>
              <div className="space-y-2">
                {!notifications || notifications.length === 0 ? (
                  <div className="text-sm text-gray-500">No notifications</div>
                ) : (
                  [...notifications].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)).map((n) => {
                    // Handle different notification types
                    let displayMessage = n.message;
                    if (!displayMessage || displayMessage.trim() === '') {
                      switch (n.type) {
                        case 'status_tagged':
                          displayMessage = `${n.sender?.username || 'Someone'} tagged you in a status`;
                          break;
                        case 'status_posted':
                          displayMessage = `${n.sender?.username || 'Someone'} posted a new status`;
                          break;
                        case 'follow':
                          displayMessage = `${n.sender?.username || 'Someone'} started following you`;
                          break;
                        case 'book_liked':
                          displayMessage = `${n.sender?.username || 'Someone'} liked your book`;
                          break;
                        case 'book_bookmarked':
                          displayMessage = `${n.sender?.username || 'Someone'} bookmarked your book`;
                          break;
                        case 'comment':
                          displayMessage = `${n.sender?.username || 'Someone'} commented on your book`;
                          break;
                        default:
                          displayMessage = 'You have a new notification';
                      }
                    }
                    
                    return (
                      <div key={n._id || n.id} className={`p-3 rounded-lg border transition-colors ${n.isRead ? 'border-gray-100' : 'border-blue-200 bg-blue-50'}`}>
                        <p className="text-sm text-gray-900">{displayMessage}</p>
                        {n.createdAt && (
                          <p className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        )}
                        {n.sender && (
                          <p className="text-xs text-gray-400 mt-1">from {n.sender.username}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
        {/* Floating Chat Button (outside notifications) */}
        <button
          onClick={() => navigate('/chat')}
          className="hidden md:flex fixed right-4 bottom-6 px-4 py-2 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors items-center gap-2 z-40"
        >
          <MessageCircle className="h-5 w-5" />
          <span>Chat</span>
        </button>
      </div>

      {/* Bottom Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around h-14">
          <NavLink to="/" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <Search className="h-5 w-5" />
            <span className="text-xs">Search</span>
          </NavLink>
          <NavLink to="/books" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <BookOpen className="h-5 w-5" />
            <span className="text-xs">Books</span>
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <Upload className="h-5 w-5" />
            <span className="text-xs">Upload</span>
          </NavLink>
          {user ? (
            <NavLink to='/profile' className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              <User className="h-5 w-5" />
              <span className="text-xs">Profile</span>
            </NavLink>
          ) : (
            <NavLink to='/login' className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              <User className="h-5 w-5" />
              <span className="text-xs">Login</span>
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
