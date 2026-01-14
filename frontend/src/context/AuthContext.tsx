import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { notificationService } from '../services/notifications';
import { useRouter } from 'expo-router';

interface Location {
  latitude: number;
  longitude: number;
}

interface Retailer {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  location: Location;
  zone_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  token: string | null;
  phone: string | null;
  retailer: Retailer | null;
  login: (token: string, isNewUser: boolean, retailerId: string | null) => Promise<void>;
  logout: () => Promise<void>;
  setRetailer: (retailer: Retailer) => void;
}

// Admin phone numbers
const ADMIN_PHONES = ['9999999999', '8888888888', '1234567890'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [retailer, setRetailerState] = useState<Retailer | null>(null);
  const router = useRouter();

  const isAdmin = phone ? ADMIN_PHONES.includes(phone) : false;

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Register push token when auth state changes
  useEffect(() => {
    if (token && phone) {
      // Small delay to ensure API is set up
      setTimeout(() => {
        notificationService.savePushToken(ADMIN_PHONES.includes(phone));
      }, 1000);
    }
  }, [token, phone]);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedPhone = await AsyncStorage.getItem('auth_phone');
      
      if (storedToken && storedPhone) {
        setToken(storedToken);
        setPhone(storedPhone);
        api.setToken(storedToken);
        
        // Check if admin - admins don't need retailer profile
        if (ADMIN_PHONES.includes(storedPhone)) {
          console.log('Admin user detected, skipping retailer fetch');
        } else {
          // Try to fetch retailer details for non-admin users
          try {
            const retailerData = await api.getCurrentRetailer();
            setRetailerState(retailerData);
          } catch (error) {
            // Retailer not found - might be new user or token expired
            console.log('Retailer not found, might need signup');
            // Clear invalid token for non-admin users without retailer
            // This forces them to login again
          }
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string, isNewUser: boolean, retailerId: string | null) => {
    try {
      // Decode phone from token (simple approach)
      const payload = JSON.parse(atob(newToken.split('.')[1]));
      const userPhone = payload.sub;
      
      await AsyncStorage.setItem('auth_token', newToken);
      await AsyncStorage.setItem('auth_phone', userPhone);
      
      setToken(newToken);
      setPhone(userPhone);
      api.setToken(newToken);
      
      if (!isNewUser && retailerId) {
        const retailerData = await api.getCurrentRetailer();
        setRetailerState(retailerData);
      }

      // Register push token after successful login
      notificationService.savePushToken(ADMIN_PHONES.includes(userPhone));
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_phone');
    setToken(null);
    setPhone(null);
    setRetailerState(null);
    api.setToken(null);
    router.replace('/(auth)/phone');
  };

  const setRetailer = (retailerData: Retailer) => {
    setRetailerState(retailerData);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        isLoading,
        isAdmin,
        token,
        phone,
        retailer,
        login,
        logout,
        setRetailer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
