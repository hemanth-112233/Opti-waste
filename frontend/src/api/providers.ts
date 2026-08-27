import api from './axiosInstance';

export const ProviderService = {
    getAll: async (skip = 0, limit = 100) => {
        const response = await api.get('/providers', { params: { skip, limit } });
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get(`/providers/${id}`);
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/providers', data);
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await api.put(`/providers/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete(`/providers/${id}`);
        return response.data;
    }
};
