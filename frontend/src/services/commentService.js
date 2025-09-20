import api from './axiosConfig';

const API_URL = '/comments/';

// Get comments for a book
const getComments = async (bookId, page = 1) => {
  const response = await api.get(`${API_URL}book/${bookId}?page=${page}`);
  return response.data;
};

// Create a new comment
const createComment = async (commentData) => {
  const response = await api.post(API_URL, commentData);
  return response.data;
};

// Update a comment
const updateComment = async (commentId, content) => {
  const response = await api.put(`${API_URL}${commentId}`, { content });
  return response.data;
};

// Delete a comment
const deleteComment = async (commentId) => {
  const response = await api.delete(`${API_URL}${commentId}`);
  return response.data;
};

// Like/unlike a comment
const toggleLike = async (commentId) => {
  const response = await api.post(`${API_URL}${commentId}/like`);
  return response.data;
};

// Get comments by user
const getUserComments = async (userId, page = 1) => {
  const response = await api.get(`${API_URL}user/${userId}?page=${page}`);
  return response.data;
};

const commentService = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  toggleLike,
  getUserComments,
};

export default commentService;
