import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', defaultLimit: 8000, icon: 'fast-food-outline' },
  { name: 'Shopping', defaultLimit: 5000, icon: 'cart-outline' },
  { name: 'Travel & Commute', defaultLimit: 4000, icon: 'car-outline' },
  { name: 'Bills & Utilities', defaultLimit: 6000, icon: 'flash-outline' },
  { name: 'Entertainment', defaultLimit: 3000, icon: 'film-outline' },
];

export const OnboardingScreen = () => {
  const { updateUser, user } = useAuth();
  const { theme } = useTheme();

  const [monthlyBudget, setMonthlyBudget] = useState('25000');
  const [warningThreshold, setWarningThreshold] = useState('80');
  const [selectedCats, setSelectedCats] = useState<string[]>([
    'Food & Dining',
    'Shopping',
    'Travel & Commute',
    'Bills & Utilities',
  ]);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (name: string) => {
    if (selectedCats.includes(name)) {
      if (selectedCats.length === 1) {
        Alert.alert('Keep At Least 1', 'Please keep at least one category');
        return;
      }
      setSelectedCats(selectedCats.filter((c) => c !== name));
    } else {
      setSelectedCats([...selectedCats, name]);
    }
  };

  const handleComplete = async () => {
    const budgetNum = parseFloat(monthlyBudget);
    if (!monthlyBudget || isNaN(budgetNum) || budgetNum <= 0) {
      Alert.alert('Invalid Budget', 'Please set a valid monthly budget limit');
      return;
    }

    setSaving(true);
    // Create categories
    try {
      for (const catName of selectedCats) {
        const item = DEFAULT_CATEGORIES.find((c) => c.name === catName);
        await api.createCategory({
          name: catName,
          limit: item ? item.defaultLimit : 5000,
          warningThreshold: parseInt(warningThreshold, 10) || 80,
          criticalThreshold: 95,
        });
      }
      await api.updateProfile({ isOnboarded: true });
    } catch {
      // Continue even if backend has local profile
    }
    setSaving(false);

    updateUser({ isOnboarded: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgApp }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Welcome Header */}
        <View style={styles.headerBlock}>
          <View style={[styles.iconCircle, { backgroundColor: theme.accentPrimarySubtle }]}>
            <Ionicons name="sparkles" size={28} color={theme.accentPrimary} />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Welcome to XpenseFlow</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Let's configure your monthly spending limits and categories.
          </Text>
        </View>

        {/* Step 1: Overall Monthly Budget */}
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>1. Target Monthly Budget</Text>
          <Text style={[styles.cardSub, { color: theme.textMuted }]}>
            Total budget ceiling you aim to stay within each month.
          </Text>

          <View style={styles.amountInputRow}>
            <Text style={[styles.rupee, { color: theme.accentPrimary }]}>₹</Text>
            <TextInput
              style={[styles.budgetInput, { color: theme.textPrimary }]}
              value={monthlyBudget}
              onChangeText={setMonthlyBudget}
              keyboardType="decimal-pad"
              placeholder="25000"
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {/* Step 2: Warning Threshold */}
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>2. Alert Threshold</Text>
          <Text style={[styles.cardSub, { color: theme.textMuted }]}>
            Get notified when your spending crosses this percentage of your limit.
          </Text>

          <View style={styles.thresholdRow}>
            {['70', '80', '90'].map((th) => {
              const isSelected = warningThreshold === th;
              return (
                <TouchableOpacity
                  key={th}
                  onPress={() => setWarningThreshold(th)}
                  style={[
                    styles.threshChip,
                    {
                      backgroundColor: isSelected ? theme.accentPrimary : theme.bgElevated,
                      borderColor: isSelected ? theme.accentPrimary : theme.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.threshText,
                      { color: isSelected ? '#ffffff' : theme.textPrimary },
                    ]}
                  >
                    {th}% Warning
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Step 3: Spending Categories */}
        <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>3. Choose Initial Categories</Text>
          <Text style={[styles.cardSub, { color: theme.textMuted }]}>
            Tap to select the categories you spend on regularly.
          </Text>

          <View style={styles.categoryGrid}>
            {DEFAULT_CATEGORIES.map((cat) => {
              const isSelected = selectedCats.includes(cat.name);
              return (
                <TouchableOpacity
                  key={cat.name}
                  onPress={() => toggleCategory(cat.name)}
                  style={[
                    styles.catSelectChip,
                    {
                      backgroundColor: isSelected ? theme.accentPrimarySubtle : theme.bgElevated,
                      borderColor: isSelected ? theme.accentPrimary : theme.borderSubtle,
                    },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={16}
                    color={isSelected ? theme.accentPrimary : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.catSelectText,
                      {
                        color: isSelected ? theme.accentPrimary : theme.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={14} color={theme.accentPrimary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Complete Setup */}
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: theme.accentPrimary }]}
          onPress={handleComplete}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.completeBtnText}>
            {saving ? 'Setting Up...' : 'Start Managing Finances →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 48,
    gap: 16,
    paddingBottom: 40,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    marginBottom: 14,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupee: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 6,
  },
  budgetInput: {
    fontSize: 36,
    fontWeight: '800',
    minWidth: 140,
    textAlign: 'center',
  },
  thresholdRow: {
    flexDirection: 'row',
    gap: 10,
  },
  threshChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  threshText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryGrid: {
    gap: 8,
  },
  catSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  catSelectText: {
    flex: 1,
    fontSize: 13,
  },
  completeBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  completeBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
