import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserProfile, LoginPayload, SignupPayload } from '@/types';
import {
  authLogin,
  authSignup,
  authVerifyOtp,
  authLogout,
  authGetProfile,
} from '@/api/client';

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
  login: (data: LoginPayload) => Promise<void>;
  signup: (data: SignupPayload) => Promise<void>;
  verifyOtp: (mobile: string, otpCode: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_PROFILE: UserProfile = {
  id: 'guest-smb-demo',
  name: 'Ramesh Sharma',
  business_name: 'Sharma General Store',
  business_type: 'kirana',
  state: 'Delhi',
  mobile: '9876543210',
  email: 'ramesh.sharma@swadeshikhata.in',
  gstin: '07AAAAA0000A1Z5',
  created_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('swadeshi_token') : null;
  });
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const isGuest = localStorage.getItem('swadeshi_is_guest') === 'true';
      if (isGuest) return GUEST_PROFILE;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isGuest = !token && user?.id === GUEST_PROFILE.id;
  const isAuthenticated = Boolean(token || isGuest);

  const fetchProfile = useCallback(async () => {
    const savedToken = localStorage.getItem('swadeshi_token');
    const guestFlag = localStorage.getItem('swadeshi_is_guest') === 'true';

    if (guestFlag && !savedToken) {
      setUser(GUEST_PROFILE);
      setIsLoading(false);
      return;
    }

    if (!savedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await authGetProfile();
      setUser(profile);
    } catch {
      localStorage.removeItem('swadeshi_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (data: LoginPayload) => {
    setIsLoading(true);
    try {
      const resp = await authLogin(data);
      setToken(resp.access_token);
      setUser(resp.user);
      localStorage.removeItem('swadeshi_is_guest');
      queryClient.invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupPayload) => {
    setIsLoading(true);
    try {
      const resp = await authSignup(data);
      setToken(resp.access_token);
      setUser(resp.user);
      localStorage.removeItem('swadeshi_is_guest');
      queryClient.invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (mobile: string, otpCode: string) => {
    setIsLoading(true);
    try {
      const resp = await authVerifyOtp(mobile, otpCode);
      setToken(resp.access_token);
      setUser(resp.user);
      localStorage.removeItem('swadeshi_is_guest');
      queryClient.invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsGuest = () => {
    localStorage.removeItem('swadeshi_token');
    localStorage.setItem('swadeshi_is_guest', 'true');
    setToken(null);
    setUser(GUEST_PROFILE);
  };

  const logout = async () => {
    try {
      await authLogout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('swadeshi_token');
      localStorage.removeItem('swadeshi_is_guest');
      setToken(null);
      setUser(null);
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        isGuest,
        login,
        signup,
        verifyOtp,
        loginAsGuest,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
