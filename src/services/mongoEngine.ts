import { safeStorage } from './storage';

// ── Storage Keys for MongoDB Collections in Mobile App ─────────────────────────
const DB_PREFIX = 'xpenseflow_mongo_';
const COLLECTIONS = {
  USERS: `${DB_PREFIX}users`,
  EXPENSES: `${DB_PREFIX}expenses`,
  INCOMES: `${DB_PREFIX}incomes`,
  CATEGORIES: `${DB_PREFIX}categories`,
  BUDGETS: `${DB_PREFIX}budgets`,
  RECURRING: `${DB_PREFIX}recurring`,
  SPLIT_GROUPS: `${DB_PREFIX}split_groups`,
  SPLIT_EXPENSES: `${DB_PREFIX}split_expenses`,
  TIFFIN_GROUPS: `${DB_PREFIX}tiffin_groups`,
  TIFFIN_ENTRIES: `${DB_PREFIX}tiffin_entries`,
  NOTIFICATIONS: `${DB_PREFIX}notifications`,
};

// Generate MongoDB-like 24-char ObjectId hex string
export const createObjectId = (): string => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const randomChars = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return timestamp + randomChars;
};

// ── Generic MongoDB Collection Class ───────────────────────────────────────────
class MongoCollection<T extends { _id?: string; id?: string }> {
  private key: string;
  private memCache: T[] | null = null;

  constructor(key: string) {
    this.key = key;
  }

  async getAll(): Promise<T[]> {
    if (this.memCache !== null) {
      return [...this.memCache];
    }
    try {
      const data = await safeStorage.getItem(this.key);
      const parsed: T[] = data ? JSON.parse(data) : [];
      this.memCache = parsed;
      return [...parsed];
    } catch {
      return [];
    }
  }

  async saveAll(items: T[]): Promise<void> {
    this.memCache = [...items];
    try {
      await safeStorage.setItem(this.key, JSON.stringify(items));
    } catch (err) {
      console.error(`[MongoEngine] Failed to save collection ${this.key}:`, err);
    }
  }

  async find(filter?: (item: T) => boolean): Promise<T[]> {
    const all = await this.getAll();
    if (!filter) return all;
    return all.filter(filter);
  }

  async findOne(filter: (item: T) => boolean): Promise<T | null> {
    const all = await this.getAll();
    const found = all.find(filter);
    return found || null;
  }

  async findById(id: string): Promise<T | null> {
    return this.findOne((item) => (item._id || item.id) === id);
  }

  async insertOne(doc: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    const all = await this.getAll();
    const newDoc = {
      ...doc,
      _id: doc._id || createObjectId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as T;

    all.unshift(newDoc);
    this.memCache = [...all];
    // Persist asynchronously in background without blocking
    safeStorage.setItem(this.key, JSON.stringify(all)).catch((err) => {
      console.error(`[MongoEngine] Failed to persist ${this.key}:`, err);
    });
    return newDoc;
  }

  async updateOne(id: string, updates: Partial<T>): Promise<T | null> {
    const all = await this.getAll();
    const index = all.findIndex((item) => (item._id || item.id) === id);
    if (index === -1) return null;

    all[index] = {
      ...all[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.memCache = [...all];
    safeStorage.setItem(this.key, JSON.stringify(all)).catch((err) => {
      console.error(`[MongoEngine] Failed to update ${this.key}:`, err);
    });
    return all[index];
  }

  async deleteOne(id: string): Promise<boolean> {
    const all = await this.getAll();
    const filtered = all.filter((item) => (item._id || item.id) !== id);
    if (filtered.length !== all.length) {
      this.memCache = [...filtered];
      safeStorage.setItem(this.key, JSON.stringify(filtered)).catch((err) => {
        console.error(`[MongoEngine] Failed to delete from ${this.key}:`, err);
      });
      return true;
    }
    return false;
  }

  async count(filter?: (item: T) => boolean): Promise<number> {
    const list = await this.find(filter);
    return list.length;
  }

  clearMemCache(): void {
    this.memCache = null;
  }
}

// ── Exported MongoDB Collections ───────────────────────────────────────────────
export const db = {
  users: new MongoCollection<any>(COLLECTIONS.USERS),
  expenses: new MongoCollection<any>(COLLECTIONS.EXPENSES),
  incomes: new MongoCollection<any>(COLLECTIONS.INCOMES),
  categories: new MongoCollection<any>(COLLECTIONS.CATEGORIES),
  budgets: new MongoCollection<any>(COLLECTIONS.BUDGETS),
  recurring: new MongoCollection<any>(COLLECTIONS.RECURRING),
  splitGroups: new MongoCollection<any>(COLLECTIONS.SPLIT_GROUPS),
  splitExpenses: new MongoCollection<any>(COLLECTIONS.SPLIT_EXPENSES),
  tiffinGroups: new MongoCollection<any>(COLLECTIONS.TIFFIN_GROUPS),
  tiffinEntries: new MongoCollection<any>(COLLECTIONS.TIFFIN_ENTRIES),
  notifications: new MongoCollection<any>(COLLECTIONS.NOTIFICATIONS),
};

export const clearAllMongoCollections = (): void => {
  Object.values(db).forEach((col) => col.clearMemCache());
};

// ── Database Initializer & Pre-Seeding ─────────────────────────────────────────
export const initMongoEngine = async () => {
  try {
    const catCount = await db.categories.count();
    if (catCount === 0) {
      console.log('[MongoEngine] Seeding initial categories & expenses...');

      // 1. Categories
      await db.categories.saveAll([
        {
          _id: createObjectId(),
          name: 'Food & Dining',
          limit: 8000,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#A78BFA',
          icon: 'fast-food-outline',
          isDefault: true,
        },
        {
          _id: createObjectId(),
          name: 'Shopping',
          limit: 5000,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#84CC16',
          icon: 'cart-outline',
          isDefault: true,
        },
        {
          _id: createObjectId(),
          name: 'Travel & Commute',
          limit: 4000,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#38BDF8',
          icon: 'car-outline',
          isDefault: true,
        },
        {
          _id: createObjectId(),
          name: 'Bills & Utilities',
          limit: 6000,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#F59E0B',
          icon: 'flash-outline',
          isDefault: true,
        },
        {
          _id: createObjectId(),
          name: 'Entertainment',
          limit: 3000,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#F472B6',
          icon: 'film-outline',
          isDefault: true,
        },
        {
          _id: createObjectId(),
          name: 'Groceries',
          limit: 5000,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#10B981',
          icon: 'basket-outline',
          isDefault: true,
        },
        {
          _id: createObjectId(),
          name: 'Health & Fitness',
          limit: 2500,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#EF4444',
          icon: 'heart-outline',
          isDefault: true,
        },
        {
          _id: createObjectId(),
          name: 'Others',
          limit: 2000,
          warningThreshold: 80,
          criticalThreshold: 95,
          color: '#9CA3AF',
          icon: 'ellipsis-horizontal-outline',
          isDefault: true,
        },
      ]);

      // 2. Sample Expenses (marked with isSeed: true so they are cleanly purged when user logs in)
      const now = new Date();
      await db.expenses.saveAll([
        {
          _id: createObjectId(),
          title: 'Starbucks Coffee & Snacks',
          amount: 380,
          category: 'Food & Dining',
          paymentMethod: 'UPI',
          date: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
          notes: 'Met with client',
          isSeed: true,
        },
        {
          _id: createObjectId(),
          title: 'Uber to Office',
          amount: 240,
          category: 'Travel & Commute',
          paymentMethod: 'UPI',
          date: new Date(now.getTime() - 8 * 3600 * 1000).toISOString(),
          notes: 'Morning rush ride',
          isSeed: true,
        },
        {
          _id: createObjectId(),
          title: 'D-Mart Monthly Groceries',
          amount: 2150,
          category: 'Groceries',
          paymentMethod: 'Debit Card',
          date: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
          notes: 'Weekly pantry restock',
          isSeed: true,
        },
        {
          _id: createObjectId(),
          title: 'Wi-Fi Fiber Broadband',
          amount: 899,
          category: 'Bills & Utilities',
          paymentMethod: 'Net Banking',
          date: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
          notes: 'Monthly bill payment',
          isSeed: true,
        },
        {
          _id: createObjectId(),
          title: 'Zara Casual Shirts',
          amount: 1990,
          category: 'Shopping',
          paymentMethod: 'Credit Card',
          date: new Date(now.getTime() - 72 * 3600 * 1000).toISOString(),
          notes: 'Weekend sale',
          isSeed: true,
        },
      ]);

      // 3. Sample Income
      await db.incomes.saveAll([
        {
          _id: createObjectId(),
          amount: 45000,
          source: 'Salary',
          date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          note: 'Monthly salary deposit',
        },
      ]);

      // 4. Sample Subscriptions
      await db.recurring.saveAll([
        {
          _id: createObjectId(),
          title: 'Netflix Premium (4K)',
          amount: 649,
          frequency: 'monthly',
          startDate: new Date().toISOString(),
          active: true,
        },
        {
          _id: createObjectId(),
          title: 'Spotify Family Plan',
          amount: 179,
          frequency: 'monthly',
          startDate: new Date().toISOString(),
          active: true,
        },
        {
          _id: createObjectId(),
          title: 'Gold Gym Membership',
          amount: 1500,
          frequency: 'monthly',
          startDate: new Date().toISOString(),
          active: true,
        },
      ]);

      // 5. Sample Split Group
      const sampleGroupId = createObjectId();
      await db.splitGroups.saveAll([
        {
          _id: sampleGroupId,
          name: 'Flat 402 Roommates',
          currency: 'INR',
          members: [
            { name: 'You (Me)' },
            { name: 'Rohit Sharma' },
            { name: 'Amit Verma' },
          ],
        },
      ]);

      await db.splitExpenses.saveAll([
        {
          _id: createObjectId(),
          groupId: sampleGroupId,
          description: 'Weekend Pizza & Biryani',
          amount: 1200,
          date: new Date().toISOString(),
        },
      ]);

      // 6. Sample Tiffin Group
      const sampleTiffinId = createObjectId();
      await db.tiffinGroups.saveAll([
        {
          _id: sampleTiffinId,
          name: 'Annapurna Homely Tiffin',
          defaultPrice: 80,
          inviteCode: '8824',
          members: [{ name: 'You' }],
        },
      ]);

      await db.tiffinEntries.saveAll([
        {
          _id: createObjectId(),
          groupId: sampleTiffinId,
          mealType: 'Lunch',
          count: 1,
          extraPrice: 0,
          totalPrice: 80,
          date: new Date().toISOString(),
        },
      ]);

      // 7. Notification
      await db.notifications.saveAll([
        {
          _id: createObjectId(),
          title: 'Welcome to XpenseFlow Native!',
          message: 'Your personal finance app is running 100% standalone on this Android device with full offline support.',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      console.log('[MongoEngine] Seeding complete.');
    }
  } catch (err) {
    console.error('[MongoEngine] Error during init:', err);
  }
};
