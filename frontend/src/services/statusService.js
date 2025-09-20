import api from './axiosConfig';

const API_URL = '/status';

const createStatus = async (formData) => {
  const res = await api.post(API_URL, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
};

const getFeed = async () => {
  const res = await api.get(`${API_URL}/feed`);
  return res.data;
};

const markViewed = async (id) => {
  const res = await api.post(`${API_URL}/${id}/view`);
  return res.data;
};

const deleteStatus = async (id) => {
  const res = await api.delete(`${API_URL}/${id}`);
  return res.data;
};

const createReMentionStatus = async (originalStatusId, text) => {
  const res = await api.post(`${API_URL}/re-mention/${originalStatusId}`, { text });
  return res.data;
};

export default { createStatus, getFeed, markViewed, deleteStatus, createReMentionStatus };


