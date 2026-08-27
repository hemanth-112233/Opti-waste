import api from './axiosInstance';

export const AuthService = {
    login: async (data: any) => {
        const response = await api.post('/auth/login', data);
        return response.data;
    },
    register: async (data: any) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
    me: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },
    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    }
};
