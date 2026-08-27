import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '../api/auth';
import { queryClient } from '../lib/queryClient';
import { registerLogout } from '../lib/authLogout';

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    lastLogin: string;
}

interface AuthState {
    token: string | null;
    role: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    login: (credentials: any, rememberMe?: boolean) => Promise<void>;
    logout: (expired?: boolean) => void;
    initialize: () => void;
}

/** Build a display name from whatever the JWT gives us */
function extractDisplayName(decoded: any, emailFallback: string): string {
    // Prefer explicit name field (set if backend embeds it)
    if (decoded.name && typeof decoded.name === 'string' && !decoded.name.includes('-')) {
        // looks like a real name, not a UUID
        const parts = decoded.name.trim().split(/\s+/);
        return parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    // Fallback: derive from email local part
    const local = emailFallback.split('@')[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Generate proper initials from a display name */
export function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return (words[0]?.[0] || '?').toUpperCase();
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    role: null,
    user: null,
    isAuthenticated: false,
    isAuthLoading: true,

    login: async (credentials, rememberMe = false) => {
        const res = await AuthService.login(credentials);
        const token = res.access_token;
        const storage = rememberMe ? localStorage : sessionStorage;

        // Clear the other storage to avoid stale tokens from previous user
        if (rememberMe) {
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('refresh_token');
        } else {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }

        storage.setItem('access_token', token);
        if (res.refresh_token) {
            storage.setItem('refresh_token', res.refresh_token);
        }

        // Invalidate all previous user's cached query data
        queryClient.clear();

        // Prefer the user object returned directly from login (fresh from MongoDB)
        // Fall back to JWT decode if not present (e.g. old backend)
        let user: User;
        if (res.user?.name && res.user?.email) {
            user = {
                id: res.user.id || '',
                name: res.user.name,
                email: res.user.email,
                role: res.user.role || 'User',
                status: 'Online',
                lastLogin: 'Just now',
            };
        } else {
            // JWT decode fallback
            let roleName = 'User';
            let email = credentials.username || credentials.email || '';
            let name = '';
            let userId = '';
            try {
                const decoded: any = jwtDecode(token);
                roleName = decoded.role || 'User';
                email = decoded.email || email;
                name = extractDisplayName(decoded, email);
                userId = decoded.sub || '';
            } catch {
                name = extractDisplayName({}, email);
            }
            user = { id: userId, name, email, role: roleName, status: 'Online', lastLogin: 'Just now' };
        }

        set({ token, role: user.role, user, isAuthenticated: true, isAuthLoading: false });

        // Hydrate with /auth/me to guarantee DB-fresh identity (async, non-blocking)
        AuthService.me().then((meRes) => {
            if (meRes?.user) {
                set((state) => ({
                    user: {
                        ...state.user!,
                        id: meRes.user.id,
                        name: meRes.user.name,
                        email: meRes.user.email,
                        role: meRes.user.role,
                    },
                    role: meRes.user.role,
                }));
            }
        }).catch(() => { /* /me failed — JWT-decoded user is still shown, that's fine */ });
    },


    logout: (expired = false) => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');

        queryClient.clear();
        set({ token: null, role: null, user: null, isAuthenticated: false, isAuthLoading: false });

        // Use React Router navigation instead of window.location to avoid full page reload
        // We set a flag that App.tsx's <Navigate> catches reactively
        // The location change happens passively when isAuthenticated flips to false
        if (expired && window.location.pathname !== '/login') {
            // Expired needs the query param — use replace to avoid history stack pollution
            const url = new URL('/login', window.location.origin);
            url.searchParams.set('expired', 'true');
            window.history.replaceState({}, '', url.toString());
            // Dispatch a popstate to signal React Router
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
        // Non-expired: ProtectedRoute will react to isAuthenticated=false and redirect
    },

    initialize: () => {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                if (decoded.exp * 1000 < Date.now()) {
                    throw new Error('Expired token');
                }
                const roleName = decoded.role || 'User';
                const email = decoded.email || decoded.sub || '';
                const name = extractDisplayName(decoded, email);
                const userId = decoded.sub || '';

                set({
                    token,
                    role: roleName,
                    user: {
                        id: userId,
                        name,
                        email,
                        role: roleName,
                        status: 'Online',
                        lastLogin: 'Session restored'
                    },
                    isAuthenticated: true,
                    isAuthLoading: false
                });
            } catch {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                sessionStorage.removeItem('access_token');
                sessionStorage.removeItem('refresh_token');
                queryClient.clear();
                set({ token: null, role: null, user: null, isAuthenticated: false, isAuthLoading: false });
            }
        } else {
            set({ isAuthLoading: false });
        }
    }
}));

// Register the logout function with the bridge so axiosInstance.ts
// can trigger a clean Zustand logout without a circular import.
registerLogout((expired) => useAuthStore.getState().logout(expired));
