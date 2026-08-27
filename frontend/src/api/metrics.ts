import api from './axiosInstance';

export const MetricService = {
    getDashboardSummary: async () => {
        const response = await api.get('/metrics/dashboard');
        return response.data;
    },
    getLatest: async (resourceId: string) => {
        const response = await api.get(`/metrics/latest/${resourceId}`);
        return response.data;
    },
    getHistory: async (resourceId: string, skip = 0, limit = 200) => {
        const response = await api.get(`/metrics/history/${resourceId}`, { params: { skip, limit } });
        return response.data;
    },
    getAll: async (skip = 0, limit = 100) => {
        const response = await api.get('/metrics', { params: { skip, limit } });
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get(`/metrics/${id}`);
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/metrics', data);
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await api.put(`/metrics/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete(`/metrics/${id}`);
        return response.data;
    }
};
