/**
 * Mobile Navigation Registry
 * 
 * Trusted client-side navigation executor for Copilot action cards.
 * Enforces that model-generated routes never bypass application validation.
 */

export interface ScreenMetadata {
  screenId: string;
  title: string;
  icon: string;
  description: string;
}

export const VALID_MOBILE_SCREENS: Record<string, ScreenMetadata> = {
  Expenses: {
    screenId: 'Expenses',
    title: 'All Expenses',
    icon: 'receipt-outline',
    description: 'Transaction history, search and filter expenses',
  },
  Analytics: {
    screenId: 'Analytics',
    title: 'Analytics & Insights',
    icon: 'bar-chart-outline',
    description: 'Visual expense breakdowns and monthly charts',
  },
  MainTabs: {
    screenId: 'MainTabs',
    title: 'Dashboard',
    icon: 'home-outline',
    description: 'Overview dashboard and cash flow',
  },
  TiffinTransactions: {
    screenId: 'TiffinTransactions',
    title: 'Tiffin Tracker',
    icon: 'restaurant-outline',
    description: 'Tiffin meal history and monthly billing',
  },
  SplitTransactions: {
    screenId: 'SplitTransactions',
    title: 'Split Expenses',
    icon: 'people-outline',
    description: 'Split bill groups and shared expenses',
  },
  Recurring: {
    screenId: 'Recurring',
    title: 'Recurring Subscriptions',
    icon: 'repeat-outline',
    description: 'Active subscriptions and recurring bills',
  },
  Profile: {
    screenId: 'Profile',
    title: 'Account & Settings',
    icon: 'person-outline',
    description: 'Account profile, settings, and sign out',
  },
  ExpenseTrackerSettings: {
    screenId: 'ExpenseTrackerSettings',
    title: 'Tracker Settings',
    icon: 'settings-outline',
    description: 'Thresholds, limits, and display settings',
  },
  TiffinSettings: {
    screenId: 'TiffinSettings',
    title: 'Tiffin Settings',
    icon: 'options-outline',
    description: 'Tiffin rates and group configurations',
  },
  SmsPendingReview: {
    screenId: 'SmsPendingReview',
    title: 'Pending SMS Expenses',
    icon: 'mail-unread-outline',
    description: 'Review auto-detected SMS payments',
  },
};

/**
 * Safely navigates to a screen if and only if it is registered in VALID_MOBILE_SCREENS.
 * Never executes arbitrary strings.
 */
export function navigateSafely(navigation: any, screenId: string, params?: any): boolean {
  if (!navigation || !screenId) return false;

  const cleanId = String(screenId).trim();
  const screenMeta = VALID_MOBILE_SCREENS[cleanId];

  if (!screenMeta) {
    console.warn(`[NavigationRegistry] Attempted navigation to unregistered screen: "${screenId}" rejected.`);
    return false;
  }

  try {
    navigation.navigate(screenMeta.screenId, params);
    return true;
  } catch (err) {
    console.error(`[NavigationRegistry] Failed to navigate to "${screenMeta.screenId}":`, err);
    return false;
  }
}

/**
 * Returns metadata for a screen ID.
 */
export function getScreenMetadata(screenId: string): ScreenMetadata | null {
  if (!screenId) return null;
  return VALID_MOBILE_SCREENS[screenId] || null;
}
