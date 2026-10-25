import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFeature, FeatureMode } from '../context/FeatureContext';
import { AppLogo } from './AppLogo';

interface HeaderProps {
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNotificationPress,
  onProfilePress,
  unreadCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme, isDark } = useTheme();
  const { user } = useAuth();
  const { activeFeature, setActiveFeature } = useFeature();

  const currentMode = activeFeature || 'expense';

  const badgeConfig = {
    expense: { label: 'Expenses', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' },
    tiffin: { label: 'Tiffin', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.14)' },
    split: { label: 'Split', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  }[currentMode];

  const handleCycleFeature = async () => {
    const nextMode: FeatureMode =
      currentMode === 'expense' ? 'tiffin' : currentMode === 'tiffin' ? 'split' : 'expense';
    await setActiveFeature(nextMode);
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Dynamically pad from status bar / punch hole / camera island
  const dynamicTopPadding = Math.max(insets.top + 6, 16);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: dynamicTopPadding,
          backgroundColor: theme.bgSurface,
          borderBottomColor: theme.borderSubtle,
        },
      ]}
    >
      {/* Left: Brand Logo & User Greeting */}
      <View style={styles.left}>
        <AppLogo size="sm" variant="icon" />
        <View style={styles.nameBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.greetingSub, { color: theme.textMuted }]}>
              {timeGreeting} 👋
            </Text>
            <TouchableOpacity
              onPress={handleCycleFeature}
              activeOpacity={0.7}
              style={[
                styles.workspaceBadge,
                { backgroundColor: badgeConfig.bg, borderColor: badgeConfig.color },
              ]}
            >
              <View style={[styles.workspaceDot, { backgroundColor: badgeConfig.color }]} />
              <Text style={[styles.workspaceBadgeText, { color: badgeConfig.color }]}>
                {badgeConfig.label}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
            {firstName}
          </Text>
        </View>
      </View>

      {/* Right: Actions (Theme Toggle, Notifications, Avatar) */}
      <View style={styles.right}>
        {/* Dark/Light Mode Pill Button */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.actionBtn, { backgroundColor: theme.bgHover, borderColor: theme.borderSubtle }]}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isDark ? 'sunny' : 'moon'}
            size={18}
            color={theme.accentPrimary}
          />
        </TouchableOpacity>

        {/* Notifications with Unread Dot */}
        <TouchableOpacity
          onPress={onNotificationPress}
          style={[styles.actionBtn, { backgroundColor: theme.bgHover, borderColor: theme.borderSubtle }]}
          activeOpacity={0.7}
        >
          <Feather name="bell" size={17} color={theme.textPrimary} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.danger }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Profile Avatar */}
        <TouchableOpacity
          onPress={onProfilePress}
          style={[
            styles.avatarBtn,
            {
              backgroundColor: theme.accentPrimary,
              borderColor: theme.borderSubtle,
            },
          ]}
          activeOpacity={0.7}
        >
          <Text style={styles.avatarText}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </Text>
          <View style={[styles.onlineDot, { backgroundColor: theme.success }]} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  nameBlock: {
    flex: 1,
  },
  greetingSub: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  workspaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  workspaceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  workspaceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    position: 'relative',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
});

export default Header;
