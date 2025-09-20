import api from './axiosConfig';

const API_URL = '/chats';

const listConversations = async () => {
  const res = await api.get(API_URL);
  return res.data;
};

const openConversation = async (userId) => {
  const res = await api.post(`${API_URL}/open`, { userId });
  return res.data;
};

const listMessages = async (conversationId, page = 1, limit = 30) => {
  const res = await api.get(`${API_URL}/${conversationId}/messages`, { params: { page, limit } });
  return res.data;
};

const sendMessage = async (conversationId, { text, bookId, statusId }) => {
  const res = await api.post(`${API_URL}/${conversationId}/messages`, { text, bookId, statusId });
  return res.data;
};

const markConversationRead = async (conversationId) => {
  const res = await api.patch(`${API_URL}/${conversationId}/read`);
  return res.data;
};

const deleteMessageForMe = async (conversationId, messageId) => {
  const res = await api.delete(`${API_URL}/${conversationId}/messages/${messageId}`);
  return res.data;
};

const deleteMessageForEveryone = async (conversationId, messageId) => {
  const res = await api.delete(`${API_URL}/${conversationId}/messages/${messageId}/everyone`);
  return res.data;
};

const listSharedRecipients = async () => {
  const res = await api.get(`${API_URL}/shared/sent`);
  return res.data;
};

const deleteAllMessages = async (conversationId) => {
  console.log('Calling deleteAllMessages API with conversationId:', conversationId);
  console.log('API URL:', `${API_URL}/${conversationId}/messages/all`);
  const res = await api.delete(`${API_URL}/${conversationId}/messages/all`);
  console.log('Delete all messages API response:', res.data);
  return res.data;
};

export default {
  listConversations,
  openConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
  listSharedRecipients,
  deleteAllMessages,
};


