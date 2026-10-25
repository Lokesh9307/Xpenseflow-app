import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFeature } from '../context/FeatureContext';

// Portal Screen (Initial 3-option feature selector)
import { FeaturePortalScreen } from '../screens/portal/FeaturePortalScreen';

// Auth Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OtpVerificationScreen } from '../screens/auth/OtpVerificationScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

// Onboarding
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';

// Main App Navigation
import { BottomTabNavigator } from './BottomTabNavigator';
import { RecurringScreen } from '../screens/recurring/RecurringScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ExpensesScreen } from '../screens/expenses/ExpensesScreen';
import { TiffinTransactionsScreen } from '../screens/tiffin/TiffinTransactionsScreen';
import { SplitTransactionsScreen } from '../screens/splits/SplitTransactionsScreen';
import { ChatbotScreen } from '../screens/chatbot/ChatbotScreen';
import { CategoryDetailScreen } from '../screens/categories/CategoryDetailScreen';
import { ExpenseTrackerSettingsScreen } from '../screens/settings/ExpenseTrackerSettingsScreen';
import { TiffinSettingsScreen } from '../screens/settings/TiffinSettingsScreen';
import { SmsPendingReviewScreen } from '../screens/settings/SmsPendingReviewScreen';
import { AppLogo } from '../components/AppLogo';
import { SmsExpenseBottomSheet } from '../components/SmsExpenseBottomSheet';

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const { activeFeature, pendingFeature, isReady } = useFeature();

  if (isLoading || !isReady) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: theme.bgApp }]}>
        <AppLogo size="xl" variant="horizontal" />
        <ActivityIndicator
          size="small"
          color={theme.accentPrimary}
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // ── Unauthenticated User Stack ────────────────────────────────────
          // FeaturePortal is the initial screen, followed by Login, Register, etc.
          <>
            <Stack.Screen name="FeaturePortal" component={FeaturePortalScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ForgotPasswordScreen} />
          </>
        ) : !user?.isOnboarded ? (
          // ── Onboarding Flow ────────────────────────────────────────────────
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // ── Main App Flow (Feature-specific bottom tab navigator) ──────────
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen
              name="FeaturePortal"
              component={FeaturePortalScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Expenses"
              component={ExpensesScreen}
              options={{ headerShown: true, headerTitle: 'All Expenses' }}
            />
            <Stack.Screen
              name="TiffinTransactions"
              component={TiffinTransactionsScreen}
              options={{ headerShown: true, headerTitle: 'Tiffin Transactions' }}
            />
            <Stack.Screen
              name="SplitTransactions"
              component={SplitTransactionsScreen}
              options={{ headerShown: true, headerTitle: 'Split History' }}
            />
            <Stack.Screen
              name="Chatbot"
              component={ChatbotScreen}
              options={{ headerShown: true, headerTitle: 'AI Financial Copilot' }}
            />
            <Stack.Screen
              name="Recurring"
              component={RecurringScreen}
              options={{ headerShown: true, headerTitle: 'Recurring Subscriptions' }}
            />
            <Stack.Screen
              name="Analytics"
              component={AnalyticsScreen}
              options={{ headerShown: true, headerTitle: 'Analytics & Insights' }}
            />
            <Stack.Screen
              name="ExpensesAnalytics"
              component={AnalyticsScreen}
              options={{ headerShown: true, headerTitle: 'Analytics & Insights' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: true, headerTitle: 'Account & Settings' }}
            />
            <Stack.Screen
              name="ProfileTab"
              component={ProfileScreen}
              options={{ headerShown: true, headerTitle: 'Account & Settings' }}
            />

            <Stack.Screen
              name="CategoryDetail"
              component={CategoryDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ExpenseTrackerSettings"
              component={ExpenseTrackerSettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TiffinSettings"
              component={TiffinSettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SmsPendingReview"
              component={SmsPendingReviewScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>

      {/* Global SMS expense prompt — slides up over any screen when
          a bank SMS transaction is detected. Mounted here so it works
          regardless of which screen the user is currently on. */}
      {isAuthenticated && user?.isOnboarded && <SmsExpenseBottomSheet />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoText: {
    fontSize: 38,
    fontWeight: '800',
  },
  splashTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
