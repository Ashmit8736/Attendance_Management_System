import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  getDemoCredentials: async () => {
    const response = await api.get('/auth/demo-credentials');
    return response.data;
  },
};
