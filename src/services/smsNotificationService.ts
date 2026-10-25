/**
 * smsNotificationService.ts
 *
 * Handles two notification channels for detected SMS transactions:
 *
 * 1. OS-level push notification  — fires immediately when an SMS transaction
 *    is detected, even if the app is in background.  Shows the amount, bank,
 *    and a "Review" action.  Uses the Expo Notifications API.
 *
 * 2. In-app prompt queue  — while the app is in foreground, keeps a queue
 *    of pending transactions that the SmsExpenseBottomSheet renders one by one,
 *    letting the user pick a category before the expense is saved.
 *
 * Privacy note:
 *   The raw SMS body is NOT included in the OS notification payload.
 *   Only amount + bank name are surfaced publicly; all other fields stay
 *   inside local encrypted storage.
 */

import { Platform } from 'react-native';
import { DetectedTransaction } from './smsTransactionStore';
import { dataEvents } from './dataEvents';

// ── Notifications (Expo) ──────────────────────────────────────────────────────
// Dynamic import so it degrades gracefully without the package
let Notifications: any = null;
let notificationsAvailable = false;

async function ensureNotifications(): Promise<boolean> {
  if (notificationsAvailable) return true;
  if (Platform.OS !== 'android') return false;
  try {
    Notifications = require('expo-notifications');
    notificationsAvailable = true;
    return true;
  } catch {
    return false;
  }
}

// ── In-app prompt queue ───────────────────────────────────────────────────────
/** Transactions waiting to be reviewed inside the app */
const promptQueue: DetectedTransaction[] = [];
let isShowing = false;

function enqueuePrompt(txn: DetectedTransaction) {
  // Avoid duplicates in queue
  if (promptQueue.some((q) => q._id === txn._id)) return;
  promptQueue.push(txn);
  if (!isShowing) showNextPrompt();
}

function showNextPrompt() {
  if (promptQueue.length === 0) {
    isShowing = false;
    return;
  }
  isShowing = true;
  const next = promptQueue[0];
  dataEvents.emit('sms_prompt_ready', next);
}

/**
 * Call this when the user finishes (saves or dismisses) the bottom sheet.
 * Moves on to the next queued transaction.
 */
export function acknowledgePrompt(): void {
  promptQueue.shift();
  isShowing = false;
  setTimeout(showNextPrompt, 650);
}

// ── Channel & permissions ─────────────────────────────────────────────────────
export async function setupNotificationChannel(): Promise<void> {
  if (!(await ensureNotifications())) return;

  try {
    await Notifications.setNotificationChannelAsync('sms_transactions', {
      name: 'SMS Transactions',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D9488',
      description:
        'Alerts for auto-detected bank transactions. Tap to categorise.',
    });

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch (err) {
    console.warn('[SmsNotification] Channel setup failed:', err);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!(await ensureNotifications())) return false;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ── Fire notification + enqueue prompt ───────────────────────────────────────
/**
 * Called by smsAutoDetectService when a new transaction is detected.
 * Fires an OS notification (amount + bank only — privacy safe) and
 * enqueues the in-app category-selection prompt.
 */
export async function notifyDetectedTransaction(
  txn: DetectedTransaction
): Promise<void> {
  // In-app prompt queue (always, regardless of OS notification permission)
  enqueuePrompt(txn);

  if (!(await ensureNotifications())) return;

  const amountStr = `₹${txn.amount.toLocaleString('en-IN')}`;
  const via = txn.paymentMethod || txn.bank || 'Bank';

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💳 Transaction Detected — ${amountStr}`,
        body: `Via ${via} · Tap to select category & save`,
        data: {
          type: 'sms_transaction',
          txnId: txn._id,
          amount: txn.amount,
        },
        color: '#0D9488',
        priority: 'high',
        autoDismiss: true,
        channelId: 'sms_transactions',
      },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn('[SmsNotification] Schedule failed:', err);
  }
}
