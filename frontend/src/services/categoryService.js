import api from './axiosConfig';

const API_URL = '/books';

// Detect book category using ML
const detectCategory = async (title, description = '') => {
  const response = await api.post(`${API_URL}/detect-category`, {
    title,
    description
  });
  return response.data;
};

// Get all available categories
const getCategories = async () => {
  const response = await api.get(`${API_URL}/categories`);
  return response.data;
};

const categoryService = {
  detectCategory,
  getCategories
};

export default categoryService;
