import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DatePickerModal } from './DatePickerModal';
import { fmtMoney } from '../utils/money';

interface AddTiffinModalProps {
  visible: boolean;
  initialGroupId?: string;
  initialMealType?: string;
  initialNoTiffin?: boolean;
  editingEntry?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const MEAL_TYPES = [
  { id: 'lunch', label: 'Lunch', icon: 'weather-sunny', color: '#F59E0B' },
  { id: 'dinner', label: 'Dinner', icon: 'weather-night', color: '#6366F1' },
  { id: 'breakfast', label: 'Breakfast', icon: 'weather-sunset-up', color: '#EAB308' },
  { id: 'none', label: 'No Tiffin', icon: 'cancel', color: '#EF4444' },
];

// Local calendar day as "YYYY-MM-DD". `toISOString()` is UTC, which shows
// YESTERDAY's date for anyone between midnight and the UTC offset.
const toLocalDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const AddTiffinModal: React.FC<AddTiffinModalProps> = ({
  visible,
  initialGroupId,
  initialMealType,
  initialNoTiffin = false,
  editingEntry,
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || '');
  const [mealType, setMealType] = useState(initialMealType?.toLowerCase() || 'lunch');
  const [isNoTiffin, setIsNoTiffin] = useState(initialNoTiffin);

  // Shared Split & Extra Tiffins Model
  // baseQuantity = tiffins shared evenly by members (e.g. 3 tiffins shared by 4 members = ₹75 each)
  const [baseQuantity, setBaseQuantity] = useState<number>(3);
  // extrasMap = extra tiffins assigned to specific members (e.g. Lokesh's brother = 1 extra @ full price ₹100)
  const [extrasMap, setExtrasMap] = useState<Record<string, number>>({});
  // splitMemberIds = who is eating and sharing the base tiffins today
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});

  const [notes, setNotes] = useState('');
  const [dateStr, setDateStr] = useState(toLocalDateString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (visible) {
      loadGroups();
      if (editingEntry) {
        // Pre-fill fields in Edit Mode
        if (editingEntry.groupId) setSelectedGroupId(editingEntry.groupId);
        setMealType(editingEntry.mealType || 'lunch');
        setIsNoTiffin(editingEntry.noTiffin || editingEntry.mealType === 'none');
        setBaseQuantity(editingEntry.baseQuantity || editingEntry.quantity || 1);
        setExtrasMap(
          Object.keys(editingEntry.extras || {}).length > 0
            ? editingEntry.extras
            : (editingEntry.participantQuantities || {})
        );
        setNotes(editingEntry.notes || '');
        if (editingEntry.date) {
          setDateStr(new Date(editingEntry.date).toISOString().slice(0, 10));
        }
      } else {
        if (initialGroupId) setSelectedGroupId(initialGroupId);
        if (initialMealType) setMealType(initialMealType.toLowerCase());
        setIsNoTiffin(initialNoTiffin || initialMealType?.toLowerCase() === 'none');
        setDateStr(toLocalDateString());
        setExtrasMap({});
        setNotes('');
      }
    }
  }, [visible, initialGroupId, initialMealType, initialNoTiffin, editingEntry]);

  const loadGroups = async () => {
    setFetching(true);
    const res = await api.getTiffinGroups();
    setFetching(false);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      setGroups(res.data);
      const preferredId = editingEntry?.groupId || selectedGroupId || initialGroupId;
      const activeGrp = res.data.find((g: any) => g._id === preferredId) || res.data[0];
      if (!selectedGroupId) setSelectedGroupId(activeGrp._id);

      // Initialize all members as sharing the base tiffins by default
      const members = activeGrp.members || [{ name: 'You' }];
      const initialMap: Record<string, boolean> = {};
      members.forEach((m: any, idx: number) => {
        initialMap[String(m._id || m.userId || idx)] = true;
      });

      // Edit mode: restore WHO was sharing from the stored entry — web entries
      // only carry `participantMemberIds`, mobile ones carry `splitMemberIds`.
      if (editingEntry) {
        const entrySplitIds = [
          ...(Array.isArray(editingEntry.splitMemberIds) ? editingEntry.splitMemberIds : []),
          ...(Array.isArray(editingEntry.participantMemberIds) ? editingEntry.participantMemberIds : []),
        ].map(String);
        if (entrySplitIds.length > 0) {
          members.forEach((m: any, idx: number) => {
            const key = String(m._id || m.userId || idx);
            initialMap[key] =
              entrySplitIds.includes(key) ||
              entrySplitIds.includes(String(idx)) ||
              (m.userId ? entrySplitIds.includes(String(m.userId)) : false);
          });
        }
      }
      setSelectedMembers(initialMap);

      // Default base tiffins to either group count or 3 (edit mode keeps the
      // entry's own value, restored by the visibility effect)
      if (!editingEntry) {
        setBaseQuantity(Math.max(1, Math.min(members.length, 3)));
      }
    }
  };

  const selectedGroup = groups.find((g) => g._id === selectedGroupId) || groups[0];
  const members = selectedGroup?.members || [
    { _id: 'm1', name: 'You', email: 'you@example.com' },
  ];
  const unitPrice = selectedGroup?.pricePerTiffin || selectedGroup?.defaultPrice || 100;

  // Calculate participating members in base split
  const participatingMembers = members.filter((m: any, idx: number) => {
    const id = String(m._id || m.userId || idx);
    return selectedMembers[id] !== false;
  });
  const splitMemberCount = Math.max(1, participatingMembers.length);

  // Total extra tiffins across all members
  const totalExtraTiffins = Object.values(extrasMap).reduce((acc, q) => acc + (q || 0), 0);
  const totalTiffinsCount = isNoTiffin ? 0 : baseQuantity + totalExtraTiffins;

  // Shared math
  const baseCost = isNoTiffin ? 0 : baseQuantity * unitPrice;
  const baseSharePerPerson = isNoTiffin ? 0 : Math.round((baseCost / splitMemberCount) * 100) / 100;
  const extraCostTotal = isNoTiffin ? 0 : totalExtraTiffins * unitPrice;
  const totalCalculatedCost = isNoTiffin ? 0 : baseCost + extraCostTotal;

  // Member-wise breakdown calculation
  const memberBills: Record<string, { base: number; extras: number; total: number }> = {};
  members.forEach((m: any, idx: number) => {
    const id = String(m._id || m.userId || idx);
    const isSharing = selectedMembers[id] !== false;
    const extraCount = extrasMap[id] || 0;
    const baseAmount = isSharing ? baseSharePerPerson : 0;
    const extraAmount = extraCount * unitPrice;
    memberBills[id] = {
      base: baseAmount,
      extras: extraAmount,
      total: Math.round((baseAmount + extraAmount) * 100) / 100,
    };
  });

  const handleToggleMember = (id: string) => {
    setSelectedMembers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleUpdateExtraTiffins = (id: string, delta: number) => {
    setExtrasMap((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleToggleNoTiffin = (value: boolean) => {
    setIsNoTiffin(value);
    if (value) {
      setMealType('none');
      if (!notes) setNotes('At that time on that day no one took the tiffin');
    } else {
      setMealType('lunch');
      if (notes === 'At that time on that day no one took the tiffin') setNotes('');
    }
  };

  const handleSave = async () => {
    if (!selectedGroupId && groups.length === 0) {
      Alert.alert('No Tiffin Group', 'Please create a Tiffin group first');
      return;
    }

    const targetGroupId = selectedGroupId || groups[0]._id;

    // Build comprehensive splitMemberIds and simpleMemberBills with all identifier variants
    const splitMemberIds: string[] = [];
    const simpleMemberBills: Record<string, number> = {};

    members.forEach((m: any, idx: number) => {
      const key = String(m._id || m.userId || idx);
      const isSelected = selectedMembers[key] !== false;
      const bill = isNoTiffin ? 0 : (memberBills[key]?.total ?? 0);

      if (m._id) simpleMemberBills[String(m._id)] = bill;
      if (m.userId) simpleMemberBills[String(m.userId)] = bill;
      simpleMemberBills[String(idx)] = bill;

      if (isSelected && !isNoTiffin) {
        if (m._id) splitMemberIds.push(String(m._id));
        if (m.userId && !splitMemberIds.includes(String(m.userId))) splitMemberIds.push(String(m.userId));
        splitMemberIds.push(String(idx));
      }
    });

    setLoading(true);
    const payload = {
      mealType: isNoTiffin ? 'none' : mealType,
      count: totalTiffinsCount,
      quantity: totalTiffinsCount,
      baseQuantity: isNoTiffin ? 0 : baseQuantity,
      splitMemberIds: isNoTiffin ? [] : splitMemberIds,
      extras: isNoTiffin ? {} : extrasMap,
      memberBills: isNoTiffin ? {} : simpleMemberBills,
      totalPrice: totalCalculatedCost,
      noTiffin: isNoTiffin,
      notes: notes.trim() || (isNoTiffin ? 'At that time on that day no one took the tiffin' : ''),
      date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
    };

    let res;
    if (editingEntry && editingEntry._id) {
      res = await api.updateTiffinEntry(targetGroupId, editingEntry._id, payload);
    } else {
      res = await api.addTiffinEntry(targetGroupId, payload);
    }
    setLoading(false);

    if (res.error) {
      Alert.alert('Error', res.error);
    } else {
      setExtrasMap({});
      setNotes('');

      onSuccess();
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.72)' }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#141416' : '#FFFFFF',
              borderColor: isDark ? '#26262B' : '#E2E8F0',
            },
          ]}
        >
          {/* Sheet Handle */}
          <View
            style={[
              styles.sheetHandle,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)' },
            ]}
          />

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: isDark ? '#26262B' : '#E2E8F0' }]}>
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.headerIconCircle,
                  { backgroundColor: isNoTiffin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.15)' },
                ]}
              >
                <MaterialCommunityIcons
                  name={isNoTiffin ? 'cancel' : 'food-takeout-box'}
                  size={18}
                  color={isNoTiffin ? '#EF4444' : '#F97316'}
                />
              </View>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                {editingEntry
                  ? 'Edit Tiffin Meal Record'
                  : isNoTiffin
                  ? 'Mark No Tiffin Day'
                  : 'Log Tiffin & Split Extras'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Live Calculation Hero Banner */}
            <View
              style={[
                styles.liveTotalCard,
                {
                  backgroundColor: isNoTiffin
                    ? 'rgba(239, 68, 68, 0.12)'
                    : isDark
                    ? 'rgba(249, 115, 22, 0.15)'
                    : 'rgba(249, 115, 22, 0.1)',
                  borderColor: isNoTiffin ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)',
                },
              ]}
            >
              <Text style={[styles.liveTotalLabel, isNoTiffin && { color: '#EF4444' }]}>
                {isNoTiffin ? 'NO TIFFIN RECORD' : 'TOTAL MEAL BILL FOR TODAY'}
              </Text>
              <Text style={[styles.liveTotalValue, isNoTiffin && { color: '#EF4444' }]}>
                ₹{fmtMoney(totalCalculatedCost)}
              </Text>
              <Text style={[styles.liveTotalSub, { color: theme.textMuted }]}>
                {isNoTiffin
                  ? 'At that time on that day no one took the tiffin · ₹0.00'
                  : `${totalTiffinsCount} tiffins total (${baseQuantity} shared + ${totalExtraTiffins} extra) at ₹${fmtMoney(unitPrice)}/each`}
              </Text>
            </View>

            {/* No Tiffin Today Quick Switch */}
            <View style={[styles.switchCard, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
              <View style={styles.switchInfo}>
                <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>
                  No one took tiffin today
                </Text>
                <Text style={[styles.switchSub, { color: theme.textMuted }]}>
                  Record an official zero-cost day entry (₹0.00)
                </Text>
              </View>
              <Switch
                value={isNoTiffin}
                onValueChange={handleToggleNoTiffin}
                trackColor={{ false: theme.borderSubtle, true: '#EF4444' }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Meal Type Selection */}
            {!isNoTiffin && (
              <View style={styles.fieldBlock}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select Meal</Text>
                <View style={styles.mealGrid}>
                  {MEAL_TYPES.map((type) => {
                    const isSelected = mealType === type.id;
                    return (
                      <TouchableOpacity
                        key={type.id}
                        style={[
                          styles.mealCard,
                          {
                            backgroundColor: isSelected ? type.color : theme.bgElevated,
                            borderColor: isSelected ? type.color : theme.borderSubtle,
                          },
                        ]}
                        onPress={() => {
                          if (type.id === 'none') {
                            handleToggleNoTiffin(true);
                          } else {
                            setIsNoTiffin(false);
                            setMealType(type.id);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name={type.icon as any}
                          size={18}
                          color={isSelected ? '#ffffff' : type.color}
                        />
                        <Text
                          style={[
                            styles.mealCardLabel,
                            { color: isSelected ? '#ffffff' : theme.textPrimary },
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Base Tiffins Shared Stepper */}
            {!isNoTiffin && (
              <View style={[styles.sectionContainer, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitleText, { color: theme.textPrimary }]}>
                      Base Tiffins Shared Evenly
                    </Text>
                    <Text style={[styles.sectionSubText, { color: theme.textMuted }]}>
                      {baseQuantity} tiffins ÷ {splitMemberCount} members = ₹{fmtMoney(baseSharePerPerson)}/person
                    </Text>
                  </View>

                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}
                      onPress={() => setBaseQuantity((q) => Math.max(1, q - 1))}
                    >
                      <Feather name="minus" size={16} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <Text style={[styles.stepperNumber, { color: theme.textPrimary }]}>
                      {baseQuantity}
                    </Text>

                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: '#F97316' }]}
                      onPress={() => setBaseQuantity((q) => q + 1)}
                    >
                      <Feather name="plus" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Assign Extra Tiffins Per Member (User's Exact Scenario!) */}
            {!isNoTiffin && (
              <View style={[styles.sectionContainer, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
                <View style={styles.sectionTitleRow}>
                  <MaterialCommunityIcons name="account-group" size={18} color="#F97316" />
                  <Text style={[styles.sectionTitleText, { color: theme.textPrimary }]}>
                    Members & Extra Tiffins (Guests / Brother)
                  </Text>
                </View>
                <Text style={[styles.sectionExplainer, { color: theme.textMuted }]}>
                  Any extra tiffin assigned to a member is billed at full price (₹{fmtMoney(unitPrice)}) to that person only.
                </Text>

                {members.map((m: any, idx: number) => {
                  const id = String(m._id || m.userId || idx);
                  const isSharing = selectedMembers[id] !== false;
                  const extraCount = extrasMap[id] || 0;
                  const mBill = memberBills[id] || { base: 0, extras: 0, total: 0 };

                  return (
                    <View
                      key={id}
                      style={[
                        styles.memberSplitCard,
                        {
                          backgroundColor: theme.bgSurface,
                          borderColor: extraCount > 0 ? '#F97316' : theme.borderSubtle,
                        },
                      ]}
                    >
                      {/* Member Info & Checkbox */}
                      <TouchableOpacity
                        style={styles.memberLeftRow}
                        onPress={() => handleToggleMember(id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.checkboxCircle,
                            {
                              backgroundColor: isSharing ? '#F97316' : theme.bgElevated,
                              borderColor: isSharing ? '#F97316' : theme.borderSubtle,
                            },
                          ]}
                        >
                          {isSharing && <Feather name="check" size={12} color="#ffffff" />}
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.memberItemName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {m.name || 'Member'}
                          </Text>
                          <Text style={[styles.memberBillText, { color: theme.textMuted }]}>
                            {isSharing ? `Base ₹${fmtMoney(baseSharePerPerson)}` : 'Not eating'}
                            {extraCount > 0 ? ` + Extra (${extraCount}×₹${fmtMoney(unitPrice)} = ₹${fmtMoney(extraCount * unitPrice)})` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Extra Tiffin Stepper for this specific member */}
                      <View style={styles.memberExtraControls}>
                        <View style={styles.extraStepperPill}>
                          <TouchableOpacity
                            style={styles.extraMiniBtn}
                            onPress={() => handleUpdateExtraTiffins(id, -1)}
                          >
                            <Feather name="minus" size={12} color={theme.textPrimary} />
                          </TouchableOpacity>

                          <View style={styles.extraQtyBadge}>
                            <Text style={[styles.extraQtyText, { color: extraCount > 0 ? '#F97316' : theme.textPrimary }]}>
                              {extraCount > 0 ? `+${extraCount}` : '0'}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.extraMiniBtn, { backgroundColor: '#F97316' }]}
                            onPress={() => handleUpdateExtraTiffins(id, 1)}
                          >
                            <Feather name="plus" size={12} color="#ffffff" />
                          </TouchableOpacity>
                        </View>

                        {/* Calculated Share for this person */}
                        <Text style={[styles.personFinalDue, { color: '#F97316' }]}>
                          ₹{fmtMoney(mBill.total)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Date Picker Trigger Card */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Meal Date</Text>
              <TouchableOpacity
                style={[
                  styles.datePickerCard,
                  { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                ]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.75}
              >
                <View style={styles.datePickerLeft}>
                  <View style={styles.dateIconCircle}>
                    <Feather name="calendar" size={16} color="#f97316" />
                  </View>
                  <View>
                    <Text style={[styles.dateFormattedText, { color: theme.textPrimary }]}>
                      {new Date(dateStr).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={[styles.dateRawSubText, { color: theme.textMuted }]}>
                      {dateStr}
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-down" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <DatePickerModal
              visible={showDatePicker}
              initialDate={dateStr}
              onClose={() => setShowDatePicker(false)}
              onSelectDate={(newDate) => setDateStr(newDate)}
            />

            {/* Notes */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Notes (Optional)</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder={isNoTiffin ? 'At that time on that day no one took the tiffin' : 'e.g. Brother visited, extra sweet'}
                  placeholderTextColor={theme.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>

            {/* Save / Update Button */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: isNoTiffin ? '#EF4444' : '#F97316' },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#ffffff" />
                  <Text style={styles.saveBtnText}>
                    {editingEntry
                      ? `Update Record (Total ₹${fmtMoney(totalCalculatedCost)})`
                      : isNoTiffin
                      ? 'Confirm No Tiffin (₹0.00)'
                      : `Confirm & Save (Total ₹${fmtMoney(totalCalculatedCost)})`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '92%',
    paddingBottom: 20,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  liveTotalCard: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  liveTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#F97316',
    marginBottom: 4,
  },
  liveTotalValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F97316',
  },
  liveTotalSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  switchInfo: {
    flex: 1,
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  mealCard: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  mealCardLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionContainer: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionExplainer: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepperNumber: {
    fontSize: 16,
    fontWeight: '900',
    minWidth: 20,
    textAlign: 'center',
  },
  memberSplitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  memberLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberBillText: {
    fontSize: 11,
    marginTop: 1,
  },
  memberExtraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  extraStepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
    padding: 2,
    gap: 4,
  },
  extraMiniBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraQtyBadge: {
    minWidth: 20,
    alignItems: 'center',
  },
  extraQtyText: {
    fontSize: 12,
    fontWeight: '800',
  },
  personFinalDue: {
    fontSize: 15,
    fontWeight: '900',
    minWidth: 45,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  datePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFormattedText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateRawSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
