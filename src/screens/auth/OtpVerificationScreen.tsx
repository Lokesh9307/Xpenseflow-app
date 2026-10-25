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
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

export const OtpVerificationScreen = ({ route, navigation }: any) => {
  const { verifyOtp } = useAuth();
  const { theme } = useTheme();

  const email = route.params?.email || '';
  const type = route.params?.type || 'signup';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!otp.trim() || otp.trim().length !== 4) {
      Alert.alert('Invalid Code', 'Please enter the 4-digit code sent to your email');
      return;
    }

    setLoading(true);
    const res = await verifyOtp(email, otp.trim(), type);
    setLoading(false);

    if (res.success) {
      if (type === 'signup') {
        Alert.alert(
          'Account Verified!',
          'Your email has been verified. You can now sign in.',
          [{ text: 'Sign In', onPress: () => navigation.navigate('Login') }]
        );
      } else {
        navigation.navigate('ResetPassword', { email, otp: otp.trim() });
      }
    } else {
      Alert.alert('Verification Failed', res.error || 'Invalid or expired OTP');
    }
  };

  const handleResend = async () => {
    setResending(true);
    const res = await api.sendOtp(email, 'reset');
    setResending(false);
    if (res.error) {
      Alert.alert('Failed to resend', res.error);
    } else {
      Alert.alert('Code Sent', 'A fresh 4-digit code has been sent to your email.');
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
          <View style={[styles.iconBox, { backgroundColor: theme.accentPrimarySubtle }]}>
            <Feather name="shield" size={28} color={theme.accentPrimary} />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Verify Code</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            We've sent a 4-digit verification code to
          </Text>
          <Text style={[styles.emailBadge, { color: theme.accentPrimary }]}>{email}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Enter 4-Digit OTP</Text>
          <TextInput
            style={[
              styles.otpInput,
              {
                backgroundColor: theme.bgElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary,
              },
            ]}
            placeholder="0000"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            value={otp}
            onChangeText={setOtp}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: theme.accentPrimary }]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify & Proceed</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={[styles.resendText, { color: theme.textMuted }]}>
              Didn't receive the email?{' '}
            </Text>
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending ? (
                <ActivityIndicator size="small" color={theme.accentPrimary} />
              ) : (
                <Text style={[styles.resendLink, { color: theme.accentPrimary }]}>Resend</Text>
              )}
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  emailBadge: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  otpInput: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 12,
    marginBottom: 20,
  },
  verifyBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  resendText: {
    fontSize: 13,
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '700',
  },
});
