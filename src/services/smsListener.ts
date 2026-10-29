/**
 * SmsListener — TypeScript bridge to the native SmsListenerModule.
 * 
 * Provides a clean API for:
 * 1. Starting/stopping SMS listening
 * 2. Subscribing to incoming SMS events
 * 3. Permission status checks
 * 
 * Falls back gracefully on iOS or web (no-ops).
 */
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

export interface SmsMessage {
  sender: string;
  body: string;
  timestamp: number;
}

type SmsCallback = (message: SmsMessage) => void;

export interface SmsPermissionResult {
  hasReceiveSms: boolean;
  isGranted: boolean;
}

export type SmsStartStatus =
  | { success: true }
  | {
      success: false;
      error: 'unsupported_platform' | 'module_unavailable' | 'permission_denied' | 'native_error';
      details?: string;
    };

const { SmsListenerModule } = NativeModules;

// Create event emitter only on Android where the native module exists
const eventEmitter =
  Platform.OS === 'android' && SmsListenerModule
    ? new NativeEventEmitter(SmsListenerModule)
    : null;

class SmsListenerService {
  private listeners: SmsCallback[] = [];
  private subscription: any = null;
  private _isListening = false;

  /**
   * Check if the native SmsListenerModule is present and linked.
   */
  isNativeAvailable(): boolean {
    return Platform.OS === 'android' && !!SmsListenerModule && !!eventEmitter;
  }

  /**
   * Query Android OS for the permission required by the SMS broadcast receiver.
   * Does not rely on cached or stored booleans.
   */
  async getDetailedPermissions(): Promise<SmsPermissionResult> {
    if (Platform.OS !== 'android') {
      return { hasReceiveSms: false, isGranted: false };
    }

    try {
      const hasReceiveSms = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
      ).catch(() => false);
      const isGranted = hasReceiveSms;
      console.log(
        `[SmsListener] Permission check: RECEIVE_SMS=${hasReceiveSms}, isGranted=${isGranted}`
      );

      return { hasReceiveSms, isGranted };
    } catch (err) {
      console.error('[SmsListener] Error querying SMS permissions:', err);
      return { hasReceiveSms: false, isGranted: false };
    }
  }

  /**
   * Request RECEIVE_SMS permission from the user.
   * Returns true if granted.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      // First check if already granted to prevent duplicate system prompts
      const current = await this.getDetailedPermissions();
      if (current.isGranted) {
        console.log('[SmsListener] SMS permission already granted');
        return true;
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        {
          title: 'SMS Permission',
          message:
            'XpenseFlow requires SMS permission to detect incoming bank transaction messages and automatically record expenses.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      console.log(`[SmsListener] Permission request result: ${result} (granted: ${granted})`);
      return granted;
    } catch (err) {
      console.error('[SmsListener] Permission request failed:', err);
      return false;
    }
  }

  /**
   * Check if SMS permission is currently granted.
   */
  async hasPermissions(): Promise<boolean> {
    const status = await this.getDetailedPermissions();
    return status.isGranted;
  }

  /**
   * Start listening with detailed diagnostic status.
   */
  async startListeningDetailed(): Promise<SmsStartStatus> {
    if (Platform.OS !== 'android') {
      console.warn('[SmsListener] SMS listening is only available on Android');
      return { success: false, error: 'unsupported_platform' };
    }

    if (!SmsListenerModule || !eventEmitter) {
      console.warn('[SmsListener] Native module SmsListenerModule is not linked in this build');
      return { success: false, error: 'module_unavailable' };
    }

    try {
      const hasPerms = await this.hasPermissions();
      if (!hasPerms) {
        console.warn('[SmsListener] SMS permissions not granted');
        return { success: false, error: 'permission_denied' };
      }

      // Subcribe BEFORE telling native to start so no event is missed
      // if an SMS arrives in the gap between startListening() and
      // addListener().
      if (this.subscription) {
        this.subscription.remove();
      }

      this.subscription = eventEmitter.addListener(
        'onSmsReceived',
        (event: any) => {
          this.notifyListeners(event as SmsMessage);
        }
      );

      // Tell native module to start forwarding events (also arms the
      // native-side persisted queue & heads-up notifications)
      await SmsListenerModule.startListening();

      this._isListening = true;
      console.log('[SmsListener] Native listener successfully started');
      return { success: true };
    } catch (err: any) {
      console.error('[SmsListener] Failed to start listening:', err);
      return {
        success: false,
        error: 'native_error',
        details: err?.message || 'Native error starting listener',
      };
    }
  }

  /**
   * Start listening for incoming SMS messages.
   * Backward-compatible boolean wrapper around startListeningDetailed.
   */
  async startListening(): Promise<boolean> {
    const result = await this.startListeningDetailed();
    return result.success;
  }

  /**
   * Stop listening for SMS messages.
   */
  async stopListening(): Promise<void> {
    if (!SmsListenerModule) return;

    try {
      await SmsListenerModule.stopListening();
    } catch {
      // Ignore errors during stop
    }

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    this._isListening = false;
  }

  /**
   * Drain the native-side SMS queue.
   *
   * Messages received while the app was killed/in background are persisted
   * natively and returned here (the native queue is cleared on pull).
   * Each one should be parsed, stored as 'pending' and surfaced through the
   * review bottom sheet — never added as an expense automatically.
   */
  async pullQueuedSms(): Promise<SmsMessage[]> {
    if (Platform.OS !== 'android' || !SmsListenerModule) return [];

    try {
      const raw: any = await SmsListenerModule.pullQueuedSms();
      if (Array.isArray(raw)) return raw as SmsMessage[];
      // Newer RN sometimes resolves WritableNativeArray as an object; normalise
      if (Array.isArray(raw?.message)) {
        return raw.message as SmsMessage[];
      }
      return [];
    } catch (err) {
      console.error('[SmsListener] Failed to pull queued SMS:', err);
      return [];
    }
  }

  /**
   * Check if the listener is currently active.
   */
  get isListening(): boolean {
    return this._isListening;
  }

  /**
   * Register a callback for incoming SMS messages.
   * Returns an unsubscribe function.
   */
  onSmsReceived(callback: SmsCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Notify all registered listeners about a new SMS.
   */
  private notifyListeners(message: SmsMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (err) {
        console.error('[SmsListener] Error in listener callback:', err);
      }
    }
  }
}

// Export singleton instance
export const smsListener = new SmsListenerService();
