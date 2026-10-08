import api from './api';

export const correctionService = {
  createRequest: async (data) => {
    const response = await api.post('/corrections', data);
    return response.data;
  },

  getRequests: async (params = {}) => {
    const response = await api.get('/corrections', { params });
    return response.data;
  },

  reviewRequest: async (id, { status, review_note }) => {
    const response = await api.patch(`/corrections/${id}/review`, { status, review_note });
    return response.data;
  },
};
