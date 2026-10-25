/**
 * SmsExpenseBottomSheet.tsx
 *
 * An in-app modal that slides up automatically when an SMS transaction is
 * detected.  It lets the user:
 *
 *   1. See the amount (pre-filled, read-only from SMS)
 *   2. Pick a category from a compact icon grid
 *   3. Optionally add a custom title / merchant name
 *   4. Save → expense created immediately
 *   5. Dismiss → transaction stays as 'pending' in SmsPendingReviewScreen
 *
 * This component is mounted once at the root layout level and listens to
 * the 'sms_prompt_ready' event from smsNotificationService.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { dataEvents } from '../services/dataEvents';
import { DetectedTransaction, approveTransaction } from '../services/smsTransactionStore';
import { acknowledgePrompt } from '../services/smsNotificationService';

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Food & Dining',     icon: 'restaurant-outline',    color: '#A78BFA' },
  { name: 'Shopping',          icon: 'bag-handle-outline',    color: '#84CC16' },
  { name: 'Travel & Commute',  icon: 'car-outline',           color: '#38BDF8' },
  { name: 'Bills & Utilities', icon: 'flash-outline',         color: '#F59E0B' },
  { name: 'Entertainment',     icon: 'film-outline',          color: '#F472B6' },
  { name: 'Groceries',         icon: 'cart-outline',          color: '#10B981' },
  { name: 'Health & Fitness',  icon: 'fitness-outline',       color: '#EF4444' },
  { name: 'Education',         icon: 'book-outline',          color: '#6366F1' },
  { name: 'Investment',        icon: 'trending-up-outline',   color: '#14B8A6' },
  { name: 'Others',            icon: 'cube-outline',          color: '#9CA3AF' },
] as const;

type CategoryName = typeof CATEGORIES[number]['name'];

// ── Component ─────────────────────────────────────────────────────────────────
export const SmsExpenseBottomSheet: React.FC = () => {
  const { isDark } = useTheme();

  const t = {
    screenBg:   isDark ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.55)',
    cardBg:     isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    textPrimary:isDark ? '#FFFFFF' : '#101012',
    textMuted:  isDark ? '#8E8E93' : '#6B7280',
    inputBg:    isDark ? '#1C1C20' : '#F1F5F9',
    inputBorder:isDark ? '#2D2D35' : '#E2E8F0',
    iconBg:     isDark ? '#222228' : '#F1F5F9',
    handleBg:   isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.14)',
    accentTeal: '#0D9488',
    amountBg:   isDark ? '#0D2825' : '#CCFBF1',
    amountText: '#0D9488',
    danger:     '#EF4444',
  };

  const [visible, setVisible]         = useState(false);
  const [txn, setTxn]                 = useState<DetectedTransaction | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryName | null>(null);
  const [merchantTitle, setMerchantTitle]       = useState('');
  const [saving, setSaving]           = useState(false);

  const slideAnim = useRef(new Animated.Value(400)).current;

  // ── Listen for new SMS prompts ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = dataEvents.on('sms_prompt_ready', (detected: DetectedTransaction) => {
      setTxn(detected);
      // Pre-fill category if parser found a confident match (not 'Others')
      const suggestedCat = detected.category as CategoryName;
      const isKnown = CATEGORIES.some((c) => c.name === suggestedCat);
      setSelectedCategory(isKnown && suggestedCat !== 'Others' ? suggestedCat : null);
      setMerchantTitle('');
      setSaving(false);
      setVisible(true);
      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 12,
      }).start();
    });
    return unsub;
  }, [slideAnim]);

  // ── Dismiss (keep as pending) ───────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 500,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setTxn(null);
      acknowledgePrompt();
    });
  }, [slideAnim]);

  // ── Save expense ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!txn || !selectedCategory) return;
    setSaving(true);

    const edits: DetectedTransaction['userEdits'] = {
      category: selectedCategory,
    };
    if (merchantTitle.trim()) {
      edits.merchant = merchantTitle.trim();
    }

    await approveTransaction(txn._id, edits);

    Animated.timing(slideAnim, {
      toValue: 500,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setTxn(null);
      setSaving(false);
      acknowledgePrompt();
    });
  }, [txn, selectedCategory, merchantTitle, slideAnim]);

  if (!txn) return null;

  const amountFormatted = `₹${txn.amount.toLocaleString('en-IN')}`;
  const via = [txn.paymentMethod, txn.bank].filter(Boolean).join(' · ');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Dimmed backdrop */}
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: t.screenBg }]}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        {/* Animated card */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: t.cardBg,
              borderTopColor: t.cardBorder,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: t.handleBg }]} />

          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.smsIconCircle, { backgroundColor: t.amountBg }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={t.amountText} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: t.textPrimary }]}>
                  Transaction Detected
                </Text>
                <Text style={[styles.headerSub, { color: t.textMuted }]}>
                  via {via}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleDismiss}
              style={[styles.closeBtn, { backgroundColor: t.iconBg }]}
            >
              <Feather name="x" size={16} color={t.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Amount pill */}
          <View style={[styles.amountPill, { backgroundColor: t.amountBg }]}>
            <Text style={[styles.amountLabel, { color: t.textMuted }]}>Amount</Text>
            <Text style={[styles.amountValue, { color: t.amountText }]}>
              {amountFormatted}
            </Text>
            {txn.paymentMethod && (
              <View style={[styles.methodBadge, { backgroundColor: isDark ? '#1A3035' : '#99F6E4' }]}>
                <Text style={[styles.methodBadgeText, { color: t.amountText }]}>
                  {txn.paymentMethod}
                </Text>
              </View>
            )}
          </View>

          {/* Merchant title input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: t.textMuted }]}>
              Title / Description  <Text style={{ color: t.textMuted, fontWeight: '400' }}>(optional)</Text>
            </Text>
            <TextInput
              style={[
                styles.titleInput,
                { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary },
              ]}
              placeholder={
                txn.merchant && txn.merchant !== 'Unknown Merchant'
                  ? txn.merchant
                  : 'e.g. Groceries at Big Bazaar'
              }
              placeholderTextColor={t.textMuted}
              value={merchantTitle}
              onChangeText={setMerchantTitle}
              returnKeyType="done"
              maxLength={60}
            />
          </View>

          {/* Category picker */}
          <View style={styles.categorySection}>
            <Text style={[styles.inputLabel, { color: t.textMuted }]}>
              Select Category
              {!selectedCategory && (
                <Text style={{ color: t.danger }}> *</Text>
              )}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => setSelectedCategory(cat.name)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected
                          ? cat.color + '22'
                          : t.inputBg,
                        borderColor: isSelected ? cat.color : t.cardBorder,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={18}
                      color={isSelected ? cat.color : t.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: isSelected ? cat.color : t.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleDismiss}
              style={[styles.dismissBtn, { borderColor: t.cardBorder }]}
            >
              <Text style={[styles.dismissBtnText, { color: t.textMuted }]}>
                Review Later
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!selectedCategory || saving}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: selectedCategory ? t.accentTeal : t.inputBg,
                  opacity: !selectedCategory ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons
                name={saving ? 'hourglass-outline' : 'checkmark-circle-outline'}
                size={18}
                color={selectedCategory ? '#FFFFFF' : t.textMuted}
              />
              <Text
                style={[
                  styles.saveBtnText,
                  { color: selectedCategory ? '#FFFFFF' : t.textMuted },
                ]}
              >
                {saving ? 'Saving…' : 'Save Expense'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountPill: {
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    flex: 1,
  },
  methodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  titleInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '500',
  },
  categorySection: {
    paddingLeft: 20,
    marginBottom: 18,
  },
  categoryScroll: {
    paddingRight: 20,
    gap: 8,
    paddingTop: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 90,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  dismissBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
