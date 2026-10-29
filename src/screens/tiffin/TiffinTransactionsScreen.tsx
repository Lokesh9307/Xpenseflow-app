import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { fmtMoney } from '../../utils/money';
import { AddTiffinModal } from '../../components/AddTiffinModal';

export const TiffinTransactionsScreen = ({ navigation }: any) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicTop = Math.max(insets.top + 6, 16);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsMonth, setTransactionsMonth] = useState<string | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const fetchRequestId = useRef(0);

  const fetchTransactions = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    try {
      const [txRes, grpRes] = await Promise.all([
        api.getTiffinTransactions(selectedMonth),
        api.getTiffinGroups(),
      ]);

      if (requestId === fetchRequestId.current && txRes.data && Array.isArray(txRes.data)) {
        setTransactions(txRes.data);
        setTransactionsMonth(selectedMonth);
      }
      if (requestId === fetchRequestId.current && grpRes.data && Array.isArray(grpRes.data)) {
        setGroups(grpRes.data);
      }
    } catch (err) {
      console.error('Error fetching tiffin transactions:', err);
    } finally {
      if (requestId === fetchRequestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => () => {
    fetchRequestId.current += 1;
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthTitle = (monthStr: string) => {
    const [y, m] = monthStr.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const monthTransactions = transactionsMonth === selectedMonth ? transactions : [];
  const hasTransactionsForSelectedMonth = transactionsMonth === selectedMonth;
  const filteredTransactions = monthTransactions.filter((tx) => {
    if (selectedGroupId === 'all') return true;
    return (tx.groupId?._id || tx.groupId || tx.group?._id || tx.group) === selectedGroupId;
  });

  const totalSpent = filteredTransactions.reduce(
    (acc, tx) => acc + (Number(tx.totalPrice ?? tx.totalCost) || 0),
    0
  );
  const totalMeals = filteredTransactions.reduce(
    (acc, tx) => {
      const quantity = Number(tx.quantity ?? tx.count ?? 1);
      return acc + (Number.isFinite(quantity) ? quantity : 1);
    },
    0
  );

  const getMealBadge = (type: string) => {
    const clean = (type || 'lunch').toLowerCase();
    switch (clean) {
      case 'breakfast':
        return { label: 'Breakfast', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', icon: 'sunny-outline' };
      case 'dinner':
        return { label: 'Dinner', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', icon: 'moon-outline' };
      case 'extra':
        return { label: 'Extra Meal', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)', icon: 'fast-food-outline' };
      case 'lunch':
      default:
        return { label: 'Lunch', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)', icon: 'restaurant-outline' };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgApp }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: dynamicTop,
            backgroundColor: theme.bgSurface,
            borderBottomColor: theme.borderSubtle,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Tiffin Transactions</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            Monthly meal logs & ledger history
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: '#ea580c' }]}
          onPress={() => setLogModalVisible(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>Log Meal</Text>
        </TouchableOpacity>
      </View>

      {/* Month Navigator Strip */}
      <View style={[styles.monthStrip, { backgroundColor: theme.bgSurface, borderBottomColor: theme.borderSubtle }]}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
          <Feather name="chevron-left" size={20} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.monthTitleBlock}>
          <Ionicons name="calendar-outline" size={16} color="#ea580c" style={{ marginRight: 6 }} />
          <Text style={[styles.monthTitleText, { color: theme.textPrimary }]}>
            {formatMonthTitle(selectedMonth)}
          </Text>
        </View>

        <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
          <Feather name="chevron-right" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* KPI Stats Strip */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Total Month Spent</Text>
          <Text style={[styles.kpiValue, { color: '#ea580c' }]}>
            {hasTransactionsForSelectedMonth ? `₹${fmtMoney(totalSpent)}` : '—'}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Total Tiffins</Text>
          <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
            {hasTransactionsForSelectedMonth ? `${totalMeals} Meals` : '—'}
          </Text>
        </View>
      </View>

      {/* Group Filter Chips */}
      {groups.length > 0 && (
        <View style={styles.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <TouchableOpacity
              onPress={() => setSelectedGroupId('all')}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedGroupId === 'all' ? '#ea580c' : theme.bgSurface,
                  borderColor: selectedGroupId === 'all' ? '#ea580c' : theme.borderSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedGroupId === 'all' ? '#ffffff' : theme.textPrimary },
                ]}
              >
                All Groups ({groups.length})
              </Text>
            </TouchableOpacity>

            {groups.map((grp) => {
              const isSelected = selectedGroupId === grp._id;
              return (
                <TouchableOpacity
                  key={grp._id}
                  onPress={() => setSelectedGroupId(grp._id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? '#ea580c' : theme.bgSurface,
                      borderColor: isSelected ? '#ea580c' : theme.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isSelected ? '#ffffff' : theme.textPrimary },
                    ]}
                  >
                    {grp.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Transaction List */}
      {loading ? (
        <ActivityIndicator size="large" color="#ea580c" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ea580c"
              colors={['#ea580c']}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: 110 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={54} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No meal entries found</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                No tiffin logs recorded for {formatMonthTitle(selectedMonth)}. Tap &quot;+ Log Meal&quot; to add one.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: '#ea580c' }]}
                onPress={() => setLogModalVisible(true)}
              >
                <Text style={styles.emptyBtnText}>Log Tiffin Meal</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getMealBadge(item.mealType);
            const dateStr = item.date
              ? new Date(item.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Today';

            const grpName = item.groupName || item.groupId?.name || 'Tiffin Group';
            const price = item.totalPrice ?? item.totalCost ?? 80;
            const count = item.quantity ?? item.count ?? 1;

            return (
              <View
                style={[
                  styles.txCard,
                  { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
                ]}
              >
                <View style={styles.txLeft}>
                  <View style={[styles.mealIconCircle, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon as any} size={20} color={badge.color} />
                  </View>

                  <View style={styles.txInfo}>
                    <View style={styles.txTitleRow}>
                      <Text style={[styles.txTitle, { color: theme.textPrimary }]}>{badge.label}</Text>
                      <View style={[styles.mealBadgePill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.mealBadgePillText, { color: badge.color }]}>
                          {count} tiffin{count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.txSub, { color: theme.textMuted }]}>
                      {grpName} · {dateStr}
                    </Text>

                    {item.notes ? (
                      <Text style={[styles.txNotes, { color: theme.textSecondary }]} numberOfLines={1}>
                        &ldquo;{item.notes}&rdquo;
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.txRight}>
                  <Text style={[styles.txPrice, { color: '#ea580c' }]}>₹{fmtMoney(price)}</Text>
                  <Text style={[styles.txShare, { color: theme.textMuted }]}>Ledger</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Tiffin Modal */}
      <AddTiffinModal
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        initialGroupId={selectedGroupId !== 'all' ? selectedGroupId : groups[0]?._id}
        onSuccess={fetchTransactions}
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
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  monthStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 12,
  },
  monthTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  chipsRow: {
    marginTop: 12,
    marginBottom: 4,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  mealIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  mealBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mealBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  txSub: {
    fontSize: 11,
    marginTop: 2,
  },
  txNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  txPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  txShare: {
    fontSize: 10,
    marginTop: 2,
  },
});
