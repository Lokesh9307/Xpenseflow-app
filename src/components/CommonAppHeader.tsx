import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { NotificationDrawer } from './NotificationDrawer';

export interface CommonAppHeaderProps {
  subtitle?: string;
  moduleBadge?: {
    label: string;
    color: string;
    bg: string;
  };
  rightActions?: React.ReactNode;
}

export const CommonAppHeader: React.FC<CommonAppHeaderProps> = ({
  subtitle,
  moduleBadge,
  rightActions,
}) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [notifVisible, setNotifVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const greetingName = user?.name ? user.name.split(' ')[0] : 'Steve';

  const defaultGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 17) return 'Good afternoon!';
    return 'Good evening!';
  };

  const fetchUnreadNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      if (res.data && Array.isArray(res.data)) {
        const count = res.data.filter((n: any) => !n.isRead).length;
        setUnreadCount(count);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchUnreadNotifications();
  }, [fetchUnreadNotifications]);

  const screenBg = isDark ? '#000000' : '#EBF0F3';
  const textPrimary = isDark ? '#FFFFFF' : '#101012';
  const textMuted = isDark ? '#8E8E93' : '#6B7280';
  const capsuleBg = isDark ? '#141416' : '#FFFFFF';
  const capsuleBorder = isDark ? '#26262B' : '#E2E8F0';

  return (
    <>
      <View
        style={[
          styles.fixedHeader,
          {
            backgroundColor: screenBg,
            borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            paddingTop: Math.max(insets.top + 6, 16),
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.greetingTitle, { color: textPrimary }]} numberOfLines={1}>
              Hey, {greetingName}!
            </Text>
            {moduleBadge && (
              <View style={[styles.moduleBadge, { backgroundColor: moduleBadge.bg }]}>
                <Text style={[styles.moduleBadgeText, { color: moduleBadge.color }]}>
                  {moduleBadge.label}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.subGreetingRow}>
            <Text style={[styles.greetingSub, { color: textMuted }]}>
              {subtitle || defaultGreeting()}
            </Text>
            {!subtitle && <Text style={styles.waveEmoji}> 👋</Text>}
          </View>
        </View>

        <View style={styles.headerRightControls}>
          {rightActions}

          {/* Notification Bell Well */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setNotifVisible(true)}
            style={[
              styles.wellButton,
              {
                backgroundColor: capsuleBg,
                borderColor: capsuleBorder,
              },
            ]}
          >
            <Feather name="bell" size={17} color={textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.unreadBadgeDot}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Circular Profile Avatar Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (navigation?.navigate) {
                navigation.navigate('Profile');
              }
            }}
            style={[
              styles.avatarCircle,
              {
                backgroundColor: '#1E1E24',
                borderColor: capsuleBorder,
              },
            ]}
          >
            <Text style={styles.avatarInitial}>
              {greetingName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <NotificationDrawer
        visible={notifVisible}
        onClose={() => setNotifVisible(false)}
        onUpdated={fetchUnreadNotifications}
      />
    </>
  );
};

const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moduleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  greetingSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  waveEmoji: {
    fontSize: 13,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
