import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { DatePickerModal } from './DatePickerModal';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAmount?: string;
}

const CATEGORIES = [
  { name: 'Food & Dining', icon: 'restaurant-outline' },
  { name: 'Shopping', icon: 'bag-handle-outline' },
  { name: 'Travel & Commute', icon: 'car-outline' },
  { name: 'Bills & Utilities', icon: 'flash-outline' },
  { name: 'Entertainment', icon: 'film-outline' },
  { name: 'Health & Fitness', icon: 'fitness-outline' },
  { name: 'Groceries', icon: 'cart-outline' },
  { name: 'Education', icon: 'book-outline' },
  { name: 'Investment', icon: 'trending-up-outline' },
  { name: 'Others', icon: 'cube-outline' },
];

const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI', icon: 'phone-portrait-outline' },
  { id: 'Credit Card', label: 'Credit Card', icon: 'card-outline' },
  { id: 'Debit Card', label: 'Debit Card', icon: 'wallet-outline' },
  { id: 'Cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'Net Banking', label: 'Net Banking', icon: 'business-outline' },
];

const toLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialAmount = '',
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
    accentTeal: '#0D9488',
    overlayBg: 'rgba(0, 0, 0, 0.72)',
    handleBg: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
  };

  const [amount, setAmount] = useState(initialAmount);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [date, setDate] = useState(toLocalDateString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  // The user's ACTUAL categories (from their account) — the static list is
  // only a fallback until the fetch resolves.
  const [categoryOptions, setCategoryOptions] = useState(CATEGORIES);

  useEffect(() => {
    if (initialAmount) setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    if (visible) {
      setDate(toLocalDateString());
      setShowDatePicker(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCategories();
        const list = Array.isArray(res.data)
          ? res.data.filter((c: any) => c && c.name)
          : [];
        if (!cancelled && list.length > 0) {
          const mapped = list.map((c: any) => ({
            name: c.name,
            icon: c.icon || 'cube-outline',
          }));
          setCategoryOptions(mapped);
          setCategory((prev) =>
            mapped.some((c) => c.name === prev) ? prev : mapped[0].name
          );
        }
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter what this expense was for');
      return;
    }

    setLoading(true);
    const res = await api.addExpense({
      title: title.trim(),
      amount: parsedAmount,
      category,
      paymentMethod,
      date: new Date(`${date}T00:00:00.000Z`).toISOString(),
      notes: notes.trim(),
    });
    setLoading(false);

    if (res.error) {
      Alert.alert('Failed to save', res.error);
    } else {
      setAmount('');
      setTitle('');
      setNotes('');
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
              <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Add Expense</Text>
              <Text style={[styles.sheetSub, { color: t.textMuted }]}>
                Record an outgoing transaction
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
            {/* Big Amount Field */}
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

            {/* Title / Description */}
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>DESCRIPTION / TITLE</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: t.inputBg,
                  borderColor: t.inputBorder,
                  color: t.textPrimary,
                },
              ]}
              placeholder="e.g. Dinner, Uber, Groceries"
              placeholderTextColor={t.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {/* Category selection */}
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {categoryOptions.map((cat) => {
                const isSelected = category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => setCategory(cat.name)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.inputBg,
                        borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.inputBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={isSelected ? (isDark ? '#000000' : '#FFFFFF') : t.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected ? (isDark ? '#000000' : '#FFFFFF') : t.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Payment Mode Selection */}
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>PAYMENT METHOD</Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_MODES.map((pm) => {
                const isSelected = paymentMethod === pm.id;
                return (
                  <TouchableOpacity
                    key={pm.id}
                    onPress={() => setPaymentMethod(pm.id)}
                    style={[
                      styles.paymentCard,
                      {
                        backgroundColor: isSelected ? (isDark ? 'rgba(13, 148, 136, 0.15)' : '#CCFBF1') : t.inputBg,
                        borderColor: isSelected ? t.accentTeal : t.inputBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name={pm.icon as any}
                      size={15}
                      color={isSelected ? t.accentTeal : t.textMuted}
                    />
                    <Text
                      style={[
                        styles.paymentText,
                        {
                          color: isSelected ? t.accentTeal : t.textMuted,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {pm.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date */}
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>DATE</Text>
            <TouchableOpacity
              style={[
                styles.textInput,
                styles.datePickerButton,
                { backgroundColor: t.inputBg, borderColor: t.inputBorder },
              ]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
            >
              <Feather name="calendar" size={16} color={t.accentTeal} />
              <Text style={[styles.datePickerText, { color: t.textPrimary }]}>
                {new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Feather name="chevron-down" size={18} color={t.textMuted} />
            </TouchableOpacity>
            <DatePickerModal
              visible={showDatePicker}
              initialDate={date}
              onClose={() => setShowDatePicker(false)}
              onSelectDate={setDate}
            />

            {/* Optional Notes */}
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textArea,
                {
                  backgroundColor: t.inputBg,
                  borderColor: t.inputBorder,
                  color: t.textPrimary,
                },
              ]}
              placeholder="Additional notes or reference..."
              placeholderTextColor={t.textMuted}
              multiline
              numberOfLines={2}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: t.accentTeal }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Expense</Text>
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
    maxHeight: '92%',
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
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    height: 64,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  chipsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12.5,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  paymentText: {
    fontSize: 12,
  },
  saveBtn: {
    marginTop: 22,
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
