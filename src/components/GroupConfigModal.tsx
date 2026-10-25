import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export interface GroupConfigModalProps {
  visible: boolean;
  group: any;
  inviteCode?: string;
  onClose: () => void;
  onSuccess: (updatedGroup: any) => void;
  onRegenerateCode?: () => Promise<void>;
}

export const GroupConfigModal: React.FC<GroupConfigModalProps> = ({
  visible,
  group,
  inviteCode,
  onClose,
  onSuccess,
  onRegenerateCode,
}) => {
  const { theme, isDark } = useTheme();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('80');
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [membersList, setMembersList] = useState<any[]>(group?.members || []);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  useEffect(() => {
    if (visible && group) {
      setName(group.name || '');
      setPrice(String(group.pricePerTiffin || group.defaultPrice || 80));
      setMembersList(group.members || []);
      setShowAddMember(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setErrorMsg('');
    }
  }, [visible, group]);

  const handleAddManualMember = () => {
    if (!newMemberName.trim()) {
      setErrorMsg('Please enter a name for the member');
      return;
    }
    const cleanName = newMemberName.trim();
    const cleanEmail = newMemberEmail.trim().toLowerCase();

    if (membersList.some((m) => (m.name || '').toLowerCase() === cleanName.toLowerCase())) {
      setErrorMsg('A member with this name already exists in the group');
      return;
    }

    const newMemberObj = {
      _id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      email: cleanEmail,
      isManual: true,
      joinedAt: new Date().toISOString(),
    };

    setMembersList((prev) => [...prev, newMemberObj]);
    setNewMemberName('');
    setNewMemberEmail('');
    setShowAddMember(false);
    setErrorMsg('');
  };

  const handleRemoveMember = (memberId: string) => {
    setMembersList((prev) => prev.filter((m, idx) => (m._id || m.userId || String(idx)) !== memberId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg('Group name cannot be empty');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setErrorMsg('Please enter a valid price per meal');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    const res = await api.updateTiffinGroup(group._id, {
      name: name.trim(),
      defaultPrice: parsedPrice,
      pricePerTiffin: parsedPrice,
      members: membersList,
    });
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      onSuccess(res.data || {
        ...group,
        name: name.trim(),
        defaultPrice: parsedPrice,
        pricePerTiffin: parsedPrice,
        members: membersList,
      });
      onClose();
    }
  };

  const handleRegenCode = async () => {
    if (!onRegenerateCode) return;
    setRegenerating(true);
    await onRegenerateCode();
    setRegenerating(false);
  };


  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: theme.bgOverlay }]}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropPress} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheetCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: theme.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="settings-sharp" size={18} color="#f97316" />
              </View>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Group Settings</Text>
                <Text style={[styles.sheetSub, { color: theme.textMuted }]}>
                  Configure meal rate, group name & members
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.bodyScroll}>
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={15} color="#ef4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Group Name */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Group Name</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
                <Feather name="users" size={16} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Flat 302 Mess, Office Lunch"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            {/* Price Per Meal */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Price Per Meal (₹)</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
                <MaterialCommunityIcons name="currency-inr" size={18} color="#f97316" />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="80"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <Text style={[styles.fieldHint, { color: theme.textMuted }]}>
                This rate is used to calculate base shares & extra guest meals.
              </Text>
            </View>

            {/* 4-Digit Invite Code Card */}
            <View style={[styles.codeCard, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
              <View style={styles.codeCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>4-Digit Join PIN</Text>
                  <Text style={styles.codeDigitsText}>{inviteCode || group?.inviteCode || '8824'}</Text>
                </View>

                <View style={styles.staticPinBadge}>
                  <Feather name="shield" size={13} color="#10b981" />
                  <Text style={styles.staticPinBadgeText}>Permanent</Text>
                </View>
              </View>
              <Text style={[styles.codeSub, { color: theme.textMuted }]}>
                Roommates can enter this 4-digit code in the app to join instantly.
              </Text>
            </View>

            {/* Group Members List */}
            <View style={styles.fieldBlock}>
              <View style={styles.membersHeaderRow}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Members ({membersList.length})
                </Text>
                <TouchableOpacity
                  style={[
                    styles.addMemberPill,
                    {
                      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.16)' : '#fff7ed',
                      borderColor: 'rgba(234, 88, 12, 0.35)',
                    },
                  ]}
                  onPress={() => setShowAddMember((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Feather name={showAddMember ? 'x' : 'user-plus'} size={13} color="#ea580c" />
                  <Text style={styles.addMemberPillText}>
                    {showAddMember ? 'Cancel' : '+ Add Member Manually'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Expandable Manual Member Form */}
              {showAddMember && (
                <View
                  style={[
                    styles.manualMemberCard,
                    { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                  ]}
                >
                  <Text style={[styles.manualCardTitle, { color: theme.textPrimary }]}>
                    Add Member Manually
                  </Text>
                  <Text style={[styles.manualCardSub, { color: theme.textMuted }]}>
                    Track meals & ledger for members even if they haven&apos;t joined the app yet.
                  </Text>

                  <View style={{ gap: 8, marginTop: 10 }}>
                    <TextInput
                      style={[
                        styles.manualInput,
                        {
                          backgroundColor: theme.bgSurface,
                          borderColor: theme.borderSubtle,
                          color: theme.textPrimary,
                        },
                      ]}
                      placeholder="Full Name (e.g. Rahul Sharma)"
                      placeholderTextColor={theme.textMuted}
                      value={newMemberName}
                      onChangeText={setNewMemberName}
                    />
                    <TextInput
                      style={[
                        styles.manualInput,
                        {
                          backgroundColor: theme.bgSurface,
                          borderColor: theme.borderSubtle,
                          color: theme.textPrimary,
                        },
                      ]}
                      placeholder="Email Address (optional, for monthly reports)"
                      placeholderTextColor={theme.textMuted}
                      value={newMemberEmail}
                      onChangeText={setNewMemberEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.manualSubmitBtn, { backgroundColor: '#ea580c' }]}
                      onPress={handleAddManualMember}
                      activeOpacity={0.8}
                    >
                      <Feather name="check" size={15} color="#ffffff" />
                      <Text style={styles.manualSubmitBtnText}>Add to Group</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.membersCard,
                  { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
                ]}
              >
                {membersList.length === 0 ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: theme.textMuted, fontSize: 13 }}>No members yet</Text>
                  </View>
                ) : (
                  membersList.map((m: any, idx: number) => {
                    const memberId = m._id || m.userId || String(idx);
                    return (
                      <View
                        key={memberId}
                        style={[
                          styles.memberItemRow,
                          idx !== membersList.length - 1 && {
                            borderBottomColor: theme.borderSubtle,
                            borderBottomWidth: 1,
                          },
                        ]}
                      >
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberInitial}>
                            {(m.name || 'M')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.memberName, { color: theme.textPrimary }]}>
                              {m.name || 'Member'}
                            </Text>
                            {m.isManual && (
                              <View style={styles.manualBadge}>
                                <Text style={styles.manualBadgeText}>MANUAL</Text>
                              </View>
                            )}
                          </View>
                          {m.email ? (
                            <Text style={[styles.memberEmail, { color: theme.textMuted }]}>
                              {m.email}
                            </Text>
                          ) : null}
                        </View>

                        <TouchableOpacity
                          style={styles.removeMemberBtn}
                          onPress={() => handleRemoveMember(memberId)}
                          activeOpacity={0.7}
                        >
                          <Feather name="trash-2" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#f97316' }, loading && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Save Configuration</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
  },
  sheetCard: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetSub: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  bodyScroll: {
    paddingTop: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  codeCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeDigitsText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f97316',
    letterSpacing: 4,
    marginTop: 2,
  },
  codeSub: {
    fontSize: 11,
    marginTop: 8,
  },
  staticPinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    gap: 5,
  },
  staticPinBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  membersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  memberItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '800',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  activeMemberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    marginTop: 6,
    gap: 8,
    elevation: 4,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  addMemberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  addMemberPillText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '700',
  },
  manualMemberCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    marginTop: 6,
  },
  manualCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  manualCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  manualInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  manualSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 10,
    gap: 6,
    marginTop: 4,
  },
  manualSubmitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  manualBadge: {
    backgroundColor: 'rgba(234, 88, 12, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  manualBadgeText: {
    color: '#ea580c',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  removeMemberBtn: {
    padding: 6,
    borderRadius: 8,
  },
});
