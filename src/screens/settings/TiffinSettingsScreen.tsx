import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api, getStaticGroupCode } from '../../services/api';
import { GroupConfigModal } from '../../components/GroupConfigModal';
import { generateAndShareTiffinReportPdf } from '../../services/tiffinPdfService';
import { dataEvents } from '../../services/dataEvents';

export const TiffinSettingsScreen = ({ navigation }: any) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Groups and Selected Group
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const selectedGroupRef = React.useRef<any>(null);
  selectedGroupRef.current = selectedGroup;
  const [loading, setLoading] = useState(true);

  // Auto-Add Daily Tiffin Config
  const [autoAddEnabled, setAutoAddEnabled] = useState(false);
  const [dailyTiffinCount, setDailyTiffinCount] = useState(1);
  const [autoAddMealType, setAutoAddMealType] = useState<'lunch' | 'dinner' | 'both'>('lunch');
  const [savingAutoAdd, setSavingAutoAdd] = useState(false);

  // Auto-Report Email Config
  const [autoReportEmailEnabled, setAutoReportEmailEnabled] = useState(true);
  const [sendingTestReport, setSendingTestReport] = useState(false);

  // Modals
  const [newGroupModalVisible, setNewGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPrice, setNewGroupPrice] = useState('80');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [groupConfigModalVisible, setGroupConfigModalVisible] = useState(false);

  const loadGroupAutoSettings = useCallback((group: any) => {
    if (!group) return;
    setAutoAddEnabled(group.autoAddEnabled ?? false);
    setDailyTiffinCount(group.dailyTiffinCount ?? 1);
    setAutoAddMealType(group.autoAddMealType ?? 'lunch');
    setAutoReportEmailEnabled(group.autoReportEmailEnabled ?? true);
  }, []);

  // Fetch all Tiffin groups - stable callback without selectedGroup loop
  const fetchGroups = useCallback(async (targetGroupId?: string) => {
    try {
      const res = await api.getTiffinGroups();
      if (res.data && Array.isArray(res.data)) {
        const groupList = res.data;
        setGroups(groupList);
        if (groupList.length > 0) {
          const currentId = targetGroupId || selectedGroupRef.current?._id;
          const matched = currentId ? groupList.find((g: any) => g._id === currentId) : null;
          const toSelect = matched || groupList[0];

          if (!selectedGroupRef.current || selectedGroupRef.current._id !== toSelect._id) {
            setSelectedGroup(toSelect);
            loadGroupAutoSettings(toSelect);
          } else {
            setSelectedGroup(toSelect);
          }
        } else {
          setSelectedGroup(null);
        }
      }
    } catch (e) {
      console.error('Error fetching tiffin groups in settings:', e);
    } finally {
      setLoading(false);
    }
  }, [loadGroupAutoSettings]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Listen to external group updates
  useEffect(() => {
    const unsub = dataEvents.on('tiffin_group_updated', (event: any) => {
      fetchGroups(event?.groupId);
    });
    return () => unsub();
  }, [fetchGroups]);

  // When user switches group from the top group selector
  const handleSelectGroup = (group: any) => {
    if (!group) return;
    if (selectedGroup?._id === group._id) return;
    setSelectedGroup(group);
    loadGroupAutoSettings(group);
  };

  // Save Auto-Add settings for the selected group
  const handleSaveAutoAdd = async (newEnabled?: boolean, newCount?: number, newMealType?: 'lunch' | 'dinner' | 'both') => {
    if (!selectedGroup?._id) return;

    const enabled = newEnabled !== undefined ? newEnabled : autoAddEnabled;
    const count = newCount !== undefined ? newCount : dailyTiffinCount;
    const meal = newMealType !== undefined ? newMealType : autoAddMealType;

    setSavingAutoAdd(true);
    try {
      const updated = await api.updateTiffinGroup(selectedGroup._id, {
        autoAddEnabled: enabled,
        dailyTiffinCount: count,
        autoAddMealType: meal,
      });

      if (!updated.error) {
        setSelectedGroup((prev: any) => ({
          ...prev,
          autoAddEnabled: enabled,
          dailyTiffinCount: count,
          autoAddMealType: meal,
        }));
        dataEvents.emit('tiffin_group_updated', { groupId: selectedGroup._id });
      }
    } catch (e) {
      console.error('Error saving auto add settings:', e);
    } finally {
      setSavingAutoAdd(false);
    }
  };

  // Toggle Auto Monthly Report via Email
  const handleToggleAutoReport = async (val: boolean) => {
    setAutoReportEmailEnabled(val);
    if (!selectedGroup?._id) return;

    try {
      await api.updateTiffinGroup(selectedGroup._id, {
        autoReportEmailEnabled: val,
      });
      setSelectedGroup((prev: any) => ({ ...prev, autoReportEmailEnabled: val }));
      dataEvents.emit('tiffin_group_updated', { groupId: selectedGroup._id });
    } catch (e) {
      console.error('Error toggling auto report email:', e);
    }
  };

  // Trigger Instant Test Monthly Report
  const handleSendTestReport = async () => {
    if (!selectedGroup?._id) return;
    setSendingTestReport(true);
    try {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      const detailsRes = await api.getTiffinGroupDetails(selectedGroup._id, currentMonthKey);
      const groupData = detailsRes.data || {};

      await generateAndShareTiffinReportPdf({
        groupName: selectedGroup.name,
        monthLabel,
        activeRate: selectedGroup.defaultPrice || selectedGroup.pricePerTiffin || 80,
        totalCost: groupData.monthTotal || 0,
        totalMeals: groupData.monthQuantity || 0,
        memberCount: selectedGroup.members?.length || 1,
        members: selectedGroup.members || [],
        memberStats: groupData.memberStats || [],
        entries: groupData.entries || [],
      });

      const memberEmails = (selectedGroup.members || [])
        .map((m: any) => m.email)
        .filter(Boolean);

      Alert.alert(
        'Report Generated & Dispatched',
        `Monthly report for ${monthLabel} generated. Dispatch queued for ${memberEmails.length} member email(s):\n${memberEmails.length > 0 ? memberEmails.join(', ') : 'All active registered members'}`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to dispatch report');
    } finally {
      setSendingTestReport(false);
    }
  };

  // Create New Group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for the new tiffin group');
      return;
    }

    setCreatingGroup(true);
    try {
      const priceVal = parseFloat(newGroupPrice) || 80;
      const res = await api.createTiffinGroup({
        name: newGroupName.trim(),
        defaultPrice: priceVal,
        pricePerTiffin: priceVal,
        autoAddEnabled: false,
        dailyTiffinCount: 1,
        autoReportEmailEnabled: true,
      });

      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        setNewGroupName('');
        setNewGroupPrice('80');
        setNewGroupModalVisible(false);
        await fetchGroups();
        if (res.data) {
          setSelectedGroup(res.data);
          loadGroupAutoSettings(res.data);
        }
        dataEvents.emit('tiffin_group_updated', {});
        Alert.alert('Group Created', 'New Tiffin Group created successfully!');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Current rate auto-fetched from group
  const activeRate = selectedGroup?.defaultPrice || selectedGroup?.pricePerTiffin || 80;
  const dailyCost = activeRate * dailyTiffinCount;
  const inviteCode = selectedGroup
    ? (selectedGroup.inviteCode || getStaticGroupCode(selectedGroup._id || selectedGroup.name))
    : '8824';

  return (
    <View style={[styles.container, { backgroundColor: theme.bgApp }]}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.bgSurface,
            borderBottomColor: theme.borderSubtle,
            paddingTop: Math.max(insets.top + 6, 16),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (navigation?.goBack) navigation.goBack();
            }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Tiffin Settings</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
              Groups, Auto-Tiffin &amp; Monthly Reports
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* ── 1. SELECT GROUP (FIRST SECTION) ─────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
            Select Group {groups.length > 1 ? `(${groups.length})` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: 'rgba(234, 88, 12, 0.12)' }]}
              onPress={() => {
                if (navigation?.navigate) {
                  navigation.navigate('TiffinHome');
                  setTimeout(() => {
                    dataEvents.emit('open_tiffin_join_modal');
                  }, 50);
                }
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="key-outline" size={12} color="#ea580c" />
              <Text style={styles.smallActionBtnText}>Join</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: 'rgba(234, 88, 12, 0.12)' }]}
              onPress={() => setNewGroupModalVisible(true)}
              activeOpacity={0.75}
            >
              <Feather name="plus" size={13} color="#ea580c" />
              <Text style={styles.smallActionBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#ea580c" style={{ marginVertical: 20 }} />
        ) : groups.length === 0 ? (
          <View style={[styles.emptyGroupBox, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
            <MaterialCommunityIcons name="food-takeout-box" size={32} color={theme.textMuted} />
            <Text style={[styles.emptyGroupTitle, { color: theme.textPrimary }]}>No Tiffin Groups Found</Text>
            <Text style={[styles.emptyGroupSub, { color: theme.textMuted }]}>
              Create a group to start tracking meals and automated reports.
            </Text>
            <TouchableOpacity
              style={[styles.createFirstBtn, { backgroundColor: '#ea580c' }]}
              onPress={() => setNewGroupModalVisible(true)}
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Create Tiffin Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupCarousel}
          >
            {groups.map((g) => {
              const isSelected = selectedGroup?._id === g._id;
              const rate = g.defaultPrice || g.pricePerTiffin || 80;
              const memberCount = g.members?.length || 1;

              return (
                <TouchableOpacity
                  key={g._id}
                  style={[
                    styles.groupCard,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(234, 88, 12, 0.16)' : '#fff7ed')
                        : theme.bgSurface,
                      borderColor: isSelected ? '#ea580c' : theme.borderSubtle,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleSelectGroup(g)}
                  activeOpacity={0.8}
                >
                  <View style={styles.groupCardTopRow}>
                    <View
                      style={[
                        styles.groupIconCircle,
                        { backgroundColor: isSelected ? 'rgba(234, 88, 12, 0.22)' : theme.bgElevated },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="silverware-fork-knife"
                        size={18}
                        color={isSelected ? '#ea580c' : theme.textPrimary}
                      />
                    </View>
                    {isSelected && (
                      <View style={styles.activeCheckBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#ea580c" />
                      </View>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.groupCardTitle,
                      { color: isSelected ? '#ea580c' : theme.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {g.name}
                  </Text>

                  <View style={styles.groupCardMetaRow}>
                    <Text style={[styles.groupMetaText, { color: theme.textMuted }]}>
                      ₹{rate}/meal • {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── 2. NEW GROUP CREATE BUTTON CARD ─────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.createGroupCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}
          onPress={() => setNewGroupModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.createIconCircle, { backgroundColor: 'rgba(234, 88, 12, 0.12)' }]}>
            <Feather name="plus-circle" size={22} color="#ea580c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>+ Create New Tiffin Group</Text>
            <Text style={[styles.cardSub, { color: theme.textMuted }]}>
              Set up a separate mess or shared tiffin group
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textMuted} />
        </TouchableOpacity>

        {/* ── 3. AUTO TIFFIN ADDED OPTION ────────────────────────────────────── */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginTop: 22 }]}>
          Daily Auto-Add Tiffin
        </Text>
        <View style={[styles.settingCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          {/* Master Toggle */}
          <View style={styles.settingRow}>
            <View style={[styles.settingLeft, { flex: 1, paddingRight: 10 }]}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(234, 88, 12, 0.14)' }]}>
                <MaterialCommunityIcons name="clock-fast" size={20} color="#ea580c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Daily Auto-Add</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Automatically log meals daily for {selectedGroup?.name || 'this group'}
                </Text>
              </View>
            </View>
            <Switch
              value={autoAddEnabled}
              onValueChange={(val) => {
                setAutoAddEnabled(val);
                handleSaveAutoAdd(val);
              }}
              trackColor={{ false: theme.borderSubtle, true: '#ea580c' }}
              thumbColor="#ffffff"
            />
          </View>

          {autoAddEnabled && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: theme.borderSubtle }]} />

              {/* Number of Daily Tiffins Stepper */}
              <View style={styles.subSettingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subSettingTitle, { color: theme.textPrimary }]}>
                    Number of Daily Tiffins
                  </Text>
                  <Text style={[styles.subSettingSub, { color: theme.textMuted }]}>
                    Daily tiffins logged automatically
                  </Text>
                </View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}
                    onPress={() => {
                      if (dailyTiffinCount > 1) {
                        const newCount = dailyTiffinCount - 1;
                        setDailyTiffinCount(newCount);
                        handleSaveAutoAdd(undefined, newCount);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="minus" size={14} color={theme.textPrimary} />
                  </TouchableOpacity>

                  <View style={styles.stepperValueBox}>
                    <Text style={[styles.stepperValueText, { color: theme.textPrimary }]}>
                      {dailyTiffinCount}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.stepperBtn, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}
                    onPress={() => {
                      if (dailyTiffinCount < 10) {
                        const newCount = dailyTiffinCount + 1;
                        setDailyTiffinCount(newCount);
                        handleSaveAutoAdd(undefined, newCount);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={14} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.rowDivider, { backgroundColor: theme.borderSubtle }]} />

              {/* Auto-Fetched Price Banner */}
              <View
                style={[
                  styles.priceSyncBanner,
                  { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.08)' : '#fff7ed', borderColor: 'rgba(234, 88, 12, 0.25)' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="pricetag-outline" size={16} color="#ea580c" />
                  <Text style={[styles.priceSyncTitle, { color: '#ea580c' }]}>
                    Auto-Fetched Group Rate: ₹{activeRate}.00 / meal
                  </Text>
                </View>
                <Text style={[styles.priceSyncSub, { color: theme.textMuted }]}>
                  Total daily estimated cost: ₹{dailyCost}.00 ({dailyTiffinCount} × ₹{activeRate})
                </Text>
              </View>

              {/* Meal Slot Selection */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.subSettingTitle, { color: theme.textPrimary, marginBottom: 8 }]}>
                  Preferred Meal Slot
                </Text>
                <View style={styles.mealSlotRow}>
                  {(['lunch', 'dinner', 'both'] as const).map((slot) => {
                    const isSelected = autoAddMealType === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.slotPill,
                          {
                            backgroundColor: isSelected ? '#ea580c' : theme.bgElevated,
                            borderColor: isSelected ? '#ea580c' : theme.borderSubtle,
                          },
                        ]}
                        onPress={() => {
                          setAutoAddMealType(slot);
                          handleSaveAutoAdd(undefined, undefined, slot);
                        }}
                      >
                        <Text
                          style={[
                            styles.slotPillText,
                            { color: isSelected ? '#ffffff' : theme.textPrimary },
                          ]}
                        >
                          {slot === 'both' ? 'Lunch & Dinner' : slot.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── 4. AUTO REPORT SEND OPTION ─────────────────────────────────────── */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginTop: 22 }]}>
          Auto-Send Monthly Report
        </Text>
        <View style={[styles.settingCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingLeft, { flex: 1, paddingRight: 10 }]}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                <Ionicons name="mail-outline" size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>
                  Auto-Email Monthly PDF
                </Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Automated statement sent to all member emails on 1st of month
                </Text>
              </View>
            </View>
            <Switch
              value={autoReportEmailEnabled}
              onValueChange={handleToggleAutoReport}
              trackColor={{ false: theme.borderSubtle, true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.rowDivider, { backgroundColor: theme.borderSubtle }]} />

          {/* Members Email Distribution Preview */}
          <View style={{ paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.subSettingTitle, { color: theme.textPrimary }]}>
                Report Recipients ({selectedGroup?.members?.length || 1})
              </Text>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>Auto-Dispatched</Text>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              {(selectedGroup?.members || []).map((m: any, idx: number) => (
                <View
                  key={m._id || m.userId || idx}
                  style={[styles.memberEmailRow, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}
                >
                  <View style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>{(m.name || 'M')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberRowName, { color: theme.textPrimary }]}>{m.name || 'Member'}</Text>
                    <Text style={[styles.memberRowEmail, { color: theme.textMuted }]}>
                      {m.email || 'Email set on join'}
                    </Text>
                  </View>
                  <Feather name="check" size={14} color="#10b981" />
                </View>
              ))}
            </View>

            {/* Test Send Button */}
            <TouchableOpacity
              style={[styles.testSendBtn, { borderColor: '#10b981', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5' }]}
              onPress={handleSendTestReport}
              disabled={sendingTestReport}
              activeOpacity={0.8}
            >
              {sendingTestReport ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <>
                  <MaterialCommunityIcons name="file-pdf-box" size={18} color="#10b981" />
                  <Text style={styles.testSendBtnText}>Generate &amp; Dispatch Monthly Report Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5. GROUP CONFIG MODAL SHORTCUT ──────────────────────────────────── */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginTop: 22 }]}>
          Group Administration
        </Text>
        <TouchableOpacity
          style={[styles.configGroupCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}
          onPress={() => setGroupConfigModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.createIconCircle, { backgroundColor: 'rgba(234, 88, 12, 0.14)' }]}>
            <Ionicons name="settings-sharp" size={20} color="#ea580c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Configure {selectedGroup?.name || 'Group'} &amp; Members
            </Text>
            <Text style={[styles.cardSub, { color: theme.textMuted }]}>
              Change meal price, permanent 4-digit PIN, or add members manually
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      {/* ── Create New Group Modal ──────────────────────────────────────────── */}
      <Modal
        visible={newGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.createIconCircle, { backgroundColor: 'rgba(234, 88, 12, 0.14)' }]}>
                <MaterialCommunityIcons name="food-takeout-box" size={22} color="#ea580c" />
              </View>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Create Tiffin Group</Text>
              <Text style={[styles.modalSub, { color: theme.textMuted }]}>
                Start a new meal tracking group for your flat or mess
              </Text>
            </View>

            <View style={{ gap: 12, marginTop: 14 }}>
              <View>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Group Name</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }]}
                  placeholder="e.g. Annapurna Mess, Flat 302"
                  placeholderTextColor={theme.textMuted}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                />
              </View>

              <View>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Default Rate per Meal (₹)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }]}
                  placeholder="80"
                  placeholderTextColor={theme.textMuted}
                  value={newGroupPrice}
                  onChangeText={setNewGroupPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.borderSubtle }]}
                onPress={() => setNewGroupModalVisible(false)}
              >
                <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#ea580c' }]}
                onPress={handleCreateGroup}
                disabled={creatingGroup}
              >
                {creatingGroup ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontWeight: '700' }}>Create Group</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Group Config Modal (Includes Manual Member Addition) ─────────────── */}
      <GroupConfigModal
        visible={groupConfigModalVisible}
        group={selectedGroup}
        inviteCode={inviteCode}
        onClose={() => setGroupConfigModalVisible(false)}
        onSuccess={(updatedGroup) => {
          setSelectedGroup(updatedGroup);
          loadGroupAutoSettings(updatedGroup);
          fetchGroups(updatedGroup?._id);
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  smallActionBtnText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '700',
  },
  groupCarousel: {
    gap: 10,
    paddingBottom: 6,
  },
  groupCard: {
    width: 170,
    padding: 14,
    borderRadius: 18,
    gap: 8,
  },
  groupCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCheckBadge: {},
  groupCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  groupCardMetaRow: {},
  groupMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyGroupBox: {
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  emptyGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyGroupSub: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 10,
  },
  createIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  settingCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
  },
  subSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subSettingTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  subSettingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueBox: {
    minWidth: 26,
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: 16,
    fontWeight: '800',
  },
  priceSyncBanner: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  priceSyncTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  priceSyncSub: {
    fontSize: 11,
  },
  mealSlotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slotPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePillText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  memberEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(234, 88, 12, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
  },
  memberRowName: {
    fontSize: 12,
    fontWeight: '700',
  },
  memberRowEmail: {
    fontSize: 11,
  },
  testSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
  },
  testSendBtnText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  configGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  modalSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
