import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { dataEvents } from '../../services/dataEvents';
import {
  getAllDetectedTransactions,
  approveTransaction,
  dismissTransaction,
  approveAllPending,
  dismissAllPending,
  DetectedTransaction,
  getReadableRawSms,
} from '../../services/smsTransactionStore';

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#A78BFA',
  'Shopping': '#84CC16',
  'Travel & Commute': '#38BDF8',
  'Bills & Utilities': '#F59E0B',
  'Entertainment': '#F472B6',
  'Groceries': '#10B981',
  'Health & Fitness': '#EF4444',
  'Education': '#6366F1',
  'Investment': '#14B8A6',
  'Others': '#9CA3AF',
};

type FilterTab = 'pending' | 'approved' | 'dismissed' | 'all';

export const SmsPendingReviewScreen = ({ navigation }: any) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicTop = Math.max(insets.top + 6, 16);

  const t = {
    screenBg: isDark ? '#000000' : '#EBF0F3',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    itemBg: isDark ? '#18181B' : '#F8FAFC',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    iconBg: isDark ? '#222228' : '#F1F5F9',
    accentGreen: '#22c55e',
    accentAmber: '#f59e0b',
    danger: '#EF4444',
  };

  const [transactions, setTransactions] = useState<DetectedTransaction[]>([]);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTxn, setEditingTxn] = useState<DetectedTransaction | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const all = await getAllDetectedTransactions();
      setTransactions(all);
    } catch (err) {
      console.error('[SmsPendingReview] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    const unsub1 = dataEvents.on('sms_transaction_detected', loadTransactions);
    const unsub2 = dataEvents.on('sms_transaction_approved', loadTransactions);
    const unsub3 = dataEvents.on('sms_transaction_dismissed', loadTransactions);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [loadTransactions]);

  const filtered = transactions.filter((txn) => {
    if (filter === 'all') return true;
    if (filter === 'approved') return txn.status === 'approved' || txn.status === 'synced';
    return txn.status === filter;
  });

  const pendingCount = transactions.filter((t) => t.status === 'pending').length;

  // Approve single transaction
  const handleApprove = async (txnId: string) => {
    setActionLoading(txnId);
    await approveTransaction(txnId);
    await loadTransactions();
    setActionLoading(null);
  };

  // Dismiss single transaction
  const handleDismiss = async (txnId: string) => {
    setActionLoading(txnId);
    await dismissTransaction(txnId);
    await loadTransactions();
    setActionLoading(null);
  };

  // Edit and approve
  const handleEditAndApprove = (txn: DetectedTransaction) => {
    setEditingTxn(txn);
    setEditCategory(txn.category);
    setEditMerchant(txn.merchant);
    setEditAmount(String(txn.amount));
    setEditNotes('');
    setEditModalVisible(true);
  };

  const handleSaveEdits = async () => {
    if (!editingTxn) return;
    setActionLoading(editingTxn._id);
    setEditModalVisible(false);

    await approveTransaction(editingTxn._id, {
      amount: parseFloat(editAmount) || editingTxn.amount,
      category: editCategory || editingTxn.category,
      merchant: editMerchant || editingTxn.merchant,
      notes: editNotes,
    });

    await loadTransactions();
    setActionLoading(null);
  };

  // Bulk actions
  const handleApproveAll = () => {
    Alert.alert(
      'Approve All Pending?',
      `This will create expenses for all ${pendingCount} pending transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          onPress: async () => {
            setLoading(true);
            await approveAllPending();
            await loadTransactions();
          },
        },
      ]
    );
  };

  const handleDismissAll = () => {
    Alert.alert(
      'Dismiss All Pending?',
      `This will reject all ${pendingCount} pending transactions. They won't be added as expenses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await dismissAllPending();
            await loadTransactions();
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getStatusColor = (status: DetectedTransaction['status']) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': case 'synced': return '#22c55e';
      case 'dismissed': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const getStatusLabel = (status: DetectedTransaction['status']) => {
    switch (status) {
      case 'pending': return 'PENDING';
      case 'approved': return 'APPROVED';
      case 'synced': return 'SYNCED';
      case 'dismissed': return 'DISMISSED';
      default: return (status as string).toUpperCase();
    }
  };

  const CATEGORIES = [
    'Food & Dining', 'Shopping', 'Travel & Commute', 'Bills & Utilities',
    'Entertainment', 'Groceries', 'Health & Fitness', 'Education',
    'Investment', 'Others',
  ];

  return (
    <View style={[styles.container, { backgroundColor: t.screenBg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: dynamicTop, backgroundColor: t.cardBg, borderBottomColor: t.cardBorder },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: t.iconBg }]}
        >
          <Feather name="arrow-left" size={18} color={t.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>
            SMS Transactions
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.textMuted }]}>
            Auto-detected bank transactions
          </Text>
        </View>

        {pendingCount > 0 && (
          <View style={[styles.headerBadge, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
            <Text style={styles.headerBadgeText}>{pendingCount} PENDING</Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {(['pending', 'approved', 'dismissed', 'all'] as FilterTab[]).map((tab) => {
          const isActive = filter === tab;
          const count = tab === 'all'
            ? transactions.length
            : tab === 'approved'
            ? transactions.filter((t) => t.status === 'approved' || t.status === 'synced').length
            : transactions.filter((t) => t.status === tab).length;

          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setFilter(tab)}
              style={[
                styles.filterTab,
                {
                  backgroundColor: isActive
                    ? (isDark ? '#FFFFFF' : '#0F172A')
                    : t.itemBg,
                  borderColor: isActive
                    ? (isDark ? '#FFFFFF' : '#0F172A')
                    : t.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  {
                    color: isActive
                      ? (isDark ? '#000000' : '#FFFFFF')
                      : t.textMuted,
                    fontWeight: isActive ? '800' : '500',
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bulk Actions (only for pending) */}
      {filter === 'pending' && pendingCount > 0 && (
        <View style={[styles.bulkActionsRow, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <TouchableOpacity
            style={[styles.bulkBtn, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}
            onPress={handleApproveAll}
          >
            <Feather name="check-circle" size={14} color="#22c55e" />
            <Text style={[styles.bulkBtnText, { color: '#22c55e' }]}>Approve All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bulkBtn, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}
            onPress={handleDismissAll}
          >
            <Feather name="x-circle" size={14} color="#ef4444" />
            <Text style={[styles.bulkBtnText, { color: '#ef4444' }]}>Dismiss All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Transaction List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={t.accentGreen} style={{ marginTop: 60 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={48}
              color={t.textMuted}
              style={{ opacity: 0.5 }}
            />
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
              No {filter !== 'all' ? filter : ''} transactions
            </Text>
            <Text style={[styles.emptyDesc, { color: t.textMuted }]}>
              {filter === 'pending'
                ? 'Transactions you dismissed from the pop-up will appear here for later review'
                : 'No transactions found for this filter'}
            </Text>
          </View>
        ) : (
          filtered.map((txn) => {
            const catColor = CATEGORY_COLORS[txn.category] || '#9CA3AF';
            const statusColor = getStatusColor(txn.status);
            const isProcessing = actionLoading === txn._id;

            return (
              <View
                key={txn._id}
                style={[
                  styles.txnCard,
                  { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                ]}
              >
                {/* Top Row: Amount + Status */}
                <View style={styles.txnTopRow}>
                  <View style={styles.txnAmountCol}>
                    <Text style={[styles.txnAmount, { color: txn.type === 'debit' ? t.danger : t.accentGreen }]}>
                      {txn.type === 'debit' ? '-' : '+'}₹{txn.amount.toLocaleString()}
                    </Text>
                    <Text style={[styles.txnType, { color: t.textMuted }]}>
                      {txn.type.toUpperCase()} • {txn.paymentMethod}
                    </Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
                    <Text style={[styles.statusPillText, { color: statusColor }]}>
                      {getStatusLabel(txn.status)}
                    </Text>
                  </View>
                </View>

                {/* Merchant */}
                <Text style={[styles.txnMerchant, { color: t.textPrimary }]}>
                  {txn.merchant}
                </Text>

                {/* Meta Row */}
                <View style={styles.txnMetaRow}>
                  <View style={[styles.txnCategoryBadge, { backgroundColor: `${catColor}20` }]}>
                    <Text style={[styles.txnCategoryText, { color: catColor }]}>
                      {txn.category}
                    </Text>
                  </View>

                  <Text style={[styles.txnBank, { color: t.textMuted }]}>{txn.bank}</Text>
                  <Text style={[styles.txnDate, { color: t.textMuted }]}>
                    {formatDate(txn.date)}
                  </Text>
                </View>

                {/* Ref Number */}
                {(txn.referenceNumber || txn.upiTxnId) && (
                  <Text style={[styles.txnRef, { color: t.textMuted }]} numberOfLines={1}>
                    Ref: {txn.referenceNumber || txn.upiTxnId}
                    {txn.accountLast4 ? ` • A/c ****${txn.accountLast4}` : ''}
                  </Text>
                )}

                {txn.isRefund && (
                  <View style={[styles.refundBadge, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                    <Feather name="rotate-ccw" size={11} color="#22c55e" />
                    <Text style={styles.refundText}>Refund / Reversal</Text>
                  </View>
                )}

                {/* Action Buttons (only for pending) */}
                {txn.status === 'pending' && (
                  <View style={styles.txnActions}>
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={t.accentGreen} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.txnActionBtn, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}
                          onPress={() => handleApprove(txn._id)}
                        >
                          <Feather name="check" size={14} color="#22c55e" />
                          <Text style={[styles.txnActionText, { color: '#22c55e' }]}>Approve</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.txnActionBtn, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}
                          onPress={() => handleEditAndApprove(txn)}
                        >
                          <Feather name="edit-2" size={14} color="#38bdf8" />
                          <Text style={[styles.txnActionText, { color: '#38bdf8' }]}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.txnActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}
                          onPress={() => handleDismiss(txn._id)}
                        >
                          <Feather name="x" size={14} color="#ef4444" />
                          <Text style={[styles.txnActionText, { color: '#ef4444' }]}>Dismiss</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.editModalBackdrop}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        />
        <View
          style={[
            styles.editModalSheet,
            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
          ]}
        >
          <View style={[styles.editModalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />

          <Text style={[styles.editModalTitle, { color: t.textPrimary }]}>
            Edit & Approve Transaction
          </Text>

          {editingTxn && (
            <>
              {/* Amount */}
              <Text style={[styles.editLabel, { color: t.textMuted }]}>AMOUNT (₹)</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: t.itemBg, borderColor: t.cardBorder, color: t.textPrimary }]}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
              />

              {/* Merchant */}
              <Text style={[styles.editLabel, { color: t.textMuted }]}>MERCHANT / TITLE</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: t.itemBg, borderColor: t.cardBorder, color: t.textPrimary }]}
                value={editMerchant}
                onChangeText={setEditMerchant}
              />

              {/* Category */}
              <Text style={[styles.editLabel, { color: t.textMuted }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.editCatsScroll}>
                {CATEGORIES.map((cat) => {
                  const isSelected = editCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setEditCategory(cat)}
                      style={[
                        styles.editCatChip,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? '#FFFFFF' : '#0F172A')
                            : t.itemBg,
                          borderColor: isSelected
                            ? (isDark ? '#FFFFFF' : '#0F172A')
                            : t.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected
                            ? (isDark ? '#000000' : '#FFFFFF')
                            : t.textMuted,
                        }}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Notes */}
              <Text style={[styles.editLabel, { color: t.textMuted }]}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[
                  styles.editInput,
                  { backgroundColor: t.itemBg, borderColor: t.cardBorder, color: t.textPrimary, height: 60 },
                ]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                placeholder="Add notes..."
                placeholderTextColor={t.textMuted}
              />

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.editSaveBtn, { backgroundColor: t.accentGreen }]}
                onPress={handleSaveEdits}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.editSaveBtnText}>Save & Approve</Text>
              </TouchableOpacity>
            </>
          )}
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
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  filterBar: {
    maxHeight: 50,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 12,
  },
  bulkActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bulkBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  txnCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  txnTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  txnAmountCol: {},
  txnAmount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  txnType: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  txnMerchant: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  txnMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  txnCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  txnCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  txnBank: {
    fontSize: 11,
    fontWeight: '500',
  },
  txnDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  txnRef: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  refundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  refundText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22c55e',
  },
  txnActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  txnActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
  },
  txnActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Edit Modal
  editModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  editModalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 22,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  editModalHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  editLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
  },
  editCatsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  editCatChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  editSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },
  editSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
