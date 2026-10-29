import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useFeature } from '../../context/FeatureContext';
import { AppLogo } from '../../components/AppLogo';
import { api } from '../../services/api';

export const LoginScreen = ({ navigation, route }: any) => {
  const { login } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { pendingFeature, setPendingFeature, setActiveFeature, featureConfig } = useFeature();

  // Sync feature selection from route params if provided
  React.useEffect(() => {
    if (route?.params?.feature && route.params.feature !== pendingFeature) {
      setPendingFeature(route.params.feature);
    }
  }, [route?.params?.feature]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeMode = pendingFeature || route?.params?.feature;
  const featureMeta = activeMode ? featureConfig[activeMode as keyof typeof featureConfig] : null;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password');
      return;
    }

    setLoading(true);
    const res = await login(email.trim(), password);
    setLoading(false);

    if (!res.success) {
      const error = res.error || 'Invalid email or password';
      if (error.toLowerCase().includes('verification link') || error.toLowerCase().includes('using the link')) {
        Alert.alert('Verify Your Email', error, [
          {
            text: 'Resend Link',
            onPress: async () => {
              setLoading(true);
              const result = await api.resendVerificationEmail(email.trim(), password);
              setLoading(false);
              Alert.alert(
                result.error ? 'Could Not Resend Link' : 'Verification Email Sent',
                result.error || 'Check your inbox for the secure verification link.'
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Sign In Failed', error);
      }
    } else {
      if (pendingFeature) {
        await setActiveFeature(pendingFeature);
        setPendingFeature(null);
      } else {
        await setActiveFeature('expense');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.bgApp }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Controls: Theme Toggle */}
        <View style={styles.topBar}>
          <View />
          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: theme.bgSurface }]}
            onPress={toggleTheme}
          >
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={16} color={theme.accentPrimary} />
          </TouchableOpacity>
        </View>

        {/* Switch Workspace back button */}
        {featureMeta && (
          <TouchableOpacity
            style={[
              styles.switchWorkspaceBar,
              { backgroundColor: featureMeta.bgTint, borderColor: featureMeta.accentColor },
            ]}
            onPress={() => {
              setPendingFeature(null);
              if (navigation?.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else if (navigation?.navigate) {
                navigation.navigate('FeaturePortal');
              }
            }}
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={14} color={featureMeta.accentColor} />
            <Text style={[styles.switchWorkspaceBarText, { color: featureMeta.accentColor }]}>
              Selected: {featureMeta.name} • Tap to change
            </Text>
          </TouchableOpacity>
        )}

        {/* Brand Header */}
        <View style={styles.brandBlock}>
          <AppLogo size="lg" variant="horizontal" style={{ marginBottom: 14 }} />

          {featureMeta && (
            <View
              style={[
                styles.featureSelectedBadge,
                { backgroundColor: featureMeta.bgTint, borderColor: featureMeta.accentColor },
              ]}
            >
              {featureMeta.iconLibrary === 'MaterialCommunityIcons' ? (
                <MaterialCommunityIcons name={featureMeta.iconName as any} size={16} color={featureMeta.accentColor} />
              ) : featureMeta.iconLibrary === 'Feather' ? (
                <Feather name={featureMeta.iconName as any} size={15} color={featureMeta.accentColor} />
              ) : (
                <Ionicons name={featureMeta.iconName as any} size={16} color={featureMeta.accentColor} />
              )}
              <Text style={[styles.featureSelectedText, { color: featureMeta.accentColor }]}>
                {featureMeta.name} Login
              </Text>
            </View>
          )}

          <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
            {featureMeta ? `Sign in to access your ${featureMeta.name} workspace` : 'Sign in to access your financial dashboard'}
          </Text>
        </View>

        {/* Auth Card */}
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Welcome back</Text>
          <Text style={[styles.cardDesc, { color: theme.textMuted }]}>
            Enter your credentials to continue
          </Text>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
              <Feather name="mail" size={17} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="name@company.com"
                placeholderTextColor={theme.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={[styles.forgotLink, { color: theme.accentPrimary }]}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
              <Feather name="lock" size={17} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="Enter password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={17} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: theme.accentPrimary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer: Sign up redirect */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.signupLink, { color: theme.accentPrimary }]}>Create one</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 44 : 24,
    minHeight: '100%',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  smallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  smallPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  themeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  serverTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  serverSub: {
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
  },
  serverInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
  },
  serverActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  serverBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchWorkspaceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 16,
    gap: 6,
  },
  switchWorkspaceBarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  featureSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  featureSelectedText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 8,
  },
  loginBtn: {
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
