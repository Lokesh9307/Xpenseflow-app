import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { FeatureProvider } from './src/context/FeatureContext';
import { RootNavigator } from './src/navigation/RootNavigator';

import { smsAutoDetect } from './src/services/smsAutoDetectService';

function MainApp() {
  const { isDark } = useTheme();

  React.useEffect(() => {
    smsAutoDetect.initialize().catch((err) => {
      console.warn('[App] Failed to initialize SMS auto-detection:', err);
    });
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FeatureProvider>
            <MainApp />
          </FeatureProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
