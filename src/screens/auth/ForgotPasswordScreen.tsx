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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { AppLogo } from '../../components/AppLogo';
import { api } from '../../services/api';

export const ForgotPasswordScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();

  const isResetStage = !!route.params?.otp;
  const [email, setEmail] = useState(route.params?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your registered email address');
      return;
    }

    setLoading(true);
    const res = await api.sendPasswordResetEmail(email.trim());
    setLoading(false);

    if (res.error) {
      Alert.alert('Error', res.error);
    } else if (res.data?.authFlow === 'otp') {
      navigation.navigate('OtpVerification', {
        email: email.trim(),
        type: 'reset',
      });
    } else {
      Alert.alert(
        'Reset Link Sent',
        'Open the password reset link in your email and set your new password in the secure page. Then return here to sign in.',
        [{ text: 'Continue to Sign In', onPress: () => navigation.navigate('Login') }]
      );
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await api.resetPassword(email, newPassword);
    setLoading(false);
    if (result.error) {
      Alert.alert('Reset Failed', result.error);
    } else {
      Alert.alert('Password Changed!', 'Your password has been reset. Please sign in.', [
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.bgApp }]}
    >
      <View style={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerBlock}>
          <AppLogo size="md" variant="horizontal" style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {isResetStage ? 'Set New Password' : 'Reset Password'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {isResetStage
              ? 'Enter your new secure password below'
              : 'Enter your email and we will send a secure reset link or code.'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          {!isResetStage ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                  ]}
                >
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
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.accentPrimary }]}
                onPress={handleSendResetLink}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Send Reset Instructions</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>New Password</Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                  ]}
                >
                  <Feather name="lock" size={17} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.textPrimary }]}
                    placeholder="Min. 6 characters"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Confirm New Password</Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                  ]}
                >
                  <Feather name="check-circle" size={17} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.textPrimary }]}
                    placeholder="Repeat password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.accentPrimary }]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerBlock: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  submitBtn: {
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
