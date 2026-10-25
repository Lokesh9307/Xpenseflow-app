import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  TextInput,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { dataEvents } from '../../services/dataEvents';
import { generateAndShareMonthlyPdfReport } from '../../utils/pdfReportGenerator';
import { CategoryModal } from '../../components/CategoryModal';
import { smsAutoDetect } from '../../services/smsAutoDetectService';
import {
  getSmsSettings,
  updateSmsSettings,
  getTransactionStats,
  getPendingTransactions,
  SmsAutoDetectSettings,
} from '../../services/smsTransactionStore';

export const ExpenseTrackerSettingsScreen = ({ navigation }: any) => {
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicTop = Math.max(insets.top + 6, 16);

  // Monochromatic TRANTOR Palette with vibrant accents
  const t = {
    screenBg: isDark ? '#000000' : '#EBF0F3',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    itemBg: isDark ? '#18181B' : '#F8FAFC',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    iconBg: isDark ? '#222228' : '#F1F5F9',
    accentTeal: '#0D9488',
    tiffinColor: '#ea580c',
    splitColor: '#8b5cf6',
    danger: '#EF4444',
  };

  // Integration states
  const [syncTiffin, setSyncTiffin] = useState<boolean>(user?.autoSyncTiffin ?? false);
  const [syncSplit, setSyncSplit] = useState<boolean>(user?.autoSyncSplit ?? false);

  // PDF Generator state
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);
  const [monthPickerVisible, setMonthPickerVisible] = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [monthExpensesCount, setMonthExpensesCount] = useState<number>(0);
  const [monthExpensesTotal, setMonthExpensesTotal] = useState<number>(0);

  // Category modal
  const [categoryModalVisible, setCategoryModalVisible] = useState<boolean>(false);
  const [categoriesCount, setCategoriesCount] = useState<number>(0);

  // Data reset state
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // SMS Auto-Detection state
  const [smsEnabled, setSmsEnabled] = useState<boolean>(false);
  const [smsAutoApprove, setSmsAutoApprove] = useState<boolean>(false);
  const [smsDebitOnly, setSmsDebitOnly] = useState<boolean>(true);
  const [smsMinAmount, setSmsMinAmount] = useState<string>('1');
  const [smsMaxAutoApprove, setSmsMaxAutoApprove] = useState<string>('5000');
  const [smsPendingCount, setSmsPendingCount] = useState<number>(0);
  const [smsTotalDetected, setSmsTotalDetected] = useState<number>(0);
  const [smsTotalAutoAmount, setSmsTotalAutoAmount] = useState<number>(0);
  const [smsLoading, setSmsLoading] = useState<boolean>(false);
  const [hasSmsPermission, setHasSmsPermission] = useState<boolean | null>(null);
  const isCheckingPermission = useRef<boolean>(false);

  useEffect(() => {
    if (user) {
      if (user.autoSyncTiffin !== undefined) setSyncTiffin(user.autoSyncTiffin);
      if (user.autoSyncSplit !== undefined) setSyncSplit(user.autoSyncSplit);
    }
  }, [user]);

  // Load preview info for selected month
  const loadMonthPreview = useCallback(async () => {
    try {
      const [expRes, catRes] = await Promise.all([
        api.getExpenses({ month: selectedMonthKey, limit: 500 }),
        api.getCategories(),
      ]);

      if (expRes.data && Array.isArray(expRes.data)) {
        const list = expRes.data;
        setMonthExpensesCount(list.length);
        const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        setMonthExpensesTotal(total);
      }

      if (catRes.data && Array.isArray(catRes.data)) {
        setCategoriesCount(catRes.data.length);
      }
    } catch (e) {
      console.error('Failed to load settings preview info:', e);
    }
  }, [selectedMonthKey]);

  useEffect(() => {
    loadMonthPreview();
  }, [loadMonthPreview]);

  // Live Android SMS permission check (does not rely on stale booleans)
  const checkSmsPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setHasSmsPermission(false);
      return false;
    }
    if (isCheckingPermission.current) return false;
    isCheckingPermission.current = true;
    try {
      const granted = await smsAutoDetect.checkPermissionStatus();
      setHasSmsPermission(granted);
      console.log('[Settings] Live SMS permission check result:', granted);
      return granted;
    } catch (err) {
      console.warn('[Settings] Failed to check SMS permission:', err);
      setHasSmsPermission(false);
      return false;
    } finally {
      isCheckingPermission.current = false;
    }
  }, []);

  // Load SMS Auto-Detect settings & stats
  const loadSmsSettings = useCallback(async () => {
    try {
      const settings = await getSmsSettings();
      setSmsEnabled(settings.enabled);
      setSmsAutoApprove(settings.autoApprove);
      setSmsDebitOnly(settings.debitOnly);
      setSmsMinAmount(String(settings.minAmount));
      setSmsMaxAutoApprove(String(settings.maxAutoApproveAmount));

      const stats = await getTransactionStats();
      setSmsPendingCount(stats.pendingCount);
      setSmsTotalDetected(stats.totalDetected);
      setSmsTotalAutoAmount(stats.totalAutoAmount);
    } catch (err) {
      console.error('[Settings] Failed to load SMS settings:', err);
    }
  }, []);

  useEffect(() => {
    loadSmsSettings();
    checkSmsPermission();
  }, [loadSmsSettings, checkSmsPermission]);

  // Re-check SMS permissions and reload settings whenever app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[Settings] App returned to foreground — refreshing SMS permission state');
        checkSmsPermission().then(async (granted) => {
          const settings = await getSmsSettings();
          if (granted) {
            // Permission granted in Settings while backgrounded; resume service if configured
            if (settings.enabled && !smsAutoDetect.isRunning) {
              await smsAutoDetect.start();
            }
          } else {
            // Permission was revoked in Settings while backgrounded
            if (smsAutoDetect.isRunning) {
              await smsAutoDetect.stop();
            }
          }
          loadSmsSettings();
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkSmsPermission, loadSmsSettings]);

  // Listen for SMS transaction events to update stats
  useEffect(() => {
    const unsub1 = dataEvents.on('sms_transaction_detected', loadSmsSettings);
    const unsub2 = dataEvents.on('sms_transaction_approved', loadSmsSettings);
    const unsub3 = dataEvents.on('sms_transactions_bulk_approved', loadSmsSettings);
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [loadSmsSettings]);

  // SMS Auto-Detect toggle handler
  const handleToggleSmsAutoDetect = async (newVal: boolean) => {
    setSmsLoading(true);
    try {
      if (newVal) {
        const result = await smsAutoDetect.start();
        if (!result.success) {
          setSmsEnabled(false);
          if (result.reason === 'permission_denied') {
            setHasSmsPermission(false);
            Alert.alert(
              'SMS Permission Required',
              'To auto-detect bank transactions, XpenseFlow needs permission to receive incoming SMS messages. Please grant SMS permissions in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    Linking.openSettings().catch(() => {});
                  },
                },
              ]
            );
          } else if (result.reason === 'module_unavailable') {
            Alert.alert(
              'Feature Unavailable',
              'SMS auto-detection requires the standalone Android build with SMS receiver support.'
            );
          } else {
            Alert.alert('Error', result.message || 'Failed to start SMS auto-detection.');
          }
          setSmsLoading(false);
          return;
        }

        setSmsEnabled(true);
        setHasSmsPermission(true);
        Alert.alert(
          'SMS Auto-Detection Enabled',
          'XpenseFlow will now automatically detect bank transaction SMS messages and record expenses. Detected transactions will appear under pending review unless auto-approve is enabled.'
        );
      } else {
        await smsAutoDetect.stop();
        setSmsEnabled(false);
        Alert.alert(
          'SMS Auto-Detection Disabled',
          'Bank SMS detection has been turned off. Previously detected transactions are preserved.'
        );
      }
      await loadSmsSettings();
      await checkSmsPermission();
    } catch (err: any) {
      setSmsEnabled(!newVal);
      Alert.alert('Error', err?.message || 'Failed to update SMS detection settings.');
    } finally {
      setSmsLoading(false);
    }
  };

  // SMS sub-setting handlers
  const handleToggleSmsAutoApprove = async (newVal: boolean) => {
    setSmsAutoApprove(newVal);
    await updateSmsSettings({ autoApprove: newVal });
  };

  const handleToggleSmsDebitOnly = async (newVal: boolean) => {
    setSmsDebitOnly(newVal);
    await updateSmsSettings({ debitOnly: newVal });
  };

  const handleSaveMinAmount = async () => {
    const val = parseInt(smsMinAmount, 10);
    if (isNaN(val) || val < 0) {
      setSmsMinAmount('1');
      await updateSmsSettings({ minAmount: 1 });
    } else {
      await updateSmsSettings({ minAmount: val });
    }
  };

  const handleSaveMaxAutoApprove = async () => {
    const val = parseInt(smsMaxAutoApprove, 10);
    if (isNaN(val) || val < 0) {
      setSmsMaxAutoApprove('5000');
      await updateSmsSettings({ maxAutoApproveAmount: 5000 });
    } else {
      await updateSmsSettings({ maxAutoApproveAmount: val });
    }
  };

  // Past 12 months options
  const monthOptions = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      list.push({ key, label });
    }
    return list;
  }, []);

  const selectedMonthLabel = useMemo(() => {
    const found = monthOptions.find((m) => m.key === selectedMonthKey);
    return found ? found.label : selectedMonthKey;
  }, [monthOptions, selectedMonthKey]);

  // 1. Toggle Connect with Tiffin Tracker
  const handleToggleTiffinSync = async (newVal: boolean) => {
    setSyncTiffin(newVal);
    updateUser({ autoSyncTiffin: newVal });
    try {
      await api.updateProfile({ autoSyncTiffin: newVal });
      await api.syncTiffinExpenses(newVal);
      loadMonthPreview();
      if (newVal) {
        Alert.alert(
          'Tiffin Tracker Connected',
          'Tiffin meals across all your groups have been synchronized into your Expense Tracker! You can view them under the "Tiffin Expense" category.'
        );
      } else {
        Alert.alert(
          'Tiffin Tracker Disconnected',
          'Tiffin auto-sync disabled. Auto-synced meals have been cleanly removed from your Expense Tracker.'
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to update Tiffin connection preference.');
    }
  };

  // 2. Toggle Connect with Split Bills (Supports multiple groups)
  const handleToggleSplitSync = async (newVal: boolean) => {
    setSyncSplit(newVal);
    updateUser({ autoSyncSplit: newVal });
    try {
      await api.updateProfile({ autoSyncSplit: newVal });
      await api.syncSplitExpenses(newVal);
      loadMonthPreview();
      if (newVal) {
        Alert.alert(
          'Split Bills Connected',
          'Shared group bills across all your groups have been synchronized into your Expense Tracker! You can view them under the "Split Expense" category.'
        );
      } else {
        Alert.alert(
          'Split Bills Disconnected',
          'Split Bills auto-sync disabled. Auto-synced group bills have been cleanly removed from your Expense Tracker.'
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to update Split connection preference.');
    }
  };

  // 3. Generate Monthly PDF Report
  const handleGeneratePdf = async () => {
    try {
      setGeneratingPdf(true);
      const res = await api.getExpenses({ month: selectedMonthKey, limit: 500 });
      const expensesList = res.data || [];
      if (!expensesList || expensesList.length === 0) {
        setGeneratingPdf(false);
        Alert.alert('No Expenses', `No expenses recorded for ${selectedMonthLabel}.`);
        return;
      }

      await generateAndShareMonthlyPdfReport({
        monthKey: selectedMonthKey,
        monthLabel: selectedMonthLabel,
        userName: user?.name || 'Account Holder',
        userEmail: user?.email || '',
        expenses: expensesList,
      });
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Could not generate report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // 4. Reset Expense Tracker Data
  const handleResetExpenseData = () => {
    Alert.alert(
      'Reset Expense Tracker Data?',
      'This will permanently delete all your recorded expenses, custom category budgets, and recurring subscriptions. Default categories will be restored.\n\nYour account, Tiffin, and Split bill records will remain untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Expenses',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsResetting(true);
              const res = await api.resetData('expenses');
              dataEvents.emit('expense_deleted', 'all');
              dataEvents.emit('category_updated');
              setIsResetting(false);
              loadMonthPreview();
              Alert.alert('Success', res.data?.message || 'Expense tracker has been reset.');
            } catch (err: any) {
              setIsResetting(false);
              Alert.alert('Reset Failed', err?.message || 'Unable to reset expense data.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.screenBg }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: dynamicTop,
            backgroundColor: t.cardBg,
            borderBottomColor: t.cardBorder,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>
            Expense Tracker Settings
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.textMuted }]}>
            Integrations, monthly PDF reports & budgets
          </Text>
        </View>

        <View style={[styles.headerBadge, { backgroundColor: 'rgba(13, 148, 136, 0.12)' }]}>
          <Text style={styles.headerBadgeText}>EXPENSES</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 1: MODULE INTEGRATIONS (Tiffin & Split Auto-Sync)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: t.textMuted }]}>
            INTEGRATED MODULES & AUTO-SYNC
          </Text>
        </View>

        <View
          style={[
            styles.settingsCard,
            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
          ]}
        >
          {/* Tiffin Tracker Integration Toggle */}
          <View style={styles.settingRow}>
            <View style={[styles.settingIconBox, { backgroundColor: 'rgba(234, 88, 12, 0.14)' }]}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#ea580c" />
            </View>

            <View style={styles.settingMetaCol}>
              <View style={styles.settingTitleRow}>
                <Text style={[styles.settingTitle, { color: t.textPrimary }]}>
                  Connect with Tiffin Tracker
                </Text>
                {syncTiffin && (
                  <View style={[styles.activePill, { backgroundColor: 'rgba(234, 88, 12, 0.14)' }]}>
                    <Text style={[styles.activePillText, { color: '#ea580c' }]}>CONNECTED</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                Automatically logs meals added on your name as an expense under category{' '}
                <Text style={{ fontWeight: '700', color: t.textPrimary }}>"Tiffin Expense"</Text>.
              </Text>
            </View>

            <Switch
              value={syncTiffin}
              onValueChange={handleToggleTiffinSync}
              trackColor={{ false: isDark ? '#333338' : '#e2e8f0', true: '#ea580c' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />

          {/* Split Bills Integration Toggle */}
          <View style={styles.settingRow}>
            <View style={[styles.settingIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.14)' }]}>
              <Ionicons name="people-outline" size={20} color="#8b5cf6" />
            </View>

            <View style={styles.settingMetaCol}>
              <View style={styles.settingTitleRow}>
                <Text style={[styles.settingTitle, { color: t.textPrimary }]}>
                  Connect with Split Bills
                </Text>
                {syncSplit && (
                  <View style={[styles.activePill, { backgroundColor: 'rgba(139, 92, 246, 0.14)' }]}>
                    <Text style={[styles.activePillText, { color: '#8b5cf6' }]}>CONNECTED</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                Automatically logs group bill shares and splits on your account under category{' '}
                <Text style={{ fontWeight: '700', color: t.textPrimary }}>"Split Expense"</Text>.
              </Text>
            </View>

            <Switch
              value={syncSplit}
              onValueChange={handleToggleSplitSync}
              trackColor={{ false: isDark ? '#333338' : '#e2e8f0', true: '#8b5cf6' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 2: MONTHLY EXPENSE REPORT GENERATOR (PDF)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: t.textMuted }]}>
            MONTHLY EXPENSE REPORT (PDF)
          </Text>
        </View>

        <View
          style={[
            styles.settingsCard,
            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
          ]}
        >
          <View style={styles.pdfHeaderRow}>
            <View style={[styles.settingIconBox, { backgroundColor: 'rgba(13, 148, 136, 0.14)' }]}>
              <Feather name="file-text" size={20} color="#0D9488" />
            </View>

            <View style={styles.settingMetaCol}>
              <Text style={[styles.settingTitle, { color: t.textPrimary }]}>
                Generate Specific Month Report
              </Text>
              <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                Creates a verified PDF report containing full category breakdown, transaction itemization, and statistics.
              </Text>
            </View>
          </View>

          {/* Month Selector Strip */}
          <View style={styles.monthSelectorBox}>
            <Text style={[styles.monthSelectorLabel, { color: t.textMuted }]}>
              Selected Month:
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setMonthPickerVisible(true)}
              style={[
                styles.monthPickerBtn,
                { backgroundColor: t.itemBg, borderColor: t.cardBorder },
              ]}
            >
              <Feather name="calendar" size={13} color="#0D9488" />
              <Text style={[styles.monthPickerBtnText, { color: t.textPrimary }]}>
                {selectedMonthLabel}
              </Text>
              <Feather name="chevron-down" size={13} color={t.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Month Preview Quick Stats */}
          <View
            style={[
              styles.previewStatsRow,
              { backgroundColor: t.itemBg, borderColor: t.cardBorder },
            ]}
          >
            <View style={styles.previewStatCol}>
              <Text style={[styles.previewStatNum, { color: t.textPrimary }]}>
                {monthExpensesCount}
              </Text>
              <Text style={[styles.previewStatLabel, { color: t.textMuted }]}>
                Transactions
              </Text>
            </View>
            <View style={[styles.previewStatDivider, { backgroundColor: t.cardBorder }]} />
            <View style={styles.previewStatCol}>
              <Text style={[styles.previewStatNum, { color: '#0D9488' }]}>
                ₹{monthExpensesTotal.toLocaleString()}
              </Text>
              <Text style={[styles.previewStatLabel, { color: t.textMuted }]}>
                Total Spent
              </Text>
            </View>
          </View>

          {/* Generate Action Button */}
          <TouchableOpacity
            style={styles.generatePdfBtn}
            onPress={handleGeneratePdf}
            disabled={generatingPdf}
            activeOpacity={0.85}
          >
            {generatingPdf ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="download" size={15} color="#FFFFFF" />
                <Text style={styles.generatePdfBtnText}>
                  Export & Share {selectedMonthLabel} PDF
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 3: CATEGORIES & RECURRING PREFERENCES
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: t.textMuted }]}>
            CATEGORIES & RECURRING PREFERENCES
          </Text>
        </View>

        <View
          style={[
            styles.settingsCard,
            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
          ]}
        >
          {/* Category Budgets Row */}
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => setCategoryModalVisible(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.settingIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}>
              <Feather name="folder-plus" size={19} color="#38bdf8" />
            </View>

            <View style={styles.settingMetaCol}>
              <Text style={[styles.settingTitle, { color: t.textPrimary }]}>
                Configure Categories & Budgets
              </Text>
              <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                {categoriesCount} active categories · Auto-resets on the 1st of every month
              </Text>
            </View>

            <Feather name="chevron-right" size={18} color={t.textMuted} />
          </TouchableOpacity>

          <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />

          {/* Recurring Subscriptions Row */}
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('ExpensesRecurring')}
            activeOpacity={0.75}
          >
            <View style={[styles.settingIconBox, { backgroundColor: 'rgba(234, 179, 8, 0.14)' }]}>
              <Ionicons name="repeat" size={19} color="#eab308" />
            </View>

            <View style={styles.settingMetaCol}>
              <Text style={[styles.settingTitle, { color: t.textPrimary }]}>
                Recurring Subscriptions
              </Text>
              <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                Auto-repeating bills, OTT subscriptions & auto-deductions
              </Text>
            </View>

            <Feather name="chevron-right" size={18} color={t.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 3B: SMS AUTO-DETECTION (Bank Transaction Capture)
            ═══════════════════════════════════════════════════════════════════════ */}
        {Platform.OS === 'android' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: t.textMuted }]}>
                SMS AUTO-DETECTION
              </Text>
            </View>

            <View
              style={[
                styles.settingsCard,
                { backgroundColor: t.cardBg, borderColor: t.cardBorder },
              ]}
            >
              {/* Master Toggle */}
              <View style={styles.settingRow}>
                <View style={[styles.settingIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#22c55e" />
                </View>

                <View style={styles.settingMetaCol}>
                  <View style={styles.settingTitleRow}>
                    <Text style={[styles.settingTitle, { color: t.textPrimary }]}>
                      Auto-Detect Bank SMS
                    </Text>
                    {smsEnabled && (
                      <View style={[styles.activePill, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}>
                        <Text style={[styles.activePillText, { color: '#22c55e' }]}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                    Automatically captures bank debit/credit SMS and creates expense records.
                    Supports UPI, NEFT, IMPS, credit/debit cards across 20+ Indian banks.
                  </Text>

                  {/* Android SMS Permission Status */}
                  <View style={styles.smsPermissionBadgeRow}>
                    <Ionicons
                      name={hasSmsPermission ? 'shield-checkmark' : 'alert-circle'}
                      size={13}
                      color={hasSmsPermission ? '#22c55e' : '#f59e0b'}
                    />
                    <Text
                      style={[
                        styles.smsPermissionBadgeText,
                        { color: hasSmsPermission ? '#22c55e' : '#f59e0b' },
                      ]}
                    >
                      {hasSmsPermission === null
                        ? 'Checking SMS permission...'
                        : hasSmsPermission
                        ? 'SMS Permission Granted'
                        : 'SMS Permission Required'}
                    </Text>
                    {hasSmsPermission === false && (
                      <TouchableOpacity
                        onPress={() => Linking.openSettings().catch(() => {})}
                        style={styles.settingsLinkBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.settingsLinkText}>Settings</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {smsLoading ? (
                  <ActivityIndicator size="small" color="#22c55e" />
                ) : (
                  <Switch
                    value={smsEnabled}
                    onValueChange={handleToggleSmsAutoDetect}
                    trackColor={{ false: isDark ? '#333338' : '#e2e8f0', true: '#22c55e' }}
                    thumbColor="#ffffff"
                  />
                )}
              </View>

              {/* Sub-settings (only when enabled) */}
              {smsEnabled && (
                <>
                  <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />

                  {/* Stats Row */}
                  <View
                    style={[
                      styles.previewStatsRow,
                      { backgroundColor: t.itemBg, borderColor: t.cardBorder },
                    ]}
                  >
                    <View style={styles.previewStatCol}>
                      <Text style={[styles.previewStatNum, { color: t.textPrimary }]}>
                        {smsTotalDetected}
                      </Text>
                      <Text style={[styles.previewStatLabel, { color: t.textMuted }]}>
                        Detected
                      </Text>
                    </View>
                    <View style={[styles.previewStatDivider, { backgroundColor: t.cardBorder }]} />
                    <View style={styles.previewStatCol}>
                      <Text style={[styles.previewStatNum, { color: '#f59e0b' }]}>
                        {smsPendingCount}
                      </Text>
                      <Text style={[styles.previewStatLabel, { color: t.textMuted }]}>
                        Pending
                      </Text>
                    </View>
                    <View style={[styles.previewStatDivider, { backgroundColor: t.cardBorder }]} />
                    <View style={styles.previewStatCol}>
                      <Text style={[styles.previewStatNum, { color: '#22c55e' }]}>
                        ₹{smsTotalAutoAmount.toLocaleString()}
                      </Text>
                      <Text style={[styles.previewStatLabel, { color: t.textMuted }]}>
                        Auto-Logged
                      </Text>
                    </View>
                  </View>

                  {/* Pending Review Link */}
                  {smsPendingCount > 0 && (
                    <TouchableOpacity
                      style={[styles.smsReviewBtn, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}
                      onPress={() => navigation.navigate('SmsPendingReview')}
                      activeOpacity={0.85}
                    >
                      <Feather name="alert-circle" size={14} color="#f59e0b" />
                      <Text style={[styles.smsReviewBtnText, { color: '#f59e0b' }]}>
                        {smsPendingCount} transaction{smsPendingCount > 1 ? 's' : ''} awaiting review
                      </Text>
                      <Feather name="chevron-right" size={14} color="#f59e0b" />
                    </TouchableOpacity>
                  )}

                  <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />

                  {/* Debit Only Toggle */}
                  <View style={styles.smsSubRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.smsSubTitle, { color: t.textPrimary }]}>Debit Only</Text>
                      <Text style={[styles.smsSubDesc, { color: t.textMuted }]}>
                        Only track outgoing payments (ignore credits/refunds)
                      </Text>
                    </View>
                    <Switch
                      value={smsDebitOnly}
                      onValueChange={handleToggleSmsDebitOnly}
                      trackColor={{ false: isDark ? '#333338' : '#e2e8f0', true: '#22c55e' }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />

                  {/* Auto-Approve Toggle */}
                  <View style={styles.smsSubRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.smsSubTitle, { color: t.textPrimary }]}>Auto-Approve</Text>
                      <Text style={[styles.smsSubDesc, { color: t.textMuted }]}>
                        Automatically add detected transactions as expenses (no review needed)
                      </Text>
                    </View>
                    <Switch
                      value={smsAutoApprove}
                      onValueChange={handleToggleSmsAutoApprove}
                      trackColor={{ false: isDark ? '#333338' : '#e2e8f0', true: '#22c55e' }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  {/* Amount Thresholds */}
                  {smsAutoApprove && (
                    <>
                      <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />
                      <View style={styles.smsAmountRow}>
                        <Text style={[styles.smsSubTitle, { color: t.textPrimary }]}>
                          Max Auto-Approve ₹
                        </Text>
                        <TextInput
                          style={[
                            styles.smsAmountInput,
                            { backgroundColor: t.itemBg, borderColor: t.cardBorder, color: t.textPrimary },
                          ]}
                          value={smsMaxAutoApprove}
                          onChangeText={setSmsMaxAutoApprove}
                          onBlur={handleSaveMaxAutoApprove}
                          keyboardType="number-pad"
                          placeholder="5000"
                          placeholderTextColor={t.textMuted}
                        />
                      </View>
                    </>
                  )}

                  <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />

                  {/* Min Amount */}
                  <View style={styles.smsAmountRow}>
                    <Text style={[styles.smsSubTitle, { color: t.textPrimary }]}>
                      Min Amount ₹
                    </Text>
                    <TextInput
                      style={[
                        styles.smsAmountInput,
                        { backgroundColor: t.itemBg, borderColor: t.cardBorder, color: t.textPrimary },
                      ]}
                      value={smsMinAmount}
                      onChangeText={setSmsMinAmount}
                      onBlur={handleSaveMinAmount}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor={t.textMuted}
                    />
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: t.cardBorder }]} />

                  {/* View All Detected Transactions */}
                  <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => navigation.navigate('SmsPendingReview')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.settingIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}>
                      <Feather name="list" size={18} color="#22c55e" />
                    </View>
                    <View style={styles.settingMetaCol}>
                      <Text style={[styles.settingTitle, { color: t.textPrimary }]}>
                        View Detected Transactions
                      </Text>
                      <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                        Review, approve, or dismiss auto-captured bank transactions
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={t.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 4: DANGER ZONE (Reset Expense Data)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: t.danger }]}>
            RESET & REFRESH DATA
          </Text>
        </View>

        <View
          style={[
            styles.settingsCard,
            { backgroundColor: t.cardBg, borderColor: 'rgba(239, 68, 68, 0.3)' },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={[styles.settingIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}>
              <Feather name="trash-2" size={19} color="#ef4444" />
            </View>

            <View style={styles.settingMetaCol}>
              <Text style={[styles.settingTitle, { color: '#ef4444' }]}>
                Reset Complete Expense Tracker
              </Text>
              <Text style={[styles.settingDesc, { color: t.textMuted }]}>
                Permanently deletes all expenses and custom budgets, starting fresh from 0.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.resetActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
              onPress={handleResetExpenseData}
              disabled={isResetting}
              activeOpacity={0.8}
            >
              {isResetting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={styles.resetActionBtnText}>Reset</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Month Selection Modal */}
      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMonthPickerVisible(false)}
        >
          <View
            style={[
              styles.pickerModalContent,
              { backgroundColor: t.cardBg, borderColor: t.cardBorder },
            ]}
          >
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: t.textPrimary }]}>
                Select Report Month
              </Text>
              <TouchableOpacity onPress={() => setMonthPickerVisible(false)}>
                <Feather name="x" size={18} color={t.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {monthOptions.map((opt) => {
                const isSelected = opt.key === selectedMonthKey;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.monthOptionRow,
                      isSelected && { backgroundColor: isDark ? '#1C1C24' : '#F1F5F9' },
                    ]}
                    onPress={() => {
                      setSelectedMonthKey(opt.key);
                      setMonthPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthOptionText,
                        {
                          color: isSelected ? '#0D9488' : t.textPrimary,
                          fontWeight: isSelected ? '800' : '500',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && <Feather name="check" size={15} color="#0D9488" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Creation Modal */}
      <CategoryModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        onSuccess={() => {
          setCategoryModalVisible(false);
          loadMonthPreview();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  headerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerBadgeText: {
    color: '#0D9488',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 18,
  },
  sectionHeaderRow: {
    marginBottom: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  settingsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingMetaCol: {
    flex: 1,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  settingDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardDivider: {
    height: 1,
    marginVertical: 14,
  },
  pdfHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  monthSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthSelectorLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthPickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    marginBottom: 14,
  },
  previewStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  previewStatNum: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewStatLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  previewStatDivider: {
    width: 1,
    height: 24,
  },
  generatePdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    borderRadius: 14,
  },
  generatePdfBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  resetActionBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  monthOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  monthOptionText: {
    fontSize: 13,
  },
  // SMS Auto-Detection styles
  smsSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 4,
  },
  smsSubTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  smsSubDesc: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
  },
  smsAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
  },
  smsAmountInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  smsReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  smsReviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  smsPermissionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  smsPermissionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  settingsLinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    marginLeft: 4,
  },
  settingsLinkText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#f59e0b',
  },
});
