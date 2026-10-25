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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

interface AddSplitModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddSplitModal: React.FC<AddSplitModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useTheme();

  const t = {
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    inputBg: isDark ? '#1C1C20' : '#F1F5F9',
    inputBorder: isDark ? '#2D2D35' : '#E2E8F0',
    iconBg: isDark ? '#1F1F24' : '#F1F5F9',
    accentTeal: '#0D9488',
    overlayBg: 'rgba(0, 0, 0, 0.72)',
    handleBg: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
  };

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (visible) {
      loadGroups();
    }
  }, [visible]);

  const loadGroups = async () => {
    setFetching(true);
    const res = await api.getSplitGroups();
    setFetching(false);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      setGroups(res.data);
      setSelectedGroupId(res.data[0]._id);
    }
  };

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to split');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Description Required', 'Please enter description of expense');
      return;
    }

    if (!selectedGroupId) {
      Alert.alert('No Group Selected', 'Please select or create a split group first');
      return;
    }

    setLoading(true);
    const res = await api.addSplitExpense(selectedGroupId, {
      description: description.trim(),
      amount: num,
      date: new Date().toISOString(),
    });
    setLoading(false);

    if (res.error) {
      Alert.alert('Error', res.error);
    } else {
      setAmount('');
      setDescription('');
      onSuccess();
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalOverlay, { backgroundColor: t.overlayBg }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheetContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {/* Sheet Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: t.handleBg }]} />

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: t.cardBorder }]}>
            <View>
              <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Split Cost</Text>
              <Text style={[styles.sheetSub, { color: t.textMuted }]}>
                Share an expense with group members
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.iconBg }]}>
              <Feather name="x" size={18} color={t.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={[styles.amountCard, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
              <Text style={[styles.currencySymbol, { color: t.accentTeal }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: t.textPrimary }]}
                placeholder="0"
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>

            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>SELECT GROUP</Text>
            {fetching ? (
              <ActivityIndicator color={t.accentTeal} style={{ marginVertical: 8 }} />
            ) : groups.length === 0 ? (
              <Text style={[styles.noGroupText, { color: t.textMuted }]}>
                No groups found. Please create a group in the Splits tab.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                {groups.map((g) => {
                  const isSelected = selectedGroupId === g._id;
                  return (
                    <TouchableOpacity
                      key={g._id}
                      onPress={() => setSelectedGroupId(g._id)}
                      style={[
                        styles.groupChip,
                        {
                          backgroundColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.inputBg,
                          borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupChipText,
                          {
                            color: isSelected ? (isDark ? '#000000' : '#FFFFFF') : t.textPrimary,
                            fontWeight: isSelected ? '800' : '500',
                          },
                        ]}
                      >
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>DESCRIPTION</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: t.inputBg,
                  borderColor: t.inputBorder,
                  color: t.textPrimary,
                },
              ]}
              placeholder="e.g. Dinner buffet, Uber ride, Airbnb"
              placeholderTextColor={t.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: t.accentTeal }]}
              onPress={handleSave}
              disabled={loading || groups.length === 0}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Split Equally With Group</Text>
              )}
            </TouchableOpacity>
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
    maxHeight: '90%',
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
  content: {
    padding: 22,
    paddingBottom: 36,
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    fontSize: 38,
    fontWeight: '800',
    minWidth: 120,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  noGroupText: {
    fontSize: 13,
    marginVertical: 6,
  },
  groupChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  groupChipText: {
    fontSize: 12.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  saveBtn: {
    marginTop: 24,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
