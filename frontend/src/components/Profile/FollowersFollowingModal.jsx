import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, UserMinus, User } from 'lucide-react';
import userService from '../../services/userService';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const FollowersFollowingModal = ({ isOpen, onClose, type, userId, username }) => {
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.auth);
  
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [followingStatus, setFollowingStatus] = useState({});

  useEffect(() => {
    if (isOpen && userId) {
      fetchUsers(false);
    }
  }, [isOpen, userId, type]);

  useEffect(() => {
    // Filter users based on search query
    if (searchQuery.trim()) {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  useEffect(() => {
    // Update following status when currentUser changes
    if (currentUser && users.length > 0) {
      const status = {};
      users.forEach(user => {
        const isFollowing = currentUser.following?.some(followingId => 
          followingId.toString() === user._id.toString()
        );
        status[user._id] = isFollowing;
      });
      setFollowingStatus(status);
    }
  }, [currentUser, users]);

  const fetchUsers = async (resetPage = false) => {
    setLoading(true);
    try {
      const currentPage = resetPage ? 1 : page;
      const response = type === 'followers' 
        ? await userService.getFollowers(userId, currentPage)
        : await userService.getFollowing(userId, currentPage);
      
      // Ensure we always have an array - handle both response formats
      let usersData = [];
      if (Array.isArray(response)) {
        usersData = response;
      } else if (response?.users) {
        usersData = response.users;
      } else if (response?.followers) {
        usersData = response.followers;
      } else if (response?.following) {
        usersData = response.following;
      }
      
      if (currentPage === 1 || resetPage) {
        setUsers(usersData);
        if (resetPage) {
          setPage(1);
        }
      } else {
        setUsers(prev => [...prev, ...usersData]);
      }
      
      setHasMore(response?.pagination?.hasNext || false);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
      // Ensure users is always an array even on error
      if (page === 1) {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUserId, isCurrentlyFollowing) => {
    console.log('Follow toggle clicked:', { targetUserId, isCurrentlyFollowing, currentUser: currentUser?._id });
    
    if (!currentUser) {
      toast.error('Please login to follow users');
      return;
    }

    try {
      if (isCurrentlyFollowing) {
        console.log('Unfollowing user:', targetUserId);
        await userService.unfollowUser(targetUserId);
        setFollowingStatus(prev => ({ ...prev, [targetUserId]: false }));
        
        // Update the users list to remove the user from following list if this is a "following" modal
        if (type === 'following') {
          setUsers(prev => prev.filter(user => user._id !== targetUserId));
        }
        
        toast.success('Unfollowed successfully');
      } else {
        console.log('Following user:', targetUserId);
        await userService.followUser(targetUserId);
        setFollowingStatus(prev => ({ ...prev, [targetUserId]: true }));
        
        // If this is a "following" modal and we just followed someone, we might want to add them to the list
        // But since we're viewing our own following list, we don't need to add them here
        // The user will appear in the following list after a refresh
        
        toast.success('Followed successfully');
      }
      
      // Refresh current user to update following/followers counts
      await dispatch(getCurrentUser());
      
      // Refresh the modal data to reflect changes
      if (type === 'following') {
        // For following modal, refetch the data to show updated list
        fetchUsers(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      fetchUsers(false);
    }
  };

  const handleClose = () => {
    setUsers([]);
    setFilteredUsers([]);
    setSearchQuery('');
    setPage(1);
    setHasMore(true);
    setFollowingStatus({});
    onClose();
  };

  const isOwnProfile = currentUser?._id === userId;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">
                {type}
              </h2>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${type}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto">
              {loading && users.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <User size={48} className="mb-2" />
                  <p className="text-sm">
                    {searchQuery ? 'No users found' : `No ${type} yet`}
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {Array.isArray(filteredUsers) && filteredUsers.map((user) => (
                    <motion.div
                      key={user._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User size={20} className="text-primary-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.username}</p>
                          {user.fullName && (
                            <p className="text-sm text-gray-500">{user.fullName}</p>
                          )}
                        </div>
                      </div>
                      
                      {!isOwnProfile && user._id !== currentUser?._id && (
                        <button
                          onClick={() => handleFollowToggle(user._id, followingStatus[user._id])}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm transition-colors ${
                            followingStatus[user._id]
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-primary-500 text-white hover:bg-primary-600'
                          }`}
                        >
                          {followingStatus[user._id] ? (
                            <>
                              <UserMinus size={14} />
                              <span>Unfollow</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={14} />
                              <span>Follow</span>
                            </>
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))}
                  
                  {/* Load More Button */}
                  {hasMore && (
                    <div className="p-4 text-center">
                      <button
                        onClick={loadMore}
                        disabled={loading}
                        className="text-primary-500 hover:text-primary-600 text-sm font-medium disabled:opacity-50"
                      >
                        {loading ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FollowersFollowingModal;
