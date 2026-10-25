import { safeStorage } from './storage';

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  intent?: string;
  actionCard?: {
    type: 'expense_preview' | 'verified_result';
    data: any;
  } | null;
  navigationAction?: {
    screenId: string;
    title: string;
    description?: string;
    tab?: string;
  } | null;
  clarification?: {
    question: string;
    options: string[];
    missingField?: string;
  } | null;
  parsedForm?: any;
}

const CHAT_STORAGE_PREFIX = 'xpenseflow_copilot_chat_';
const MAX_LOCAL_MESSAGES = 150;

const DEFAULT_WELCOME_MESSAGE: CopilotMessage = {
  id: 'welcome',
  sender: 'assistant',
  text: "👋 Hi! I'm ExpenseBot, your production-grade AI financial assistant.\n\nAsk me about budgets, log transactions, or navigate the app in plain English:\n• 'Spent ₹400 on petrol via UPI'\n• 'How much did I spend this month?'\n• 'Log lunch tiffin for today'\n• 'Show reports & analytics'",
  timestamp: 'Just now',
};

/**
 * Production-grade OS-level Chat Store for AI Copilot
 * 
 * Architectural Guarantees:
 * 1. Zero Server DB Persistence: Chat messages are NEVER saved to the remote backend or MongoDB.
 * 2. High-speed In-Memory RAM Working Set: Reads, appends, and updates occur in RAM (< 0.1ms).
 * 3. On-Device Phone Storage Persistence: Debounced asynchronous flush to local phone storage.
 * 4. User Data Isolation: Storage is keyed per user ID so account switches remain private and secure.
 */
class CopilotChatStore {
  private memoryCache: CopilotMessage[] = [];
  private currentUserId: string = 'guest';
  private isHydrated: boolean = false;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  private getStorageKey(userId: string): string {
    const cleanId = (userId || 'guest').trim().toLowerCase();
    return `${CHAT_STORAGE_PREFIX}${cleanId}`;
  }

  /**
   * Initializes or switches user session.
   * Loads from RAM if already hydrated for this user, or hydrates from phone storage.
   */
  async init(userId?: string): Promise<CopilotMessage[]> {
    const targetUserId = (userId || 'guest').trim().toLowerCase();

    // If already in memory for this exact user, return RAM cache instantly
    if (this.isHydrated && this.currentUserId === targetUserId && this.memoryCache.length > 0) {
      return [...this.memoryCache];
    }

    this.currentUserId = targetUserId;
    const storageKey = this.getStorageKey(targetUserId);

    try {
      const raw = await safeStorage.getItem(storageKey);
      if (raw) {
        const parsed: CopilotMessage[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoryCache = parsed;
          this.isHydrated = true;
          return [...this.memoryCache];
        }
      }
    } catch (err) {
      console.warn('[CopilotChatStore] Failed to read phone storage:', err);
    }

    // Default seed in RAM if brand new conversation
    this.memoryCache = [{ ...DEFAULT_WELCOME_MESSAGE, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    this.isHydrated = true;
    return [...this.memoryCache];
  }

  /**
   * Sub-millisecond synchronous read directly from RAM.
   */
  getMessages(): CopilotMessage[] {
    if (!this.isHydrated || this.memoryCache.length === 0) {
      return [{ ...DEFAULT_WELCOME_MESSAGE, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    }
    return [...this.memoryCache];
  }

  /**
   * Appends message to high-speed RAM and schedules async phone storage write.
   */
  appendMessage(msg: CopilotMessage): void {
    this.memoryCache.push(msg);
    if (this.memoryCache.length > MAX_LOCAL_MESSAGES) {
      this.memoryCache = this.memoryCache.slice(-MAX_LOCAL_MESSAGES);
    }
    this.scheduleFlushToDisk();
  }

  /**
   * Updates an existing message in RAM (e.g. actionCard confirmation) and schedules flush.
   */
  updateMessage(msgId: string, updates: Partial<CopilotMessage>): void {
    const index = this.memoryCache.findIndex((m) => m.id === msgId);
    if (index !== -1) {
      this.memoryCache[index] = {
        ...this.memoryCache[index],
        ...updates,
      };
      this.scheduleFlushToDisk();
    }
  }

  /**
   * Wipes phone storage and resets in-memory RAM cache for current user.
   * Does NOT touch backend server or database.
   */
  async clearChat(): Promise<void> {
    const freshWelcome: CopilotMessage = {
      ...DEFAULT_WELCOME_MESSAGE,
      id: `welcome_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.memoryCache = [freshWelcome];
    const storageKey = this.getStorageKey(this.currentUserId);

    try {
      await safeStorage.setItem(storageKey, JSON.stringify([freshWelcome]));
    } catch (err) {
      console.warn('[CopilotChatStore] Failed to clear phone storage:', err);
    }
  }

  /**
   * Clears in-memory RAM cache on user logout or session switch.
   */
  clearMemory(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.memoryCache = [];
    this.isHydrated = false;
    this.currentUserId = 'guest';
  }

  /**
   * Non-blocking, debounced disk write to ensure UI thread never freezes.
   */
  private scheduleFlushToDisk(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    this.flushTimeout = setTimeout(async () => {
      try {
        const storageKey = this.getStorageKey(this.currentUserId);
        const payload = JSON.stringify(this.memoryCache);
        await safeStorage.setItem(storageKey, payload);
      } catch (err) {
        console.warn('[CopilotChatStore] Async phone storage flush failed:', err);
      }
    }, 150);
  }
}

export const copilotChatStore = new CopilotChatStore();
