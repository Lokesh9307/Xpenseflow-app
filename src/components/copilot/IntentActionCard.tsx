import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IntentActionCardProps {
  cardData: {
    amount: number;
    category: string;
    categoryId?: string;
    title?: string;
    paymentMethod?: string;
    date?: string;
    saved?: boolean;
  };
  onConfirm: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  theme: any;
}

export const IntentActionCard: React.FC<IntentActionCardProps> = ({
  cardData,
  onConfirm,
  onCancel,
  isSubmitting = false,
  theme,
}) => {
  const isSaved = !!cardData.saved;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.bgElevated,
          borderColor: isSaved ? theme.success : theme.accentPrimary,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={isSaved ? 'checkmark-circle' : 'receipt-outline'}
            size={18}
            color={isSaved ? theme.success : theme.accentPrimary}
          />
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {isSaved ? 'Expense Verified & Saved' : 'Expense Prepared'}
          </Text>
        </View>
        <Text style={[styles.amount, { color: theme.accentPrimary }]}>
          ₹{cardData.amount}
        </Text>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Category</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {cardData.category}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Payment Mode</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {cardData.paymentMethod || 'UPI'}
          </Text>
        </View>
      </View>

      {cardData.title && cardData.title !== `${cardData.category} expense` && (
        <View style={styles.titleRow}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Title / Note</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]} numberOfLines={1}>
            {cardData.title}
          </Text>
        </View>
      )}

      {!isSaved ? (
        <View style={styles.actionButtons}>
          {onCancel && (
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.borderSubtle }]}
              onPress={onCancel}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: theme.accentPrimary }]}
            onPress={onConfirm}
            disabled={isSubmitting}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Confirm and save expense"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm & Save Expense</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.savedBadge, { backgroundColor: theme.successSubtle }]}>
          <Ionicons name="shield-checkmark" size={14} color={theme.success} />
          <Text style={[styles.savedBadgeText, { color: theme.success }]}>
            Verified · Saved to Dashboard & History
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
