import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Bookmark, 
  MessageCircle, 
  UserPlus, 
  UserMinus,
  Grid,
  List,
  Eye,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

import { getBooks } from '../../store/slices/bookSlice';
import BookCard from '../../components/Books/BookCard';
import BookSkeleton from '../../components/UI/BookSkeleton';
import FollowersFollowingModal from '../../components/Profile/FollowersFollowingModal';
import userService from '../../services/userService';
import { getCurrentUser } from '../../store/slices/authSlice';

const UserProfile = () => {
  const { username } = useParams();
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { books, loading } = useSelector((state) => state.books);
  const { viewMode } = useSelector((state) => state.ui);

  const [user, setUser] = useState(null);
  const [userBooks, setUserBooks] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('books');
  const [loadingUser, setLoadingUser] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('followers');

  useEffect(() => {
    if (username) {
      fetchUserProfile();
    }
  }, [username]);

  useEffect(() => {
    // Recompute following state whenever currentUser or viewed user changes
    if (currentUser?._id && user?._id) {
      const followingIds = (currentUser.following || [])
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            if (entry._id) return String(entry._id);
          }
          try { return entry?.toString?.(); } catch (_) { return null; }
        })
        .filter(Boolean);
      setIsFollowing(followingIds.includes(String(user._id)));
    } else {
      setIsFollowing(false);
    }
  }, [currentUser?._id, currentUser?.following, user?._id]);

  const fetchUserProfile = async () => {
    try {
      setLoadingUser(true);
      const data = await userService.getUserByUsername(username);
      setUser(data);
      // Load books after user is known
      try {
        const res = await userService.getUserBooks(data.username, 1);
        setUserBooks(res?.books || res || []);
      } catch (_) {
        setUserBooks([]);
      }
    } catch (error) {
      toast.error('Failed to load user profile');
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchUserBooks = async () => {};

  const handleFollow = async () => {
    if (!currentUser) {
      toast.error('Please login to follow users');
      return;
    }
    if (!user?._id) return;
    try {
      // Optimistic toggle for instant UI feedback
      setIsFollowing((prev) => !prev);
      if (isFollowing) {
        await userService.unfollowUser(user._id);
      } else {
        await userService.followUser(user._id);
      }
      // Refresh auth user to persist following across refresh and recompute state
      await dispatch(getCurrentUser());
      // Optionally refresh viewed user to update follower count
      const refreshed = await userService.getUserByUsername(username);
      setUser(refreshed);
      toast.success(isFollowing ? 'Unfollowed successfully' : 'Followed successfully');
    } catch (error) {
      // Revert optimistic toggle on failure
      setIsFollowing((prev) => !prev);
      toast.error('Failed to update follow status');
    }
  };

  const handleOpenModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const tabs = [
    { id: 'books', label: 'Books', icon: Bookmark, count: userBooks.length },
    { id: 'liked', label: 'Liked Books', icon: Heart, count: 0 },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'books':
        return (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <BookSkeleton key={index} viewMode={viewMode} />
              ))
            ) : userBooks.length > 0 ? (
              userBooks.map((book, index) => (
                <motion.div
                  key={book._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <BookCard book={book} viewMode={viewMode} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Bookmark className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No books uploaded yet
                </h3>
                <p className="text-gray-500">
                  {user?.username} hasn't uploaded any books yet
                </p>
              </div>
            )}
          </div>
        );

      case 'liked':
        return (
          <div className="text-center py-12">
            <Heart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Liked books are private
            </h3>
            <p className="text-gray-500">
              You can only see your own liked books
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4">
          <div className="animate-pulse">
            <div className="card p-8 mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
                <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="flex space-x-6">
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">User not found</h2>
          <p className="text-gray-600">The user you're looking for doesn't exist</p>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?._id === user._id;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 mb-8"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            {/* Profile Picture */}
            <div className="relative">
              <img
                src={user.profilePicture || '/default-avatar.png'}
                alt={user.username}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {user.username}
                  </h1>
                  <p className="text-gray-600 mb-2">{user.email}</p>
                  {user.bio && (
                    <p className="text-gray-700 max-w-md mb-2">{user.bio}</p>
                  )}
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <Calendar size={16} />
                    <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                {!isOwnProfile && currentUser && (
                  <button
                    onClick={handleFollow}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors mt-4 md:mt-0 ${
                      isFollowing
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus size={18} />
                        <span>Unfollow</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-6 mt-6">
                <button
                  onClick={() => handleOpenModal('followers')}
                  className="text-center hover:opacity-75 transition-opacity cursor-pointer"
                >
                  <div className="text-2xl font-bold text-gray-900">
                    {user.followers?.length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Followers</div>
                </button>
                <button
                  onClick={() => handleOpenModal('following')}
                  className="text-center hover:opacity-75 transition-opacity cursor-pointer"
                >
                  <div className="text-2xl font-bold text-gray-900">
                    {user.following?.length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Following</div>
                </button>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {userBooks.length}
                  </div>
                  <div className="text-sm text-gray-500">Books</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </motion.div>

        {/* View Mode Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 capitalize">
            {tabs.find(tab => tab.id === activeTab)?.label}
          </h2>
          
          {activeTab !== 'liked' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => dispatch({ type: 'ui/setViewMode', payload: 'grid' })}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-primary-100 text-primary-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => dispatch({ type: 'ui/setViewMode', payload: 'list' })}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-primary-100 text-primary-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <List size={18} />
              </button>
            </div>
          )}
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </div>

      {/* Followers/Following Modal */}
      <FollowersFollowingModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        type={modalType}
        userId={user?._id}
        username={user?.username}
      />
    </div>
  );
};

export default UserProfile;
