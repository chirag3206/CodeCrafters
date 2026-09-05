import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../services/api';
import type { AuthUser, UserRole } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  switchPersona: (key: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const _applyAuth = (data: AuthUser) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    _applyAuth(res.data);
  };

  const switchPersona = async (key: string) => {
    const res = await authApi.switchPersona(key);
    _applyAuth(res.data);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasRole = (...roles: UserRole[]) => {
    return user ? roles.includes(user.role) : false;
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<string> => {
    const res = await authApi.changePassword(currentPassword, newPassword, confirmPassword);
    return res.data.message as string;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, switchPersona, logout, hasRole, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
