import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useFeature } from '../../context/FeatureContext';
import { api } from '../../services/api';
import { AddExpenseModal } from '../../components/AddExpenseModal';
import { AddIncomeModal } from '../../components/AddIncomeModal';
import { AddSplitModal } from '../../components/AddSplitModal';
import { AddTiffinModal } from '../../components/AddTiffinModal';
import { DigitalCalculatorModal } from '../../components/DigitalCalculatorModal';
import { NotificationDrawer } from '../../components/NotificationDrawer';
import { CategoryModal } from '../../components/CategoryModal';
import { CommonAppHeader } from '../../components/CommonAppHeader';
import { Category3DIcon } from '../../components/Category3DIcon';
import { dataEvents } from '../../services/dataEvents';

// Category icon mapper - all monochromatic matching TRANTOR's clean styling
const CATEGORY_ICONS: Record<string, string> = {
  'Food & Dining': 'restaurant-outline',
  Shopping: 'bag-handle-outline',
  'Travel & Commute': 'car-outline',
  'Bills & Utilities': 'flash-outline',
  Entertainment: 'film-outline',
  'Health & Fitness': 'fitness-outline',
  Groceries: 'cart-outline',
  Education: 'book-outline',
  Investment: 'trending-up-outline',
  Others: 'cube-outline',
};

export const DashboardScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { setActiveFeature } = useFeature();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Month selector (identical to web version)
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );

  // Data states from web app features
  const [incomeSummary, setIncomeSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [recurringList, setRecurringList] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dashboardRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interactive UI state for TRANTOR components
  const [timeframe, setTimeframe] = useState<'1d' | '7 days' | '1m' | '6m' | '1y'>('7 days');
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  // Modals
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [tiffinModalVisible, setTiffinModalVisible] = useState(false);
  const [calcModalVisible, setCalcModalVisible] = useState(false);
  const [notifDrawerVisible, setNotifDrawerVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<any>(null);
  const [calcPrefillAmount, setCalcPrefillAmount] = useState<string>('');

  // Month picker options (past 6 months)
  const monthOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      const val = date.toISOString().slice(0, 7);
      const label = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      return { val, label };
    });
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const [incomeRes, expRes, catRes, budgRes, recRes, notifRes] = await Promise.all([
        api.getIncomeSummary(),
        api.getExpenses({ limit: '1000', sortBy: 'date', sortOrder: 'desc' }),
        api.getCategories(),
        api.getBudgets(),
        api.getRecurringExpenses(),
        api.getNotifications(),
      ]);

      if (incomeRes.data) setIncomeSummary(incomeRes.data);
      if (expRes.data && Array.isArray(expRes.data)) setExpenses(expRes.data);
      if (catRes.data && Array.isArray(catRes.data)) setCategories(catRes.data);
      if (budgRes.data && Array.isArray(budgRes.data)) setBudgets(budgRes.data);
      if (recRes.data && Array.isArray(recRes.data)) setRecurringList(recRes.data);
      if (notifRes.data && Array.isArray(notifRes.data)) setNotifications(notifRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const scheduleDashboardReload = useCallback(() => {
    if (dashboardRefreshTimer.current) clearTimeout(dashboardRefreshTimer.current);
    dashboardRefreshTimer.current = setTimeout(() => {
      dashboardRefreshTimer.current = null;
      void loadDashboardData();
    }, 250);
  }, [loadDashboardData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Apply event payloads immediately and coalesce the follow-up network refresh.
  useEffect(() => {
    const unsubExpAdded = dataEvents.on('expense_added', (newExp: any) => {
      if (newExp) {
        setExpenses((prev) => {
          const id = newExp._id || newExp.id;
          if (prev.some((e) => (e._id || e.id) === id)) return prev;
          return [newExp, ...prev];
        });
      }
      scheduleDashboardReload();
    });

    const unsubExpDeleted = dataEvents.on('expense_deleted', (deletedId: string) => {
      if (deletedId) {
        setExpenses((prev) => prev.filter((e) => (e._id || e.id) !== deletedId));
      }
      scheduleDashboardReload();
    });

    const unsubExpUpdated = dataEvents.on('expense_updated', (updatedExp: any) => {
      if (updatedExp) {
        const id = updatedExp._id || updatedExp.id;
        setExpenses((prev) =>
          prev.map((e) => ((e._id || e.id) === id ? { ...e, ...updatedExp } : e))
        );
      }
      scheduleDashboardReload();
    });

    const unsubIncAdded = dataEvents.on('income_added', () => {
      scheduleDashboardReload();
    });

    const unsubCatUpdated = dataEvents.on('category_updated', (cat: any) => {
      if (cat) {
        setCategories((prev) => {
          const id = cat._id || cat.id;
          const exists = prev.some(
            (c) =>
              (id && (c._id || c.id) === id) ||
              (cat.previousName && c.name?.toLowerCase() === cat.previousName?.toLowerCase()) ||
              c.name?.toLowerCase() === cat.name?.toLowerCase()
          );
          if (exists) {
            return prev.map((c) =>
              (id && (c._id || c.id) === id) ||
              (cat.previousName && c.name?.toLowerCase() === cat.previousName?.toLowerCase()) ||
              c.name?.toLowerCase() === cat.name?.toLowerCase()
                ? { ...c, ...cat }
                : c
            );
          }
          return [...prev, cat];
        });

        if (cat.previousName && cat.name && cat.previousName !== cat.name) {
          setExpenses((prev) =>
            prev.map((e) => (e.category === cat.previousName ? { ...e, category: cat.name } : e))
          );
        }
      }
      if (cat) scheduleDashboardReload();
    });

    const unsubRefresh = dataEvents.on('refresh_data', () => {
      scheduleDashboardReload();
    });

    const unsubCatDeleted = dataEvents.on('category_deleted', (catId: string) => {
      setCategories((prev) => prev.filter((c) => (c._id || c.id) !== catId));
      scheduleDashboardReload();
    });

    const unsubExpSynced = dataEvents.on('expenses_synced', (syncedExpenses: any[]) => {
      if (Array.isArray(syncedExpenses)) setExpenses(syncedExpenses);
    });

    return () => {
      unsubExpAdded();
      unsubExpDeleted();
      unsubExpUpdated();
      unsubIncAdded();
      unsubCatUpdated();
      unsubRefresh();
      unsubCatDeleted();
      unsubExpSynced();
      if (dashboardRefreshTimer.current) clearTimeout(dashboardRefreshTimer.current);
    };
  }, [scheduleDashboardReload]);

  const onRefresh = async () => {
    setRefreshing(true);
    await api.syncUserData({ force: true }).catch(() => {});
    await loadDashboardData();
  };

  // Current active month key (YYYY-MM). Auto-resets on the 1st of every month!
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const activeMonthKey = selectedMonth || currentMonthKey;

  // Active month expenses: resets to fresh 0 on the 1st of every month automatically
  const activeMonthExpenses = useMemo(() => {
    return expenses.filter((item) => {
      try {
        const itemDateStr = item.date ? new Date(item.date).toISOString().slice(0, 7) : '';
        return !itemDateStr || itemDateStr === activeMonthKey;
      } catch {
        return false;
      }
    });
  }, [expenses, activeMonthKey]);

  // Compute category-wise totals from active month expenses
  // All categories automatically start fresh at ₹0 on the 1st of every month!
  const categoryStats = useMemo(() => {
    const map: Record<string, { amount: number; count: number; name: string; limit: number; id: string }> = {};

    categories.forEach((c) => {
      map[c.name] = {
        amount: 0,
        count: 0,
        name: c.name,
        limit: c.limit || c.monthlyLimit || 5000,
        id: c._id || c.id,
      };
    });

    activeMonthExpenses.forEach((item) => {
      const cat = item.category || 'Others';
      if (!map[cat]) {
        map[cat] = { amount: 0, count: 0, name: cat, limit: 5000, id: '' };
      }
      map[cat].amount += Number(item.amount) || 0;
      map[cat].count += 1;
    });

    const list = Object.values(map);
    list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [categories, activeMonthExpenses]);

  // Total spent in active month (automatically starts fresh at ₹0 on 1st of every month)
  const activeMonthSpent = useMemo(() => {
    return activeMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [activeMonthExpenses]);

  const monthTotal = activeMonthSpent > 0 ? activeMonthSpent : (incomeSummary?.monthExpense ?? 0);
  const monthIncome = incomeSummary?.monthIncome ?? 0;
  const cashFlow = monthIncome - monthTotal;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Overall KPI Summary:
  // 1. Total Limit: Strictly the sum of all category limits configured by the user
  const totalLimit = useMemo(() => {
    return categories.reduce((acc, c) => acc + (Number(c.limit || c.monthlyLimit) || 0), 0);
  }, [categories]);

  // 2. Net Available Balance / Remaining: Total Income (or Total Limit if income is 0) minus total expenses
  // When income is added, the pool increases; as expenses are logged, it decreases.
  const effectiveBudgetPool = monthIncome > 0 ? monthIncome : totalLimit;
  const remainingBudget = effectiveBudgetPool - monthTotal;
  const budgetConsumedPct = effectiveBudgetPool > 0
    ? Math.min(Math.round((monthTotal / effectiveBudgetPool) * 100), 100)
    : 0;

  // Upcoming Recurring Subscriptions (next 7 days)
  const upcomingRecurring = useMemo(() => {
    return recurringList
      .filter((item) => item.active !== false)
      .slice(0, 3);
  }, [recurringList]);

  // Filtered expenses based on category selection
  const filteredExpenses = useMemo(() => {
    if (selectedCategory === 'All') return expenses;
    return expenses.filter((e) => e.category === selectedCategory);
  }, [expenses, selectedCategory]);

  // ── REAL DATE-WISE EXPENDITURE CHART DATA (Responsive to 1d, 7 days, 1m, 6m, 1y) ──
  const realChartData = useMemo(() => {
    const relevantExpenses = selectedCategory === 'All'
      ? expenses
      : expenses.filter((e) => e.category === selectedCategory);

    const now = new Date();

    const formatDateKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let bars: Array<{
      day: string;
      dateNumber?: number;
      detailLabel?: string;
      currentAmount: number;
      prevAmount: number;
      growth: string;
      isMore: boolean;
      isLess: boolean;
      isActive: boolean;
    }> = [];

    let currentPeriodLabel = 'This Week';
    let prevPeriodLabel = 'Last Week';

    const getGrowth = (current: number, prev: number) => {
      if (prev > 0) {
        const diff = current - prev;
        const pct = Math.round((diff / prev) * 100);
        return {
          growthStr: (pct > 0 ? '+' : '') + pct + '%',
          isMore: pct > 0,
          isLess: pct < 0,
        };
      } else if (current > 0) {
        return { growthStr: '+100%', isMore: true, isLess: false };
      }
      return { growthStr: '0%', isMore: false, isLess: false };
    };

    if (timeframe === '1d') {
      currentPeriodLabel = 'Today';
      prevPeriodLabel = 'Yesterday';

      const todayStr = formatDateKey(now);
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = formatDateKey(yesterday);

      const slots = [
        { label: '06h', name: 'Early', start: 0, end: 6 },
        { label: '10h', name: 'Morning', start: 6, end: 10 },
        { label: '14h', name: 'Noon', start: 10, end: 14 },
        { label: '18h', name: 'Evening', start: 14, end: 18 },
        { label: '22h', name: 'Night', start: 18, end: 22 },
        { label: '24h', name: 'Midnight', start: 22, end: 24 },
      ];

      const currentSlotMap: Record<number, number> = {};
      const prevSlotMap: Record<number, number> = {};

      relevantExpenses.forEach((item) => {
        if (!item.date) return;
        const d = new Date(item.date);
        if (isNaN(d.getTime())) return;
        const dStr = formatDateKey(d);
        const hour = d.getHours();
        const amt = Number(item.amount) || 0;

        const slotIdx = slots.findIndex((s) => hour >= s.start && hour < s.end);
        if (slotIdx >= 0) {
          if (dStr === todayStr) {
            currentSlotMap[slotIdx] = (currentSlotMap[slotIdx] || 0) + amt;
          } else if (dStr === yesterdayStr) {
            prevSlotMap[slotIdx] = (prevSlotMap[slotIdx] || 0) + amt;
          }
        }
      });

      const currentHour = now.getHours();
      const currentActiveSlot = slots.findIndex((s) => currentHour >= s.start && currentHour < s.end);

      bars = slots.map((s, idx) => {
        const curAmt = currentSlotMap[idx] || 0;
        const prvAmt = prevSlotMap[idx] || 0;
        const { growthStr, isMore, isLess } = getGrowth(curAmt, prvAmt);

        return {
          day: s.label,
          detailLabel: `Today · ${s.name} (${s.start}:00 - ${s.end}:00)`,
          currentAmount: curAmt,
          prevAmount: prvAmt,
          growth: growthStr,
          isMore,
          isLess,
          isActive: idx === currentActiveSlot,
        };
      });

    } else if (timeframe === '7 days') {
      currentPeriodLabel = 'This Week';
      prevPeriodLabel = 'Last Week';

      const todayDayOfWeek = (now.getDay() + 6) % 7;
      const expenseDateMap: Record<string, number> = {};
      relevantExpenses.forEach((item) => {
        if (item.date) {
          const d = new Date(item.date);
          if (!isNaN(d.getTime())) {
            const key = formatDateKey(d);
            expenseDateMap[key] = (expenseDateMap[key] || 0) + (Number(item.amount) || 0);
          }
        }
      });

      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const thisMonday = new Date(now);
      thisMonday.setHours(0, 0, 0, 0);
      thisMonday.setDate(now.getDate() - todayDayOfWeek);

      bars = dayNames.map((day, idx) => {
        const thisDayDate = new Date(thisMonday);
        thisDayDate.setDate(thisMonday.getDate() + idx);
        const thisDayKey = formatDateKey(thisDayDate);
        const currentAmount = expenseDateMap[thisDayKey] || 0;

        const lastWeekDayDate = new Date(thisDayDate);
        lastWeekDayDate.setDate(thisDayDate.getDate() - 7);
        const lastWeekKey = formatDateKey(lastWeekDayDate);
        const prevAmount = expenseDateMap[lastWeekKey] || 0;

        const { growthStr, isMore, isLess } = getGrowth(currentAmount, prevAmount);

        return {
          day,
          dateNumber: thisDayDate.getDate(),
          detailLabel: thisDayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          currentAmount,
          prevAmount,
          growth: growthStr,
          isMore,
          isLess,
          isActive: idx === todayDayOfWeek,
        };
      });

    } else if (timeframe === '1m') {
      currentPeriodLabel = 'This Month';
      prevPeriodLabel = 'Last Month';

      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      const prevMonthDate = new Date(curYear, curMonth - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth();

      const weeks = [
        { label: 'W1', name: '1st - 7th', start: 1, end: 7 },
        { label: 'W2', name: '8th - 14th', start: 8, end: 14 },
        { label: 'W3', name: '15th - 21st', start: 15, end: 21 },
        { label: 'W4', name: '22nd - 28th', start: 22, end: 28 },
        { label: 'W5', name: '29th - End', start: 29, end: 31 },
      ];

      const currentWeekMap: Record<number, number> = {};
      const prevWeekMap: Record<number, number> = {};

      relevantExpenses.forEach((item) => {
        if (!item.date) return;
        const d = new Date(item.date);
        if (isNaN(d.getTime())) return;
        const y = d.getFullYear();
        const m = d.getMonth();
        const dateNum = d.getDate();
        const amt = Number(item.amount) || 0;

        const weekIdx = weeks.findIndex((w) => dateNum >= w.start && dateNum <= w.end);
        if (weekIdx >= 0) {
          if (y === curYear && m === curMonth) {
            currentWeekMap[weekIdx] = (currentWeekMap[weekIdx] || 0) + amt;
          } else if (y === prevYear && m === prevMonth) {
            prevWeekMap[weekIdx] = (prevWeekMap[weekIdx] || 0) + amt;
          }
        }
      });

      const todayDate = now.getDate();
      const activeWeekIdx = weeks.findIndex((w) => todayDate >= w.start && todayDate <= w.end);

      bars = weeks.map((w, idx) => {
        const curAmt = currentWeekMap[idx] || 0;
        const prvAmt = prevWeekMap[idx] || 0;
        const { growthStr, isMore, isLess } = getGrowth(curAmt, prvAmt);

        return {
          day: w.label,
          detailLabel: `${w.label} (${w.name})`,
          currentAmount: curAmt,
          prevAmount: prvAmt,
          growth: growthStr,
          isMore,
          isLess,
          isActive: idx === activeWeekIdx,
        };
      });

    } else if (timeframe === '6m') {
      currentPeriodLabel = 'Past 6 Months';
      prevPeriodLabel = 'Prior 6M';

      const monthsList: Array<{ label: string; monthKey: string; prevMonthKey: string; fullLabel: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const prevD = new Date(now.getFullYear(), now.getMonth() - i - 6, 1);
        const monthKey = d.toISOString().slice(0, 7);
        const prevMonthKey = prevD.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('en-US', { month: 'short' });
        const fullLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        monthsList.push({ label, monthKey, prevMonthKey, fullLabel });
      }

      const currentMonthKey = now.toISOString().slice(0, 7);
      const monthSpendMap: Record<string, number> = {};

      relevantExpenses.forEach((item) => {
        if (!item.date) return;
        const d = new Date(item.date);
        if (isNaN(d.getTime())) return;
        const key = d.toISOString().slice(0, 7);
        monthSpendMap[key] = (monthSpendMap[key] || 0) + (Number(item.amount) || 0);
      });

      bars = monthsList.map((m) => {
        const curAmt = monthSpendMap[m.monthKey] || 0;
        const prvAmt = monthSpendMap[m.prevMonthKey] || 0;
        const { growthStr, isMore, isLess } = getGrowth(curAmt, prvAmt);

        return {
          day: m.label,
          detailLabel: m.fullLabel,
          currentAmount: curAmt,
          prevAmount: prvAmt,
          growth: growthStr,
          isMore,
          isLess,
          isActive: m.monthKey === currentMonthKey,
        };
      });

    } else if (timeframe === '1y') {
      currentPeriodLabel = 'This Year';
      prevPeriodLabel = 'Last Year';

      const thisYear = now.getFullYear();
      const lastYear = thisYear - 1;

      const periods = [
        { label: 'Jan-Feb', months: [0, 1] },
        { label: 'Mar-Apr', months: [2, 3] },
        { label: 'May-Jun', months: [4, 5] },
        { label: 'Jul-Aug', months: [6, 7] },
        { label: 'Sep-Oct', months: [8, 9] },
        { label: 'Nov-Dec', months: [10, 11] },
      ];

      const currentPeriodMap: Record<number, number> = {};
      const prevPeriodMap: Record<number, number> = {};

      relevantExpenses.forEach((item) => {
        if (!item.date) return;
        const d = new Date(item.date);
        if (isNaN(d.getTime())) return;
        const y = d.getFullYear();
        const m = d.getMonth();
        const amt = Number(item.amount) || 0;

        const pIdx = periods.findIndex((p) => p.months.includes(m));
        if (pIdx >= 0) {
          if (y === thisYear) {
            currentPeriodMap[pIdx] = (currentPeriodMap[pIdx] || 0) + amt;
          } else if (y === lastYear) {
            prevPeriodMap[pIdx] = (prevPeriodMap[pIdx] || 0) + amt;
          }
        }
      });

      const currentMonth = now.getMonth();
      const activePIdx = periods.findIndex((p) => p.months.includes(currentMonth));

      bars = periods.map((p, idx) => {
        const curAmt = currentPeriodMap[idx] || 0;
        const prvAmt = prevPeriodMap[idx] || 0;
        const { growthStr, isMore, isLess } = getGrowth(curAmt, prvAmt);

        return {
          day: p.label,
          detailLabel: `${p.label} ${thisYear}`,
          currentAmount: curAmt,
          prevAmount: prvAmt,
          growth: growthStr,
          isMore,
          isLess,
          isActive: idx === activePIdx,
        };
      });
    }

    // Calculate maximum amount to dynamically scale bars
    const allAmounts = bars.map((b) => Math.max(b.currentAmount, b.prevAmount));
    const rawMax = Math.max(...allAmounts, 0);
    const maxVal = rawMax > 0 ? Math.ceil(rawMax / 100) * 100 : 1000;

    const scaledBars = bars.map((bar) => {
      const heightPercent = bar.currentAmount > 0
        ? Math.max(Math.min(Math.round((bar.currentAmount / maxVal) * 100), 100), 6)
        : 0;

      const prevWeekHeight = bar.prevAmount > 0
        ? Math.max(Math.min(Math.round((bar.prevAmount / maxVal) * 100), 100), 6)
        : 0;

      return {
        ...bar,
        heightPercent,
        prevWeekHeight,
      };
    });

    const formatYVal = (val: number) => {
      if (val >= 1000) {
        const k = (val / 1000).toFixed(1);
        return `₹${k.endsWith('.0') ? k.slice(0, -2) : k}k`;
      }
      return `₹${Math.round(val)}`;
    };

    const yGridLabels = [
      formatYVal(maxVal),
      formatYVal((maxVal * 2) / 3),
      formatYVal(maxVal / 3),
      '₹0',
    ];

    const thisPeriodTotal = bars.reduce((acc, b) => acc + b.currentAmount, 0);
    const prevPeriodTotal = bars.reduce((acc, b) => acc + b.prevAmount, 0);

    let periodTrendPct = 0;
    if (prevPeriodTotal > 0) {
      periodTrendPct = Math.round(((thisPeriodTotal - prevPeriodTotal) / prevPeriodTotal) * 100);
    } else if (thisPeriodTotal > 0) {
      periodTrendPct = 100;
    }

    return {
      bars: scaledBars,
      yGridLabels,
      thisPeriodTotal,
      prevPeriodTotal,
      periodTrendPct,
      currentPeriodLabel,
      prevPeriodLabel,
    };
  }, [expenses, selectedCategory, timeframe]);


  const handleDeleteExpense = (id: string, title: string) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await api.deleteExpense(id);
            if (res.error) Alert.alert('Error', res.error);
            else scheduleDashboardReload();
          },
        },
      ]
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXACT TRANTOR COLOR PALETTE (From Uploaded Image)
  // ═══════════════════════════════════════════════════════════════════════════
  const t = {
    screenBg: isDark ? '#000000' : '#EBF0F3',
    textPrimary: isDark ? '#FFFFFF' : '#101012',
    textMuted: isDark ? '#8E8E93' : '#6B7280',
    // White/Dark capsule
    capsuleBg: isDark ? '#141416' : '#FFFFFF',
    capsuleBorder: isDark ? '#26262B' : '#E2E8F0',
    capsuleIconBg: isDark ? '#222228' : '#F1F5F9',
    // Pastel Mint Bento
    mintBg: isDark ? '#122823' : '#CEEFE9',
    mintBorder: isDark ? '#1C3A33' : '#B5E4DC',
    mintText: isDark ? '#E6FAF5' : '#0B2923',
    mintMuted: isDark ? '#7BAAA0' : '#4E7E74',
    mintBarActive: isDark ? '#101012' : '#0F172A',
    mintBarShadow: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(11, 41, 35, 0.14)',
    // Deep Charcoal Bento (Identical to Screen 1 lower half)
    charcoalBg: '#101012',
    charcoalBorder: '#222226',
    charcoalItemBg: '#1C1C1E',
    charcoalItemBorder: '#28282C',
    charcoalText: '#FFFFFF',
    charcoalSub: '#8E8E93',
    // Lavender Pill
    lavenderBg: isDark ? '#262038' : '#EDE6FA',
    lavenderText: isDark ? '#C7B8F5' : '#4338CA',
    // Trend green
    trendGreen: '#059669',
  };


  const greetingName = user?.name ? user.name.split(' ')[0] : 'Steve';

  return (
    <View style={[styles.container, { backgroundColor: t.screenBg }]}>
      {/* ═══════════════════════════════════════════════════════════════════════
          COMMON FIXED HEADER: (Hey, {name}! / Avatar / Bell Well) - NOT SCROLLABLE
          ═══════════════════════════════════════════════════════════════════════ */}
      <CommonAppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.mintText}
            colors={[t.mintText]}
          />
        }
      >
        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 2: LIVE REMAINING BALANCE BANNER (Increases with Income, Decreases with Expenses)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.currentValueSection}>
          <View style={styles.currentValueTopRow}>
            <Text style={[styles.currentValueLabel, { color: t.textMuted }]}>
              {monthIncome > 0 ? 'AVAILABLE BALANCE' : 'REMAINING BUDGET'}
            </Text>

            {/* Month selector pill */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowMonthDropdown(!showMonthDropdown)}
              style={[
                styles.monthFilterPill,
                { backgroundColor: t.capsuleBg, borderColor: t.capsuleBorder },
              ]}
            >
              <Feather name="calendar" size={12} color={t.textMuted} />
              <Text style={[styles.monthFilterText, { color: t.textPrimary }]}>
                {new Date(`${selectedMonth}-01`).toLocaleString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
              <Feather name="chevron-down" size={12} color={t.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Month selector dropdown */}
          {showMonthDropdown && (
            <View
              style={[
                styles.monthDropdownMenu,
                { backgroundColor: t.capsuleBg, borderColor: t.capsuleBorder },
              ]}
            >
              {monthOptions.map((m) => (
                <TouchableOpacity
                  key={m.val}
                  onPress={() => {
                    setSelectedMonth(m.val);
                    setShowMonthDropdown(false);
                  }}
                  style={styles.dropdownMenuItem}
                >
                  <Text
                    style={[
                      styles.dropdownMenuText,
                      {
                        color: selectedMonth === m.val ? '#0D9488' : t.textPrimary,
                        fontWeight: selectedMonth === m.val ? '800' : '600',
                      },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.amountTrendRow}>
            <Text
              style={[
                styles.amountBig,
                { color: remainingBudget >= 0 ? t.textPrimary : '#EF4444' },
              ]}
            >
              {remainingBudget < 0 ? '-' : ''}₹{Math.abs(remainingBudget).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor:
                    remainingBudget >= 0
                      ? 'rgba(5, 150, 105, 0.12)'
                      : 'rgba(239, 68, 68, 0.12)',
                },
              ]}
            >
              <Feather
                name={remainingBudget >= 0 ? 'arrow-up-right' : 'arrow-down-right'}
                size={13}
                color={remainingBudget >= 0 ? t.trendGreen : '#EF4444'}
              />
              <Text
                style={[
                  styles.trendBadgeText,
                  { color: remainingBudget >= 0 ? t.trendGreen : '#EF4444' },
                ]}
              >
                {monthIncome > 0
                  ? `+₹${monthIncome.toLocaleString()} Income`
                  : `${budgetConsumedPct}% Spent`}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            TRANTOR SECTION 3: CONNECTED DUAL-ACTION CAPSULE
            [ (↑) Add Expense ]  ( ⋈ )  [ Add Income (↓) ]
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.actionCapsuleWrapper}>
          <View
            style={[
              styles.actionCapsuleContainer,
              {
                backgroundColor: t.capsuleBg,
                borderColor: t.capsuleBorder,
              },
            ]}
          >
            {/* Left Action: Add Expense */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setExpenseModalVisible(true)}
              style={styles.capsuleHalfBtn}
            >
              <View style={[styles.roundActionIcon, { backgroundColor: t.capsuleIconBg }]}>
                <Feather name="arrow-up" size={16} color={t.textPrimary} />
              </View>
              <Text style={[styles.capsuleBtnText, { color: t.textPrimary }]}>
                Add Expense
              </Text>
            </TouchableOpacity>

            {/* Interlocking Center Bridge */}
            <View
              style={[
                styles.capsuleCenterBridge,
                {
                  backgroundColor: t.screenBg,
                  borderColor: t.capsuleBorder,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="vector-link"
                size={15}
                color={t.textMuted}
              />
            </View>

            {/* Right Action: Add Income */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setIncomeModalVisible(true)}
              style={styles.capsuleHalfBtn}
            >
              <Text style={[styles.capsuleBtnText, { color: t.textPrimary }]}>
                Add Income
              </Text>
              <View style={[styles.roundActionIcon, { backgroundColor: t.capsuleIconBg }]}>
                <Feather name="arrow-down" size={16} color={t.textPrimary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            SUMMARY KPI PILLS (Total Limit · Spent · Remaining Live Balance)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.kpiRow}>
          <View
            style={[
              styles.kpiPillCard,
              { backgroundColor: t.capsuleBg, borderColor: t.capsuleBorder },
            ]}
          >
            <Text style={[styles.kpiPillSub, { color: t.textMuted }]}>TOTAL LIMIT</Text>
            <Text style={[styles.kpiPillAmount, { color: t.textPrimary }]}>
              ₹{totalLimit.toLocaleString()}
            </Text>
            <Text style={[styles.kpiPillDesc, { color: t.textMuted }]}>
              All {categories.length} Categories
            </Text>
          </View>

          <View
            style={[
              styles.kpiPillCard,
              { backgroundColor: t.capsuleBg, borderColor: t.capsuleBorder },
            ]}
          >
            <Text style={[styles.kpiPillSub, { color: t.textMuted }]}>TOTAL SPENT</Text>
            <Text style={[styles.kpiPillAmount, { color: '#EF4444' }]}>
              -₹{monthTotal.toLocaleString()}
            </Text>
            <Text style={[styles.kpiPillDesc, { color: t.textMuted }]}>
              {budgetConsumedPct}% Consumed
            </Text>
          </View>

          <View
            style={[
              styles.kpiPillCard,
              { backgroundColor: t.capsuleBg, borderColor: t.capsuleBorder },
            ]}
          >
            <Text style={[styles.kpiPillSub, { color: t.textMuted }]}>
              {monthIncome > 0 ? 'NET BALANCE' : 'REMAINING'}
            </Text>
            <Text
              style={[
                styles.kpiPillAmount,
                { color: remainingBudget >= 0 ? t.trendGreen : '#EF4444' },
              ]}
            >
              {remainingBudget < 0 ? '-' : ''}₹{Math.abs(remainingBudget).toLocaleString()}
            </Text>
            <Text style={[styles.kpiPillDesc, { color: t.textMuted }]}>
              {monthIncome > 0 ? 'After All Expenses' : 'Budget Left'}
            </Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            TRANTOR SECTION 4: REAL DATE-WISE EXPENDITURE CHART (Minimalist Bento Card)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View
          style={[
            styles.mintBentoCard,
            {
              backgroundColor: '#FFFFFF',
              borderColor: isDark ? '#2A2A30' : '#E2E8F0',
            },
          ]}
        >
          {/* Card Top Row: Category Picker Pill + Timeframe Selector + More Button */}
          <View style={styles.mintCardTopRow}>
            {/* Category Pill with Dropdown */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              style={[
                styles.mintCategoryPill,
                { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1 },
              ]}
            >
              <Ionicons name="pricetag-outline" size={12} color="#0F172A" />
              <Text style={[styles.mintCategoryPillText, { color: '#0F172A' }]}>
                {selectedCategory}
              </Text>
              <Feather name="chevron-down" size={12} color="#0F172A" />
            </TouchableOpacity>

            {/* Timeframe Selector Strip */}
            <View style={[styles.timeframeStrip, { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 2, borderWidth: 1, borderColor: '#E2E8F0' }]}>
              {(['1d', '7 days', '1m', '6m', '1y'] as const).map((tf) => {
                const isActive = timeframe === tf;
                return (
                  <TouchableOpacity
                    key={tf}
                    onPress={() => {
                      setTimeframe(tf);
                      setSelectedBarIndex(null);
                    }}
                    style={[
                      styles.timeframePill,
                      isActive && {
                        backgroundColor: '#0F172A',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeframeText,
                        {
                          color: isActive
                            ? '#FFFFFF'
                            : '#64748B',
                        },
                      ]}
                    >
                      {tf}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Lavender More Pill */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Analytics')}
              style={[
                styles.moreLavenderPill,
                { backgroundColor: t.lavenderBg },
              ]}
            >
              <Text style={[styles.moreLavenderText, { color: t.lavenderText }]}>
                More
              </Text>
              <Feather name="chevron-down" size={11} color={t.lavenderText} />
            </TouchableOpacity>
          </View>

          {/* Interactive Inspection Tooltip Banner when a bar is tapped */}
          {selectedBarIndex !== null && realChartData.bars[selectedBarIndex] && (
            <View style={[styles.chartInteractivePill, { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}>
              <Ionicons name="sparkles" size={13} color="#0D9488" />
              <Text style={styles.chartInteractivePillText}>
                <Text style={{ fontWeight: '800', color: '#0F172A' }}>
                  {realChartData.bars[selectedBarIndex].detailLabel || realChartData.bars[selectedBarIndex].day}
                </Text>
                {' : '}
                <Text style={{ fontWeight: '800', color: '#0D9488' }}>
                  ₹{realChartData.bars[selectedBarIndex].currentAmount.toLocaleString()}
                </Text>
                {' ('}
                {realChartData.bars[selectedBarIndex].growth} vs {realChartData.prevPeriodLabel})
              </Text>
            </View>
          )}

          {/* Optional Category Dropdown Popover */}
          {showCategoryDropdown && (
            <View
              style={[
                styles.categoryDropdownMenu,
                {
                  backgroundColor: t.capsuleBg,
                  borderColor: t.capsuleBorder,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory('All');
                  setShowCategoryDropdown(false);
                }}
                style={styles.dropdownMenuItem}
              >
                <Text style={[styles.dropdownMenuText, { color: t.textPrimary, fontWeight: selectedCategory === 'All' ? '700' : '500' }]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {categoryStats.map((c) => (
                <TouchableOpacity
                  key={c.name}
                  onPress={() => {
                    setSelectedCategory(c.name);
                    setShowCategoryDropdown(false);
                  }}
                  style={styles.dropdownMenuItem}
                >
                  <Text style={[styles.dropdownMenuText, { color: t.textPrimary, fontWeight: selectedCategory === c.name ? '700' : '500' }]}>
                    {c.name} (₹{c.amount.toLocaleString()})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Bar Chart Area with Real Dashed Y-axis Grid Lines */}
          <View style={styles.chartContainer}>
            {/* Real Y-axis values & Dashed lines */}
            <View style={styles.gridLinesContainer}>
              {realChartData.yGridLabels.map((val, idx) => (
                <View key={idx} style={styles.gridRow}>
                  <Text style={[styles.gridLabel, { color: '#64748B' }]}>
                    {val}
                  </Text>
                  <View
                    style={[
                      styles.dashedLine,
                      {
                        borderColor: '#E2E8F0',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>

            {/* Chunky Vertical Rounded Bars for Each Period */}
            <View style={styles.barsContainer}>
              {realChartData.bars.map((bar, idx) => {
                const isBarSelected = selectedBarIndex === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => setSelectedBarIndex(isBarSelected ? null : idx)}
                    style={styles.barColumn}
                  >
                    {/* Percent change indicator badge atop bar: more or less */}
                    <View
                      style={[
                        styles.barGrowthBadge,
                        {
                          backgroundColor: isBarSelected ? '#CCFBF1' : '#F1F5F9',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.barGrowthText,
                          {
                            color: isBarSelected
                              ? '#0D9488'
                              : bar.isLess
                              ? '#059669'
                              : bar.isMore
                              ? '#DC2626'
                              : '#64748B',
                            fontWeight: isBarSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {bar.growth}
                      </Text>
                    </View>

                    {/* Bar track with Previous Period Shadow + Current Period Real Expenditure */}
                    <View style={styles.barTrack}>
                      {/* Previous period same shadow bar */}
                      <View
                        style={[
                          styles.shadowBar,
                          {
                            height: `${bar.prevWeekHeight}%`,
                            backgroundColor: '#E2E8F0',
                          },
                        ]}
                      />
                      {/* Active real expenditure bar */}
                      <View
                        style={[
                          styles.solidBar,
                          {
                            height: `${bar.heightPercent}%`,
                            backgroundColor: isBarSelected ? '#0D9488' : '#0F172A',
                          },
                        ]}
                      />
                    </View>

                    {/* Period label with active/highlighted period */}
                    <Text
                      style={[
                        styles.barDayLabel,
                        {
                          color: isBarSelected ? '#0D9488' : bar.isActive ? '#0F172A' : '#64748B',
                          fontWeight: isBarSelected || bar.isActive ? '800' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {bar.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Chart Legend with dynamic period labels */}
          <View style={styles.chartLegendRow}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDotSolid,
                  { backgroundColor: '#0F172A' },
                ]}
              />
              <Text style={[styles.legendLabel, { color: '#64748B' }]}>
                {realChartData.currentPeriodLabel} (₹{realChartData.thisPeriodTotal.toLocaleString()})
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDotHollow,
                  {
                    borderColor: '#94A3B8',
                  },
                ]}
              />
              <Text style={[styles.legendLabel, { color: '#64748B' }]}>
                {realChartData.prevPeriodLabel} (₹{realChartData.prevPeriodTotal.toLocaleString()})
              </Text>
            </View>
          </View>
        </View>
        {/* ═══════════════════════════════════════════════════════════════════════
            CATEGORY BUDGETS SECTION (Separate Standalone Folder Cards, Full List)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.categorySectionWrapper}>
          {/* Section Header: Title + Subtitle + Add Category Action */}
          <View style={styles.categorySectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>
                Category Budgets
              </Text>
              <Text style={[styles.categorySectionSub, { color: t.textMuted }]}>
                {categoryStats.length} active categories · Resets 1st of month
              </Text>
            </View>

            {/* Add Category Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setSelectedCategoryForEdit(null);
                setCategoryModalVisible(true);
              }}
              style={styles.addCategoryHeaderPill}
            >
              <Feather name="plus" size={13} color="#FFFFFF" />
              <Text style={styles.addCategoryHeaderPillText}>Add Category</Text>
            </TouchableOpacity>
          </View>

          {/* Separate Folder Cards Stack (Each card is its own standalone entity) */}
          <View style={styles.folderCardsStack}>
            {categoryStats.length === 0 ? (
              <View
                style={[
                  styles.emptyCategoriesBox,
                  {
                    backgroundColor: t.capsuleBg,
                    borderColor: t.capsuleBorder,
                  },
                ]}
              >
                <Feather name="layers" size={24} color={t.textMuted} />
                <Text style={[styles.emptyCategoriesText, { color: t.textMuted }]}>
                  No category budgets set yet. Tap + Add Category to configure.
                </Text>
              </View>
            ) : (
              categoryStats.map((item) => {
                const limit = item.limit || 5000;
                const ratio = Math.min(Math.round((item.amount / limit) * 100), 100);
                const isOverBudget = item.amount >= limit;
                const remaining = Math.max(limit - item.amount, 0);

                const catObj = categories.find(
                  (c) => (c._id || c.id) === item.id || c.name === item.name
                ) || {
                  _id: item.id,
                  id: item.id,
                  name: item.name,
                  limit: limit,
                  monthlyLimit: limit,
                };

                return (
                  <View key={item.name} style={styles.folderCardOuter}>
                    {/* ── Document Sheet Peek (Tactile paper slip peeking out from folder) ── */}
                    <View
                      style={[
                        styles.documentSheetPeek,
                        {
                          backgroundColor: isDark ? '#23232C' : '#FFFFFF',
                          borderColor: isDark ? '#383848' : '#CBD5E1',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.documentFauxLine1,
                          { backgroundColor: isDark ? '#3D3D50' : '#E2E8F0' },
                        ]}
                      />
                      <View
                        style={[
                          styles.documentFauxLine2,
                          { backgroundColor: isDark ? '#3D3D50' : '#E2E8F0' },
                        ]}
                      />
                    </View>

                    {/* ── Folder Asymmetrical Top Tab Handle ── */}
                    <View
                      style={[
                        styles.individualFolderTab,
                        {
                          backgroundColor: isDark ? '#1C1C22' : '#F1F5F9',
                          borderColor: t.capsuleBorder,
                        },
                      ]}
                    >
                      <Feather name="folder" size={11} color="#0D9488" />
                      <Text style={[styles.individualFolderTabText, { color: t.textPrimary }]}>
                        {item.name}
                      </Text>
                      <View
                        style={[
                          styles.folderStatusDot,
                          {
                            backgroundColor: isOverBudget
                              ? '#EF4444'
                              : ratio >= 80
                              ? '#F59E0B'
                              : '#0D9488',
                          },
                        ]}
                      />
                    </View>

                    {/* ── Folder Main Card Body ── */}
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        navigation.navigate('CategoryDetail', {
                          categoryId: item.id,
                          categoryName: item.name,
                          categoryLimit: limit,
                          categoryIcon: catObj.icon || (item as any).icon,
                        });
                      }}
                      style={[
                        styles.individualFolderBody,
                        {
                          backgroundColor: t.capsuleBg,
                          borderColor: t.capsuleBorder,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: isDark ? 0.35 : 0.06,
                          shadowRadius: 10,
                          elevation: 3,
                        },
                      ]}
                    >
                      {/* Subtle Folder Crease / Seam Line */}
                      <View
                        style={[
                          styles.folderCreaseLine,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.04)',
                          },
                        ]}
                      />

                      {/* Top Header Row: 3D Category Icon + Category Meta + Budget Utilization Badge & Edit Button */}
                      <View style={styles.catCardTopRow}>
                        <View style={styles.cat3DIconWrapper}>
                          <Category3DIcon
                            category={item.name}
                            icon={catObj.icon || (item as any).icon}
                            size={48}
                          />
                        </View>

                        <View style={styles.catMetaCol}>
                          <Text style={[styles.catTitleText, { color: t.textPrimary }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              styles.catStatusText,
                              {
                                color: isOverBudget
                                  ? '#EF4444'
                                  : ratio >= 80
                                  ? '#F59E0B'
                                  : '#0D9488',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {isOverBudget
                              ? `⚠️ Exceeded by ₹${(item.amount - limit).toLocaleString()}`
                              : ratio >= 80
                              ? `⚡ ₹${remaining.toLocaleString()} left of ₹${limit.toLocaleString()}`
                              : `✨ ₹${remaining.toLocaleString()} remaining`}
                          </Text>
                        </View>

                        {/* Top-right Actions: Utilization Badge */}
                        <View style={styles.catTopRightActions}>
                          <View
                            style={[
                              styles.catUtilizationPill,
                              {
                                backgroundColor: isOverBudget
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : ratio >= 80
                                  ? 'rgba(245, 158, 11, 0.12)'
                                  : 'rgba(13, 148, 136, 0.12)',
                                borderColor: isOverBudget
                                  ? 'rgba(239, 68, 68, 0.25)'
                                  : ratio >= 80
                                  ? 'rgba(245, 158, 11, 0.25)'
                                  : 'rgba(13, 148, 136, 0.25)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.catUtilizationText,
                                {
                                  color: isOverBudget
                                    ? '#EF4444'
                                    : ratio >= 80
                                    ? '#F59E0B'
                                    : '#0D9488',
                                },
                              ]}
                            >
                              {ratio}%
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Amount Spent vs Budget Limit Row */}
                      <View style={styles.catAmountRow}>
                        <View style={styles.catAmountFlex}>
                          <Text style={[styles.catAmountSpent, { color: t.textPrimary }]}>
                            ₹{item.amount.toLocaleString()}
                          </Text>
                          <Text style={[styles.catBudgetMuted, { color: t.textMuted }]}>
                            {' '}of ₹{limit.toLocaleString()} budget
                          </Text>
                        </View>
                        <Text style={[styles.catTxnSmall, { color: t.textMuted }]}>
                          {item.count} {item.count === 1 ? 'txn' : 'txns'}
                        </Text>
                      </View>

                      {/* 3D Progress Bar Track */}
                      <View
                        style={[
                          styles.catProgressTrack,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E2E8F0',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.catProgressFill,
                            {
                              width: `${ratio}%`,
                              backgroundColor: isOverBudget
                                ? '#EF4444'
                                : ratio >= 80
                                ? '#F59E0B'
                                : '#0D9488',
                            },
                          ]}
                        />
                      </View>

                      {/* Bottom Folder Pocket Footer */}
                      <View
                        style={[
                          styles.folderPocketFooter,
                          {
                            borderTopColor: isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.05)',
                          },
                        ]}
                      >
                        <View style={styles.folderPocketLeft}>
                          <Feather name="file-text" size={11} color={t.textMuted} />
                          <Text style={[styles.folderPocketCountText, { color: t.textMuted }]}>
                            {item.count} {item.count === 1 ? 'transaction' : 'transactions'} this month
                          </Text>
                        </View>
                        <View style={styles.folderOpenPrompt}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedCategoryForEdit(catObj);
                              setCategoryModalVisible(true);
                            }}
                            style={styles.folderInlineEditBtn}
                          >
                            <Feather name="edit-2" size={11} color={t.textMuted} />
                            <Text style={[styles.folderInlineEditText, { color: t.textMuted }]}>Edit</Text>
                          </TouchableOpacity>
                          <View style={[styles.folderActionDivider, { backgroundColor: t.capsuleBorder }]} />
                          <Text style={[styles.folderOpenPromptText, { color: '#0D9488' }]}>
                            View Folder
                          </Text>
                          <Feather name="arrow-right" size={11} color="#0D9488" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            UPCOMING RECURRING SUBSCRIPTIONS CARD (From Web Version)
            ═══════════════════════════════════════════════════════════════════════ */}
        {upcomingRecurring.length > 0 && (
          <View style={styles.recurringSectionWrapper}>
            <View style={styles.recentSectionHeader}>
              <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>
                Upcoming Subscriptions
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Recurring')}
                activeOpacity={0.7}
              >
                <Text style={[styles.seeAllTxnsText, { color: '#0D9488' }]}>
                  Manage All
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.transactionsCard,
                { backgroundColor: t.capsuleBg, borderColor: t.capsuleBorder },
              ]}
            >
              {upcomingRecurring.map((rec, idx) => {
                const isLast = idx === upcomingRecurring.length - 1;
                return (
                  <View
                    key={rec._id || idx}
                    style={[
                      styles.txnRow,
                      !isLast && { borderBottomColor: t.capsuleBorder, borderBottomWidth: 1 },
                    ]}
                  >
                    <View style={[styles.txnIconSquare, { backgroundColor: t.capsuleIconBg }]}>
                      <Feather name="repeat" size={16} color={t.textPrimary} />
                    </View>

                    <View style={styles.txnCenterCol}>
                      <Text style={[styles.txnTitleText, { color: t.textPrimary }]} numberOfLines={1}>
                        {rec.title}
                      </Text>
                      <Text style={[styles.txnCategoryText, { color: t.textMuted }]}>
                        {rec.frequency || 'Monthly'} · Auto-renew
                      </Text>
                    </View>

                    <Text style={[styles.txnAmountText, { color: t.textPrimary }]}>
                      ₹{Number(rec.amount || 0).toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TRANTOR SECTION 6: RECENT TRANSACTIONS (With Delete Action & Filter)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.recentSectionHeader}>
          <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>
            Recent Activity
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ExpensesTxns')}
            activeOpacity={0.7}
          >
            <Text style={[styles.seeAllTxnsText, { color: t.textMuted }]}>
              See All ({expenses.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.transactionsCard,
            {
              backgroundColor: t.capsuleBg,
              borderColor: t.capsuleBorder,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator
              size="small"
              color={t.mintText}
              style={{ padding: 24 }}
            />
          ) : filteredExpenses.length === 0 ? (
            <View style={styles.emptyStatePad}>
              <Feather name="credit-card" size={26} color={t.textMuted} />
              <Text style={[styles.emptyStateTitle, { color: t.textPrimary }]}>
                No expenses logged yet
              </Text>
              <Text style={[styles.emptyStateDesc, { color: t.textMuted }]}>
                Tap the + Add Expense button above to create your first record.
              </Text>
            </View>
          ) : (
            filteredExpenses.slice(0, 6).map((item, idx) => {
              const iconName = CATEGORY_ICONS[item.category] || 'cube-outline';
              const isLast = idx === Math.min(filteredExpenses.length, 6) - 1;

              return (
                <View
                  key={item._id || item.id || idx}
                  style={[
                    styles.txnRow,
                    !isLast && {
                      borderBottomColor: t.capsuleBorder,
                      borderBottomWidth: 1,
                    },
                  ]}
                >
                  <View style={[styles.txnIconSquare, { backgroundColor: t.capsuleIconBg }]}>
                    <Ionicons
                      name={iconName as any}
                      size={17}
                      color={t.textPrimary}
                    />
                  </View>

                  <View style={styles.txnCenterCol}>
                    <Text
                      style={[styles.txnTitleText, { color: t.textPrimary }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.txnCategoryText, { color: t.textMuted }]}>
                      {item.category} · {item.paymentMethod || 'UPI'}
                    </Text>
                  </View>

                  <Text style={[styles.txnAmountText, { color: t.textPrimary }]}>
                    -₹{Number(item.amount || 0).toLocaleString()}
                  </Text>

                  {/* Quick Delete icon button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteExpense(item._id || item.id, item.title)}
                    style={styles.deleteTxnBtn}
                  >
                    <Feather name="trash-2" size={14} color={t.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Bottom space to avoid overlap with bottom cradle tabbar */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Modals & Drawers */}
      <AddExpenseModal
        visible={expenseModalVisible}
        onClose={() => setExpenseModalVisible(false)}
        onSuccess={scheduleDashboardReload}
        initialAmount={calcPrefillAmount}
      />

      <AddIncomeModal
        visible={incomeModalVisible}
        onClose={() => setIncomeModalVisible(false)}
        onSuccess={scheduleDashboardReload}
      />

      <AddSplitModal
        visible={splitModalVisible}
        onClose={() => setSplitModalVisible(false)}
        onSuccess={scheduleDashboardReload}
      />

      <AddTiffinModal
        visible={tiffinModalVisible}
        onClose={() => setTiffinModalVisible(false)}
        onSuccess={scheduleDashboardReload}
      />

      <CategoryModal
        visible={categoryModalVisible}
        onClose={() => {
          setCategoryModalVisible(false);
          setSelectedCategoryForEdit(null);
        }}
        onSuccess={scheduleDashboardReload}
        initialCategory={selectedCategoryForEdit}
      />

      <DigitalCalculatorModal
        visible={calcModalVisible}
        onClose={() => setCalcModalVisible(false)}
        onUseResult={(result) => {
          setCalcPrefillAmount(result);
          setExpenseModalVisible(true);
        }}
      />

      <NotificationDrawer
        visible={notifDrawerVisible}
        onClose={() => setNotifDrawerVisible(false)}
        onUpdated={scheduleDashboardReload}
      />
    </View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// TRANTOR STYLES (Identical Geometry & Tokens)
// ═════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // 1. Header Styles
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  greetingSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  waveEmoji: {
    fontSize: 13,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // 2. Current Value Section
  currentValueSection: {
    marginBottom: 16,
    position: 'relative',
  },
  currentValueTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentValueLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  monthFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  monthFilterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  monthDropdownMenu: {
    position: 'absolute',
    top: 32,
    right: 0,
    zIndex: 999,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    minWidth: 140,
  },
  amountTrendRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  amountBig: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // 3. Connected Action Capsule
  actionCapsuleWrapper: {
    marginBottom: 16,
  },
  actionCapsuleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 32,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    position: 'relative',
  },
  capsuleHalfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  roundActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  capsuleCenterBridge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -4,
    zIndex: 2,
  },

  // KPI Row
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  kpiPillCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
  },
  kpiPillSub: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiPillAmount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  kpiPillDesc: {
    fontSize: 8,
    marginTop: 2,
  },

  // 4. Pastel Mint Bento Card
  mintBentoCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  mintCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 6,
  },
  mintCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mintCategoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeframeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeframePill: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 12,
  },
  timeframeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  moreLavenderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
  },
  moreLavenderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryDropdownMenu: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 99,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownMenuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownMenuText: {
    fontSize: 12,
  },

  chartInteractivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  chartInteractivePillText: {
    fontSize: 11,
    color: '#0F172A',
  },

  // Chart
  chartContainer: {
    height: 170,
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  gridLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 22,
    justifyContent: 'space-between',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '600',
    width: 26,
  },
  dashedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginLeft: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    paddingLeft: 28,
  },
  barColumn: {
    alignItems: 'center',
    width: 32,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barGrowthBadge: {
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  barGrowthText: {
    fontSize: 8,
    fontWeight: '800',
  },
  barTrack: {
    width: 24,
    height: 105,
    borderRadius: 12,
    position: 'relative',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  shadowBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 12,
  },
  solidBar: {
    width: '100%',
    borderRadius: 12,
  },
  barDayLabel: {
    fontSize: 10,
    marginTop: 6,
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDotSolid: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotHollow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '600',
  },

  // 5. Standalone Category Folder Cards Section
  categorySectionWrapper: {
    marginBottom: 20,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categorySectionSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  addCategoryHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addCategoryHeaderPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  folderCardsStack: {
    gap: 16,
    paddingTop: 6,
  },
  folderCardOuter: {
    position: 'relative',
    paddingTop: 16,
    marginBottom: 4,
  },
  documentSheetPeek: {
    position: 'absolute',
    top: 3,
    right: 22,
    width: 88,
    height: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    zIndex: 1,
    paddingHorizontal: 8,
    paddingTop: 3,
  },
  documentFauxLine1: {
    width: 42,
    height: 2,
    borderRadius: 1,
    marginBottom: 2,
  },
  documentFauxLine2: {
    width: 26,
    height: 2,
    borderRadius: 1,
  },
  individualFolderTab: {
    position: 'absolute',
    top: 0,
    left: 14,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  individualFolderTabText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  folderStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginLeft: 2,
  },
  individualFolderBody: {
    padding: 16,
    paddingTop: 14,
    borderRadius: 22,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    gap: 12,
    position: 'relative',
    zIndex: 2,
  },
  folderCreaseLine: {
    height: 1,
    width: '100%',
    marginBottom: 2,
  },
  catCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cat3DIconWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  catMetaCol: {
    flex: 1,
  },
  catTitleText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  catStatusText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  catTopRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catEditBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catUtilizationPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catUtilizationText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  catAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  catAmountFlex: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  catAmountSpent: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  catBudgetMuted: {
    fontSize: 12,
    fontWeight: '500',
  },
  catTxnSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  catProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  folderPocketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
  },
  folderPocketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  folderPocketCountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  folderOpenPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  folderInlineEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  folderInlineEditText: {
    fontSize: 11,
    fontWeight: '700',
  },
  folderActionDivider: {
    width: 1,
    height: 12,
    marginHorizontal: 3,
  },
  folderOpenPromptText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCategoriesBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyCategoriesText: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Subscriptions & Recent sections
  recurringSectionWrapper: {
    marginBottom: 18,
  },
  recentSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  seeAllTxnsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  transactionsCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  txnIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnCenterCol: {
    flex: 1,
  },
  txnTitleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  txnCategoryText: {
    fontSize: 11,
    marginTop: 2,
  },
  txnAmountText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  deleteTxnBtn: {
    padding: 6,
    marginLeft: 8,
  },
  emptyStatePad: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyStateDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
});
