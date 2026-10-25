import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeatureMode = 'expense' | 'tiffin' | 'split';

export interface FeatureMetadata {
  id: FeatureMode;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  iconName: string;
  iconLibrary: 'Ionicons' | 'MaterialCommunityIcons' | 'Feather';
  accentColor: string;
  glowColor: string;
  bgTint: string;
}

export const FEATURE_CONFIGS: Record<FeatureMode, FeatureMetadata> = {
  expense: {
    id: 'expense',
    name: 'Expense Tracker',
    tagline: 'Personal Budgets & AI Analytics',
    badge: 'Personal Finance',
    description: 'Track daily spends, incomes, budgets, recurring bills and get AI-powered financial insights.',
    iconName: 'wallet-outline',
    iconLibrary: 'Ionicons',
    accentColor: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.35)',
    bgTint: 'rgba(139, 92, 246, 0.12)',
  },
  tiffin: {
    id: 'tiffin',
    name: 'Tiffin Tracker',
    tagline: 'Meal Logs & Shared Hostel Ledger',
    badge: 'Meal Management',
    description: 'Log breakfast, lunch & dinner, assign guest/brother extra tiffins, and export detailed monthly A4 PDF bills.',
    iconName: 'silverware-fork-knife',
    iconLibrary: 'MaterialCommunityIcons',
    accentColor: '#ea580c',
    glowColor: 'rgba(234, 88, 12, 0.35)',
    bgTint: 'rgba(234, 88, 12, 0.12)',
  },
  split: {
    id: 'split',
    name: 'Split Bill',
    tagline: 'Fair Group Spends & Balances',
    badge: 'Group & Trips',
    description: 'Split flat, trip and party bills equally or custom with roommates and friends with 1-tap settlements.',
    iconName: 'people-outline',
    iconLibrary: 'Ionicons',
    accentColor: '#0284c7',
    glowColor: 'rgba(2, 132, 199, 0.35)',
    bgTint: 'rgba(2, 132, 199, 0.12)',
  },
};

const STORAGE_ACTIVE_FEATURE_KEY = '@xpenseflow_active_feature_v1';
const STORAGE_DEFAULT_FEATURE_KEY = '@xpenseflow_default_feature_v1';

interface FeatureContextType {
  activeFeature: FeatureMode | null;
  setActiveFeature: (mode: FeatureMode | null) => Promise<void>;
  defaultFeature: FeatureMode | null;
  setDefaultFeature: (mode: FeatureMode) => Promise<void>;
  pendingFeature: FeatureMode | null;
  setPendingFeature: (mode: FeatureMode | null) => void;
  featureConfig: Record<FeatureMode, FeatureMetadata>;
  activeMetadata: FeatureMetadata | null;
  isReady: boolean;
}

const FeatureContext = createContext<FeatureContextType>({
  activeFeature: null,
  setActiveFeature: async () => {},
  defaultFeature: null,
  setDefaultFeature: async () => {},
  pendingFeature: null,
  setPendingFeature: () => {},
  featureConfig: FEATURE_CONFIGS,
  activeMetadata: null,
  isReady: false,
});

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeFeature, setActiveFeatureState] = useState<FeatureMode | null>(null);
  const [defaultFeature, setDefaultFeatureState] = useState<FeatureMode | null>(null);
  const [pendingFeature, setPendingFeature] = useState<FeatureMode | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Restore previously selected and default feature modes
  useEffect(() => {
    (async () => {
      try {
        const [savedActive, savedDefault] = await Promise.all([
          AsyncStorage.getItem(STORAGE_ACTIVE_FEATURE_KEY),
          AsyncStorage.getItem(STORAGE_DEFAULT_FEATURE_KEY),
        ]);

        let initialDefault: FeatureMode | null = null;
        if (savedDefault && (savedDefault === 'expense' || savedDefault === 'tiffin' || savedDefault === 'split')) {
          initialDefault = savedDefault as FeatureMode;
          setDefaultFeatureState(initialDefault);
        }

        // When launching app: prioritize user's default workspace if set
        if (initialDefault) {
          setActiveFeatureState(initialDefault);
        } else if (savedActive && (savedActive === 'expense' || savedActive === 'tiffin' || savedActive === 'split')) {
          setActiveFeatureState(savedActive as FeatureMode);
        }
      } catch (e) {
        console.warn('Failed to restore feature modes:', e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setActiveFeature = async (mode: FeatureMode | null) => {
    setActiveFeatureState(mode);
    try {
      if (mode) {
        await AsyncStorage.setItem(STORAGE_ACTIVE_FEATURE_KEY, mode);
      } else {
        await AsyncStorage.removeItem(STORAGE_ACTIVE_FEATURE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save active feature mode:', e);
    }
  };

  const setDefaultFeature = async (mode: FeatureMode) => {
    setDefaultFeatureState(mode);
    setActiveFeatureState(mode);
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_DEFAULT_FEATURE_KEY, mode),
        AsyncStorage.setItem(STORAGE_ACTIVE_FEATURE_KEY, mode),
      ]);
    } catch (e) {
      console.warn('Failed to save default feature mode:', e);
    }
  };

  const activeMetadata = activeFeature ? FEATURE_CONFIGS[activeFeature] : null;

  return (
    <FeatureContext.Provider
      value={{
        activeFeature,
        setActiveFeature,
        defaultFeature,
        setDefaultFeature,
        pendingFeature,
        setPendingFeature,
        featureConfig: FEATURE_CONFIGS,
        activeMetadata,
        isReady,
      }}
    >
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeature = () => useContext(FeatureContext);
