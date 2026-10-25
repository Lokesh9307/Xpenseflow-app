/**
 * smsAutoDetectService.ts
 * 
 * Orchestrator service that connects:
 * 1. SmsListener (native bridge) → receives SMS events
 * 2. SmsTransactionParser → extracts transaction data
 * 3. SmsTransactionStore → persists and manages detected transactions
 * 
 * This is the single entry point for enabling/disabling SMS auto-detection.
 * Call initialize() once at app startup, then use start()/stop() to control.
 */

import { Platform } from 'react-native';
import { smsListener, SmsMessage } from './smsListener';
import { parseSmsTransaction } from './smsTransactionParser';
import {
  storeDetectedTransaction,
  getSmsSettings,
  updateSmsSettings,
  SmsAutoDetectSettings,
} from './smsTransactionStore';
import { dataEvents } from './dataEvents';
import {
  setupNotificationChannel,
  requestNotificationPermission,
} from './smsNotificationService';

export interface SmsStartResult {
  success: boolean;
  reason?: 'permission_denied' | 'module_unavailable' | 'unsupported_platform' | 'error';
  message?: string;
}

class SmsAutoDetectService {
  private _isInitialized = false;
  private _isRunning = false;
  private unsubscribe: (() => void) | null = null;

  /**
   * Initialize the service. Should be called once at app startup.
   * Does NOT start listening — call start() separately.
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) return;
    if (Platform.OS !== 'android') {
      console.log('[SmsAutoDetect] Not on Android, skipping initialization');
      this._isInitialized = true;
      return;
    }

    // Check if auto-detect was enabled in settings
    const settings = await getSmsSettings();
    if (settings.enabled) {
      // Auto-start if previously enabled
      await this.start();
    }

    this._isInitialized = true;
    console.log('[SmsAutoDetect] Service initialized');
  }

  /**
   * Start listening for SMS messages and auto-detecting transactions.
   * Also sets up the Android notification channel and requests
   * notification permission so the user gets instant alerts.
   */
  async start(): Promise<SmsStartResult> {
    if (Platform.OS !== 'android') {
      return {
        success: false,
        reason: 'unsupported_platform',
        message: 'SMS auto-detection is only available on Android.',
      };
    }
    if (this._isRunning) {
      return { success: true };
    }

    // Verify native module availability before requesting permission
    if (!smsListener.isNativeAvailable()) {
      console.warn('[SmsAutoDetect] Native SmsListenerModule is not available in current APK build');
      return {
        success: false,
        reason: 'module_unavailable',
        message: 'The native SMS listener module is missing. Please install the updated APK build.',
      };
    }

    // Request SMS permissions
    const hasPerms = await smsListener.requestPermissions();
    if (!hasPerms) {
      console.warn('[SmsAutoDetect] SMS permissions denied');
      dataEvents.emit('sms_permission_denied');
      return {
        success: false,
        reason: 'permission_denied',
        message: 'SMS permission was not granted. Please grant SMS permissions in Android Settings.',
      };
    }

    // Start native listener
    const startStatus = await smsListener.startListeningDetailed();
    if (!startStatus.success) {
      console.error('[SmsAutoDetect] Failed to start SMS listener:', startStatus);
      return {
        success: false,
        reason: startStatus.error === 'permission_denied' ? 'permission_denied' : 'error',
        message: startStatus.details || 'Failed to start SMS listener.',
      };
    }

    // Subscribe to SMS events
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.unsubscribe = smsListener.onSmsReceived(this.handleSms.bind(this));

    this._isRunning = true;

    // Set up notification channel + request permission in parallel
    // (non-blocking — we don't fail if the user denies notification permission)
    setupNotificationChannel().catch(() => {});
    requestNotificationPermission().catch(() => {});

    // Update settings
    await updateSmsSettings({ enabled: true });

    dataEvents.emit('sms_autodetect_started');
    console.log('[SmsAutoDetect] Service started — listening for bank SMS');

    return { success: true };
  }


  /**
   * Check live permission status from Android OS without requesting or altering state.
   */
  async checkPermissionStatus(): Promise<boolean> {
    return await smsListener.hasPermissions();
  }

  /**
   * Stop listening for SMS messages.
   */
  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    await smsListener.stopListening();
    this._isRunning = false;

    // Update settings
    await updateSmsSettings({ enabled: false });

    dataEvents.emit('sms_autodetect_stopped');
    console.log('[SmsAutoDetect] Service stopped');
  }

  /**
   * Handle an incoming SMS message.
   */
  private async handleSms(message: SmsMessage): Promise<void> {
    try {
      console.log(
        `[SmsAutoDetect] SMS received from: ${message.sender} (${message.body.length} chars)`
      );

      // Parse the SMS
      const parsed = parseSmsTransaction(
        message.sender,
        message.body,
        message.timestamp
      );

      if (!parsed) {
        // Not a transaction SMS — ignore silently
        return;
      }

      console.log(
        `[SmsAutoDetect] Transaction detected: ₹${parsed.amount} ${parsed.type} at ${parsed.merchant}`
      );

      // Store and process
      const stored = await storeDetectedTransaction(parsed);

      if (!stored) {
        console.log('[SmsAutoDetect] Transaction was filtered or duplicate');
        return;
      }

      console.log(
        `[SmsAutoDetect] Transaction stored with status: ${stored.status} (ID: ${stored._id})`
      );
    } catch (err) {
      console.error('[SmsAutoDetect] Error processing SMS:', err);
    }
  }

  /**
   * Check if the service is currently running.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Check if the service has been initialized.
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get current settings.
   */
  async getSettings(): Promise<SmsAutoDetectSettings> {
    return getSmsSettings();
  }

  /**
   * Update settings and apply changes.
   */
  async updateSettings(
    updates: Partial<SmsAutoDetectSettings>
  ): Promise<SmsAutoDetectSettings> {
    const newSettings = await updateSmsSettings(updates);

    // If enabled state changed, start/stop accordingly
    if (updates.enabled !== undefined) {
      if (updates.enabled && !this._isRunning) {
        await this.start();
      } else if (!updates.enabled && this._isRunning) {
        await this.stop();
      }
    }

    return newSettings;
  }

  /**
   * Manually process an SMS body (for testing or importing from inbox).
   */
  async processManualSms(sender: string, body: string): Promise<boolean> {
    const parsed = parseSmsTransaction(sender, body, Date.now());
    if (!parsed) return false;

    const stored = await storeDetectedTransaction(parsed);
    return !!stored;
  }
}

// Export singleton
export const smsAutoDetect = new SmsAutoDetectService();
