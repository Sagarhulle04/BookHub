import api from './axiosConfig';

const API_URL = '/books/';

// Get all books
const getBooks = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.category && filters.category !== 'all') params.append('category', filters.category);
  if (filters.search) params.append('search', filters.search);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const response = await api.get(API_URL, { params });
  return response.data;
};

// Personalized feed
const getFeed = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  const response = await api.get('/books/feed', { params });
  return response.data;
};

// Get book by ID
const getBookById = async (bookId) => {
  const response = await api.get(API_URL + bookId);
  return response.data;
};

// Search books
const searchBooks = async (searchParams = {}) => {
  const params = new URLSearchParams();
  
  if (searchParams.q) params.append('q', searchParams.q);
  if (searchParams.category && searchParams.category !== 'all') params.append('category', searchParams.category);
  if (searchParams.author) params.append('author', searchParams.author);
  if (searchParams.year) params.append('year', searchParams.year);
  if (searchParams.language) params.append('language', searchParams.language);
  if (searchParams.sortBy) params.append('sortBy', searchParams.sortBy);
  if (searchParams.sortOrder) params.append('sortOrder', searchParams.sortOrder);
  if (searchParams.page) params.append('page', searchParams.page);
  if (searchParams.limit) params.append('limit', searchParams.limit);

  const response = await api.get(API_URL + 'search', { params });
  return response.data;
};

// Get book categories
const getCategories = async () => {
  const response = await api.get(API_URL + 'categories');
  return response.data;
};

// Get user's uploaded books
const getMyUploads = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.status) params.append('status', filters.status);

  const response = await api.get(API_URL + 'my-uploads', { params });
  return response.data;
};

// Create book (Authenticated users)
const createBook = async (bookData) => {
  const response = await api.post(API_URL, bookData);
  return response.data;
};

// Update book (Admin only)
const updateBook = async ({ bookId, bookData }) => {
  const response = await api.put(API_URL + bookId, bookData);
  return response.data;
};

// Delete book (Admin only)
const deleteBook = async (bookId) => {
  const response = await api.delete(API_URL + bookId);
  return response.data;
};

// Share book globally (Admin only)
const shareBookGlobally = async (bookId) => {
  const response = await api.post(API_URL + bookId + '/share-globally');
  return response.data;
};

// Unshare book globally (Admin only)
const unshareBookGlobally = async (bookId) => {
  const response = await api.delete(API_URL + bookId + '/share-globally');
  return response.data;
};

// Toggle global visibility (Admin only)
const toggleGlobalVisibility = async (bookId) => {
  const response = await api.post(API_URL + bookId + '/toggle-global');
  return response.data;
};

// Get ML-based recommendations
const getRecommendations = async (limit = 10) => {
  const response = await api.get(API_URL + 'recommendations', {
    params: { limit }
  });
  return response.data;
};

// Detect category for a book
const detectCategory = async (title, description = '') => {
  const response = await api.post(API_URL + 'detect-category', {
    title,
    description
  });
  return response.data;
};

// Analyze a book for category detection
const analyzeBook = async (bookId) => {
  const response = await api.post(API_URL + 'analyze', {
    bookId
  });
  return response.data;
};

const bookService = {
  getBooks,
  getBookById,
  searchBooks,
  getCategories,
  getMyUploads,
  createBook,
  updateBook,
  deleteBook,
  getFeed,
  shareBookGlobally,
  unshareBookGlobally,
  toggleGlobalVisibility,
  getRecommendations,
  detectCategory,
  analyzeBook,
};

export default bookService;
