import api from './axiosInstance';

export const ResourceService = {
    getDashboardSummary: async () => {
        const response = await api.get('/resources/dashboard/summary');
        return response.data;
    },
    search: async (q: string, skip = 0, limit = 100) => {
        const response = await api.get('/resources/search', { params: { q, skip, limit } });
        return response.data;
    },
    filter: async (params: any) => {
        const response = await api.get('/resources/filter', { params });
        return response.data;
    },
    getAll: async (skip = 0, limit = 100, sortBy = "created_at", descending = true) => {
        const response = await api.get('/resources', { params: { skip, limit, sort_by: sortBy, descending } });
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get(`/resources/${id}`);
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/resources', data);
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await api.put(`/resources/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete(`/resources/${id}`);
        return response.data;
    }
};
