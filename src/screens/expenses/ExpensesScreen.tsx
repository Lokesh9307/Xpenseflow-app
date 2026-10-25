import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { dataEvents } from '../../services/dataEvents';
import { AddExpenseModal } from '../../components/AddExpenseModal';

const CATEGORIES = [
  'All',
  'Food & Dining',
  'Shopping',
  'Travel & Commute',
  'Bills & Utilities',
  'Entertainment',
  'Health & Fitness',
  'Groceries',
  'Education',
  'Investment',
  'Others',
];

const CATEGORY_ICONS: Record<string, string> = {
  'Food & Dining': 'restaurant-outline',
  Shopping: 'bag-handle-outline',
  'Travel & Commute': 'car-outline',
  'Bills & Utilities': 'flash-outline',
  Entertainment: 'film-outline',
  'Health & Fitness': 'fitness-outline',
  Groceries: 'cart-outline',
  Education: 'book-outline',
  Investment: 'trending-up-outline',
  Others: 'cube-outline',
};

export const ExpensesScreen = ({ navigation }: any) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicTop = Math.max(insets.top + 6, 16);

  // TRANTOR Theme palette
  const t = {
    screenBg: isDark ? '#000000' : '#EBF0F3',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    itemBg: isDark ? '#18181B' : '#F8FAFC',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    inputBg: isDark ? '#141416' : '#FFFFFF',
    inputBorder: isDark ? '#26262B' : '#E2E8F0',
    iconBg: isDark ? '#222228' : '#F1F5F9',
    accentTeal: '#0D9488',
    danger: '#EF4444',
    handleBg: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
    overlayBg: 'rgba(0, 0, 0, 0.72)',
  };

  // Month filtering state (defaults to current month: YYYY-MM)
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [showMonthModal, setShowMonthModal] = useState(false);

  // Available month choices: past 12 months + "All Time"
  const monthOptions = useMemo(() => {
    const list = Array.from({ length: 12 }, (_, index) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - index);
      const val = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      return { val, label, isCurrent: index === 0 };
    });
    return [
      ...list,
      { val: 'all', label: 'All Time (All Months)', isCurrent: false },
    ];
  }, []);

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'All Time';
    if (selectedMonth === currentMonthStr) {
      const name = new Date(`${selectedMonth}-01`).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      return `This Month (${name})`;
    }
    return new Date(`${selectedMonth}-01`).toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }, [selectedMonth, currentMonthStr]);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      const params: Record<string, string> = { sortBy: 'date', sortOrder: 'desc', limit: '150' };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedMonth && selectedMonth !== 'all') params.month = selectedMonth;

      const res = await api.getExpenses(params);
      if (res.data && Array.isArray(res.data)) {
        let list = res.data;
        // Client-side verification ensuring strictly matching month if server returns all
        if (selectedMonth && selectedMonth !== 'all') {
          list = list.filter((e) => {
            if (!e.date) return false;
            return e.date.slice(0, 7) === selectedMonth;
          });
        }
        setExpenses(list);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedMonth]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Instant 0ms synchronization: listens to global dataEvents
  useEffect(() => {
    const unsubAdded = dataEvents.on('expense_added', (newExp: any) => {
      if (!newExp) return;
      setExpenses((prev) => {
        const id = newExp._id || newExp.id;
        if (prev.some((e) => (e._id || e.id) === id)) return prev;
        if (selectedMonth && selectedMonth !== 'all' && newExp.date) {
          if (newExp.date.slice(0, 7) !== selectedMonth) return prev;
        }
        return [newExp, ...prev];
      });
    });

    const unsubDeleted = dataEvents.on('expense_deleted', (deletedId: string) => {
      setExpenses((prev) => prev.filter((e) => (e._id || e.id) !== deletedId));
    });

    const unsubUpdated = dataEvents.on('expense_updated', (updatedExp: any) => {
      const id = updatedExp._id || updatedExp.id;
      setExpenses((prev) =>
        prev.map((e) => ((e._id || e.id) === id ? { ...e, ...updatedExp } : e))
      );
    });

    return () => {
      unsubAdded();
      unsubDeleted();
      unsubUpdated();
    };
  }, [selectedMonth]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchExpenses();
  };

  const handleDeleteExpense = (id: string, title: string) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Instantly deletes in 0ms!
            const res = await api.deleteExpense(id);
            if (res.error) {
              Alert.alert('Error', res.error);
            }
          },
        },
      ]
    );
  };

  const totalSpent = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Highest Category Spend: category name and total expense only
  const highestCategorySpend = useMemo(() => {
    if (expenses.length === 0) return { name: 'None', amount: 0 };
    const map: Record<string, number> = {};
    for (const exp of expenses) {
      const cat = exp.category || 'Others';
      map[cat] = (map[cat] || 0) + (exp.amount || 0);
    }
    let topName = 'None';
    let topAmount = 0;
    for (const [name, amount] of Object.entries(map)) {
      if (amount > topAmount) {
        topAmount = amount;
        topName = name;
      }
    }
    return { name: topName, amount: topAmount };
  }, [expenses]);

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
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Transactions</Text>
          <Text style={[styles.headerSub, { color: t.textMuted }]} numberOfLines={1}>
            {expenses.length} record{expenses.length === 1 ? '' : 's'} · {selectedMonthLabel}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Month Filter Selector Pill */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowMonthModal(true)}
            style={[
              styles.monthFilterPill,
              { backgroundColor: t.iconBg, borderColor: t.cardBorder },
            ]}
          >
            <Feather name="calendar" size={13} color={t.accentTeal} />
            <Text style={[styles.monthFilterText, { color: t.textPrimary }]} numberOfLines={1}>
              {selectedMonth === 'all'
                ? 'All Time'
                : new Date(`${selectedMonth}-01`).toLocaleString('en-US', { month: 'short' })}
            </Text>
            <Feather name="chevron-down" size={12} color={t.textMuted} />
          </TouchableOpacity>

          {/* Add Expense Button */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={15} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary KPI Strip */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: t.textMuted }]}>
            {selectedMonth === 'all' ? 'ALL TIME SPENT' : 'THIS MONTH SPENT'}
          </Text>
          <Text style={[styles.kpiValue, { color: t.textPrimary }]}>
            ₹{totalSpent.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: t.textMuted }]}>HIGHEST CATEGORY SPEND</Text>
          <Text style={[styles.kpiValue, { color: t.accentTeal }]} numberOfLines={1}>
            ₹{highestCategorySpend.amount.toLocaleString()}
          </Text>
          <Text style={[styles.kpiCategoryText, { color: t.textPrimary }]} numberOfLines={1}>
            {highestCategorySpend.name}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBox, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
          <Feather name="search" size={17} color={t.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: t.textPrimary }]}
            placeholder={`Search in ${selectedMonth === 'all' ? 'all' : 'this month'} transactions...`}
            placeholderTextColor={t.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={t.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills Filter */}
      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.cardBg,
                    borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected ? (isDark ? '#000000' : '#FFFFFF') : t.textMuted,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Transactions List */}
      {loading ? (
        <ActivityIndicator size="large" color={t.accentTeal} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accentTeal}
              colors={[t.accentTeal]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBox, { backgroundColor: t.iconBg }]}>
                <Ionicons name="receipt-outline" size={36} color={t.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No transactions found</Text>
              <Text style={[styles.emptySub, { color: t.textMuted }]}>
                {search || selectedCategory !== 'All'
                  ? 'Try clearing your search query or category filter'
                  : `No expenses logged for ${selectedMonthLabel}. Tap "+ Add" to record an expense.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const iconName = CATEGORY_ICONS[item.category] || 'receipt-outline';
            return (
              <View
                style={[
                  styles.itemCard,
                  { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                ]}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.itemIconCircle, { backgroundColor: t.iconBg }]}>
                    <Ionicons name={iconName as any} size={18} color={t.textPrimary} />
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: t.textPrimary }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.itemSubRow}>
                      <Text style={[styles.itemBadge, { backgroundColor: t.iconBg, color: t.textMuted }]}>
                        {item.category || 'General'}
                      </Text>
                      <Text style={[styles.itemDate, { color: t.textMuted }]}>
                        {item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </Text>
                      {item.paymentMethod && (
                        <Text style={[styles.itemPayment, { color: t.textMuted }]}>
                          · {item.paymentMethod}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.itemRight}>
                  <Text style={[styles.itemAmount, { color: t.textPrimary }]}>
                    -₹{item.amount?.toLocaleString()}
                  </Text>

                  <TouchableOpacity
                    onPress={() => handleDeleteExpense(item._id || item.id, item.title)}
                    style={styles.deleteBtn}
                  >
                    <Feather name="trash-2" size={14} color={t.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── Month Selection Unified Bottom Sheet ── */}
      <Modal
        visible={showMonthModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowMonthModal(false)}
          />
          <View style={[styles.sheetContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            {/* Grabber Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: t.handleBg }]} />

            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: t.cardBorder }]}>
              <View>
                <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Select Time Period</Text>
                <Text style={[styles.sheetSub, { color: t.textMuted }]}>
                  Filter transactions month-wise or view all
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMonthModal(false)}
                style={[styles.closeBtn, { backgroundColor: t.iconBg }]}
              >
                <Feather name="x" size={18} color={t.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={styles.monthListContent}>
              {monthOptions.map((opt) => {
                const isSelected = selectedMonth === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.val}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedMonth(opt.val);
                      setShowMonthModal(false);
                    }}
                    style={[
                      styles.monthOptionRow,
                      {
                        backgroundColor: isSelected ? (isDark ? 'rgba(13, 148, 136, 0.12)' : '#CCFBF1') : t.itemBg,
                        borderColor: isSelected ? t.accentTeal : t.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.monthOptionLeft}>
                      <Feather
                        name={opt.val === 'all' ? 'clock' : 'calendar'}
                        size={16}
                        color={isSelected ? t.accentTeal : t.textMuted}
                      />
                      <Text
                        style={[
                          styles.monthOptionLabel,
                          {
                            color: isSelected ? t.accentTeal : t.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {opt.label}
                        {opt.isCurrent ? ' (Current)' : ''}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={[styles.selectedCircle, { backgroundColor: t.accentTeal }]}>
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Expense Modal */}
      <AddExpenseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={fetchExpenses}
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  monthFilterText: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 80,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  kpiCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  kpiCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: -0.2,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  chipsRow: {
    paddingVertical: 12,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7.5,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 6,
  },
  itemDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemPayment: {
    fontSize: 11,
    marginLeft: 3,
    fontWeight: '500',
  },
  itemRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
    lineHeight: 18,
  },

  // Modal Sheet Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthListContent: {
    padding: 16,
    gap: 8,
  },
  monthOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  monthOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthOptionLabel: {
    fontSize: 14,
  },
  selectedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
