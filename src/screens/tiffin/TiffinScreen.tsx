import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Share,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { api, getStaticGroupCode } from '../../services/api';
import { AddTiffinModal } from '../../components/AddTiffinModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ShareCodeModal } from '../../components/ShareCodeModal';
import { GroupConfigModal } from '../../components/GroupConfigModal';
import { generateAndShareTiffinReportPdf } from '../../services/tiffinPdfService';
import { CommonAppHeader } from '../../components/CommonAppHeader';
import { dataEvents } from '../../services/dataEvents';

const { width } = Dimensions.get('window');

// Top-down Indian thali plate asset for Hero section
const TIFFIN_HERO_IMAGE = require('../../../assets/tiffin_hero_plate.jpg');

// Dedicated stainless steel lunch box asset for Add Tiffin button
const TIFFIN_ADD_BOX_IMAGE = require('../../../assets/tiffin_add_box.jpg');

export const TiffinScreen = () => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Selected Group and Data
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [groupLoading, setGroupLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Month navigation (Defaults to current month YYYY-MM; auto-resets on 1st of every month!)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Active view tab: 'member_logs' | 'monthly_ledger'
  const [activeTab, setActiveTab] = useState<'member_logs' | 'monthly_ledger'>('member_logs');

  // Modals
  const [tiffinModalVisible, setTiffinModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [shareCodeModalVisible, setShareCodeModalVisible] = useState(false);
  const [groupConfigModalVisible, setGroupConfigModalVisible] = useState(false);

  // Join by code modal
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // New Group modal
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('80');
  const [creating, setCreating] = useState(false);

  // Re-confirm Modal State (replaces native Alert.alert!)
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'warning' | 'info';
    loading: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    type: 'danger',
    loading: false,
    onConfirm: () => {},
  });

  const selectedGroupRef = React.useRef(selectedGroup);
  selectedGroupRef.current = selectedGroup;
  const groupsRef = React.useRef(groups);
  groupsRef.current = groups;

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.getTiffinGroups();
      if (res.data && Array.isArray(res.data)) {
        setGroups(res.data);
        if (res.data.length > 0 && !selectedGroupRef.current) {
          setSelectedGroup(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching tiffin groups:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch group details for the selected month
  const fetchGroupDetails = useCallback(async (groupId: string, monthKey: string) => {
    setGroupLoading(true);
    try {
      const res = await api.getTiffinGroupDetails(groupId, monthKey);
      if (res.data) {
        setGroupDetails(res.data);
      }
    } catch (err) {
      console.error('Error loading group details:', err);
    } finally {
      setGroupLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroup?._id) {
      fetchGroupDetails(selectedGroup._id, selectedMonth);
    }
  }, [selectedGroup, selectedMonth, fetchGroupDetails]);

  // Listen to Bottom Navbar action buttons for Tiffin (Add tiffin, Join group, Create new group, Tiffin settings)
  useEffect(() => {
    const unsubAdd = dataEvents.on('open_tiffin_add_modal', () => {
      setEditingEntry(null);
      setTiffinModalVisible(true);
    });
    const unsubJoin = dataEvents.on('open_tiffin_join_modal', () => {
      setJoinModalVisible(true);
    });
    const unsubNew = dataEvents.on('open_tiffin_new_group_modal', () => {
      setNewGroupModal(true);
    });
    const unsubSettings = dataEvents.on('open_tiffin_settings_modal', () => {
      if (!selectedGroupRef.current && groupsRef.current.length === 0) {
        triggerNoticeModal('No Group', 'Please create or join a Tiffin group first.', 'info');
        return;
      }
      setGroupConfigModalVisible(true);
    });

    const unsubRefresh = dataEvents.on('refresh_tiffin_data', () => {
      fetchGroups();
      if (selectedGroupRef.current?._id) {
        fetchGroupDetails(selectedGroupRef.current._id, selectedMonth);
      }
    });

    return () => {
      unsubAdd();
      unsubJoin();
      unsubNew();
      unsubSettings();
      unsubRefresh();
    };
  }, [fetchGroups, fetchGroupDetails, selectedMonth]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
    if (selectedGroup?._id) {
      fetchGroupDetails(selectedGroup._id, selectedMonth);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(key);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(key);
  };

  const formattedMonthLabel = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  const isCurrentMonth = (() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === curKey;
  })();

  // Delete an entry with ConfirmModal
  const triggerDeleteEntry = (entryId: string) => {
    if (!selectedGroup) return;

    setConfirmModal({
      visible: true,
      title: 'Delete Meal Record?',
      message: 'Are you sure you want to delete this recorded meal? Group member logs and monthly totals will be recalculated immediately.',
      confirmText: 'Delete Record',
      type: 'danger',
      loading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        const res = await api.deleteTiffinEntry(selectedGroup._id, entryId);
        setConfirmModal((prev) => ({ ...prev, visible: false, loading: false }));

        if (res.error) {
          triggerNoticeModal('Error', res.error, 'danger');
        } else {
          fetchGroupDetails(selectedGroup._id, selectedMonth);
        }
      },
    });
  };

  // Notice modal helper
  const triggerNoticeModal = (title: string, message: string, type: 'info' | 'warning' | 'danger') => {
    setConfirmModal({
      visible: true,
      title,
      message,
      confirmText: 'Dismiss',
      type,
      loading: false,
      onConfirm: () => setConfirmModal((prev) => ({ ...prev, visible: false })),
    });
  };

  // Edit an entry
  const handleEditEntry = (item: any) => {
    setEditingEntry(item);
    setTiffinModalVisible(true);
  };

  // Regenerate Code
  const handleRegenerateCode = async () => {
    if (!selectedGroup) return;
    const res = await api.regenerateTiffinInviteCode(selectedGroup._id);
    if (res.data?.inviteCode) {
      setGroupDetails((prev: any) => ({
        ...prev,
        inviteCode: res.data.inviteCode,
      }));
    }
  };

  // Generate and Share comprehensive A4 PDF report matching the web app
  const handleGenerateReportPdf = async () => {
    if (!selectedGroup) return;

    try {
      setGeneratingPdf(true);
      const entries = groupDetails?.entries || [];
      const totalMeals = entries.reduce(
        (s: number, e: any) => s + (e.quantity ?? e.count ?? 0),
        0
      );
      const totalCost = groupDetails?.monthTotal ?? groupDetails?.cycleTotal ?? 0;
      const memberStats = groupDetails?.memberStats || [];
      const members = selectedGroup?.members || [];
      const activeRate =
        selectedGroup?.pricePerTiffin ||
        selectedGroup?.defaultPrice ||
        groupDetails?.group?.pricePerTiffin ||
        groupDetails?.group?.defaultPrice ||
        groupDetails?.customRate ||
        100;

      await generateAndShareTiffinReportPdf({
        groupName: selectedGroup.name,
        monthLabel: formattedMonthLabel,
        activeRate,
        totalCost,
        totalMeals,
        memberCount: members.length || 1,
        members,
        memberStats,
        entries,
      });
    } catch (err: any) {
      console.warn('PDF Generation error:', err);
      triggerNoticeModal('Report Error', err?.message || 'Failed to generate PDF report', 'danger');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Share Bill now generates and shares the complete detailed PDF report
  const handleShareBill = async () => {
    await handleGenerateReportPdf();
  };

  // Join by 4-digit PIN
  const handleJoinByCode = async () => {
    if (!joinCode || joinCode.trim().length !== 4) {
      triggerNoticeModal('Invalid Code', 'Please enter a 4-digit invite code', 'warning');
      return;
    }

    setJoining(true);
    const res = await api.joinTiffinGroupByCode(joinCode.trim());
    setJoining(false);

    if (res.error) {
      triggerNoticeModal('Join Failed', res.error, 'danger');
    } else {
      setJoinModalVisible(false);
      setJoinCode('');
      fetchGroups();
      triggerNoticeModal('Success!', res.data?.message || 'You have joined the Tiffin Group!', 'info');
    }
  };

  // Create Group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      triggerNoticeModal('Required', 'Please enter a group name', 'warning');
      return;
    }

    setCreating(true);
    const res = await api.createTiffinGroup({
      name: groupName.trim(),
      defaultPrice: parseFloat(defaultPrice) || 100,
      pricePerTiffin: parseFloat(defaultPrice) || 100,
    });
    setCreating(false);

    if (res.error) {
      triggerNoticeModal('Error', res.error, 'danger');
    } else {
      setGroupName('');
      setNewGroupModal(false);
      fetchGroups();
      if (res.data) setSelectedGroup(res.data);
    }
  };

  const dynamicTop = Math.max(insets.top + 6, 16);

  // Group stats
  const activeRate = selectedGroup?.pricePerTiffin || selectedGroup?.defaultPrice || 100;

  const monthTotal = groupDetails?.monthTotal ?? groupDetails?.cycleTotal ?? 0;
  const monthQuantity = groupDetails?.monthQuantity ?? groupDetails?.cycleQuantity ?? 0;
  const memberCount = selectedGroup?.members?.length || 1;
  const todayEntries = groupDetails?.todayEntries || [];
  const noTiffinToday =
    todayEntries.length > 0 &&
    todayEntries.every((e: any) => e.noTiffin === true || e.mealType === 'none');
  const hasMealsToday = todayEntries.length > 0 && !noTiffinToday;
  const memberStatsList = groupDetails?.memberStats || [];
  const entriesList = groupDetails?.entries || [];

  // Static, deterministic unique invite code for this group (always permanent!)
  const activeInviteCode =
    groupDetails?.inviteCode && /^\d{4}$/.test(String(groupDetails.inviteCode))
      ? String(groupDetails.inviteCode)
      : (selectedGroup?.inviteCode && /^\d{4}$/.test(String(selectedGroup.inviteCode))
          ? String(selectedGroup.inviteCode)
          : getStaticGroupCode(selectedGroup?._id || selectedGroup?.name));

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#09090b' : '#f8f8f8' }]}>
      {/* ── Common Fixed Header: (Hey, {name}! / Avatar / Bell Well) ── */}
      <CommonAppHeader moduleBadge={{ label: 'TIFFIN', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.14)' }} />



      <ScrollView
        style={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f97316"
            colors={['#f97316']}
          />
        }
      >
        {/* Group Selector Pills Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {groups.map((g) => {
            const isSelected = selectedGroup?._id === g._id;
            return (
              <TouchableOpacity
                key={g._id}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected ? '#f97316' : theme.bgSurface,
                    borderColor: isSelected ? '#f97316' : theme.borderSubtle,
                  },
                ]}
                onPress={() => setSelectedGroup(g)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: isSelected ? '#ffffff' : theme.textPrimary },
                  ]}
                >
                  {g.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── 2. The Signature Hero Card (Includes Configure Group Button) ── */}
        <View style={styles.heroCardContainer}>
          <View style={styles.heroCard}>
            {/* Top Row: Rate Badge & Group Settings / Share */}
            <View style={styles.heroCardHeader}>
              <View style={styles.heroDiscountBadge}>
                <Text style={styles.heroDiscountText}>% ₹{activeRate}/MEAL</Text>
              </View>

              <View style={styles.heroHeaderBtnRow}>
                {/* Configure Group Button */}
                <TouchableOpacity
                  style={styles.heroConfigBtn}
                  onPress={() => setGroupConfigModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="settings-sharp" size={14} color="#ea580c" />
                  <Text style={styles.heroConfigBtnText}>Settings</Text>
                </TouchableOpacity>

                {/* Share PIN Button */}
                <TouchableOpacity
                  style={styles.heroShareBtn}
                  onPress={() => setShareCodeModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="share-social" size={14} color="#ea580c" />
                  <Text style={styles.heroShareBtnText}>Code: {activeInviteCode}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Typography */}
            <View style={styles.heroCardBody}>
              <Text style={styles.heroCardSubTitle}>
                {noTiffinToday ? 'Skipped Today' : hasMealsToday ? 'Meal Logged' : "Today's Tiffin"}
              </Text>
              <Text style={styles.heroCardTitle} numberOfLines={2}>
                {selectedGroup ? selectedGroup.name : 'Delicious Tiffin'}
              </Text>

              {/* Tag Pills */}
              <View style={styles.heroTagRow}>
                <View style={styles.heroTagPill}>
                  <Text style={styles.heroTagText}>Fresh Rotis</Text>
                </View>
                <View style={styles.heroTagPill}>
                  <Text style={styles.heroTagText}>Dal & Sabji</Text>
                </View>
                <View style={styles.heroTagPill}>
                  <Text style={styles.heroTagText}>{memberCount} Members</Text>
                </View>
              </View>

              {/* Price & Status Row */}
              <View style={styles.heroPriceRow}>
                <Text style={styles.heroPriceText}>
                  ₹{noTiffinToday ? '0.00' : `${activeRate}.00`}
                </Text>
                <View style={styles.heroStatusChip}>
                  <Text style={styles.heroStatusChipText}>
                    {noTiffinToday ? 'Zero Cost Day' : 'Active Mess'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Overlapping Realistic Dish Plate */}
            <View style={styles.dishImageWrapper} pointerEvents="none">
              <Image
                source={TIFFIN_HERO_IMAGE}
                style={styles.dishImage}
                resizeMode="cover"
              />
            </View>
          </View>
        </View>

        {/* ── 3. Image-Based "Add Tiffin Meal" Button (Dedicated Lunch Box Image) ── */}
        <TouchableOpacity
          style={styles.imageAddTiffinCard}
          onPress={() => {
            setEditingEntry(null);
            setTiffinModalVisible(true);
          }}
          activeOpacity={0.88}
        >
          <View style={styles.imageAddTiffinLeft}>
            <Image source={TIFFIN_ADD_BOX_IMAGE} style={styles.imageAddTiffinPlate} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <View style={styles.imageAddBadge}>
                <Text style={styles.imageAddBadgeText}>RECORD MEAL</Text>
              </View>
              <Text style={styles.imageAddTiffinTitle}>+ Add Tiffin Meal</Text>
              <Text style={styles.imageAddTiffinSub}>
                Shared base meals, extra tiffins & split
              </Text>
            </View>
          </View>
          <View style={styles.imageAddChevronCircle}>
            <Feather name="arrow-right" size={20} color="#f97316" />
          </View>
        </TouchableOpacity>

        {/* Secondary Quick Action Row: Generate Detailed Report (A4 PDF) & Share Bill */}
        <View style={styles.quickActionSecondaryRow}>
          <TouchableOpacity
            style={[
              styles.quickGenerateReportPill,
              {
                backgroundColor: isDark ? 'rgba(234, 88, 12, 0.12)' : '#fff7ed',
                borderColor: 'rgba(234, 88, 12, 0.35)',
              },
            ]}
            onPress={handleGenerateReportPdf}
            disabled={generatingPdf}
            activeOpacity={0.8}
          >
            {generatingPdf ? (
              <ActivityIndicator size="small" color="#ea580c" />
            ) : (
              <>
                <MaterialCommunityIcons name="file-pdf-box" size={18} color="#ea580c" />
                <Text style={styles.quickGenerateReportText}>Generate Report</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickShareBillPill,
              { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
            ]}
            onPress={handleShareBill}
            disabled={generatingPdf}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={16} color="#f97316" />
            <Text style={[styles.quickShareBillText, { color: theme.textPrimary }]}>
              Share Bill
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Month Navigation & 1st-of-Month Auto-Reset Indicator ────── */}
        <View
          style={[
            styles.monthNavigatorCard,
            { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
          ]}
        >
          <View style={styles.monthNavTopRow}>
            <TouchableOpacity
              style={[styles.monthNavArrow, { backgroundColor: theme.bgElevated }]}
              onPress={handlePrevMonth}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={18} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={styles.monthLabelWrapper}>
              <Text style={[styles.monthNavTitle, { color: theme.textPrimary }]}>
                {formattedMonthLabel}
              </Text>
              <Text style={[styles.monthNavSub, { color: theme.textMuted }]}>
                {isCurrentMonth ? 'Active Current Billing Cycle' : 'Archived Month History'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.monthNavArrow, { backgroundColor: theme.bgElevated }]}
              onPress={handleNextMonth}
              activeOpacity={0.7}
            >
              <Feather name="chevron-right" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5. 4 Nutrition / Stat Columns for This Month ──────────────── */}
        <View
          style={[
            styles.metricsCard,
            { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
          ]}
        >
          <View style={styles.metricCol}>
            <Text style={[styles.metricVal, { color: theme.textPrimary }]}>₹{activeRate}</Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Rate/Meal</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metricCol}>
            <Text style={[styles.metricVal, { color: theme.textPrimary }]}>{monthQuantity}</Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Month Meals</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metricCol}>
            <Text style={[styles.metricVal, { color: '#f97316' }]}>
              ₹{monthTotal > 999 ? `${(monthTotal / 1000).toFixed(1)}k` : monthTotal}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Month Bill</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metricCol}>
            <Text style={[styles.metricVal, { color: theme.textPrimary }]}>{memberCount}</Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Members</Text>
          </View>
        </View>

        {/* ── 6. Segmented Switcher: Member Logs vs Meal Ledger ────────── */}
        <View style={[styles.tabSwitcherRow, { backgroundColor: theme.bgElevated }]}>
          <TouchableOpacity
            style={[
              styles.tabSwitchBtn,
              activeTab === 'member_logs' && [styles.tabSwitchActive, { backgroundColor: theme.bgSurface }],
            ]}
            onPress={() => setActiveTab('member_logs')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={18}
              color={activeTab === 'member_logs' ? '#f97316' : theme.textMuted}
            />
            <Text
              style={[
                styles.tabSwitchText,
                { color: activeTab === 'member_logs' ? '#f97316' : theme.textMuted },
              ]}
              numberOfLines={1}
            >
              Member Logs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabSwitchBtn,
              activeTab === 'monthly_ledger' && [styles.tabSwitchActive, { backgroundColor: theme.bgSurface }],
            ]}
            onPress={() => setActiveTab('monthly_ledger')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="clipboard-text-clock-outline"
              size={18}
              color={activeTab === 'monthly_ledger' ? '#f97316' : theme.textMuted}
            />
            <Text
              style={[
                styles.tabSwitchText,
                { color: activeTab === 'monthly_ledger' ? '#f97316' : theme.textMuted },
              ]}
              numberOfLines={1}
            >
              Meal Ledger
            </Text>
            {entriesList.length > 0 && (
              <View
                style={[
                  styles.tabCountBadge,
                  {
                    backgroundColor:
                      activeTab === 'monthly_ledger'
                        ? 'rgba(249, 115, 22, 0.15)'
                        : 'rgba(150, 150, 150, 0.15)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabCountBadgeText,
                    { color: activeTab === 'monthly_ledger' ? '#f97316' : theme.textMuted },
                  ]}
                >
                  {entriesList.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── TAB 1: MEMBER LOGS (EACH PERSON'S EXPENSE FOR THIS MONTH) ────── */}
        {activeTab === 'member_logs' && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitleMain, { color: theme.textPrimary }]}>
                  Member Logs for {formattedMonthLabel}
                </Text>
                <Text style={[styles.sectionTitleSub, { color: theme.textMuted }]}>
                  Individual member meal counts, extra tiffins & expense breakdown
                </Text>
              </View>
            </View>

            {memberStatsList.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
                <MaterialCommunityIcons name="account-group" size={36} color={theme.textMuted} />
                <Text style={[styles.emptyCardTitle, { color: theme.textPrimary }]}>
                  No expense logged for {formattedMonthLabel}
                </Text>
                <Text style={[styles.emptyCardSub, { color: theme.textMuted }]}>
                  On the 1st of every month, totals reset to ₹0 until new meals are logged.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.memberTableCard,
                  { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
                ]}
              >
                {/* Table Header */}
                <View style={[styles.memberTableHeaderRow, { borderBottomColor: theme.borderSubtle }]}>
                  <Text style={[styles.thCell, { flex: 2, color: theme.textMuted }]}>MEMBER</Text>
                  <Text style={[styles.thCell, { flex: 1, textAlign: 'center', color: theme.textMuted }]}>MEALS</Text>
                  <Text style={[styles.thCell, { flex: 1, textAlign: 'center', color: theme.textMuted }]}>EXTRAS</Text>
                  <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right', color: theme.textMuted }]}>TOTAL DUE</Text>
                </View>

                {/* Table Rows */}
                {memberStatsList.map((m: any, idx: number) => {
                  return (
                    <View
                      key={m.memberId || idx}
                      style={[
                        styles.memberTableRow,
                        idx !== memberStatsList.length - 1 && { borderBottomColor: theme.borderSubtle },
                      ]}
                    >
                      {/* Name & Avatar */}
                      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.memberSmallAvatar}>
                          <Text style={styles.memberSmallInitial}>
                            {(m.name || 'M')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.memberRowName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {m.name || 'Member'}
                          </Text>
                          <Text style={[styles.memberRowBaseSub, { color: theme.textMuted }]}>
                            Base: ₹{Math.round(m.baseTotal || 0)}
                          </Text>
                        </View>
                      </View>

                      {/* Meals Count */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={[styles.memberMealsBadge, { color: theme.textPrimary }]}>
                          {m.mealsCount || 0}
                        </Text>
                      </View>

                      {/* Extras Count */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                          style={[
                            styles.memberExtrasBadge,
                            { color: m.extraTiffins > 0 ? '#f97316' : theme.textMuted },
                          ]}
                        >
                          {m.extraTiffins > 0 ? `+${m.extraTiffins}` : '-'}
                        </Text>
                      </View>

                      {/* Total Due */}
                      <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                        <Text style={[styles.memberRowDueText, { color: '#f97316' }]}>
                          ₹{Math.round(m.totalDue || 0).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {/* Table Footer Total */}
                <View style={[styles.memberTableFooterRow, { borderTopColor: theme.borderSubtle }]}>
                  <Text style={[styles.tfLabel, { color: theme.textPrimary }]}>Group Total ({formattedMonthLabel}):</Text>
                  <Text style={styles.tfValue}>₹{monthTotal.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── TAB 2: PARTICULAR GROUP'S ALL LOGS DATE-WISE TABLE WITH EDIT & DELETE ── */}
        {activeTab === 'monthly_ledger' && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitleMain, { color: theme.textPrimary }]}>
                  All Logs for {formattedMonthLabel}
                </Text>
                <Text style={[styles.sectionTitleSub, { color: theme.textMuted }]}>
                  Date-wise recorded meals with edit and delete actions
                </Text>
              </View>
            </View>

            {entriesList.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={36} color={theme.textMuted} />
                <Text style={[styles.emptyCardTitle, { color: theme.textPrimary }]}>No entries recorded</Text>
                <Text style={[styles.emptyCardSub, { color: theme.textMuted }]}>
                  Tap "+ Add Tiffin Meal" above to record meals for {formattedMonthLabel}.
                </Text>
              </View>
            ) : (
              entriesList.map((item: any) => {
                const isSkipped = item.noTiffin || item.mealType === 'none' || item.quantity === 0;
                const dateObj = new Date(item.date);
                const dateDay = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
                const dateWeekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <View
                    key={item._id}
                    style={[
                      styles.ledgerItemCard,
                      { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
                    ]}
                  >
                    {/* Date Block */}
                    <View style={[styles.ledgerDateBlock, { backgroundColor: theme.bgElevated }]}>
                      <Text style={[styles.ledgerDateDay, { color: theme.textPrimary }]}>{dateDay}</Text>
                      <Text style={[styles.ledgerDateWeekday, { color: theme.textMuted }]}>{dateWeekday}</Text>
                    </View>

                    {/* Meal Info */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.ledgerMealHeaderRow}>
                        <View
                          style={[
                            styles.ledgerMealPill,
                            { backgroundColor: isSkipped ? 'rgba(239, 68, 68, 0.12)' : 'rgba(249, 115, 22, 0.12)' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.ledgerMealPillText,
                              { color: isSkipped ? '#ef4444' : '#f97316' },
                            ]}
                          >
                            {isSkipped ? 'NO TIFFIN' : (item.mealType || 'LUNCH').toUpperCase()}
                          </Text>
                        </View>

                        <Text style={[styles.ledgerTotalAmount, { color: isSkipped ? theme.textMuted : '#f97316' }]}>
                          ₹{item.totalPrice || 0}
                        </Text>
                      </View>

                      {/* Tiffins count and breakdown */}
                      <Text style={[styles.ledgerNotesText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {isSkipped
                          ? 'At that time on that day no one took the tiffin'
                          : item.baseQuantity
                          ? `${item.quantity || 1} tiffins (${item.baseQuantity} shared${
                              item.extras && Object.values(item.extras).some((k: any) => k > 0)
                                ? ` + ${Object.values(item.extras).reduce((a: any, b: any) => a + b, 0)} extra`
                                : ''
                            })`
                          : item.notes || `${item.quantity || 1} meal`}
                      </Text>

                      {/* Member Chips */}
                      {item.memberBills && Object.keys(item.memberBills).length > 0 && !isSkipped && (
                        <View style={styles.memberBillsPillRow}>
                          {Object.entries(item.memberBills).map(([mId, amt]: [string, any]) => {
                            const mObj = selectedGroup?.members?.find(
                              (m: any) => String(m._id || m.userId) === mId
                            );
                            return (
                              <View
                                key={mId}
                                style={[styles.miniMemberBillPill, { backgroundColor: theme.bgElevated }]}
                              >
                                <Text style={[styles.miniMemberBillText, { color: theme.textSecondary }]}>
                                  {mObj?.name || 'Member'}: ₹{amt}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    {/* Action Buttons: Edit & Delete */}
                    <View style={styles.ledgerActionsCol}>
                      <TouchableOpacity
                        style={[styles.ledgerActionBtn, { backgroundColor: theme.bgElevated }]}
                        onPress={() => handleEditEntry(item)}
                        activeOpacity={0.7}
                      >
                        <Feather name="edit-2" size={13} color="#f97316" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.ledgerActionBtn, { backgroundColor: theme.bgElevated }]}
                        onPress={() => triggerDeleteEntry(item._id)}
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={13} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {/* 1. Add / Edit Tiffin Modal */}
      <AddTiffinModal
        visible={tiffinModalVisible}
        initialGroupId={selectedGroup?._id}
        editingEntry={editingEntry}
        onClose={() => {
          setTiffinModalVisible(false);
          setEditingEntry(null);
        }}
        onSuccess={() => {
          fetchGroups();
          if (selectedGroup?._id) fetchGroupDetails(selectedGroup._id, selectedMonth);
        }}
      />

      {/* 2. Group Configuration Modal (Change Name, Meal Rate, Manage PIN & Members) */}
      <GroupConfigModal
        visible={groupConfigModalVisible}
        group={selectedGroup}
        inviteCode={activeInviteCode}
        onClose={() => setGroupConfigModalVisible(false)}
        onSuccess={(updatedGroup) => {
          setSelectedGroup(updatedGroup);
          fetchGroups();
          if (updatedGroup?._id) fetchGroupDetails(updatedGroup._id, selectedMonth);
        }}
      />

      {/* 3. Share 4-Digit Code Modal */}
      <ShareCodeModal
        visible={shareCodeModalVisible}
        groupName={selectedGroup?.name || 'Tiffin Group'}
        inviteCode={activeInviteCode}
        pricePerMeal={activeRate}
        isCreator={groupDetails?.isCreator}
        onClose={() => setShareCodeModalVisible(false)}
      />

      {/* 4. Re-Confirm Modal (Custom Designable confirmation for Deletes / Skips) */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        loading={confirmModal.loading}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />

      {/* 5. Join Group with 4-Digit PIN */}
      <Modal
        visible={joinModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.bgOverlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: theme.bgSurface }]}>
            <View style={styles.dialogHeader}>
              <View style={[styles.dialogIconCircle, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
                <Feather name="key" size={20} color="#f97316" />
              </View>
              <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>Join Tiffin Group</Text>
              <Text style={[styles.dialogSub, { color: theme.textMuted }]}>
                Enter the 4-digit code shared by your friend to join
              </Text>
            </View>

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.textPrimary, backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
              ]}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="e.g. 4821"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
              autoFocus
            />

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[styles.dialogCancelBtn, { borderColor: theme.borderSubtle }]}
                onPress={() => setJoinModalVisible(false)}
              >
                <Text style={[styles.dialogCancelText, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dialogConfirmBtn, { backgroundColor: '#f97316' }]}
                onPress={handleJoinByCode}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.dialogConfirmText}>Join Group</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. New Group Modal */}
      <Modal
        visible={newGroupModal}
        animationType="fade"
        transparent
        onRequestClose={() => setNewGroupModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.bgOverlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: theme.bgSurface }]}>
            <View style={styles.dialogHeader}>
              <View style={[styles.dialogIconCircle, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
                <MaterialCommunityIcons name="food-takeout-box" size={20} color="#f97316" />
              </View>
              <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>Create Tiffin Group</Text>
              <Text style={[styles.dialogSub, { color: theme.textMuted }]}>
                Setup a new meal group for your flat or office mess
              </Text>
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Group Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { color: theme.textPrimary, backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                ]}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="e.g. Flat 302 Mess, Office Lunch"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Rate per meal (₹)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { color: theme.textPrimary, backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                ]}
                value={defaultPrice}
                onChangeText={setDefaultPrice}
                placeholder="80"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[styles.dialogCancelBtn, { borderColor: theme.borderSubtle }]}
                onPress={() => setNewGroupModal(false)}
              >
                <Text style={[styles.dialogCancelText, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dialogConfirmBtn, { backgroundColor: '#f97316' }]}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.dialogConfirmText}>Create Group</Text>
                )}
              </TouchableOpacity>
            </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerLeftCol: {
    flex: 1,
    paddingRight: 10,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#f97316',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  appTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerAppTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  activeGroupSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  headerGroupSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 150,
  },
  headerBentoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bentoBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  scrollBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  categoryPill: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroCardContainer: {
    marginBottom: 14,
  },
  heroCard: {
    backgroundColor: '#f97316',
    borderRadius: 28,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 180,
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroDiscountBadge: {
    backgroundColor: '#18181b',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroDiscountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroHeaderBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    elevation: 2,
  },
  heroConfigBtnText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
  },
  heroShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    elevation: 2,
  },
  heroShareBtnText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
  },
  heroCardBody: {
    maxWidth: '65%',
  },
  heroCardSubTitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  heroCardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 24,
  },
  heroTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  heroTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroPriceText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroStatusChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroStatusChipText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  dishImageWrapper: {
    position: 'absolute',
    right: -36,
    bottom: -22,
    width: 170,
    height: 170,
    borderRadius: 85,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  imageAddTiffinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f97316',
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  imageAddTiffinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  imageAddTiffinPlate: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  imageAddBadge: {
    backgroundColor: '#18181b',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  imageAddBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  imageAddTiffinTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  imageAddTiffinSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  imageAddChevronCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickGenerateReportPill: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickGenerateReportText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '700',
  },
  quickShareBillPill: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickShareBillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthNavigatorCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  monthNavTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNavArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelWrapper: {
    alignItems: 'center',
  },
  monthNavTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  monthNavSub: {
    fontSize: 11,
    marginTop: 1,
  },
  autoResetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 8,
  },
  autoResetBannerText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  metricCol: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  metricDivider: {
    width: 1,
    height: 26,
  },
  tabSwitcherRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 18,
    marginBottom: 14,
    gap: 4,
  },
  tabSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 6,
  },
  tabSwitchActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabSwitchText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 2,
  },
  tabCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabContentContainer: {
    gap: 10,
  },
  sectionHeaderRow: {
    marginBottom: 4,
  },
  sectionTitleMain: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitleSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCardSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  memberTableCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  memberTableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  thCell: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  memberTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  memberSmallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberSmallInitial: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '800',
  },
  memberRowName: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberRowBaseSub: {
    fontSize: 10,
  },
  memberMealsBadge: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberExtrasBadge: {
    fontSize: 13,
    fontWeight: '800',
  },
  memberRowDueText: {
    fontSize: 14,
    fontWeight: '900',
  },
  memberTableFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1.5,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  tfLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  tfValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f97316',
  },
  ledgerItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  ledgerDateBlock: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerDateDay: {
    fontSize: 12,
    fontWeight: '800',
  },
  ledgerDateWeekday: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  ledgerMealHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  ledgerMealPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ledgerMealPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ledgerTotalAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  ledgerNotesText: {
    fontSize: 11,
    lineHeight: 15,
  },
  memberBillsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  miniMemberBillPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniMemberBillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  ledgerActionsCol: {
    gap: 6,
  },
  ledgerActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
  },
  dialogHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dialogIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  dialogSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  pinInput: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    marginBottom: 18,
  },
  inputBlock: {
    width: '100%',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textInput: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dialogConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
