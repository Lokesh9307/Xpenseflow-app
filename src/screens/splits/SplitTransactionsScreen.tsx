import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AddSplitModal } from '../../components/AddSplitModal';

export const SplitTransactionsScreen = ({ navigation }: any) => {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const dynamicTop = Math.max(insets.top + 6, 16);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  const fetchSplitExpenses = useCallback(async () => {
    try {
      const [allRes, sumRes] = await Promise.all([
        api.getSplitAllExpenses(),
        api.getSplitSummary(),
      ]);

      if (allRes.data && Array.isArray(allRes.data)) {
        setExpenses(allRes.data);
      }
      if (sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err) {
      console.error('Error fetching split transactions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSplitExpenses();
  }, [fetchSplitExpenses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSplitExpenses();
  };

  const handleSettle = async (expenseId: string, title: string) => {
    Alert.alert(
      'Settle Split Expense',
      `Mark "${title}" as settled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: async () => {
            const res = await api.settleSplitExpense(expenseId);
            if (res.error) {
              Alert.alert('Error', res.error);
            } else {
              fetchSplitExpenses();
            }
          },
        },
      ]
    );
  };

  const currentUserId = user?.id || (user as any)?._id;

  const filteredExpenses = expenses.filter((exp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = (exp.title || exp.description || '').toLowerCase();
    const grp = (exp.groupName || exp.group?.name || '').toLowerCase();
    return title.includes(q) || grp.includes(q);
  });

  const totalOwed = summary?.totalOwedToYou ?? 0;
  const totalYouOwe = summary?.totalYouOwe ?? 0;

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
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Split History</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            All shared expenses & settlements
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: '#0d9488' }]}
          onPress={() => setSplitModalVisible(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>Split Bill</Text>
        </TouchableOpacity>
      </View>

      {/* Summary KPI Strip */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Owed To You</Text>
          <Text style={[styles.kpiValue, { color: theme.success }]}>+₹{totalOwed.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>You Owe</Text>
          <Text style={[styles.kpiValue, { color: theme.danger }]}>-₹{totalYouOwe.toLocaleString()}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBox, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Feather name="search" size={17} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search transactions or group..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Transactions List */}
      {loading ? (
        <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0d9488"
              colors={['#0d9488']}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: 110 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={54} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No split transactions yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                {search ? 'No matches found.' : 'Add an expense inside any of your split groups to see it here.'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: '#0d9488' }]}
                onPress={() => setSplitModalVisible(true)}
              >
                <Text style={styles.emptyBtnText}>Add First Split Expense</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const isPaidByMe = item.paidBy === currentUserId || item.paidBy?._id === currentUserId;
            const payerName = isPaidByMe ? 'You' : (item.paidBy?.name || 'Member');
            const grpName = item.groupName || item.groupId?.name || 'Group';
            const title = item.title || item.description || 'Shared Expense';
            const amount = item.amount || 0;
            const isSettled = item.isSettled === true;

            const mySplit = Array.isArray(item.splitBetween)
              ? item.splitBetween.find((s: any) => s.userId === currentUserId || s.userId?._id === currentUserId)
              : null;
            const myShare = mySplit ? mySplit.amount : Math.round(amount / 2);

            return (
              <View
                style={[
                  styles.itemCard,
                  { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
                ]}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.itemIconCircle, { backgroundColor: 'rgba(13, 148, 136, 0.14)' }]}>
                    <Feather name="credit-card" size={18} color="#0d9488" />
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={[styles.itemSub, { color: theme.textMuted }]}>
                      {grpName} · Paid by {payerName}
                    </Text>
                    <Text style={[styles.itemDate, { color: theme.textMuted }]}>
                      {item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemRight}>
                  <Text
                    style={[
                      styles.itemAmount,
                      { color: isPaidByMe ? theme.success : theme.danger },
                    ]}
                  >
                    {isPaidByMe ? `+₹${amount.toLocaleString()}` : `-₹${myShare.toLocaleString()}`}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isSettled
                          ? 'rgba(22, 163, 74, 0.12)'
                          : 'rgba(245, 158, 11, 0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isSettled ? theme.success : '#f59e0b' },
                      ]}
                    >
                      {isSettled ? 'Settled' : 'Active'}
                    </Text>
                  </View>

                  {!isSettled && !isPaidByMe && (
                    <TouchableOpacity
                      onPress={() => handleSettle(item._id || item.id, title)}
                      style={[styles.settleBtn, { backgroundColor: theme.bgElevated }]}
                    >
                      <Text style={[styles.settleBtnText, { color: '#0d9488' }]}>Settle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Split Modal */}
      <AddSplitModal
        visible={splitModalVisible}
        onClose={() => setSplitModalVisible(false)}
        onSuccess={fetchSplitExpenses}
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
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
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
  searchWrapper: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
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
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  itemIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 10,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  settleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  settleBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
