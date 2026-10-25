import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

const CAT_COLORS = ['#0D9488', '#0284C7', '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6', '#64748B'];

export const AnalyticsScreen = () => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicTop = Math.max(insets.top + 6, 16);

  // TRANTOR Theme palette
  const t = {
    screenBg: isDark ? '#000000' : '#EBF0F3',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#26262B' : '#E2E8F0',
    itemBg: isDark ? '#1C1C20' : '#F8FAFC',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    iconBg: isDark ? '#222228' : '#F1F5F9',
    accentTeal: '#0D9488',
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<'7 days' | '1m' | '6m' | '1y' | 'All'>('1m');

  const loadAnalytics = async () => {
    try {
      const [expRes, incRes] = await Promise.all([
        api.getExpenses({ limit: '500' }),
        api.getIncomeSummary(),
      ]);

      if (expRes.data && Array.isArray(expRes.data)) setExpenses(expRes.data);
      if (incRes.data) setIncomeSummary(incRes.data);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  // Filtered expenses based on selected timeframe
  const filteredExpenses = useMemo(() => {
    if (timeframe === 'All') return expenses;
    const now = new Date();
    if (timeframe === '7 days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return expenses.filter((e) => e.date && new Date(e.date) >= past7);
    }
    if (timeframe === '1m') {
      const past1m = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return expenses.filter((e) => e.date && new Date(e.date) >= past1m);
    }
    if (timeframe === '6m') {
      const past6m = new Date(now.getTime() - 180 * 24 * 3600 * 1000);
      return expenses.filter((e) => e.date && new Date(e.date) >= past6m);
    }
    if (timeframe === '1y') {
      const past1y = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
      return expenses.filter((e) => e.date && new Date(e.date) >= past1y);
    }
    return expenses;
  }, [expenses, timeframe]);

  // Group by category
  const categoryTotals: Record<string, number> = {};
  let totalSpend = 0;
  filteredExpenses.forEach((item) => {
    const cat = item.category || 'Others';
    const amt = Number(item.amount) || 0;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    totalSpend += amt;
  });

  const categoryList = Object.entries(categoryTotals)
    .map(([name, amount], index) => ({
      name,
      amount,
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
      color: CAT_COLORS[index % CAT_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  // Group by payment method
  const paymentTotals: Record<string, number> = {};
  filteredExpenses.forEach((item) => {
    const pm = item.paymentMethod || 'UPI';
    paymentTotals[pm] = (paymentTotals[pm] || 0) + (Number(item.amount) || 0);
  });

  return (
    <View style={[styles.container, { backgroundColor: t.screenBg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: t.cardBg,
            borderBottomColor: t.cardBorder,
            paddingTop: dynamicTop,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Analytics & Insights</Text>
        <Text style={[styles.headerSub, { color: t.textMuted }]}>
          Visual breakdown of your financial habits
        </Text>
      </View>

      {/* Interactive Timeframe Filter Strip */}
      <View style={[styles.filterStripContainer, { backgroundColor: t.cardBg, borderBottomColor: t.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStripScroll}>
          {(['7 days', '1m', '6m', '1y', 'All'] as const).map((tf) => {
            const active = timeframe === tf;
            return (
              <TouchableOpacity
                key={tf}
                onPress={() => setTimeframe(tf)}
                style={[
                  styles.filterPill,
                  active
                    ? { backgroundColor: '#0F172A', borderColor: '#0F172A' }
                    : { backgroundColor: t.itemBg, borderColor: t.cardBorder },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: active ? '#FFFFFF' : t.textMuted, fontWeight: active ? '800' : '600' },
                  ]}
                >
                  {tf === '1m' ? '1 Month' : tf === '6m' ? '6 Months' : tf === '1y' ? '1 Year' : tf === '7 days' ? '7 Days' : 'All Time'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accentTeal}
            colors={[t.accentTeal]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={t.accentTeal} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* AI Insights Card */}
            <View
              style={[
                styles.insightCard,
                {
                  backgroundColor: isDark ? 'rgba(13, 148, 136, 0.12)' : '#CCFBF1',
                  borderColor: isDark ? 'rgba(13, 148, 136, 0.3)' : '#99F6E4',
                },
              ]}
            >
              <View style={styles.insightHeader}>
                <Ionicons name="sparkles" size={16} color={t.accentTeal} />
                <Text style={[styles.insightTitle, { color: t.accentTeal }]}>
                  AI FINANCIAL OBSERVATION
                </Text>
              </View>
              <Text style={[styles.insightBody, { color: t.textPrimary }]}>
                {categoryList[0]
                  ? `Your highest expenditure this period is in "${categoryList[0].name}" accounting for ${categoryList[0].percentage}% of total outgoings. Track your recurring bills to keep balance stable.`
                  : 'Start recording expenses to generate smart AI spending breakdowns.'}
              </Text>
            </View>

            {/* Total Spending Stat Card */}
            <View
              style={[
                styles.card,
                { backgroundColor: t.cardBg, borderColor: t.cardBorder },
              ]}
            >
              <Text style={[styles.statLabel, { color: t.textMuted }]}>TOTAL TRACKED SPENDING</Text>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>
                ₹{totalSpend.toLocaleString()}
              </Text>
              <Text style={[styles.statSub, { color: t.textMuted }]}>
                Across {expenses.length} recorded payments
              </Text>
            </View>

            {/* Category Breakdown */}
            <View
              style={[
                styles.card,
                { backgroundColor: t.cardBg, borderColor: t.cardBorder },
              ]}
            >
              <Text style={[styles.cardTitle, { color: t.textPrimary }]}>
                Spending by Category
              </Text>

              {/* Progress bar stack */}
              <View style={[styles.multiBarTrack, { backgroundColor: t.iconBg }]}>
                {categoryList.map((cat) => (
                  <View
                    key={cat.name}
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                      height: '100%',
                    }}
                  />
                ))}
              </View>

              <View style={styles.legendList}>
                {categoryList.map((cat) => (
                  <View key={cat.name} style={styles.legendItem}>
                    <View style={styles.legendLeft}>
                      <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                      <Text style={[styles.legendName, { color: t.textPrimary }]}>
                        {cat.name}
                      </Text>
                    </View>
                    <View style={styles.legendRight}>
                      <Text style={[styles.legendAmount, { color: t.textPrimary }]}>
                        ₹{cat.amount.toLocaleString()}
                      </Text>
                      <Text style={[styles.legendPercent, { color: t.textMuted }]}>
                        ({cat.percentage}%)
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Payment Methods Breakdown */}
            <View
              style={[
                styles.card,
                { backgroundColor: t.cardBg, borderColor: t.cardBorder },
              ]}
            >
              <Text style={[styles.cardTitle, { color: t.textPrimary }]}>
                Payment Channels
              </Text>
              <View style={styles.paymentMethodList}>
                {Object.entries(paymentTotals).map(([method, amt]) => {
                  const pct = totalSpend > 0 ? Math.round((amt / totalSpend) * 100) : 0;
                  return (
                    <View key={method} style={[styles.pmRow, { borderBottomColor: t.cardBorder }]}>
                      <View style={styles.pmLeft}>
                        <View style={[styles.pmIconBox, { backgroundColor: t.iconBg }]}>
                          <Feather name="credit-card" size={15} color={t.textPrimary} />
                        </View>
                        <Text style={[styles.pmName, { color: t.textPrimary }]}>{method}</Text>
                      </View>
                      <Text style={[styles.pmAmount, { color: t.textPrimary }]}>
                        ₹{amt.toLocaleString()}{' '}
                        <Text style={[styles.pmPercent, { color: t.textMuted }]}>({pct}%)</Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  filterStripContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterStripScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  insightCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  insightBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  card: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statSub: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  multiBarTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 16,
  },
  legendList: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    fontSize: 13,
    fontWeight: '600',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  legendPercent: {
    fontSize: 12,
  },
  paymentMethodList: {
    gap: 4,
  },
  pmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pmIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pmName: {
    fontSize: 13,
    fontWeight: '600',
  },
  pmAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  pmPercent: {
    fontSize: 12,
    fontWeight: '500',
  },
});
