import api from './axiosConfig';

const API_URL = '/users/';

// Get current user profile
const getCurrentUser = async () => {
  const response = await api.get(API_URL + 'me');
  return response.data;
};

// Update current user profile
const updateProfile = async (userData) => {
  const response = await api.put(API_URL + 'me', userData);
  return response.data;
};

// Upload profile picture
const uploadProfilePicture = async (formData) => {
  const response = await api.post(API_URL + 'me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Get user by username
const getUserByUsername = async (username) => {
  const response = await api.get(API_URL + username);
  return response.data;
};

// Follow a user
const followUser = async (userId) => {
  console.log('Attempting to follow user:', userId);
  try {
    const response = await api.post(API_URL + 'follow/' + userId);
    console.log('Follow response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Follow user error:', error);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Unfollow a user
const unfollowUser = async (userId) => {
  console.log('Attempting to unfollow user:', userId);
  try {
    const response = await api.post(API_URL + 'unfollow/' + userId);
    console.log('Unfollow response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Unfollow user error:', error);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Get user's followers
const getFollowers = async (userId, page = 1) => {
  const response = await api.get(API_URL + userId + '/followers?page=' + page);
  return response.data;
};

// Get user's following
const getFollowing = async (userId, page = 1) => {
  const response = await api.get(API_URL + userId + '/following?page=' + page);
  return response.data;
};

// Get books uploaded by user (by username)
const getUserBooks = async (username, page = 1) => {
  const response = await api.get(API_URL + username + '/books?page=' + page);
  return response.data;
};

// Get user's liked books
const getUserLikedBooks = async (userId, page = 1) => {
  const response = await api.get(API_URL + userId + '/liked-books?page=' + page);
  return response.data;
};

// Get user's bookmarked books
const getUserBookmarkedBooks = async (userId, page = 1) => {
  const response = await api.get(API_URL + userId + '/bookmarked-books?page=' + page);
  return response.data;
};

// Get user's comments
const getUserComments = async (userId, page = 1) => {
  const response = await api.get(API_URL + userId + '/comments?page=' + page);
  return response.data;
};

// Search users
const searchUsers = async (query, page = 1) => {
  const response = await api.get(API_URL + 'search?q=' + encodeURIComponent(query) + '&page=' + page);
  return response.data;
};

// Get user statistics
const getUserStats = async (userId) => {
  const response = await api.get(API_URL + userId + '/stats');
  return response.data;
};

// Update user settings
const updateSettings = async (settings) => {
  const response = await api.put(API_URL + 'me/settings', settings);
  return response.data;
};

// Change password
const changePassword = async (passwordData) => {
  const response = await api.put(API_URL + 'me/password', passwordData);
  return response.data;
};

// Delete account
const deleteAccount = async (password) => {
  const response = await api.delete(API_URL + 'me', { data: { password } });
  return response.data;
};

// Get user activity feed
const getUserActivity = async (userId, page = 1) => {
  const response = await api.get(API_URL + userId + '/activity?page=' + page);
  return response.data;
};

// Block a user
const blockUser = async (userId) => {
  const response = await api.post(API_URL + userId + '/block');
  return response.data;
};

// Unblock a user
const unblockUser = async (userId) => {
  const response = await api.delete(API_URL + userId + '/block');
  return response.data;
};

// Get blocked users
const getBlockedUsers = async (page = 1) => {
  const response = await api.get(API_URL + 'me/blocked?page=' + page);
  return response.data;
};

// Follow suggestions
const getFollowSuggestions = async () => {
  const response = await api.get(API_URL + 'suggestions');
  return response.data;
};

// Presence heartbeat
const ping = async () => {
  const response = await api.post(API_URL + 'me/ping');
  return response.data;
};

// Update favorite categories for current user
const updateFavoriteCategories = async (categories) => {
  const response = await api.put(API_URL + 'me/favorite-categories', { categories });
  return response.data;
};

const userService = {
  getCurrentUser,
  updateProfile,
  uploadProfilePicture,
  getUserByUsername,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getUserBooks,
  getUserLikedBooks,
  getUserBookmarkedBooks,
  getUserComments,
  searchUsers,
  getUserStats,
  updateSettings,
  changePassword,
  deleteAccount,
  getUserActivity,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getFollowSuggestions,
  ping,
  updateFavoriteCategories,
};

export default userService;
