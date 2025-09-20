import api from './axiosConfig';

const API_URL = '/auth/';

// Register user
const register = async (userData) => {
  try {
    const response = await api.post(API_URL + 'signup', userData);
    if (response.data) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    // Re-throw the error so it can be handled by the Redux slice
    throw error;
  }
};

// Login user
const login = async (userData) => {
  try {
    const response = await api.post(API_URL + 'login', userData);
    if (response.data) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    // Re-throw the error so it can be handled by the Redux slice
    throw error;
  }
};

// Logout user
const logout = async () => {
  try {
    await api.post(API_URL + 'logout');
  } catch (error) {
    console.error('Logout error:', error);
  }
  localStorage.removeItem('user');
};

// Get current user
const getCurrentUser = async () => {
  try {
    const response = await api.get(API_URL + 'me');
    if (response.data) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
  } catch (error) {
    // Re-throw the error so it can be handled by the Redux slice
    throw error;
  }
};

// Refresh token
const refreshToken = async () => {
  try {
    const response = await api.post(API_URL + 'refresh');
    return response.data;
  } catch (error) {
    // Re-throw the error so it can be handled by the Redux slice
    throw error;
  }
};

// Forgot password
const forgotPassword = async (email) => {
  try {
    const response = await api.post(API_URL + 'forgot-password', { email });
    return response.data;
  } catch (error) {
    // Re-throw the error so it can be handled by the Redux slice
    throw error;
  }
};

// Reset password
const resetPassword = async (token, password) => {
  try {
    const response = await api.post(API_URL + 'reset-password', { token, password });
    return response.data;
  } catch (error) {
    // Re-throw the error so it can be handled by the Redux slice
    throw error;
  }
};

// OTP verification functions
export const signup = async (payload) => {
  const res = await api.post(`${API_URL}signup`, payload);
  return res.data;
};

export const verifyOtp = async (userId, code) => {
  const res = await api.post(`${API_URL}verify-otp`, { userId, code });
  return res.data;
};

export const resendOtp = async (userId) => {
  const res = await api.post(`${API_URL}resend-otp`, { userId });
  return res.data;
};

export const cleanupUnverified = async () => {
  const res = await api.post(`${API_URL}cleanup-unverified`);
  return res.data;
};

const authService = {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  forgotPassword,
  resetPassword,
  signup,
  verifyOtp,
  resendOtp,
  cleanupUnverified,
};

export default authService;
