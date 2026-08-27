import axios from 'axios';
import { triggerLogout } from '../lib/authLogout';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach JWT — checks both localStorage (Remember Me on) and sessionStorage (Remember Me off)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 401 handler — skip auth endpoints, delegate logout to Zustand via bridge
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const originalRequest = error.config;

        // Skip 401 interception for auth endpoints to prevent redirect loops
        if (
            originalRequest?.url &&
            (originalRequest.url.includes('/auth/login') ||
                originalRequest.url.includes('/auth/register') ||
                originalRequest.url.includes('/auth/signup'))
        ) {
            return Promise.reject(error);
        }

        if (error.response && error.response.status === 401) {
            triggerLogout(true);
        }
        return Promise.reject(error);
    }
);
