import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { initAPI } from '../api/woocommerce';

const AppContext = createContext(null);

const STORAGE_KEY = 'wc_credentials';

export const AppProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredCredentials();
  }, []);

  const loadStoredCredentials = async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const creds = JSON.parse(stored);
        initAPI(creds.siteUrl, creds.consumerKey, creds.consumerSecret);
        setCredentials(creds);
        setIsLoggedIn(true);
      }
    } catch (e) {
      console.warn('Kimlik bilgileri yüklenemedi:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (siteUrl, consumerKey, consumerSecret) => {
    const creds = { siteUrl, consumerKey, consumerSecret };
    initAPI(siteUrl, consumerKey, consumerSecret);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(creds));
    setCredentials(creds);
    setIsLoggedIn(true);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setCredentials(null);
    setIsLoggedIn(false);
  };

  return (
    <AppContext.Provider value={{ isLoggedIn, credentials, isLoading, login, logout }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
