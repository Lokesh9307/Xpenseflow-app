import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { api, getStoredAuth, setStoredAuth, clearStoredAuth, setSessionExpiredHandler } from '../services/api';
import { copilotChatStore } from '../services/copilotChatStore';

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  isOnboarded?: boolean;
  isAdmin?: boolean;
  isVerified?: boolean;
  autoSyncTiffin?: boolean;
  autoSyncSplit?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; email?: string; authFlow?: 'email-link' | 'otp' }>;
  verifyOtp: (email: string, otp: string, type: 'signup' | 'reset') => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  verifyOtp: async () => ({ success: false }),
  logout: async () => {},
  updateUser: () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setSessionExpiredHandler(async () => {
      setToken(null);
      copilotChatStore.clearMemory();
      Alert.alert('Session Expired', 'Please sign in again to continue.');
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // Restore stored session on startup
  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredAuth();
        if (stored.token && stored.user) {
          setToken(stored.token);
          setUser(stored.user);
          // Revise and sync user account data in background on launch
          api.syncUserData().catch((e) => console.log('Initial startup sync:', e));
        }
      } catch (err) {
        console.error('Failed to restore auth session:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const res = await api.login(email, password);
    setIsLoading(false);

    if (res.error) {
      return { success: false, error: res.error };
    }

    if (res.data?.success && res.data?.token) {
      const loggedUser = res.data.user;
      const sessionToken = res.data.token;
      if (user?.id && user.id !== loggedUser.id) {
        await api.clearLocalUserCache();
      }
      setUser(loggedUser);
      setToken(sessionToken);
      await setStoredAuth(sessionToken, loggedUser);

      // Trigger full account sync so all old and existing data is revised & hydrated immediately
      api.syncUserData({ force: true }).catch((err) => {
        console.error('Post-login sync error:', err);
      });

      return { success: true };
    }

    return { success: false, error: 'Login failed. Please check credentials.' };
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    const res = await api.register(name, email, password);
    setIsLoading(false);

    if (res.error) {
      return { success: false, error: res.error };
    }

    const authFlow: 'email-link' | 'otp' =
      res.data?.authFlow === 'email-link' ? 'email-link' : 'otp';
    return {
      success: true,
      email: res.data?.email || email,
      authFlow,
    };
  };

  const verifyOtp = async (email: string, otp: string, type: 'signup' | 'reset') => {
    setIsLoading(true);
    const res = await api.verifyOtp(email, otp, type);
    setIsLoading(false);

    if (res.error) return { success: false, error: res.error };
    return { success: true };
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await clearStoredAuth();
    copilotChatStore.clearMemory();
    await api.clearLocalUserCache();
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (user) {
      const nextUser = { ...user, ...updatedFields };
      setUser(nextUser);
      if (token) {
        setStoredAuth(token, nextUser);
      }
    }
  };

  const refreshUser = async () => {
    const res = await api.getProfile();
    if (res.data?.user) {
      updateUser(res.data.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        verifyOtp,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
