import api from './axiosConfig';

const API_URL = '/user-preferences';

// Get user preferences
const getPreferences = async () => {
  const response = await api.get(API_URL);
  return response.data;
};

// Complete onboarding
const completeOnboarding = async (preferences) => {
  const response = await api.post(`${API_URL}/onboarding`, preferences);
  return response.data;
};

// Update user preferences
const updatePreferences = async (preferences) => {
  const response = await api.put(API_URL, preferences);
  return response.data;
};

// Get personalized recommendations
const getRecommendations = async (limit = 10) => {
  const response = await api.get(`${API_URL}/recommendations`, {
    params: { limit }
  });
  return response.data;
};

// Get available categories
const getCategories = async () => {
  const response = await api.get(`${API_URL}/categories`);
  return response.data;
};

const userPreferencesService = {
  getPreferences,
  completeOnboarding,
  updatePreferences,
  getRecommendations,
  getCategories
};

export default userPreferencesService;
