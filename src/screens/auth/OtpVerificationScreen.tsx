import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

export const OtpVerificationScreen = ({ route, navigation }: any) => {
  const { verifyOtp } = useAuth();
  const { theme } = useTheme();
  const email = route.params?.email || '';
  const type: 'signup' | 'reset' = route.params?.type === 'reset' ? 'reset' : 'signup';
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!/^\d{4}$/.test(otp.trim())) {
      Alert.alert('Invalid Code', 'Please enter the 4-digit code sent to your email');
      return;
    }

    setLoading(true);
    const result = await verifyOtp(email, otp.trim(), type);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Verification Failed', result.error || 'Invalid or expired OTP');
    } else if (type === 'signup') {
      Alert.alert('Account Verified!', 'Your email has been verified. You can now sign in.', [
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
    } else {
      navigation.navigate('ResetPassword', { email, otp: otp.trim() });
    }
  };

  const handleResend = async () => {
    setResending(true);
    const result = await api.sendOtp(email, type);
    setResending(false);
    if (result.error) {
      Alert.alert('Failed to resend', result.error);
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
        <View style={styles.header}>
          <Feather name="shield" size={30} color={theme.accentPrimary} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>Verify Code</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Enter the 4-digit code sent to</Text>
          <Text style={[styles.email, { color: theme.accentPrimary }]}>{email}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <TextInput
            style={[styles.otpInput, {
              backgroundColor: theme.bgElevated,
              borderColor: theme.borderSubtle,
              color: theme.textPrimary,
            }]}
            accessibilityLabel="4-digit verification code"
            placeholder="0000"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            value={otp}
            onChangeText={setOtp}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.accentPrimary }]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Verify & Proceed</Text>}
          </TouchableOpacity>
          <View style={styles.resendRow}>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>Didn't receive the email? </Text>
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={theme.accentPrimary} />
                : <Text style={[styles.resend, { color: theme.accentPrimary }]}>Resend</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  content: { width: '100%' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 16 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 12 },
  subtitle: { fontSize: 14, marginTop: 6 },
  email: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, alignItems: 'center' },
  otpInput: { width: '100%', height: 56, borderRadius: 14, borderWidth: 1, fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 12, marginBottom: 20 },
  button: { width: '100%', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  resend: { fontSize: 13, fontWeight: '700' },
});
