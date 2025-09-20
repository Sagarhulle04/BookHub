import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Edit3, 
  Camera, 
  Heart, 
  Bookmark, 
  UserPlus, 
  UserMinus,
  Settings,
  Grid,
  List,
  Eye,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

import { getLikedBooks } from '../../store/slices/likeSlice';
import { getBookmarkedBooks } from '../../store/slices/bookmarkSlice';
import { getMyUploads } from '../../store/slices/bookSlice';
import BookCard from '../../components/Books/BookCard';
import BookSkeleton from '../../components/UI/BookSkeleton';
import FollowersFollowingModal from '../../components/Profile/FollowersFollowingModal';
import { getCurrentUser, logout } from '../../store/slices/authSlice';
import axios from 'axios';

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { likedBooks, loading: likedLoading } = useSelector((state) => state.likes);
  const { bookmarkedBooks, loading: bookmarkLoading } = useSelector((state) => state.bookmarks);
  const { myUploads, loading: uploadsLoading } = useSelector((state) => state.books);
  const { viewMode } = useSelector((state) => state.ui);

  const [activeTab, setActiveTab] = useState('mybooks');
  const [isMobile, setIsMobile] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    bio: '',
    profilePicture: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('followers');

  useEffect(() => {
    if (user) {
      setEditForm({
        fullName: user.fullName || '',
        username: user.username || '',
        bio: user.bio || '',
        profilePicture: null
      });
    }
  }, [user]);

  // Reset submitting state when modal opens
  useEffect(() => {
    if (showEditModal) {
      setIsSubmitting(false);
    }
  }, [showEditModal]);

  useEffect(() => {
    if (user) {
      dispatch(getLikedBooks({ userId: user._id, page: 1 }));
      dispatch(getBookmarkedBooks({ userId: user._id, page: 1, folder: 'all' }));
      dispatch(getMyUploads({ page: 1, limit: 12 }));
    }
  }, [dispatch, user]);

  // Track mobile viewport to adjust available tabs
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    // Basic validation
    if (!editForm.fullName || !editForm.username) {
      toast.error('Full name and username are required');
      return;
    }
    
    if (editForm.fullName.length < 2 || editForm.fullName.length > 50) {
      toast.error('Full name must be between 2 and 50 characters');
      return;
    }
    
    if (editForm.username.length < 3 || editForm.username.length > 30) {
      toast.error('Username must be between 3 and 30 characters');
      return;
    }
    
    if (editForm.bio && editForm.bio.length > 500) {
      toast.error('Bio cannot exceed 500 characters');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const form = new FormData();
      // Always append fields so backend can set empty values if needed
      form.append('fullName', editForm.fullName || '');
      form.append('username', editForm.username || '');
      form.append('bio', typeof editForm.bio === 'string' ? editForm.bio : '');
      if (editForm.profilePicture) {
        form.append('image', editForm.profilePicture);
      }

      console.log('Submitting profile update:', {
        fullName: editForm.fullName,
        username: editForm.username,
        bio: editForm.bio,
        hasImage: !!editForm.profilePicture
      });

      const response = await axios.put('/api/users/profile', form, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Profile update response:', response.data);

      toast.success('Profile updated successfully');
      setShowEditModal(false);
      // Refresh auth user
      dispatch(getCurrentUser());
    } catch (err) {
      console.error('Profile update error:', err);
      const message = err?.response?.data?.message || err?.message || 'Update failed';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditForm(prev => ({ ...prev, profilePicture: file }));
      // Auto-upload image immediately for quick update UX
      try {
        const form = new FormData();
        form.append('fullName', editForm.fullName || '');
        form.append('username', editForm.username || '');
        form.append('bio', typeof editForm.bio === 'string' ? editForm.bio : '');
        form.append('image', file);
        await axios.put('/api/users/profile', form, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Profile picture updated');
        dispatch(getCurrentUser());
      } catch (err) {
        const message = err?.response?.data?.message || err?.message || 'Image upload failed';
        toast.error(message);
      }
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
    { id: 'mybooks', label: 'My Books', icon: Upload, count: myUploads.length },
    { id: 'liked', label: 'Liked Books', icon: Heart, count: likedBooks.length },
    { id: 'bookmarked', label: 'Bookmarked', icon: Bookmark, count: bookmarkedBooks.length },
  ];

  const visibleTabs = isMobile ? tabs.filter(t => t.id === 'mybooks') : tabs;

  // no dropdown menu handling (navigates to a separate page)

  const renderContent = () => {
    switch (activeTab) {
      case 'mybooks':
        return (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2' 
              : 'grid-cols-1'
          }`}>
            {uploadsLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <BookSkeleton key={index} viewMode={viewMode} />
              ))
            ) : myUploads.length > 0 ? (
              myUploads.map((book, index) => (
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
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No books uploaded yet
                </h3>
                <p className="text-gray-500">
                  Books you upload will appear here
                </p>
              </div>
            )}
          </div>
        );

      case 'liked':
        return (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2' 
              : 'grid-cols-1'
          }`}>
            {likedLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <BookSkeleton key={index} viewMode={viewMode} />
              ))
            ) : likedBooks.length > 0 ? (
              likedBooks.map((book, index) => (
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
                <Heart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No liked books yet
                </h3>
                <p className="text-gray-500">
                  Books you like will appear here
                </p>
              </div>
            )}
          </div>
        );

      case 'bookmarked':
        return (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2' 
              : 'grid-cols-1'
          }`}>
            {bookmarkLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <BookSkeleton key={index} viewMode={viewMode} />
              ))
            ) : bookmarkedBooks.length > 0 ? (
              bookmarkedBooks.map((bookmark, index) => (
                <motion.div
                  key={bookmark._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <BookCard book={bookmark.book} viewMode={viewMode} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Bookmark className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No bookmarked books yet
                </h3>
                <p className="text-gray-500">
                  Books you bookmark will appear here
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please login</h2>
          <p className="text-gray-600">You need to be logged in to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 sm:p-8 mb-8"
        >
          {/* Top bar: username + go-to menu page */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm sm:text-base text-gray-600">@{user.username}</div>
            <button
              onClick={() => navigate('/profile/menu')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Menu
            </button>
          </div>
          {/* Top row: Avatar on left, Name + counts on right */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Avatar */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={user.profilePicture || '/default-avatar.png'}
                  alt={user.username}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <input id="profile-image-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button type="button" onClick={() => document.getElementById('profile-image-input').click()} className="absolute bottom-0 right-0 bg-primary-500 text-white p-2 rounded-full hover:bg-primary-600 transition-colors">
                  <Camera size={16} />
                </button>
              </div>

              {/* Right of avatar: Full name and counts */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {user.fullName || user.username}
                </h1>
                <div className="flex items-center gap-6 mt-3">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-semibold text-gray-900">{myUploads.length}</div>
                    <div className="text-xs text-gray-500">Posts</div>
                  </div>
                  <button
                    onClick={() => handleOpenModal('followers')}
                    className="text-center hover:opacity-75 transition-opacity cursor-pointer"
                  >
                    <div className="text-lg sm:text-xl font-semibold text-gray-900">{user.followers?.length || 0}</div>
                    <div className="text-xs text-gray-500">Followers</div>
                  </button>
                  <button
                    onClick={() => handleOpenModal('following')}
                    className="text-center hover:opacity-75 transition-opacity cursor-pointer"
                  >
                    <div className="text-lg sm:text-xl font-semibold text-gray-900">{user.following?.length || 0}</div>
                    <div className="text-xs text-gray-500">Following</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bio below image */}
          {user.bio && (
            <div className="mt-5">
              <p className="text-gray-700 whitespace-pre-line">{user.bio}</p>
            </div>
          )}

          {/* Buttons below bio */}
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex-1 sm:flex-none sm:px-5 sm:py-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 size={18} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={async () => {
                const url = `${window.location.origin}/user/${user.username}`;
                const title = `${user.fullName || user.username} • BookHub`;
                const text = 'Check out my BookHub profile';
                try {
                  if (navigator.share) {
                    await navigator.share({ title, text, url });
                  } else {
                    await navigator.clipboard?.writeText(url);
                    toast.success('Profile link copied to clipboard');
                  }
                } catch (_) {}
              }}
              className="flex-1 sm:flex-none sm:px-5 sm:py-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Share profile"
            >
              Share Profile
            </button>
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
              {visibleTabs.map((tab) => {
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
          
          {(activeTab === 'mybooks' || activeTab === 'liked' || activeTab === 'bookmarked') && (
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

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowEditModal(false);
                setIsSubmitting(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Edit Profile
              </h3>
              
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setIsSubmitting(false);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center ${
                      isSubmitting 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-primary-500 hover:bg-primary-600'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
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

export default Profile;
