import api from './axiosConfig';

const API_URL = '/likes/';

// Toggle like for a book
const toggleLike = async (bookId) => {
  const response = await api.post(`${API_URL}${bookId}`);
  return response.data;
};

// Check if user liked a book
const checkLike = async (bookId) => {
  const response = await api.get(`${API_URL}book/${bookId}`);
  return response.data;
};

// Get books liked by a user
const getLikedBooks = async (userId, page = 1) => {
  const response = await api.get(`${API_URL}user/${userId}?page=${page}`);
  return response.data;
};

// Get like count for a book
const getLikeCount = async (bookId) => {
  const response = await api.get(`${API_URL}book/${bookId}/count`);
  return response.data;
};

const likeService = {
  toggleLike,
  checkLike,
  getLikedBooks,
  getLikeCount,
};

export default likeService;
