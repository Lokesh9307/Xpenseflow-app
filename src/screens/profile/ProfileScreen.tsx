import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useFeature, FeatureMode, FEATURE_CONFIGS } from '../../context/FeatureContext';
import { AppLogo } from '../../components/AppLogo';

export const ProfileScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeFeature, setActiveFeature, setPendingFeature } = useFeature();


  const handleSwitchFeature = async (mode: FeatureMode) => {
    await setActiveFeature(mode);
    if (navigation?.popToTop && navigation.canGoBack && navigation.canGoBack()) {
      navigation.popToTop();
    } else if (navigation?.navigate) {
      navigation.navigate('MainTabs');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of XpenseFlow?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await setActiveFeature(null);
          setPendingFeature(null);
          await logout();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgApp }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.accentPrimary }]}>
            <Text style={styles.avatarInitial}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.textPrimary }]}>{user?.name || 'User'}</Text>
            <Text style={[styles.userEmail, { color: theme.textMuted }]}>{user?.email}</Text>
            <View style={styles.badgeRow}>
              {user?.isAdmin && (
                <View style={[styles.roleBadge, { backgroundColor: theme.accentPrimarySubtle }]}>
                  <Text style={[styles.roleText, { color: theme.accentPrimary }]}>ADMIN</Text>
                </View>
              )}
              <View style={[styles.roleBadge, { backgroundColor: theme.successSubtle }]}>
                <Text style={[styles.roleText, { color: theme.success }]}>VERIFIED</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Workspace Modules */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginBottom: 0 }]}>
            Workspace Modules
          </Text>
          <View style={[styles.ssoBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }]}>
            <Ionicons name="shield-checkmark" size={12} color="#10b981" />
            <Text style={styles.ssoBadgeText}>Auto-Login Active</Text>
          </View>
        </View>

        {/* Account Detection Callout */}
        <View
          style={[
            styles.accountDetectBox,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
            },
          ]}
        >
          <View style={styles.accountDetectLeft}>
            <View style={[styles.miniAvatar, { backgroundColor: theme.accentPrimary }]}>
              <Text style={styles.miniAvatarText}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountDetectName, { color: theme.textPrimary }]} numberOfLines={1}>
                {user?.name || 'User'} ({user?.email})
              </Text>
              <Text style={[styles.accountDetectDesc, { color: theme.textMuted }]}>
                Switch modules instantly with this account. No re-login required.
              </Text>
            </View>
          </View>
        </View>

        {/* 3 Module Cards */}
        <View style={styles.modulesContainer}>
          {(['expense', 'tiffin', 'split'] as FeatureMode[]).map((mode) => {
            const config = FEATURE_CONFIGS[mode];
            const isActive = (activeFeature || 'expense') === mode;

            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.moduleCard,
                  {
                    backgroundColor: isActive
                      ? (isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff')
                      : theme.bgSurface,
                    borderColor: isActive ? config.accentColor : theme.borderSubtle,
                    borderWidth: isActive ? 1.5 : 1,
                  },
                ]}
                onPress={() => handleSwitchFeature(mode)}
                activeOpacity={0.75}
              >
                <View style={styles.moduleCardLeft}>
                  <View
                    style={[
                      styles.moduleIconBox,
                      {
                        backgroundColor: isActive
                          ? config.bgTint
                          : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'),
                      },
                    ]}
                  >
                    {config.iconLibrary === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons
                        name={config.iconName as any}
                        size={22}
                        color={config.accentColor}
                      />
                    ) : config.iconLibrary === 'Ionicons' ? (
                      <Ionicons
                        name={(isActive ? config.iconName.replace('-outline', '') : config.iconName) as any}
                        size={22}
                        color={config.accentColor}
                      />
                    ) : (
                      <Feather
                        name={config.iconName as any}
                        size={20}
                        color={config.accentColor}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.moduleTitleRow}>
                      <Text style={[styles.moduleName, { color: theme.textPrimary }]}>
                        {config.name}
                      </Text>
                      {isActive && (
                        <View style={[styles.activePill, { backgroundColor: config.bgTint }]}>
                          <Ionicons name="checkmark-circle" size={11} color={config.accentColor} />
                          <Text style={[styles.activePillText, { color: config.accentColor }]}>
                            ACTIVE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.moduleTagline, { color: theme.textMuted }]} numberOfLines={1}>
                      {config.tagline}
                    </Text>
                  </View>
                </View>

                {isActive ? (
                  <View style={styles.switchActionCol}>
                    <Text style={[styles.switchActionText, { color: config.accentColor, fontWeight: '700' }]}>
                      Open
                    </Text>
                    <Feather name="arrow-right" size={14} color={config.accentColor} />
                  </View>
                ) : (
                  <View style={styles.switchActionCol}>
                    <Text style={[styles.switchActionText, { color: config.accentColor }]}>
                      Switch
                    </Text>
                    <Feather name="arrow-right" size={14} color={config.accentColor} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>


        {/* Section: Preferences */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>Preferences</Text>
        <View style={[styles.settingsCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          {/* Dark Mode */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.accentPrimarySubtle }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={theme.accentPrimary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Dark Mode</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  {isDark ? 'OLED sleek dark theme' : 'Warm ivory light theme'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.borderSubtle, true: theme.accentPrimary }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.rowDivider, { backgroundColor: theme.borderSubtle }]} />

          {/* Currency */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.successSubtle }]}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.success }}>₹</Text>
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Currency</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>Indian Rupee (INR · ₹)</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textMuted} />
          </View>
        </View>

        {/* Section: App Info */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>About</Text>
        <View style={[styles.settingsCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle, paddingVertical: 18 }]}>
          <AppLogo size="md" variant="horizontal" style={{ alignSelf: 'center', marginBottom: 14 }} />
          <View style={styles.settingRow}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Version</Text>
            <Text style={[styles.settingSub, { color: theme.textMuted }]}>1.0.0 (Production)</Text>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: theme.borderSubtle }]} />
          <View style={styles.settingRow}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Platform</Text>
            <Text style={[styles.settingSub, { color: theme.textMuted }]}>Native Android App</Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: theme.dangerSubtle, borderColor: theme.danger }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={18} color={theme.danger} />
          <Text style={[styles.signOutText, { color: theme.danger }]}>Sign Out of XpenseFlow</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  settingsCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 1,
  },
  rowDivider: {
    height: 1,
  },
  serverInfoBlock: {
    paddingVertical: 12,
  },
  serverHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  currentUrlText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  editUrlBox: {
    marginTop: 10,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  urlActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  ssoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ssoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.3,
  },
  accountDetectBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  accountDetectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  accountDetectName: {
    fontSize: 13,
    fontWeight: '700',
  },
  accountDetectDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  modulesContainer: {
    gap: 10,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
  },
  moduleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  moduleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moduleName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  moduleTagline: {
    fontSize: 12,
    marginTop: 2,
  },
  switchActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  switchActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  monthPickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  monthItemBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  monthItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
  monthItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pdfTag: {
    fontSize: 11,
    fontWeight: '800',
  },
});
