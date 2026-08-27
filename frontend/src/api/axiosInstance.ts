import axios from 'axios';
import { triggerLogout } from '../lib/authLogout';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.DEV
    ? 'http://localhost:8000/api/v1'
    : (() => {
      throw new Error('VITE_API_BASE_URL must be configured for production');
    })()
);

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request.
// Reads from BOTH localStorage (Remember Me = on) and sessionStorage (Remember Me = off).
api.interceptors.request.use(
  (config) => {
    const tokenFromLocal = localStorage.getItem('access_token');
    const tokenFromSession = sessionStorage.getItem('access_token');
    const token = tokenFromLocal || tokenFromSession;

    // DEBUG: log token state on every request (remove before production)
    if (import.meta.env.DEV) {
      console.log(
        `[Axios] ${config.method?.toUpperCase()} ${config.url}` +
        ` | localStorage: ${tokenFromLocal ? tokenFromLocal.substring(0, 20) + '...' : 'null'}` +
        ` | sessionStorage: ${tokenFromSession ? tokenFromSession.substring(0, 20) + '...' : 'null'}` +
        ` | Sending token: ${token ? 'YES' : 'NO'}`
      );
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 401 response handler
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (import.meta.env.DEV) {
      const status = error.response?.status ?? 'network';
      console.error(`[Axios] ${status} on ${originalRequest?.url}`, error.response?.data);
    }

    // Do not intercept 401s from auth endpoints to avoid redirect loops
    if (
      originalRequest?.url &&
      (originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/signup'))
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Attempt token refresh
      const refreshToken =
        localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refresh_token: refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const newAccessToken = res.data.access_token;
          if (newAccessToken) {
            if (localStorage.getItem('refresh_token')) {
              localStorage.setItem('access_token', newAccessToken);
            } else {
              sessionStorage.setItem('access_token', newAccessToken);
            }
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        } catch {
          // Refresh failed — fall through to logout
        }
      }

      // Delegate clean logout to Zustand via bridge
      triggerLogout(true);
    }

    return Promise.reject(error);
  }
);

export default api;
