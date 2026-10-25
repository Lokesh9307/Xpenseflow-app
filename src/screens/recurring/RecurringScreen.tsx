import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

const FREQUENCIES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'daily', label: 'Daily' },
];

const SUBSCRIPTION_ICONS: Record<string, string> = {
  netflix: 'tv-outline',
  spotify: 'musical-notes-outline',
  apple: 'logo-apple',
  amazon: 'cart-outline',
  prime: 'film-outline',
  gym: 'barbell-outline',
  rent: 'home-outline',
  wifi: 'wifi-outline',
  internet: 'wifi-outline',
  cloud: 'cloud-outline',
  youtube: 'logo-youtube',
  electricity: 'flash-outline',
};

const getSubscriptionIcon = (title: string, category?: string) => {
  const lower = (title || '').toLowerCase();
  for (const key of Object.keys(SUBSCRIPTION_ICONS)) {
    if (lower.includes(key)) return SUBSCRIPTION_ICONS[key];
  }
  if (category === 'Food & Dining') return 'restaurant-outline';
  if (category === 'Shopping') return 'bag-handle-outline';
  if (category === 'Travel & Commute') return 'car-outline';
  if (category === 'Bills & Utilities') return 'flash-outline';
  return 'repeat-outline';
};

export const RecurringScreen = ({ navigation }: any) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [recurringList, setRecurringList] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Recurring Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [selectedCategory, setSelectedCategory] = useState('Subscriptions');
  const [saving, setSaving] = useState(false);

  // Filter state (All / Active / Paused)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  // TRANTOR Color Palette
  const t = useMemo(() => ({
    screenBg: isDark ? '#000000' : '#EBF0F3',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    iconBg: isDark ? '#222228' : '#F1F5F9',
    accentTeal: '#0D9488',
    accentGreen: '#059669',
    danger: '#EF4444',
    kpiBg: isDark ? '#101012' : '#FFFFFF',
  }), [isDark]);

  const loadData = useCallback(async () => {
    try {
      const [recRes, catRes] = await Promise.all([
        api.getRecurringExpenses(),
        api.getCategories(),
      ]);

      if (recRes.data && Array.isArray(recRes.data)) {
        setRecurringList(recRes.data);
      }
      if (catRes.data && Array.isArray(catRes.data)) {
        setCategories(catRes.data);
        if (catRes.data.length > 0 && selectedCategory === 'Subscriptions') {
          // If category list has Subscriptions or similar
          const hasSubs = catRes.data.some((c: any) => c.name === 'Subscriptions');
          if (!hasSubs) setSelectedCategory(catRes.data[0].name);
        }
      }
    } catch (err) {
      console.error('Error loading recurring data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveRecurring = async () => {
    const num = parseFloat(amount);
    if (!title.trim() || !amount || isNaN(num) || num <= 0) {
      Alert.alert('Required Fields', 'Please enter a valid subscription name and amount');
      return;
    }

    setSaving(true);
    const catObj = categories.find((c) => c.name === selectedCategory);

    const res = await api.addRecurringExpense({
      title: title.trim(),
      amount: num,
      frequency,
      category: selectedCategory,
      categoryId: catObj?._id || catObj?.id,
      startDate: new Date().toISOString(),
      active: true,
    });
    setSaving(false);

    if (res.error) {
      Alert.alert('Error', res.error);
    } else {
      setTitle('');
      setAmount('');
      setFrequency('monthly');
      setModalVisible(false);
      loadData();
      Alert.alert('Success', `"${title.trim()}" is now actively tracked and connected to your budgets.`);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const nextStatus = !currentActive;
    setRecurringList((prev) =>
      prev.map((r) => ((r._id || r.id) === id ? { ...r, active: nextStatus } : r))
    );
    const res = await api.updateRecurringExpense(id, { active: nextStatus });
    if (res.error) {
      Alert.alert('Error', res.error);
      loadData();
    }
  };

  const handleTriggerNow = (item: any) => {
    const id = item._id || item.id;
    Alert.alert(
      'Log Subscription Expense',
      `Log ₹${Number(item.amount).toLocaleString()} for "${item.title}" right now? This creates an active expense entry and immediately updates your cash flow and category limits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Expense Now',
          style: 'default',
          onPress: async () => {
            const res = await api.triggerRecurringExpense(id);
            if (res.error) {
              Alert.alert('Error', res.error);
            } else {
              Alert.alert(
                'Expense Logged',
                `₹${Number(item.amount).toLocaleString()} for "${item.title}" was successfully recorded!`,
                [{ text: 'OK', onPress: () => loadData() }]
              );
            }
          },
        },
      ]
    );
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Subscription', `Stop tracking and delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteRecurringExpense(id);
          setRecurringList((prev) => prev.filter((r) => (r._id || r.id) !== id));
        },
      },
    ]);
  };

  // Calculations
  const activeSubscriptions = recurringList.filter((item) => item.active !== false);

  const monthlyCommitment = activeSubscriptions.reduce((acc, item) => {
    const val = Number(item.amount) || 0;
    if (item.frequency === 'yearly') return acc + Math.round(val / 12);
    if (item.frequency === 'weekly') return acc + val * 4;
    if (item.frequency === 'daily') return acc + val * 30;
    return acc + val;
  }, 0);

  const filteredList = useMemo(() => {
    if (statusFilter === 'active') return recurringList.filter((r) => r.active !== false);
    if (statusFilter === 'paused') return recurringList.filter((r) => r.active === false);
    return recurringList;
  }, [recurringList, statusFilter]);

  return (
    <View style={[styles.container, { backgroundColor: t.screenBg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: t.cardBg,
            borderBottomColor: t.cardBorder,
            paddingTop: Math.max(insets.top + 6, 16),
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Recurring</Text>
          <Text style={[styles.headerSub, { color: t.textMuted }]}>
            Subscriptions & Auto-Bills ({activeSubscriptions.length} active)
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={15} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accentTeal}
            colors={[t.accentTeal]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* KPI Banner Card */}
        <View style={[styles.kpiBanner, { backgroundColor: t.kpiBg, borderColor: t.cardBorder }]}>
          <View style={styles.kpiTopRow}>
            <View>
              <Text style={[styles.kpiLabel, { color: t.textMuted }]}>
                TOTAL MONTHLY OBLIGATION
              </Text>
              <Text style={[styles.kpiAmount, { color: t.textPrimary }]}>
                ₹{monthlyCommitment.toLocaleString()}
                <Text style={[styles.kpiPeriod, { color: t.textMuted }]}>/month</Text>
              </Text>
            </View>

            <View style={styles.kpiBadgePill}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#0D9488" />
              <Text style={styles.kpiBadgePillText}>Auto-Add Active</Text>
            </View>
          </View>

          <View style={[styles.kpiDivider, { backgroundColor: t.cardBorder }]} />

          <View style={styles.kpiBottomRow}>
            <View style={styles.kpiMiniStat}>
              <Text style={[styles.kpiMiniNum, { color: t.textPrimary }]}>
                {activeSubscriptions.length}
              </Text>
              <Text style={[styles.kpiMiniLabel, { color: t.textMuted }]}>Active</Text>
            </View>

            <View style={[styles.kpiMiniStatDivider, { backgroundColor: t.cardBorder }]} />

            <View style={styles.kpiMiniStat}>
              <Text style={[styles.kpiMiniNum, { color: t.textPrimary }]}>
                {recurringList.length - activeSubscriptions.length}
              </Text>
              <Text style={[styles.kpiMiniLabel, { color: t.textMuted }]}>Paused</Text>
            </View>

            <View style={[styles.kpiMiniStatDivider, { backgroundColor: t.cardBorder }]} />

            <View style={styles.kpiMiniStat}>
              <Text style={[styles.kpiMiniNum, { color: t.textPrimary }]}>
                ₹{(monthlyCommitment * 12).toLocaleString()}
              </Text>
              <Text style={[styles.kpiMiniLabel, { color: t.textMuted }]}>Yearly Est.</Text>
            </View>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterStrip}>
          {(['all', 'active', 'paused'] as const).map((st) => {
            const isActive = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? (isDark ? '#FFFFFF' : '#0F172A') : t.cardBg,
                    borderColor: isActive ? (isDark ? '#FFFFFF' : '#0F172A') : t.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? (isDark ? '#000000' : '#FFFFFF') : t.textMuted,
                      fontWeight: isActive ? '800' : '600',
                    },
                  ]}
                >
                  {st === 'all' ? 'All Subscriptions' : st === 'active' ? 'Active Only' : 'Paused'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Subscriptions List */}
        {loading ? (
          <ActivityIndicator size="small" color={t.accentTeal} style={{ marginVertical: 30 }} />
        ) : filteredList.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Ionicons name="repeat" size={38} color={t.textMuted} />
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
              {statusFilter === 'paused' ? 'No paused subscriptions' : 'No recurring subscriptions'}
            </Text>
            <Text style={[styles.emptySub, { color: t.textMuted }]}>
              Track Netflix, Spotify, Rent, Gym, or Wi-Fi to keep your budget automatically synchronized.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => setModalVisible(true)}
            >
              <Feather name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>Add First Subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredList.map((item) => {
            const id = item._id || item.id;
            const isActive = item.active !== false;
            const iconName = getSubscriptionIcon(item.title, item.category);
            const freqLabel = (item.frequency || 'monthly').toUpperCase();

            // Next renewal display
            let dueText = 'Scheduled';
            if (item.nextDueDate) {
              const d = new Date(item.nextDueDate);
              if (!isNaN(d.getTime())) {
                dueText = `Renews ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
              }
            }

            return (
              <View
                key={id}
                style={[
                  styles.subscriptionCard,
                  {
                    backgroundColor: t.cardBg,
                    borderColor: t.cardBorder,
                    opacity: isActive ? 1 : 0.72,
                  },
                ]}
              >
                {/* Top Row: Icon + Meta + Amount */}
                <View style={styles.subCardTopRow}>
                  <View style={[styles.subIconSquare, { backgroundColor: t.iconBg }]}>
                    <Ionicons name={iconName as any} size={20} color={t.textPrimary} />
                  </View>

                  <View style={styles.subMetaCol}>
                    <View style={styles.subTitleRow}>
                      <Text style={[styles.subTitle, { color: t.textPrimary }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isActive ? 'rgba(5, 150, 105, 0.12)' : 'rgba(142, 142, 147, 0.14)',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: isActive ? t.accentGreen : t.textMuted },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: isActive ? t.accentGreen : t.textMuted },
                          ]}
                        >
                          {isActive ? 'Active' : 'Paused'}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.subCategoryText, { color: t.textMuted }]}>
                      {item.category || 'Subscriptions'} · {freqLabel}
                    </Text>
                  </View>

                  <View style={styles.subAmountCol}>
                    <Text style={[styles.subAmountText, { color: t.textPrimary }]}>
                      ₹{Number(item.amount || 0).toLocaleString()}
                    </Text>
                    <Text style={[styles.subDueText, { color: t.accentTeal }]}>
                      {dueText}
                    </Text>
                  </View>
                </View>

                {/* Bottom Action Row: Log Now / Toggle Active / Delete */}
                <View style={[styles.subCardBottomRow, { borderTopColor: t.cardBorder }]}>
                  {/* Quick Run-Now / Log Expense Now Button */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => handleTriggerNow(item)}
                    style={[styles.quickActionPill, { backgroundColor: t.iconBg }]}
                  >
                    <Feather name="zap" size={12} color="#0D9488" />
                    <Text style={[styles.quickActionPillText, { color: t.textPrimary }]}>
                      Log Expense Now
                    </Text>
                  </TouchableOpacity>

                  {/* Toggle Active / Pause */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => handleToggleActive(id, isActive)}
                    style={[styles.quickActionPill, { backgroundColor: t.iconBg }]}
                  >
                    <Feather name={isActive ? 'pause' : 'play'} size={12} color={t.textMuted} />
                    <Text style={[styles.quickActionPillText, { color: t.textMuted }]}>
                      {isActive ? 'Pause' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  {/* Delete Button */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => handleDelete(id, item.title)}
                    style={styles.deleteIconButton}
                  >
                    <Feather name="trash-2" size={14} color={t.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Recurring Subscription Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={[styles.sheetContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            {/* Sheet Handle */}
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)' },
              ]}
            />

            <View style={[styles.sheetHeader, { borderBottomColor: t.cardBorder }]}>
              <View>
                <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>
                  Add Recurring Subscription
                </Text>
                <Text style={[styles.sheetSub, { color: t.textMuted }]}>
                  Automatically added as an expense on due dates
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.sheetCloseBtn, { backgroundColor: t.iconBg }]}
              >
                <Feather name="x" size={18} color={t.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={[styles.inputLabel, { color: t.textMuted }]}>SUBSCRIPTION / OBLIGATION NAME</Text>
              <TextInput
                style={[
                  styles.sheetInput,
                  { backgroundColor: t.iconBg, borderColor: t.cardBorder, color: t.textPrimary },
                ]}
                placeholder="e.g. Netflix, Spotify, Wi-Fi, Gym, Rent"
                placeholderTextColor={t.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              {/* Amount */}
              <Text style={[styles.inputLabel, { color: t.textMuted }]}>AMOUNT (₹)</Text>
              <TextInput
                style={[
                  styles.sheetInput,
                  { backgroundColor: t.iconBg, borderColor: t.cardBorder, color: t.textPrimary },
                ]}
                placeholder="499"
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Frequency Selector */}
              <Text style={[styles.inputLabel, { color: t.textMuted }]}>BILLING FREQUENCY</Text>
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => {
                  const isSelected = frequency === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setFrequency(f.key)}
                      style={[
                        styles.freqChip,
                        {
                          backgroundColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.iconBg,
                          borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.freqText,
                          {
                            color: isSelected ? (isDark ? '#000000' : '#FFFFFF') : t.textMuted,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Connected Category Picker */}
              <Text style={[styles.inputLabel, { color: t.textMuted }]}>CONNECTED BUDGET CATEGORY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryPillsRow}
              >
                {categories.map((c) => {
                  const isSelected = selectedCategory === c.name;
                  return (
                    <TouchableOpacity
                      key={c.name}
                      onPress={() => setSelectedCategory(c.name)}
                      style={[
                        styles.catPill,
                        {
                          backgroundColor: isSelected ? '#0D9488' : t.iconBg,
                          borderColor: isSelected ? '#0D9488' : t.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          {
                            color: isSelected ? '#FFFFFF' : t.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveRecurring}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save & Start Tracking</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 14,
  },
  kpiBanner: {
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  kpiPeriod: {
    fontSize: 13,
    fontWeight: '600',
  },
  kpiBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kpiBadgePillText: {
    color: '#0D9488',
    fontSize: 11,
    fontWeight: '700',
  },
  kpiDivider: {
    height: 1,
    marginVertical: 14,
  },
  kpiBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  kpiMiniStat: {
    alignItems: 'center',
  },
  kpiMiniNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  kpiMiniLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  kpiMiniStatDivider: {
    width: 1,
    height: 24,
  },
  filterStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
  },
  subscriptionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
  },
  subCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subMetaCol: {
    flex: 1,
  },
  subTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subCategoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  subAmountCol: {
    alignItems: 'flex-end',
  },
  subAmountText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subDueText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  subCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
    gap: 8,
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  quickActionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteIconButton: {
    padding: 6,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D9488',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    marginTop: 10,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sheetInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  freqChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  freqText: {
    fontSize: 11,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingVertical: 4,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 11,
  },
  saveBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
