import api from './axiosConfig';

const create = async ({ bookId, pageNumber, text, note }) => {
  const res = await api.post('/highlights', { bookId, pageNumber, text, note });
  return res.data;
};

const listByBook = async (bookId) => {
  const res = await api.get(`/highlights/book/${bookId}`);
  return res.data;
};

const remove = async (id) => {
  const res = await api.delete(`/highlights/${id}`);
  return res.data;
};

const summarize = async (bookId) => {
  const res = await api.get(`/highlights/book/${bookId}/summary`);
  return res.data;
};

export default { create, listByBook, remove, summarize };


