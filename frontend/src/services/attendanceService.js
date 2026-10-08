import api from './api';

export const attendanceService = {
  clockIn: async (notes = '') => {
    const response = await api.post('/attendance/clock-in', { notes });
    return response.data;
  },

  clockOut: async (notes = '') => {
    const response = await api.post('/attendance/clock-out', { notes });
    return response.data;
  },

  getTodayStatus: async () => {
    const response = await api.get('/attendance/today');
    return response.data;
  },

  getHistory: async (params = {}) => {
    const response = await api.get('/attendance/history', { params });
    return response.data;
  },

  getMetrics: async (params = {}) => {
    const response = await api.get('/attendance/metrics', { params });
    return response.data;
  },
};
