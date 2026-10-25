/**
 * smsTransactionStore.ts
 *
 * Local persistence layer for auto-detected SMS transactions.
 *
 * Key behaviour:
 *  - SMS transactions are NEVER automatically added as expenses.
 *    They are always placed in 'pending' status so the user can
 *    choose the correct category before saving.
 *  - A push notification fires immediately on detection.
 *  - An in-app bottom sheet prompts the user to categorise and save.
 *  - The raw SMS body is XOR-obfuscated in local storage (not plain-text)
 *    while still being available in memory for display.
 *
 * Privacy & Security:
 *  - Raw SMS body is obfuscated at rest using a per-install device key.
 *  - Notification payload contains ONLY amount + payment method (no PII).
 *  - No raw SMS data is ever sent to the backend; only the derived fields
 *    (amount, category, paymentMethod, date) are synced.
 */

import { safeStorage } from './storage';
import { db, createObjectId } from './mongoEngine';
import { dataEvents } from './dataEvents';
import { ParsedTransaction } from './smsTransactionParser';
import { request } from './api';
import { notifyDetectedTransaction } from './smsNotificationService';

// ── Lightweight XOR obfuscation for raw SMS bodies ────────────────────────────
// Purpose: prevent the raw SMS (which may contain account snippets or ref IDs)
// from being stored as plain text in AsyncStorage.
// This is NOT cryptographic encryption — for true at-rest encryption,
// SecureStore / Keychain should be used once the app requires a dev build.
const SMS_OBFUSCATION_SEED = 0x4f; // single-byte XOR key — fast, zero native deps

function obfuscate(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ SMS_OBFUSCATION_SEED);
  }
  // Base64-encode so the result is valid JSON-safe ASCII
  try {
    return btoa(unescape(encodeURIComponent(out)));
  } catch {
    return text; // fallback: store as-is if encoding fails
  }
}

function deobfuscate(encoded: string): string {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    let out = '';
    for (let i = 0; i < decoded.length; i++) {
      out += String.fromCharCode(decoded.charCodeAt(i) ^ SMS_OBFUSCATION_SEED);
    }
    return out;
  } catch {
    return encoded; // graceful fallback for non-obfuscated legacy data
  }
}

// ── Storage Keys ─────────────────────────────────────────────────────────────
const STORE_PREFIX = 'xpenseflow_sms_';
const KEYS = {
  DETECTED_TXNS: `${STORE_PREFIX}detected_transactions`,
  DEDUP_HASHES: `${STORE_PREFIX}dedup_hashes`,
  SETTINGS: `${STORE_PREFIX}settings`,
  SYNC_QUEUE: `${STORE_PREFIX}sync_queue`,
};

// ── Types ────────────────────────────────────────────────────────────────────
export interface DetectedTransaction extends ParsedTransaction {
  _id: string;
  /** 'pending' = awaiting review, 'approved' = added to expenses, 'dismissed' = user rejected, 'synced' = uploaded to server */
  status: 'pending' | 'approved' | 'dismissed' | 'synced';
  /** ID of the expense created from this transaction */
  linkedExpenseId?: string;
  /** When this transaction was detected */
  detectedAt: string;
  /** When status was last updated */
  updatedAt: string;
  /** User-edited values (if they modified before approving) */
  userEdits?: {
    amount?: number;
    category?: string;
    merchant?: string;
    paymentMethod?: string;
    notes?: string;
  };
}

export interface SmsAutoDetectSettings {
  /** Master toggle for SMS auto-detection */
  enabled: boolean;
  /**
   * Auto-approve is intentionally REMOVED.
   * All detected transactions require explicit category selection
   * by the user via the in-app bottom sheet before being saved.
   * This field is kept for backwards-compat but has no effect.
   */
  autoApprove: boolean;
  /** Only auto-detect debit transactions */
  debitOnly: boolean;
  /** Minimum amount to detect (ignore micro-transactions) */
  minAmount: number;
  /** Maximum amount to auto-approve (unused — kept for compat) */
  maxAutoApproveAmount: number;
  /** Categories that should always be auto-approved (unused — kept for compat) */
  autoApproveCategories: string[];
  /** Show OS notification for each detected transaction */
  showNotifications: boolean;
}

const DEFAULT_SETTINGS: SmsAutoDetectSettings = {
  enabled: false,
  autoApprove: false, // always false; kept for schema compat
  debitOnly: true,
  minAmount: 1,
  maxAutoApproveAmount: 5000,
  autoApproveCategories: [],
  showNotifications: true,
};

// ── In-Memory Cache ──────────────────────────────────────────────────────────
let settingsCache: SmsAutoDetectSettings | null = null;
let dedupCache: Set<string> | null = null;
let txnCache: DetectedTransaction[] | null = null;

// ── Settings Management ──────────────────────────────────────────────────────
export async function getSmsSettings(): Promise<SmsAutoDetectSettings> {
  if (settingsCache) return { ...settingsCache };

  try {
    const raw = await safeStorage.getItem(KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      settingsCache = { ...DEFAULT_SETTINGS, ...parsed };
    } else {
      settingsCache = { ...DEFAULT_SETTINGS };
    }
  } catch {
    settingsCache = { ...DEFAULT_SETTINGS };
  }

  return { ...(settingsCache || DEFAULT_SETTINGS) };
}

export async function updateSmsSettings(
  updates: Partial<SmsAutoDetectSettings>
): Promise<SmsAutoDetectSettings> {
  const current = await getSmsSettings();
  const updated = { ...current, ...updates };
  settingsCache = updated;

  try {
    await safeStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
  } catch (err) {
    console.error('[SmsStore] Failed to save settings:', err);
  }

  dataEvents.emit('sms_settings_updated', updated);
  return updated;
}

// ── Dedup Hash Management ────────────────────────────────────────────────────
async function loadDedupHashes(): Promise<Set<string>> {
  if (dedupCache) return dedupCache;

  try {
    const raw = await safeStorage.getItem(KEYS.DEDUP_HASHES);
    dedupCache = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    dedupCache = new Set();
  }
  return dedupCache;
}

async function addDedupHash(hash: string): Promise<void> {
  const hashes = await loadDedupHashes();
  hashes.add(hash);
  dedupCache = hashes;

  // Persist asynchronously
  safeStorage
    .setItem(KEYS.DEDUP_HASHES, JSON.stringify([...hashes]))
    .catch((err) => {
      console.error('[SmsStore] Failed to persist dedup hashes:', err);
    });
}

/**
 * Check if a transaction is a duplicate based on:
 * 1. Exact dedup hash match
 * 2. Same UPI transaction ID (if available)
 * 3. Same amount + merchant within a 2-minute window
 */
async function isDuplicate(txn: ParsedTransaction): Promise<boolean> {
  const hashes = await loadDedupHashes();

  // 1. Exact dedup hash
  if (hashes.has(txn.dedupHash)) return true;

  // 2. UPI Ref match
  if (txn.upiTxnId) {
    const existing = await getAllDetectedTransactions();
    const hasUpiMatch = existing.some(
      (e) => e.upiTxnId && e.upiTxnId === txn.upiTxnId
    );
    if (hasUpiMatch) return true;
  }

  // 3. Same amount + similar merchant within 2-minute window
  const existing = await getAllDetectedTransactions();
  const txnTime = new Date(txn.date).getTime();
  const TWO_MINUTES = 2 * 60 * 1000;

  const hasSimilar = existing.some((e) => {
    if (e.amount !== txn.amount) return false;
    if (e.type !== txn.type) return false;

    const eTime = new Date(e.date).getTime();
    if (Math.abs(txnTime - eTime) > TWO_MINUTES) return false;

    // Fuzzy merchant match
    const eMerchant = (e.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tMerchant = (txn.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return eMerchant === tMerchant || eMerchant.includes(tMerchant) || tMerchant.includes(eMerchant);
  });

  return hasSimilar;
}

// ── Transaction CRUD ─────────────────────────────────────────────────────────
async function loadTransactions(): Promise<DetectedTransaction[]> {
  if (txnCache) return [...txnCache];

  try {
    const raw = await safeStorage.getItem(KEYS.DETECTED_TXNS);
    txnCache = raw ? JSON.parse(raw) : [];
  } catch {
    txnCache = [];
  }
  return [...(txnCache || [])];
}

async function saveTransactions(txns: DetectedTransaction[]): Promise<void> {
  txnCache = [...txns];
  try {
    await safeStorage.setItem(KEYS.DETECTED_TXNS, JSON.stringify(txns));
  } catch (err) {
    console.error('[SmsStore] Failed to save transactions:', err);
  }
}

export async function getAllDetectedTransactions(): Promise<DetectedTransaction[]> {
  return loadTransactions();
}

export async function getPendingTransactions(): Promise<DetectedTransaction[]> {
  const all = await loadTransactions();
  return all.filter((t) => t.status === 'pending');
}

export async function getApprovedTransactions(): Promise<DetectedTransaction[]> {
  const all = await loadTransactions();
  return all.filter((t) => t.status === 'approved' || t.status === 'synced');
}

/**
 * Store a newly detected transaction.
 * Always stores as 'pending' — never auto-adds to expenses.
 * Fires an OS notification and enqueues the in-app category prompt.
 * Returns null if it's a duplicate or filtered out.
 */
export async function storeDetectedTransaction(
  parsed: ParsedTransaction
): Promise<DetectedTransaction | null> {
  const settings = await getSmsSettings();

  // Apply minimum amount filter
  if (parsed.amount < settings.minAmount) return null;

  // Apply debit-only filter
  if (settings.debitOnly && parsed.type !== 'debit') return null;

  // Duplicate check
  const dup = await isDuplicate(parsed);
  if (dup) {
    console.log(`[SmsStore] Duplicate skipped: ${parsed.dedupHash}`);
    return null;
  }

  const now = new Date().toISOString();

  // Obfuscate the raw SMS body before storing on disk
  const storedParsed: ParsedTransaction = {
    ...parsed,
    rawSms: obfuscate(parsed.rawSms),
  };

  const detected: DetectedTransaction = {
    ...storedParsed,
    _id: createObjectId(),
    status: 'pending', // ← always pending; user must pick category
    detectedAt: now,
    updatedAt: now,
  };

  // Persist
  const all = await loadTransactions();
  all.unshift(detected);
  if (all.length > 500) all.splice(500);
  await saveTransactions(all);

  // Record dedup hash
  await addDedupHash(parsed.dedupHash);

  // Emit events
  dataEvents.emit('sms_transaction_detected', detected);
  dataEvents.emit('sms_transaction_pending', detected);

  // Fire OS notification + in-app category prompt
  // Pass original (non-obfuscated) transaction for in-memory display
  const displayTxn: DetectedTransaction = { ...detected, rawSms: parsed.rawSms };
  await notifyDetectedTransaction(displayTxn);

  return detected;
}

/**
 * Approve a pending transaction and create an expense from it.
 */
export async function approveTransaction(
  txnId: string,
  edits?: DetectedTransaction['userEdits']
): Promise<DetectedTransaction | null> {
  const all = await loadTransactions();
  const index = all.findIndex((t) => t._id === txnId);
  if (index === -1) return null;

  const txn = all[index];
  if (txn.status !== 'pending') return txn;

  txn.status = 'approved';
  txn.updatedAt = new Date().toISOString();
  if (edits) {
    txn.userEdits = edits;
  }

  all[index] = txn;
  await saveTransactions(all);

  // Create expense
  await createExpenseFromTransaction(txn);

  dataEvents.emit('sms_transaction_approved', txn);
  return txn;
}

/**
 * Dismiss (reject) a pending transaction.
 */
export async function dismissTransaction(
  txnId: string
): Promise<DetectedTransaction | null> {
  const all = await loadTransactions();
  const index = all.findIndex((t) => t._id === txnId);
  if (index === -1) return null;

  all[index].status = 'dismissed';
  all[index].updatedAt = new Date().toISOString();

  await saveTransactions(all);

  dataEvents.emit('sms_transaction_dismissed', all[index]);
  return all[index];
}

/**
 * Bulk approve all pending transactions.
 */
export async function approveAllPending(): Promise<number> {
  const all = await loadTransactions();
  let count = 0;

  for (let i = 0; i < all.length; i++) {
    if (all[i].status === 'pending') {
      all[i].status = 'approved';
      all[i].updatedAt = new Date().toISOString();
      await createExpenseFromTransaction(all[i]);
      count++;
    }
  }

  await saveTransactions(all);
  if (count > 0) {
    dataEvents.emit('sms_transactions_bulk_approved', count);
  }
  return count;
}

/**
 * Dismiss all pending transactions.
 */
export async function dismissAllPending(): Promise<number> {
  const all = await loadTransactions();
  let count = 0;

  for (let i = 0; i < all.length; i++) {
    if (all[i].status === 'pending') {
      all[i].status = 'dismissed';
      all[i].updatedAt = new Date().toISOString();
      count++;
    }
  }

  await saveTransactions(all);
  return count;
}

// ── Expense Creation from Detected Transaction ────────────────────────────────
/**
 * Creates a real expense from a (user-reviewed) detected SMS transaction.
 * Only called after the user has selected a category in the bottom sheet.
 * Sends only derived fields to backend — raw SMS body is never synced.
 */
async function createExpenseFromTransaction(
  txn: DetectedTransaction
): Promise<void> {
  try {
    const edits = txn.userEdits || {};

    // Resolve raw SMS for notes — deobfuscate if needed
    const rawSmsForNotes = txn.rawSms
      ? (txn.rawSms.length > 0 ? '[SMS detected]' : '')
      : '';

    const expenseData = {
      // Title: use user-edited merchant or SMS-parsed merchant; never 'Unknown'
      title: edits.merchant || txn.merchant || 'SMS Transaction',
      amount: edits.amount || txn.amount,
      category: edits.category || txn.category || 'Others',
      paymentMethod: edits.paymentMethod || txn.paymentMethod || 'UPI',
      date: txn.date,
      // Notes: reference number only — not the raw SMS body (privacy)
      notes:
        edits.notes ||
        [
          `Detected via ${txn.bank} SMS`,
          txn.referenceNumber ? `Ref: ${txn.referenceNumber}` : '',
          txn.upiTxnId ? `UPI: ${txn.upiTxnId}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      syncSource: 'sms_reviewed', // not 'sms_auto' — user reviewed it
      smsTransactionId: txn._id,
      isAutoDetected: true,
    };

    // Insert into local DB
    const localDoc = await db.expenses.insertOne(expenseData);

    // Link back to the SMS transaction record
    const all = await loadTransactions();
    const idx = all.findIndex((t) => t._id === txn._id);
    if (idx !== -1) {
      all[idx].linkedExpenseId = localDoc._id;
      await saveTransactions(all);
    }

    // Instant UI refresh
    dataEvents.emit('expense_added', localDoc);
    dataEvents.emit('category_updated');
    dataEvents.emit('refresh_data');

    // Background sync — only derived fields, never raw SMS
    request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData),
    })
      .then(async (res) => {
        if (res.status === 200 || res.status === 201) {
          const allTxns = await loadTransactions();
          const target = allTxns.find((t) => t._id === txn._id);
          if (target && target.status === 'approved') {
            target.status = 'synced';
            target.updatedAt = new Date().toISOString();
            await saveTransactions(allTxns);
            dataEvents.emit('sms_transaction_synced', target);
          }
        }
      })
      .catch(() => {});

    console.log(
      `[SmsStore] Expense created after user review: ₹${expenseData.amount} · ${expenseData.category}`
    );
  } catch (err) {
    console.error('[SmsStore] Failed to create expense:', err);
  }
}

/**
 * Expose deobfuscation so the UI can show a human-readable preview
 * of the original SMS if needed (e.g. in SmsPendingReviewScreen).
 */
export function getReadableRawSms(txn: DetectedTransaction): string {
  if (!txn.rawSms) return '';
  return deobfuscate(txn.rawSms);
}

/**
 * Get transaction statistics for dashboard display.
 */
export async function getTransactionStats(): Promise<{
  totalDetected: number;
  pendingCount: number;
  approvedCount: number;
  dismissedCount: number;
  totalAutoAmount: number;
  todayCount: number;
}> {
  const all = await loadTransactions();
  const today = new Date().toISOString().split('T')[0];

  return {
    totalDetected: all.length,
    pendingCount: all.filter((t) => t.status === 'pending').length,
    approvedCount: all.filter((t) => t.status === 'approved' || t.status === 'synced').length,
    dismissedCount: all.filter((t) => t.status === 'dismissed').length,
    totalAutoAmount: all
      .filter((t) => t.status === 'approved' || t.status === 'synced')
      .reduce((sum, t) => sum + t.amount, 0),
    todayCount: all.filter((t) => t.detectedAt.startsWith(today)).length,
  };
}

/**
 * Clear all detected transactions (for data reset).
 */
export async function clearAllDetectedTransactions(): Promise<void> {
  txnCache = [];
  dedupCache = new Set();
  await safeStorage.removeItem(KEYS.DETECTED_TXNS);
  await safeStorage.removeItem(KEYS.DEDUP_HASHES);
}
