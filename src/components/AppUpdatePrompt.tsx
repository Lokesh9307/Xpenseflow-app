import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Updates from 'expo-updates';

export const AppUpdatePrompt = () => {
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checking = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS === 'web' || !Updates.isEnabled || checking.current) return;

    checking.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setError(null);
        setVisible(true);
      }
    } catch (err) {
      console.warn('[AppUpdatePrompt] Failed to check for updates:', err);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void checkForUpdate();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    return () => subscription.remove();
  }, [checkForUpdate]);

  const installUpdate = async () => {
    setInstalling(true);
    setError(null);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err) {
      console.error('[AppUpdatePrompt] Failed to install update:', err);
      setError('The update could not be installed. Check your connection and try again.');
      setInstalling(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => {
        if (!installing) setVisible(false);
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.message}>
            A new version of XpenseFlow is ready. Install it now for the latest improvements.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={installing}
            onPress={installUpdate}
            style={[styles.installButton, installing && styles.disabledButton]}
          >
            <Text style={styles.installLabel}>
              {installing ? 'Installing…' : 'Install update'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={installing}
            onPress={() => setVisible(false)}
            style={styles.laterButton}
          >
            <Text style={styles.laterLabel}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: '#111827',
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 10,
  },
  message: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: '#B91C1C',
    fontSize: 13,
    marginTop: 12,
  },
  installButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#0D9488',
    marginTop: 22,
    paddingVertical: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  installLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  laterButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
  },
  laterLabel: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
});
