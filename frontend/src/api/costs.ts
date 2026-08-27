import api from './axiosInstance';

export const CostService = {
    getDashboardSummary: async () => {
        const response = await api.get('/costs/dashboard');
        return response.data;
    },
    getMonthly: async (billingPeriod: string, skip = 0, limit = 100) => {
        const response = await api.get('/costs/monthly', { params: { billing_period: billingPeriod, skip, limit } });
        return response.data;
    },
    getByProvider: async (providerId: string) => {
        const response = await api.get(`/costs/provider/${providerId}`);
        return response.data;
    },
    getByResource: async (resourceId: string) => {
        const response = await api.get(`/costs/resource/${resourceId}`);
        return response.data;
    },
    getAll: async (skip = 0, limit = 100) => {
        const response = await api.get('/costs', { params: { skip, limit } });
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get(`/costs/${id}`);
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/costs', data);
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await api.put(`/costs/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete(`/costs/${id}`);
        return response.data;
    }
};
