import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory fallback cache in case native storage module is initializing or unavailable
const memoryFallback = new Map<string, string>();
let nativeModuleAvailable = true;

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (nativeModuleAvailable) {
      try {
        const val = await AsyncStorage.getItem(key);
        if (val !== null) {
          memoryFallback.set(key, val);
          return val;
        }
      } catch {
        nativeModuleAvailable = false;
      }
    }
    return memoryFallback.get(key) ?? null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memoryFallback.set(key, value);
    if (nativeModuleAvailable) {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        nativeModuleAvailable = false;
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    memoryFallback.delete(key);
    if (nativeModuleAvailable) {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        nativeModuleAvailable = false;
      }
    }
  },

  clear: async (): Promise<void> => {
    memoryFallback.clear();
    if (nativeModuleAvailable) {
      try {
        await AsyncStorage.clear();
      } catch {
        nativeModuleAvailable = false;
      }
    }
  },
};

export default safeStorage;
