import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface CreditCard3DProps {
  balance: number;
  income: number;
  expense: number;
  cardHolder?: string;
  onAddPress?: () => void;
  onIncomePress?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CreditCard3D: React.FC<CreditCard3DProps> = ({
  balance,
  income,
  expense,
  cardHolder = 'XPENSEFLOW PLATINUM',
  onAddPress,
  onIncomePress,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.outerContainer}>
      {/* 3D Layered Card Container */}
      <View style={[styles.card, { borderColor: isDark ? 'rgba(45, 212, 191, 0.25)' : 'rgba(15, 118, 110, 0.2)' }]}>
        {/* Vector Background Gradient Mesh */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            {isDark ? (
              <LinearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#0d3b36" />
                <Stop offset="45%" stopColor="#111827" />
                <Stop offset="100%" stopColor="#0b0a09" />
              </LinearGradient>
            ) : (
              <LinearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#0f766e" />
                <Stop offset="55%" stopColor="#115e59" />
                <Stop offset="100%" stopColor="#042f2e" />
              </LinearGradient>
            )}
            <LinearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#fde047" />
              <Stop offset="50%" stopColor="#ca8a04" />
              <Stop offset="100%" stopColor="#eab308" />
            </LinearGradient>
            <LinearGradient id="glowCircle" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={24} fill="url(#cardGrad)" />
          {/* Ambient Lighting Orbs */}
          <Circle cx="85%" cy="20%" r="90" fill="url(#glowCircle)" />
          <Circle cx="15%" cy="85%" r="70" fill="url(#glowCircle)" />
        </Svg>

        {/* Top Row: Chip & Contactless Wave & Logo */}
        <View style={styles.topRow}>
          <View style={styles.chipWrapper}>
            {/* Realistic EMV Metallic Chip */}
            <Svg width="40" height="30" viewBox="0 0 40 30">
              <Rect width="40" height="30" rx="5" fill="url(#chipGrad)" />
              <Path
                d="M0 15 H40 M20 0 V30 M10 0 V15 M30 0 V15 M10 30 V15 M30 30 V15"
                stroke="#854d0e"
                strokeWidth="1.2"
                opacity="0.8"
              />
              <Rect x="14" y="9" width="12" height="12" rx="3" fill="#eab308" opacity="0.9" />
            </Svg>
            {/* NFC Contactless Wave */}
            <Ionicons name="radio-outline" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 10 }} />
          </View>

          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>VIRTUAL CARD</Text>
          </View>
        </View>

        {/* Middle: Net Worth / Balance Display */}
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Text style={styles.balanceAmount}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Card Number & Holder */}
        <View style={styles.numberRow}>
          <Text style={styles.cardNumber}>••••  ••••  ••••  8824</Text>
          <Text style={styles.cardHolder}>{cardHolder}</Text>
        </View>

        {/* Bottom Income & Expense Mini Bento Pills */}
        <View style={styles.pillsRow}>
          <TouchableOpacity
            style={styles.statPill}
            onPress={onIncomePress}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
              <Feather name="arrow-down-left" size={14} color="#4ade80" />
            </View>
            <View>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={[styles.statValue, { color: '#4ade80' }]}>
                +₹{income.toLocaleString('en-IN')}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.pillDivider} />

          <TouchableOpacity
            style={styles.statPill}
            onPress={onAddPress}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
              <Feather name="arrow-up-right" size={14} color="#fb7185" />
            </View>
            <View>
              <Text style={styles.statLabel}>Expenses</Text>
              <Text style={[styles.statValue, { color: '#fb7185' }]}>
                -₹{expense.toLocaleString('en-IN')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
    shadowColor: '#2dd4bf',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 215,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgePillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  balanceBlock: {
    marginTop: 8,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  balanceAmount: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  cardNumber: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  cardHolder: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  statIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
});

export default CreditCard3D;
