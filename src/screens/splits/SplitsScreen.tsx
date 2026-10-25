import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { AddSplitModal } from '../../components/AddSplitModal';
import { CommonAppHeader } from '../../components/CommonAppHeader';

export const SplitsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicTop = Math.max(insets.top + 6, 16);

  const [summary, setSummary] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Group Modal
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Quick Bill Split Modal
  const [splitExpenseModal, setSplitExpenseModal] = useState(false);

  const fetchSplits = useCallback(async () => {
    try {
      const [sumRes, grpRes] = await Promise.all([
        api.getSplitSummary(),
        api.getSplitGroups(),
      ]);

      if (sumRes.data) setSummary(sumRes.data);
      if (grpRes.data && Array.isArray(grpRes.data)) setGroups(grpRes.data);
    } catch (err) {
      console.error('Error fetching splits:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSplits();
  }, [fetchSplits]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSplits();
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for the group');
      return;
    }

    setCreating(true);
    const res = await api.createSplitGroup({ name: groupName.trim() });
    setCreating(false);

    if (res.error) {
      Alert.alert('Error', res.error);
    } else {
      setGroupName('');
      setNewGroupModal(false);
      fetchSplits();
    }
  };

  const totalOwedToYou = summary?.totalOwedToYou ?? 0;
  const totalYouOwe = summary?.totalYouOwe ?? 0;
  const netBalance = totalOwedToYou - totalYouOwe;

  return (
    <View style={[styles.container, { backgroundColor: theme.bgApp }]}>
      {/* ── Common Fixed Header: (Hey, {name}! / Avatar / Bell Well) ── */}
      <CommonAppHeader moduleBadge={{ label: 'SPLIT', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' }} />

      {/* Sub-Header with Action Button */}
      <View
        style={[
          styles.header,
          {
            paddingTop: 12,
            backgroundColor: theme.bgSurface,
            borderBottomColor: theme.borderSubtle,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Split Costs</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            Shared group expenses & settlements
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#0D9488' }]}
            onPress={() => setSplitExpenseModal(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color="#ffffff" />
            <Text style={styles.actionBtnText}>Split Bill</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Bento Card */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Owed to You</Text>
              <Text style={[styles.summaryValue, { color: theme.success }]}>
                ₹{totalOwedToYou.toLocaleString()}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

            <View style={styles.summaryCol}>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>You Owe</Text>
              <Text style={[styles.summaryValue, { color: theme.danger }]}>
                ₹{totalYouOwe.toLocaleString()}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

            <View style={styles.summaryCol}>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Net Balance</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: netBalance >= 0 ? theme.success : theme.danger },
                ]}
              >
                {netBalance >= 0 ? '+' : '-'}₹{Math.abs(netBalance).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Groups List */}
      <View style={styles.listHeaderRow}>
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
          Your Groups ({groups.length})
        </Text>
        <TouchableOpacity
          style={styles.newGroupBtn}
          onPress={() => setNewGroupModal(true)}
        >
          <Feather name="plus" size={14} color={theme.accentPrimary} />
          <Text style={[styles.newGroupBtnText, { color: theme.accentPrimary }]}>
            New Group
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.accentPrimary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item._id || item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentPrimary}
              colors={[theme.accentPrimary]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={50} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No groups yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Create a split group with flatmates, trip buddies or friends.
              </Text>
              <TouchableOpacity
                style={[styles.createFirstBtn, { backgroundColor: '#0D9488' }]}
                onPress={() => setNewGroupModal(true)}
              >
                <Text style={styles.createFirstBtnText}>Create Your First Group</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.groupCard,
                { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
              ]}
            >
              <View style={styles.groupLeft}>
                <View style={[styles.groupIconCircle, { backgroundColor: 'rgba(13, 148, 136, 0.15)' }]}>
                  <Feather name="users" size={20} color="#0D9488" />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={[styles.groupTitle, { color: theme.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.groupMembers, { color: theme.textMuted }]}>
                    {item.members?.length || 1} members · {item.currency || 'INR (₹)'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.addExpenseInGroupBtn, { backgroundColor: theme.bgElevated }]}
                onPress={() => setSplitExpenseModal(true)}
              >
                <Text style={[styles.addExpenseInGroupText, { color: '#0D9488' }]}>+ Bill</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={newGroupModal} animationType="slide" transparent onRequestClose={() => setNewGroupModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.bgOverlay }]}>
          <View style={[styles.sheetContainer, { backgroundColor: theme.bgSurface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.borderSubtle }]}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Create Split Group</Text>
              <TouchableOpacity onPress={() => setNewGroupModal(false)}>
                <Feather name="x" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Group Name</Text>
              <TextInput
                style={[
                  styles.sheetInput,
                  { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle, color: theme.textPrimary },
                ]}
                placeholder="e.g. Goa Trip 2026, Flat 402, Office Lunch"
                placeholderTextColor={theme.textMuted}
                value={groupName}
                onChangeText={setGroupName}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: '#0D9488' }]}
                onPress={handleCreateGroup}
                disabled={creating}
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.createBtnText}>Create Group</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Split Bill Modal */}
      <AddSplitModal
        visible={splitExpenseModal}
        onClose={() => setSplitExpenseModal(false)}
        onSuccess={fetchSplits}
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
    paddingTop: 16,
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
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryContainer: {
    padding: 16,
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 36,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newGroupBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 10,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 12,
  },
  addExpenseInGroupBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  addExpenseInGroupText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  createFirstBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  createFirstBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sheetInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  createBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
