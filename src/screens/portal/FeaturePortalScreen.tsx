import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useFeature, FeatureMode } from '../../context/FeatureContext';
import { AppLogo } from '../../components/AppLogo';

const CARDS_CONFIG: Record<
  FeatureMode,
  {
    title: string;
    tag: string;
    icon: string;
    iconLib: 'Ionicons' | 'MaterialCommunityIcons';
    accentColor: string;
    bgTint: string;
  }
> = {
  expense: {
    title: 'Expense Tracker',
    tag: 'Personal Finance',
    icon: 'wallet-outline',
    iconLib: 'Ionicons',
    accentColor: '#0D9488',
    bgTint: 'rgba(13, 148, 136, 0.14)',
  },
  tiffin: {
    title: 'Tiffin Tracker',
    tag: 'Hostel & Meal Logs',
    icon: 'silverware-fork-knife',
    iconLib: 'MaterialCommunityIcons',
    accentColor: '#ea580c',
    bgTint: 'rgba(234, 88, 12, 0.14)',
  },
  split: {
    title: 'Split Bills',
    tag: 'Group & Flatmates',
    icon: 'people-outline',
    iconLib: 'Ionicons',
    accentColor: '#0284c7',
    bgTint: 'rgba(2, 132, 199, 0.14)',
  },
};

interface FeaturePortalScreenProps {
  navigation?: any;
  onSelectFeature?: (mode: FeatureMode) => void;
}

export const FeaturePortalScreen: React.FC<FeaturePortalScreenProps> = ({ navigation, onSelectFeature }) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();
  const { activeFeature, setActiveFeature, defaultFeature, setDefaultFeature, setPendingFeature } = useFeature();

  const handleChooseFeature = async (mode: FeatureMode) => {
    if (onSelectFeature) {
      onSelectFeature(mode);
      return;
    }

    if (isAuthenticated) {
      // If already logged in, enter that feature directly!
      await setActiveFeature(mode);
      if (navigation?.navigate) {
        navigation.navigate('MainTabs');
      }
    } else {
      // Direct user to authenticate for that specific feature
      setPendingFeature(mode);
      if (navigation?.navigate) {
        navigation.navigate('Login', { feature: mode });
      }
    }
  };

  const featureList: FeatureMode[] = ['expense', 'tiffin', 'split'];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#09090b' : '#f8fafc' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 16, 28), paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
      >
        {/* Brand Header without verbose description */}
        <View style={styles.brandHeader}>
          <AppLogo size="md" variant="horizontal" style={{ alignSelf: 'flex-start', marginBottom: 14 }} />

          <Text style={[styles.mainHeading, { color: theme.textPrimary }]}>
            Select Your Workspace
          </Text>
        </View>

        {/* Existing Account Active Banner (if user already logged in) */}
        {isAuthenticated && user && (
          <View
            style={[
              styles.accountBanner,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                borderColor: 'rgba(16, 185, 129, 0.35)',
              },
            ]}
          >
            <View style={styles.accountBannerLeft}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>
                  {(user.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.accountBadgeRow}>
                  <Text style={styles.accountBadgeText}>ACTIVE SESSION DETECTED</Text>
                </View>
                <Text style={[styles.accountName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {user.name || 'User'}
                </Text>
                <Text style={[styles.accountEmail, { color: theme.textMuted }]} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.switchAccountBtn}
              onPress={async () => {
                await setActiveFeature(null);
                setPendingFeature(null);
                await logout();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.switchAccountBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Clean, Designable Cards (No images, with Default button) */}
        <View style={styles.cardsContainer}>
          {featureList.map((mode) => {
            const config = CARDS_CONFIG[mode];
            const isDefault = defaultFeature === mode;
            const isActive = activeFeature === mode;

            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.designableCard,
                  {
                    backgroundColor: isDark ? '#141417' : '#ffffff',
                    borderColor: isDefault
                      ? config.accentColor
                      : isDark
                        ? 'rgba(255, 255, 255, 0.09)'
                        : 'rgba(0, 0, 0, 0.08)',
                    borderWidth: isDefault ? 2 : 1,
                    shadowColor: isDefault ? config.accentColor : '#000000',
                  },
                ]}
                onPress={() => handleChooseFeature(mode)}
                activeOpacity={0.88}
              >
                {/* Top Row: Icon + Tag on Left, "Default" Button on Right */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.iconBubble, { backgroundColor: config.bgTint }]}>
                      {config.iconLib === 'MaterialCommunityIcons' ? (
                        <MaterialCommunityIcons
                          name={config.icon as any}
                          size={24}
                          color={config.accentColor}
                        />
                      ) : (
                        <Ionicons
                          name={config.icon as any}
                          size={24}
                          color={config.accentColor}
                        />
                      )}
                    </View>
                    <View style={[styles.tagBadge, { backgroundColor: config.bgTint }]}>
                      <Text style={[styles.tagBadgeText, { color: config.accentColor }]}>
                        {config.tag}
                      </Text>
                    </View>
                  </View>

                  {/* ── Set as Default Button on 3 cards ── */}
                  <TouchableOpacity
                    style={[
                      styles.defaultBtn,
                      isDefault
                        ? [styles.defaultBtnActive, { backgroundColor: config.accentColor }]
                        : [
                            styles.defaultBtnInactive,
                            {
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                            },
                          ],
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setDefaultFeature(mode);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={isDefault ? 'star' : 'star-outline'}
                      size={13}
                      color={isDefault ? '#ffffff' : theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.defaultBtnText,
                        { color: isDefault ? '#ffffff' : theme.textMuted },
                      ]}
                    >
                      {isDefault ? 'Default' : 'Set as Default'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Title (No Subtitle Description) */}
                <View style={styles.cardTitleSection}>
                  <Text style={[styles.cardTitleText, { color: theme.textPrimary }]}>
                    {config.title}
                  </Text>
                </View>

                {/* Bottom Row: Active Status Indicator + Open Action Button */}
                <View style={styles.cardBottomRow}>
                  {isActive ? (
                    <View style={[styles.activeStatusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ecfdf5' }]}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeStatusText}>Active Now</Text>
                    </View>
                  ) : (
                    <View />
                  )}

                  <View
                    style={[
                      styles.openActionBtn,
                      {
                        backgroundColor: isDefault
                          ? config.accentColor
                          : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.openActionBtnText,
                        { color: isDefault ? '#ffffff' : theme.textPrimary },
                      ]}
                    >
                      Open
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={14}
                      color={isDefault ? '#ffffff' : theme.textPrimary}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer note */}
        <View style={styles.footerInfo}>
          <Feather name="shield" size={14} color={theme.textMuted} />
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Single sign-on. Once logged in, switch seamlessly across all 3 modules from Settings or More.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  brandHeader: {
    marginBottom: 20,
  },
  mainHeading: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  accountBanner: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  accountBadgeRow: {
    marginBottom: 2,
  },
  accountBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.8,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 12,
  },
  switchAccountBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  switchAccountBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  cardsContainer: {
    gap: 14,
    marginBottom: 24,
  },
  designableCard: {
    borderRadius: 22,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  defaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  defaultBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  defaultBtnInactive: {
    borderWidth: 1,
  },
  defaultBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitleSection: {
    marginBottom: 14,
  },
  cardTitleText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  activeStatusText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  openActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    marginLeft: 'auto',
  },
  openActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});
