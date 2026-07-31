import type { AuthUser } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const parseError = (data: unknown, fallback: string) =>
  data && typeof (data as { detail?: unknown }).detail === 'string'
    ? (data as { detail: string }).detail
    : fallback;

const TOKEN_KEY = 'veritas_access_token';

// Deliberately just a thin wrapper around localStorage rather than React
// state: the token needs to be readable by services/api.ts's plain fetch
// calls too, outside any component tree.
export const TokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const AuthAPI = {
  register: async (email: string, password: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(data, 'Registration failed.'));
    return data;
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify?token=${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(data, 'Verification failed.'));
    return data;
  },

  login: async (email: string, password: string): Promise<{ access_token: string; user: AuthUser }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(data, 'Login failed.'));
    return data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(data, 'Request failed.'));
    return data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(parseError(data, 'Reset failed.'));
    return data;
  },

  me: async (token: string): Promise<AuthUser> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Session expired.');
    return response.json();
  },
};
