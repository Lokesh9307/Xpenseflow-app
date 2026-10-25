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
   * Request RECEIVE_SMS permission from the user.
   * Returns true if granted.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('[SmsListener] Permission request failed:', err);
      return false;
    }
  }

  /**
   * Check if SMS permission is currently granted.
   */
  async hasPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
      );
    } catch {
      return false;
    }
  }

  /**
   * Start listening for incoming SMS messages.
   * Must call requestPermissions() first.
   */
  async startListening(): Promise<boolean> {
    if (Platform.OS !== 'android' || !SmsListenerModule || !eventEmitter) {
      console.warn('[SmsListener] SMS listening is only available on Android');
      return false;
    }

    try {
      const hasPerms = await this.hasPermissions();
      if (!hasPerms) {
        console.warn('[SmsListener] SMS permissions not granted');
        return false;
      }

      // Tell native module to start forwarding events
      await SmsListenerModule.startListening();

      // Subscribe to native events
      if (this.subscription) {
        this.subscription.remove();
      }

      this.subscription = eventEmitter.addListener(
        'onSmsReceived',
        (event: any) => {
          this.notifyListeners(event as SmsMessage);
        }
      );

      this._isListening = true;
      return true;
    } catch (err) {
      console.error('[SmsListener] Failed to start listening:', err);
      return false;
    }
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
