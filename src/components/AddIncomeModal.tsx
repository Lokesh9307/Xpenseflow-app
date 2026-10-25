import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SOURCES = [
  { name: 'Salary', icon: 'wallet-outline' },
  { name: 'Freelance', icon: 'laptop-outline' },
  { name: 'Investments', icon: 'trending-up-outline' },
  { name: 'Business', icon: 'business-outline' },
  { name: 'Bonus', icon: 'gift-outline' },
  { name: 'Other', icon: 'cash-outline' },
];

export const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useTheme();

  // TRANTOR Theme tokens
  const t = {
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    inputBg: isDark ? '#1C1C20' : '#F1F5F9',
    inputBorder: isDark ? '#2D2D35' : '#E2E8F0',
    iconBg: isDark ? '#1F1F24' : '#F1F5F9',
    accentGreen: '#059669',
    accentTeal: '#0D9488',
    overlayBg: 'rgba(0, 0, 0, 0.72)',
    handleBg: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
  };

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('Salary');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid income amount');
      return;
    }

    setLoading(true);
    const res = await api.addIncome({
      amount: num,
      source,
      note: note.trim(),
      date: new Date().toISOString(),
    });
    setLoading(false);

    if (res.error) {
      Alert.alert('Error', res.error);
    } else {
      setAmount('');
      setNote('');
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
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: t.cardBg,
              borderColor: t.cardBorder,
            },
          ]}
        >
          {/* Top Handle Grabber */}
          <View style={[styles.sheetHandle, { backgroundColor: t.handleBg }]} />

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: t.cardBorder }]}>
            <View>
              <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Add Income</Text>
              <Text style={[styles.sheetSub, { color: t.textMuted }]}>
                Record new earnings or inflows
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.iconBg }]}>
              <Feather name="x" size={18} color={t.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount Field */}
            <View style={[styles.amountCard, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
              <Text style={[styles.currencySymbol, { color: t.accentGreen }]}>₹</Text>
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

            {/* Income Source */}
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>INCOME SOURCE</Text>
            <View style={styles.sourceGrid}>
              {SOURCES.map((s) => {
                const isSelected = source === s.name;
                return (
                  <TouchableOpacity
                    key={s.name}
                    onPress={() => setSource(s.name)}
                    style={[
                      styles.sourceChip,
                      {
                        backgroundColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.inputBg,
                        borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.inputBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name={s.icon as any}
                      size={15}
                      color={isSelected ? (isDark ? '#000000' : '#FFFFFF') : t.textMuted}
                    />
                    <Text
                      style={[
                        styles.sourceChipText,
                        {
                          color: isSelected ? (isDark ? '#000000' : '#FFFFFF') : t.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note */}
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>NOTE / REFERENCE (OPTIONAL)</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: t.inputBg,
                  borderColor: t.inputBorder,
                  color: t.textPrimary,
                },
              ]}
              placeholder="e.g. October monthly salary, Project milestone"
              placeholderTextColor={t.textMuted}
              value={note}
              onChangeText={setNote}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: t.accentGreen }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Income</Text>
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
    paddingBottom: 24,
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
  scrollContent: {
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
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  sourceChipText: {
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
