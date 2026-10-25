import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { AddExpenseModal } from '../../components/AddExpenseModal';
import { CategoryModal } from '../../components/CategoryModal';
import { Category3DIcon } from '../../components/Category3DIcon';
import { dataEvents } from '../../services/dataEvents';

export const CategoryDetailScreen = ({ route, navigation }: any) => {
  const {
    categoryId,
    categoryName: initialName,
    categoryLimit: initialLimit,
    categoryIcon: initialIcon,
  } = route.params || {};
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [categoryName, setCategoryName] = useState(initialName || 'Category');
  const [categoryIcon, setCategoryIcon] = useState(initialIcon || '');
  const [limit, setLimit] = useState(initialLimit || 5000);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Month filtering state (defaults to current month: YYYY-MM)
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [showMonthModal, setShowMonthModal] = useState(false);

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

  // Modals
  const [addExpenseModalVisible, setAddExpenseModalVisible] = useState(false);
  const [editCategoryModalVisible, setEditCategoryModalVisible] = useState(false);

  const fetchCategoryData = useCallback(async () => {
    try {
      const expParams: Record<string, string> = { category: categoryName, limit: '150' };
      if (selectedMonth && selectedMonth !== 'all') expParams.month = selectedMonth;

      const [expRes, catRes] = await Promise.all([
        api.getExpenses(expParams),
        api.getCategories(),
      ]);

      if (expRes.data && Array.isArray(expRes.data)) {
        let list = expRes.data.filter((e) => {
          const itemCat = (e.category || '').toLowerCase().trim();
          const targetCat = categoryName.toLowerCase().trim();
          return (
            itemCat === targetCat ||
            (targetCat.includes('tiffin') && itemCat.includes('tiffin')) ||
            (targetCat.includes('split') && itemCat.includes('split'))
          );
        });
        if (selectedMonth && selectedMonth !== 'all') {
          list = list.filter((e) => {
            if (!e.date) return false;
            return e.date.slice(0, 7) === selectedMonth;
          });
        }
        setExpenses(list);
      }

      if (catRes.data && Array.isArray(catRes.data)) {
        const found = catRes.data.find(
          (c: any) => (c._id || c.id) === categoryId || c.name === categoryName
        );
        if (found) {
          setCategoryName(found.name);
          setLimit(found.limit || found.monthlyLimit || 5000);
          if (found.icon) setCategoryIcon(found.icon);
        }
      }
    } catch (err) {
      console.error('Failed to load category details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId, categoryName, selectedMonth]);

  useEffect(() => {
    fetchCategoryData();
  }, [fetchCategoryData]);

  // Instant 0ms synchronization: category expenses update in milliseconds
  useEffect(() => {
    const unsubExpAdded = dataEvents.on('expense_added', (newExp: any) => {
      if (newExp) {
        const itemCat = (newExp.category || '').toLowerCase().trim();
        const targetCat = categoryName.toLowerCase().trim();
        const matchesCat =
          itemCat === targetCat ||
          (targetCat.includes('tiffin') && itemCat.includes('tiffin')) ||
          (targetCat.includes('split') && itemCat.includes('split'));

        if (matchesCat) {
          setExpenses((prev) => {
            const id = newExp._id || newExp.id;
            if (prev.some((e) => (e._id || e.id) === id)) return prev;
            if (selectedMonth && selectedMonth !== 'all' && newExp.date) {
              if (newExp.date.slice(0, 7) !== selectedMonth) return prev;
            }
            return [newExp, ...prev];
          });
        }
      }
      fetchCategoryData();
    });

    const unsubExpDeleted = dataEvents.on('expense_deleted', (deletedId: string) => {
      setExpenses((prev) => prev.filter((e) => (e._id || e.id) !== deletedId));
      fetchCategoryData();
    });

    const unsubExpUpdated = dataEvents.on('expense_updated', (updatedExp: any) => {
      if (updatedExp) {
        const id = updatedExp._id || updatedExp.id;
        setExpenses((prev) =>
          prev.map((e) => ((e._id || e.id) === id ? { ...e, ...updatedExp } : e))
        );
      }
      fetchCategoryData();
    });

    const unsubCatUpdated = dataEvents.on('category_updated', (cat: any) => {
      if (
        cat &&
        (cat.name === categoryName ||
          (cat._id || cat.id) === categoryId ||
          (cat.previousName && cat.previousName === categoryName))
      ) {
        if (cat.name) setCategoryName(cat.name);
        if (cat.limit || cat.monthlyLimit) setLimit(cat.limit || cat.monthlyLimit);
        if (cat.icon) setCategoryIcon(cat.icon);
        if (cat.previousName && cat.name && cat.previousName !== cat.name) {
          setExpenses((prev) =>
            prev.map((e) => (e.category === cat.previousName ? { ...e, category: cat.name } : e))
          );
        }
      }
      fetchCategoryData();
    });

    const unsubRefresh = dataEvents.on('refresh_data', () => {
      fetchCategoryData();
    });

    return () => {
      unsubExpAdded();
      unsubExpDeleted();
      unsubExpUpdated();
      unsubCatUpdated();
      unsubRefresh();
    };
  }, [categoryName, categoryId, selectedMonth, fetchCategoryData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategoryData();
  };

  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = Math.max(0, limit - totalSpent);
  const percentUsed = limit > 0 ? Math.min(Math.round((totalSpent / limit) * 100), 100) : 0;
  const isOverBudget = totalSpent > limit;

  const handleDeleteExpense = (id: string, title: string) => {
    Alert.alert(
      'Delete Expense',
      `Delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await api.deleteExpense(id);
            if (res.error) Alert.alert('Error', res.error);
            else fetchCategoryData();
          },
        },
      ]
    );
  };

  // ── Monochromatic TRANTOR Palette ──
  const t = {
    screenBg: isDark ? '#000000' : '#EBF0F3',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    itemBg: isDark ? '#1C1C20' : '#F8FAFC',
    itemBorder: isDark ? '#26262B' : '#E2E8F0',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    accent: '#0D9488',
    handleBg: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
    overlayBg: 'rgba(0, 0, 0, 0.72)',
  };

  return (
    <View style={[styles.container, { backgroundColor: t.screenBg }]}>
      {/* ── Top Header Bar ── */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: Math.max(insets.top + 6, 20),
            backgroundColor: t.cardBg,
            borderBottomColor: t.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: t.itemBg }]}
        >
          <Feather name="arrow-left" size={18} color={t.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerSub, { color: t.textMuted }]}>
            FOLDER TRANSACTIONS
          </Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]} numberOfLines={1}>
            {categoryName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setEditCategoryModalVisible(true)}
          style={[styles.editBtn, { backgroundColor: t.itemBg }]}
        >
          <Feather name="settings" size={17} color={t.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item._id || item.id || String(Math.random())}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* ── Modern Unified Category Hero Card ── */}
            <View
              style={[
                styles.heroUnifiedCard,
                {
                  backgroundColor: t.cardBg,
                  borderColor: t.cardBorder,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDark ? 0.35 : 0.06,
                  shadowRadius: 12,
                  elevation: 3,
                },
              ]}
            >
              {/* Top Banner Row: Category Tag Pill + Edit Category Button */}
              <View style={styles.heroCardHeaderRow}>
                <View
                  style={[
                    styles.heroCategoryPill,
                    {
                      backgroundColor: isDark ? '#1C1C22' : '#F1F5F9',
                      borderColor: t.cardBorder,
                    },
                  ]}
                >
                  <Feather name="folder" size={12} color={t.accent} />
                  <Text style={[styles.heroCategoryPillText, { color: t.textPrimary }]} numberOfLines={1}>
                    {categoryName}
                  </Text>
                  <View
                    style={[
                      styles.heroStatusDot,
                      {
                        backgroundColor: isOverBudget
                          ? '#EF4444'
                          : percentUsed >= 80
                          ? '#F59E0B'
                          : '#0D9488',
                      },
                    ]}
                  />
                </View>

                {/* Quick Edit Category Button */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setEditCategoryModalVisible(true)}
                  style={[
                    styles.heroEditCardBtn,
                    {
                      backgroundColor: isDark ? '#1F1F26' : '#F8FAFC',
                      borderColor: t.cardBorder,
                    },
                  ]}
                >
                  <Feather name="edit-2" size={12} color={t.accent} />
                  <Text style={[styles.heroEditCardBtnText, { color: t.textPrimary }]}>Edit Category</Text>
                </TouchableOpacity>
              </View>

              {/* Main Spending Row: 3D Category Icon + Spent Amount + Utilization Badge */}
              <View style={styles.heroRow}>
                <View style={styles.heroIconBox}>
                  <Category3DIcon category={categoryName} icon={categoryIcon} size={50} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroSpentLabel, { color: t.textMuted }]}>
                    Total Spent ({selectedMonth === 'all' ? 'All Time' : selectedMonthLabel})
                  </Text>
                  <Text style={[styles.heroSpentAmount, { color: t.textPrimary }]}>
                    ₹{totalSpent.toLocaleString()}
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroBadge,
                    {
                      backgroundColor: isOverBudget
                        ? 'rgba(239, 68, 68, 0.15)'
                        : percentUsed >= 80
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(13, 148, 136, 0.15)',
                      borderColor: isOverBudget
                        ? 'rgba(239, 68, 68, 0.3)'
                        : percentUsed >= 80
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(13, 148, 136, 0.3)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.heroBadgeText,
                      {
                        color: isOverBudget
                          ? '#EF4444'
                          : percentUsed >= 80
                          ? '#F59E0B'
                          : t.accent,
                      },
                    ]}
                  >
                    {isOverBudget ? '⚠️ Exceeded' : `${percentUsed}% used`}
                  </Text>
                </View>
              </View>

              {/* Progress Bar Track */}
              <View
                style={[
                  styles.heroProgressTrack,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#E2E8F0',
                  },
                ]}
              >
                <View
                  style={[
                    styles.heroProgressFill,
                    {
                      width: `${percentUsed}%`,
                      backgroundColor: isOverBudget
                        ? '#EF4444'
                        : percentUsed >= 80
                        ? '#F59E0B'
                        : t.accent,
                    },
                  ]}
                />
              </View>

              {/* Bottom Financial Metrics Row */}
              <View style={[styles.heroStatsRow, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' }]}>
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroSubStatLabel, { color: t.textMuted }]}>Budget Limit</Text>
                  <Text style={[styles.heroSubStatValue, { color: t.textPrimary }]}>
                    ₹{limit.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.heroStatDivider, { backgroundColor: t.cardBorder }]} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroSubStatLabel, { color: t.textMuted }]}>
                    {isOverBudget ? 'Over Budget' : 'Remaining'}
                  </Text>
                  <Text
                    style={[
                      styles.heroSubStatValue,
                      { color: isOverBudget ? '#EF4444' : t.accent },
                    ]}
                  >
                    ₹{Math.abs(remaining).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.heroStatDivider, { backgroundColor: t.cardBorder }]} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroSubStatLabel, { color: t.textMuted }]}>Transactions</Text>
                  <Text style={[styles.heroSubStatValue, { color: t.textPrimary }]}>
                    {expenses.length}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Section Title + Month Selector + Add Button ── */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.sectionHeading, { color: t.textPrimary }]}>
                  Saved Transactions
                </Text>
                <Text style={[styles.sectionCount, { color: t.textMuted }]} numberOfLines={1}>
                  {expenses.length} records · {selectedMonthLabel}
                </Text>
              </View>

              <View style={styles.sectionActionBtns}>
                {/* Month Picker Pill */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowMonthModal(true)}
                  style={[
                    styles.monthFilterPill,
                    { backgroundColor: t.itemBg, borderColor: t.itemBorder },
                  ]}
                >
                  <Feather name="calendar" size={12} color={t.accent} />
                  <Text style={[styles.monthFilterText, { color: t.textPrimary }]} numberOfLines={1}>
                    {selectedMonth === 'all'
                      ? 'All'
                      : new Date(`${selectedMonth}-01`).toLocaleString('en-US', { month: 'short' })}
                  </Text>
                  <Feather name="chevron-down" size={11} color={t.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setAddExpenseModalVisible(true)}
                  style={[styles.addExpenseBtn, { backgroundColor: t.accent }]}
                >
                  <Feather name="plus" size={14} color="#FFFFFF" />
                  <Text style={styles.addExpenseBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={t.accent} style={{ marginTop: 40 }} />
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <Feather name="inbox" size={32} color={t.textMuted} />
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
                No transactions in this folder
              </Text>
              <Text style={[styles.emptySub, { color: t.textMuted }]}>
                {selectedMonth === 'all'
                  ? 'No expenses recorded in this category yet.'
                  : `No expenses recorded for ${selectedMonthLabel}. Tap "+ Add" to log an expense.`}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isTiffin =
            item.syncSource === 'tiffin' ||
            categoryName === 'Tiffin Expense' ||
            (item.title && item.title.toLowerCase().startsWith('tiffin:'));
          const isSplit =
            item.syncSource === 'split' ||
            categoryName === 'Split Expense' ||
            (item.title && item.title.toLowerCase().startsWith('split:'));
          const isAutoDetected =
            item.isAutoDetected || item.syncSource === 'sms_auto';
          const groupName =
            item.groupName ||
            item.notes?.match(/Group:\s*([^·\n]+)/)?.[1]?.trim() ||
            item.title?.match(/\(([^)]+)\)$/)?.[1]?.trim();

          return (
            <View
              style={[
                styles.txnCard,
                { backgroundColor: t.cardBg, borderColor: t.cardBorder },
              ]}
            >
              <View
                style={[
                  styles.txnIconSquare,
                  {
                    backgroundColor: isTiffin
                      ? isDark
                        ? 'rgba(234, 88, 12, 0.18)'
                        : '#FFEDD5'
                      : isSplit
                      ? isDark
                        ? 'rgba(139, 92, 246, 0.18)'
                        : '#EDE9FE'
                      : isAutoDetected
                      ? isDark
                        ? 'rgba(59, 130, 246, 0.18)'
                        : '#EFF6FF'
                      : t.itemBg,
                  },
                ]}
              >
                <Ionicons
                  name={isTiffin ? 'restaurant' : isSplit ? 'people' : isAutoDetected ? 'flash' : 'receipt-outline'}
                  size={18}
                  color={isTiffin ? '#ea580c' : isSplit ? '#8b5cf6' : isAutoDetected ? '#3b82f6' : t.textPrimary}
                />
              </View>

              <View style={styles.txnCenterCol}>
                <View style={styles.txnTitleRow}>
                  <Text style={[styles.txnTitle, { color: t.textPrimary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>

                {groupName ? (
                  <View style={styles.groupBadgeRow}>
                    <View
                      style={[
                        styles.groupTagPill,
                        {
                          backgroundColor: isTiffin
                            ? isDark
                              ? 'rgba(234, 88, 12, 0.18)'
                              : '#FFF7ED'
                            : isSplit
                            ? isDark
                              ? 'rgba(139, 92, 246, 0.18)'
                              : '#F5F3FF'
                            : t.itemBg,
                          borderColor: isTiffin
                            ? '#ea580c'
                            : isSplit
                            ? '#8b5cf6'
                            : t.cardBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isTiffin ? 'restaurant-outline' : isSplit ? 'people-outline' : 'folder-outline'}
                        size={10}
                        color={isTiffin ? '#ea580c' : isSplit ? '#8b5cf6' : t.textMuted}
                      />
                      <Text
                        style={[
                          styles.groupTagText,
                          {
                            color: isTiffin ? '#ea580c' : isSplit ? '#8b5cf6' : t.textPrimary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {groupName}
                      </Text>
                    </View>
                  </View>
                ) : isAutoDetected ? (
                  <View style={styles.groupBadgeRow}>
                    <View
                      style={[
                        styles.groupTagPill,
                        {
                          backgroundColor: isDark
                            ? 'rgba(59, 130, 246, 0.16)'
                            : '#EFF6FF',
                          borderColor: '#3B82F6',
                        },
                      ]}
                    >
                      <Ionicons name="flash-outline" size={10} color="#3B82F6" />
                      <Text style={[styles.groupTagText, { color: '#3B82F6' }]}>
                        Auto-detected SMS
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Text style={[styles.txnSub, { color: t.textMuted }]}>
                  {item.date
                    ? new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recent'}{' '}
                  · {item.paymentMethod || 'UPI'}
                </Text>
              </View>

              <View style={styles.txnRightCol}>
                <Text style={[styles.txnAmount, { color: t.textPrimary }]}>
                  -₹{Number(item.amount || 0).toLocaleString()}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeleteExpense(item._id || item.id, item.title)}
                  style={styles.trashBtn}
                >
                  <Feather name="trash-2" size={13} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

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
                  Filter {categoryName} expenses month-wise
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMonthModal(false)}
                style={[styles.closeBtn, { backgroundColor: t.itemBg }]}
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
                        borderColor: isSelected ? t.accent : t.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.monthOptionLeft}>
                      <Feather
                        name={opt.val === 'all' ? 'clock' : 'calendar'}
                        size={16}
                        color={isSelected ? t.accent : t.textMuted}
                      />
                      <Text
                        style={[
                          styles.monthOptionLabel,
                          {
                            color: isSelected ? t.accent : t.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {opt.label}
                        {opt.isCurrent ? ' (Current)' : ''}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={[styles.selectedCircle, { backgroundColor: t.accent }]}>
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

      {/* Add Expense modal pre-selecting this category */}
      <AddExpenseModal
        visible={addExpenseModalVisible}
        onClose={() => setAddExpenseModalVisible(false)}
        onSuccess={fetchCategoryData}
      />

      {/* Edit Category Modal */}
      <CategoryModal
        visible={editCategoryModalVisible}
        onClose={() => setEditCategoryModalVisible(false)}
        onSuccess={() => {
          fetchCategoryData();
        }}
        initialCategory={{
          _id: categoryId,
          name: categoryName,
          limit,
          icon: categoryIcon,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerSub: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  listContent: {
    padding: 18,
    paddingBottom: 60,
    gap: 12,
  },

  // Unified Hero Card geometry
  heroUnifiedCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 10,
    gap: 14,
  },
  heroCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '65%',
  },
  heroCategoryPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroEditCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroEditCardBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroIconBox: {
    marginRight: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  heroSpentLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  heroSpentAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSubStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  heroSubStatValue: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroStatDivider: {
    width: 1,
    height: 22,
    opacity: 0.8,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  monthFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
    maxWidth: 75,
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Transaction list card
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  txnIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnCenterCol: {
    flex: 1,
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txnSub: {
    fontSize: 11,
    marginTop: 2,
  },
  txnRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  txnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 2,
  },
  groupTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  groupTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trashBtn: {
    padding: 4,
  },

  // Empty state
  emptyBox: {
    padding: 30,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 11,
    textAlign: 'center',
  },

  // Month Modal
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
