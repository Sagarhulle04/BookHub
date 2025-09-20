import api from './axiosConfig';

const API_URL = '/bookmarks/';

// Toggle bookmark for a book
const toggleBookmark = async (bookId, bookmarkData = {}) => {
  const response = await api.post(`${API_URL}${bookId}`, bookmarkData);
  return response.data;
};

// Check if user bookmarked a book
const checkBookmark = async (bookId) => {
  const response = await api.get(`${API_URL}book/${bookId}`);
  return response.data;
};

// Get books bookmarked by a user
const getBookmarkedBooks = async (userId, page = 1, folder = null) => {
  const params = new URLSearchParams({ page });
  if (folder) params.append('folder', folder);
  
  const response = await api.get(`${API_URL}user/${userId}?${params}`);
  return response.data;
};

// Get bookmark folders for a user
const getBookmarkFolders = async (userId) => {
  const response = await api.get(`${API_URL}user/${userId}/folders`);
  return response.data;
};

// Update bookmark details (folder, note)
const updateBookmark = async (bookmarkId, updateData) => {
  const response = await api.put(`${API_URL}${bookmarkId}`, updateData);
  return response.data;
};

// Remove bookmark
const removeBookmark = async (bookmarkId) => {
  const response = await api.delete(`${API_URL}${bookmarkId}`);
  return response.data;
};

// Get bookmark count for a book
const getBookmarkCount = async (bookId) => {
  const response = await api.get(`${API_URL}book/${bookId}/count`);
  return response.data;
};

// Create bookmark folder
const createBookmarkFolder = async (folderData) => {
  const response = await api.post(`${API_URL}folders`, folderData);
  return response.data;
};

// Update bookmark folder
const updateBookmarkFolder = async (folderId, updateData) => {
  const response = await api.put(`${API_URL}folders/${folderId}`, updateData);
  return response.data;
};

// Delete bookmark folder
const deleteBookmarkFolder = async (folderId) => {
  const response = await api.delete(`${API_URL}folders/${folderId}`);
  return response.data;
};

const bookmarkService = {
  toggleBookmark,
  checkBookmark,
  getBookmarkedBooks,
  getBookmarkFolders,
  updateBookmark,
  removeBookmark,
  getBookmarkCount,
  createBookmarkFolder,
  updateBookmarkFolder,
  deleteBookmarkFolder,
};

export default bookmarkService;
