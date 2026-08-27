/**
 * authLogout.ts
 *
 * A thin bridge that allows axiosInstance.ts to trigger a logout without
 * creating a circular import between api/axiosInstance → store/useAuthStore.
 *
 * Usage: the Zustand store calls `registerLogout` once on initialisation;
 * the Axios interceptor then calls `triggerLogout` without knowing about Zustand.
 */

type LogoutFn = (expired?: boolean) => void;

let _logout: LogoutFn | null = null;

export function registerLogout(fn: LogoutFn) {
    _logout = fn;
}

export function triggerLogout(expired = false) {
    if (_logout) {
        _logout(expired);
    } else {
        // Fallback: clear storage manually if store hasn't registered yet
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        if (window.location.pathname !== '/login') {
            window.location.href = expired ? '/login?expired=true' : '/login';
        }
    }
}
