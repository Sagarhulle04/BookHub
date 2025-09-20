import api from './axiosConfig';

const API_URL = '/notifications/';

// Get user's notifications
const getNotifications = async (page = 1, limit = 20, unreadOnly = false) => {
  const response = await api.get(API_URL, {
    params: { page, limit, unreadOnly }
  });
  return response.data;
};

// Mark notification as read
const markAsRead = async (notificationId) => {
  const response = await api.put(`${API_URL}${notificationId}/read`);
  return response.data;
};

// Mark all notifications as read
const markAllAsRead = async () => {
  const response = await api.put(`${API_URL}read-all`);
  return response.data;
};

// Delete a notification
const deleteNotification = async (notificationId) => {
  const response = await api.delete(`${API_URL}${notificationId}`);
  return response.data;
};

// Delete all notifications
const deleteAllNotifications = async () => {
  const response = await api.delete(API_URL);
  return response.data;
};

const notificationService = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};

export default notificationService;
