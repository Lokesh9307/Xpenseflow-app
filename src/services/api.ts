import { safeStorage } from './storage';
import { db, initMongoEngine, createObjectId, clearAllMongoCollections } from './mongoEngine';
import { dataEvents } from './dataEvents';

const STORAGE_TOKEN_KEY = 'xpenseflow_auth_token';
const STORAGE_USER_KEY = 'xpenseflow_auth_user';
const STORAGE_API_URL_KEY = 'xpenseflow_api_url';

let cachedToken: string | null = null;
let cachedUser: any | null = null;

const DEFAULT_RENDER_URL = 'https://xpenseflow-backend.onrender.com';
let currentApiUrl: string = process.env.EXPO_PUBLIC_API_URL || DEFAULT_RENDER_URL;

safeStorage.getItem(STORAGE_API_URL_KEY).then((saved) => {
  if (saved) currentApiUrl = saved;
});

// Initialize on-device fallback MongoEngine
initMongoEngine();

export interface ApiResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
}

export const getApiUrl = (): string => currentApiUrl;

export const setApiUrl = async (url: string): Promise<void> => {
  currentApiUrl = url.trim();
  await safeStorage.setItem(STORAGE_API_URL_KEY, currentApiUrl);
};

export const resetApiUrl = async (): Promise<void> => {
  currentApiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_RENDER_URL;
  await safeStorage.removeItem(STORAGE_API_URL_KEY);
};

export const setStoredAuth = async (token: string, user: any): Promise<void> => {
  cachedToken = token;
  cachedUser = user;
  await safeStorage.setItem(STORAGE_TOKEN_KEY, token);
  await safeStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
};

export const getStoredAuth = async (): Promise<{ token: string | null; user: any | null }> => {
  try {
    const token = await safeStorage.getItem(STORAGE_TOKEN_KEY);
    const userStr = await safeStorage.getItem(STORAGE_USER_KEY);
    cachedToken = token;
    cachedUser = userStr ? JSON.parse(userStr) : null;
    return { token, user: cachedUser };
  } catch {
    return { token: null, user: null };
  }
};

export const clearStoredAuth = async (): Promise<void> => {
  cachedToken = null;
  cachedUser = null;
  await safeStorage.removeItem(STORAGE_TOKEN_KEY);
  await safeStorage.removeItem(STORAGE_USER_KEY);
};

// ── Offline queue for tiffin meals ──────────────────────────────────────────
// Meals logged while the server is unreachable are queued here and replayed on
// the next successful sync, so nothing stays "mobile-only" forever.
const PENDING_TIFFIN_KEY = 'xpenseflow_pending_tiffin_writes';

const readPendingTiffinWrites = async (): Promise<any[]> => {
  try {
    const raw = await safeStorage.getItem(PENDING_TIFFIN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writePendingTiffinWrites = async (list: any[]): Promise<void> => {
  try {
    if (list.length === 0) {
      await safeStorage.removeItem(PENDING_TIFFIN_KEY);
    } else {
      await safeStorage.setItem(PENDING_TIFFIN_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('[pendingTiffin] failed to persist queue:', err);
  }
};

// ── Derived-row dedupe ─────────────────────────────────────────────────────
// Mobile materialises tiffin/split bills as local expense rows (syncSource
// 'tiffin'/'split'). When the server has already synced the same bill into the
// member's tracker, keeping the local copy would DOUBLE-COUNT it. Match by
// syncRefId (tiffin), splitExpenseId (split), or — for legacy server rows
// without refs — by the same meal title + calendar day.
const dateKeyOf = (d: any): string => {
  const dt = d ? new Date(d) : null;
  return dt && !Number.isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : '';
};

const dropRowsDuplicatedByServer = (localRows: any[], serverRows: any[]): any[] => {
  const rows = Array.isArray(serverRows) ? serverRows : [];
  const serverSyncRefs = new Set(rows.map((e: any) => e?.syncRefId).filter(Boolean));
  const serverSplitExpenseIds = new Set(
    rows
      .map((e: any) => String(e?.splitExpenseId || ''))
      .filter((v: string) => v && v !== 'undefined' && v !== 'null')
  );
  // Any server-side tiffin row (canonical or legacy backfill) already covers
  // that meal & day — the locally derived copy would double the category.
  const serverTiffinKeys = new Set(
    rows
      .filter(
        (e: any) =>
          e &&
          (e.syncSource === 'tiffin' || e.category === 'Tiffin Expense' || /^Tiffin:/i.test(e.title || ''))
      )
      .map((e: any) => `${e.title}::${dateKeyOf(e.date || e.createdAt)}`)
  );
  return (localRows || []).filter((lp: any) => {
    const ref = String(lp?.syncRefId || '');
    if (ref && serverSyncRefs.has(ref)) return false;
    if (lp?.syncSource === 'split' && ref.startsWith('split_')) {
      const expId = ref.split('_')[1];
      if (expId && serverSplitExpenseIds.has(expId)) return false;
    }
    if (
      lp?.syncSource === 'tiffin' &&
      lp?.title &&
      serverTiffinKeys.has(`${lp.title}::${dateKeyOf(lp.date || lp.createdAt)}`)
    ) {
      return false;
    }
    return true;
  });
};

const replayPendingTiffinWrites = async (): Promise<void> => {
  const pending = await readPendingTiffinWrites();
  if (pending.length === 0) return;

  const remaining: any[] = [];
  for (const item of pending) {
    if (!item?.payload?.groupId) continue;
    const r = await request(`/api/tiffin/groups/${item.payload.groupId}/entries`, {
      method: 'POST',
      body: JSON.stringify(item.payload),
    });

    if (r.status === 201 || r.status === 200) {
      // Swap the local pending copy for the authoritative server copy
      if (item.localId) await db.tiffinEntries.deleteOne(item.localId);
      if (r.data?._id) {
        await db.tiffinEntries.insertOne({ ...r.data, groupId: item.payload.groupId });
      }
    } else if (r.status === 409) {
      // The server already holds a record for this date/meal — drop the copy
      if (item.localId) await db.tiffinEntries.deleteOne(item.localId);
    } else if (r.status > 0) {
      // Permanently rejected — don't retry forever, just log it
      console.warn('[pendingTiffin] entry rejected by server:', r.error);
    } else {
      remaining.push(item); // still unreachable — keep for the next sync
    }
  }
  await writePendingTiffinWrites(remaining);

  // Re-derive the Expense Tracker rows now that the server copies exist
  if (remaining.length !== pending.length) {
    try {
      await api.syncTiffinExpenses(true);
    } catch (err) {
      console.warn('[pendingTiffin] re-sync error:', err);
    }
  }
};

// ── Generic Network Request Client with Timeout ──────────────────────────────
export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiUrl().replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (!cachedToken) {
    const auth = await getStoredAuth();
    if (auth.token) cachedToken = auth.token;
  }

  if (cachedToken) {
    headers['Authorization'] = `Bearer ${cachedToken}`;
  }

  try {
    const controller = new AbortController();
    // Generous timeout: Render's free tier cold-starts can exceed 15s, and a
    // timeout here used to kick the app into its offline/mock fallback.
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        status: res.status,
        error: json?.message || json?.error || `Server returned error (${res.status})`,
        data: json,
      };
    }

    return {
      status: res.status,
      data: json,
    };
  } catch (err: any) {
    return {
      status: 0,
      error: err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Network error'),
    };
  }
}

// Deterministic unique 4-digit code per group so the join PIN is 100% static & permanent
export const getStaticGroupCode = (groupOrId: any): string => {
  if (!groupOrId) return '8824';
  if (typeof groupOrId === 'object' && groupOrId.inviteCode && /^\d{4}$/.test(String(groupOrId.inviteCode))) {
    return String(groupOrId.inviteCode);
  }
  const idStr = String(
    typeof groupOrId === 'object'
      ? (groupOrId._id || groupOrId.id || groupOrId.name)
      : groupOrId
  );
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 9000 + 1000);
};

// ── API Operations (Connected to Render with Offline Fallback) ────────────────
export const api = {
  getStaticGroupCode,
  // ── Authentication ─────────────────────────────────────────────────────────
  login: async (email: string, password: string): Promise<ApiResponse<any>> => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 200 && res.data?.token) {
      await setStoredAuth(res.data.token, res.data.user);
      return res;
    }

    if (res.status > 0) {
      return res;
    }

    // Offline / Local Engine Fallback
    try {
      const cleanEmail = email.toLowerCase().trim();
      let user = await db.users.findOne((u) => u.email === cleanEmail);
      if (!user) {
        user = await db.users.insertOne({
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          password,
          isVerified: true,
          isOnboarded: true,
          avatar: '',
          currency: 'INR',
        });
      }

      const token = `token_${createObjectId()}`;
      const userPayload = {
        id: user._id,
        name: user.name,
        email: user.email,
        isOnboarded: user.isOnboarded !== false,
        isAdmin: !!user.isAdmin,
      };

      await setStoredAuth(token, userPayload);
      return { status: 200, data: { success: true, user: userPayload, token } };
    } catch (err: any) {
      return { status: 500, error: err.message || 'Login failed' };
    }
  },

  register: async (name: string, email: string, password: string): Promise<ApiResponse<any>> => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (res.status === 201 || res.status === 200) {
      return res;
    }

    if (res.status > 0) {
      return res;
    }

    // Offline Fallback
    try {
      const cleanEmail = email.toLowerCase().trim();
      let user = await db.users.findOne((u) => u.email === cleanEmail);
      if (user) {
        return { status: 409, error: 'User already exists with this email' };
      }
      user = await db.users.insertOne({
        name,
        email: cleanEmail,
        password,
        isVerified: true,
        isOnboarded: false,
        avatar: '',
        currency: 'INR',
      });
      return { status: 201, data: { success: true, email: cleanEmail, message: 'Account created' } };
    } catch (err: any) {
      return { status: 500, error: err.message || 'Registration failed' };
    }
  },

  verifyOtp: async (email: string, otp: string, type: 'signup' | 'reset'): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, type }),
    });
    if (res.status === 200) return res;
    if (res.status > 0) return res;
    return { status: 200, data: { success: true } };
  },

  sendOtp: async (email: string, type: 'reset'): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await request('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    });
    if (res.status === 200) return res;
    if (res.status > 0) return res;
    return { status: 200, data: { success: true } };
  },

  resetPassword: async (email: string, password: string): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 200) return res;
    if (res.status > 0) return res;

    try {
      const cleanEmail = email.toLowerCase().trim();
      const user = await db.users.findOne((u) => u.email === cleanEmail);
      if (user) {
        await db.users.updateOne(user._id, { password });
      }
      return { status: 200, data: { success: true } };
    } catch (err: any) {
      return { status: 500, error: err.message || 'Failed to reset password' };
    }
  },

  // ── Dashboard & Cash Flow ──────────────────────────────────────────────────
  getIncomeSummary: async (): Promise<ApiResponse<any>> => {
    // 1. Calculate instantly from local in-memory DB (takes < 1ms)
    const computeLocal = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const allExpenses = await db.expenses.getAll();
      const allIncomes = await db.incomes.getAll();

      const monthExpenses = allExpenses.filter((e) => {
        const d = new Date(e.date || e.createdAt);
        return d >= startOfMonth && d <= endOfMonth;
      });

      const monthIncomes = allIncomes.filter((i) => {
        const d = new Date(i.date || i.createdAt);
        return d >= startOfMonth && d <= endOfMonth;
      });

      const monthExpense = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const monthIncome = monthIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);

      const week = [];
      for (let idx = 6; idx >= 0; idx--) {
        const d = new Date();
        d.setDate(d.getDate() - idx);
        const dateStr = d.toISOString().split('T')[0];
        const dayStart = new Date(new Date(d).setHours(0, 0, 0, 0));
        const dayEnd = new Date(new Date(d).setHours(23, 59, 59, 999));

        const dayExp = allExpenses
          .filter((e) => {
            const expDate = new Date(e.date || e.createdAt);
            return expDate >= dayStart && expDate <= dayEnd;
          })
          .reduce((sum, e) => sum + (e.amount || 0), 0);

        const dayInc = allIncomes
          .filter((i) => {
            const incDate = new Date(i.date || i.createdAt);
            return incDate >= dayStart && incDate <= dayEnd;
          })
          .reduce((sum, i) => sum + (i.amount || 0), 0);

        week.push({ date: dateStr, expense: dayExp, income: dayInc });
      }

      return {
        monthExpense,
        monthIncome,
        week,
      };
    };

    // Background server refresh
    request('/api/income', { method: 'GET' }).catch(() => {});

    try {
      const data = await computeLocal();
      return { status: 200, data };
    } catch (err: any) {
      return { status: 500, error: err.message, data: undefined };
    }
  },

  // ── Expenses ───────────────────────────────────────────────────────────────
  getExpenses: async (params?: {
    category?: string;
    search?: string;
    limit?: number | string;
    sortBy?: string;
    sortOrder?: string;
    month?: string;
  }): Promise<ApiResponse<any[]>> => {
    // 1. Instantly return from local memory DB (< 1ms)
    let list = await db.expenses.getAll();
    if (params?.category && params.category !== 'All') {
      const targetCat = params.category.toLowerCase().trim();
      list = list.filter((e) => {
        const itemCat = (e.category || '').toLowerCase().trim();
        return (
          itemCat === targetCat ||
          (targetCat.includes('tiffin') && itemCat.includes('tiffin')) ||
          (targetCat.includes('split') && itemCat.includes('split'))
        );
      });
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q)
      );
    }
    if (params?.month && params.month !== 'all') {
      list = list.filter((e) => {
        try {
          const d = new Date(e.date || e.createdAt);
          return d.toISOString().slice(0, 7) === params.month;
        } catch {
          return false;
        }
      });
    }
    list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    if (params?.limit) {
      const max = parseInt(String(params.limit), 10);
      if (!isNaN(max)) list = list.slice(0, max);
    }

    // Background server sync without blocking UI
    let queryStr = '';
    if (params) {
      const q = new URLSearchParams();
      if (params.category && params.category !== 'All') q.append('category', params.category);
      if (params.search) q.append('search', params.search);
      if (params.limit) q.append('limit', String(params.limit));
      if (params.sortBy) q.append('sortBy', params.sortBy);
      if (params.sortOrder) q.append('sortOrder', params.sortOrder);
      if (params.month) q.append('month', params.month);
      queryStr = `?${q.toString()}`;
    }

    request(`/api/expenses${queryStr}`, { method: 'GET' }).then(async (res) => {
      if (res.status === 200 && Array.isArray(res.data)) {
        const isFilteredQuery = Boolean(params?.category && params.category !== 'All') || Boolean(params?.search) || Boolean(params?.month && params.month !== 'all');
        if (isFilteredQuery) return;

        const normalizedServerData = res.data.map((e: any) => {
          const catName = e.category && e.category !== 'Others'
            ? e.category
            : ((typeof e.categoryId === 'object' && e.categoryId?.name) || e.category || 'Others');
          return {
            ...e,
            category: catName,
          };
        });

        const localCurrent = await db.expenses.getAll();
        // Remove demo seed items if real server records are present
        const nonSeedLocal = localCurrent.filter(
          (e) => !e.isSeed && !/^(Starbucks Coffee & Snacks|Uber to Office|D-Mart Monthly Groceries|Wi-Fi Fiber Broadband|Zara Casual Shirts)$/i.test(e.title || '')
        );

        const localPending = nonSeedLocal.filter(
          (e) => e.syncSource === 'tiffin' || e.syncSource === 'split' || e.syncSource === 'sms_auto' || e.isOfflinePending
        );
        // Derived tiffin/split rows must not survive when the server already
        // carries the same bill — otherwise every synced meal counts twice.
        const dedupedPending = dropRowsDuplicatedByServer(localPending, normalizedServerData);
        const serverIds = new Set(normalizedServerData.map((e: any) => e._id || e.id));

        const finalExpenses: any[] = [...normalizedServerData];
        for (const lp of dedupedPending) {
          if (!serverIds.has(lp._id || lp.id)) {
            finalExpenses.push(lp);
          }
        }

        finalExpenses.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
        await db.expenses.saveAll(finalExpenses);
        dataEvents.emit('expenses_synced', finalExpenses);
      }
    }).catch(() => {});


    return { status: 200, data: list };
  },

  addExpense: async (data: any): Promise<ApiResponse<any>> => {
    let localDoc: any = null;
    try {
      localDoc = await db.expenses.insertOne({
        title: data.title,
        amount: parseFloat(data.amount),
        category: data.category || 'Others',
        paymentMethod: data.paymentMethod || 'UPI',
        date: data.date || new Date().toISOString(),
        notes: data.notes || '',
        location: data.location || '',
      });
      // Fire instant event for all screens to update in 1 millisecond
      dataEvents.emit('expense_added', localDoc);
    } catch (err: any) {
      console.error('[addExpense] local write error:', err);
    }

    // Sync in background without blocking
    request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => {});

    return { status: 201, data: localDoc || data };
  },

  updateExpense: async (id: string, data: any): Promise<ApiResponse<any>> => {
    let updated: any = null;
    try {
      updated = await db.expenses.updateOne(id, data);
      dataEvents.emit('expense_updated', updated || { ...data, _id: id });
    } catch (err: any) {
      console.error('[updateExpense] local update error:', err);
    }

    request(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).catch(() => {});

    return { status: 200, data: updated || { ...data, _id: id } };
  },

  deleteExpense: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      await db.expenses.deleteOne(id);
      dataEvents.emit('expense_deleted', id);
    } catch (err: any) {
      console.error('[deleteExpense] local delete error:', err);
    }

    request(`/api/expenses/${id}`, { method: 'DELETE' }).catch(() => {});

    return { status: 200, data: { success: true } };
  },

  // ── Income ─────────────────────────────────────────────────────────────────
  addIncome: async (data: any): Promise<ApiResponse<any>> => {
    let localDoc: any = null;
    try {
      localDoc = await db.incomes.insertOne({
        amount: parseFloat(data.amount),
        source: data.source || 'General',
        date: data.date || new Date().toISOString(),
        notes: data.notes || '',
      });
      dataEvents.emit('income_added', localDoc);
    } catch (err: any) {
      console.error('[addIncome] local write error:', err);
    }

    request('/api/income', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => {});

    return { status: 201, data: localDoc || data };
  },

  // ── Categories & Budgets ───────────────────────────────────────────────────
  getCategories: async (): Promise<ApiResponse<any[]>> => {
    // 1. Immediately return from local memory DB (< 1ms)
    let list = await db.categories.getAll();

    // Background sync
    request('/api/categories', { method: 'GET' })
      .then(async (res) => {
        if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
          const localItems = await db.categories.getAll();
          const merged = res.data.map((serverCat: any) => {
            const localMatch = localItems.find(
              (l: any) =>
                (l._id || l.id) === (serverCat._id || serverCat.id) ||
                l.name?.toLowerCase() === serverCat.name?.toLowerCase()
            );
            if (localMatch) {
              return {
                ...localMatch,
                ...serverCat,
              };
            }
            return serverCat;
          });

          localItems.forEach((localCat: any) => {
            if (
              !localCat.isDefault &&
              !merged.some(
                (m: any) =>
                  (m._id || m.id) === (localCat._id || localCat.id) ||
                  m.name?.toLowerCase() === localCat.name?.toLowerCase()
              )
            ) {
              merged.push(localCat);
            }
          });

          await db.categories.saveAll(merged);
          dataEvents.emit('category_updated');
        }
      })
      .catch(() => {});

    return { status: 200, data: list };
  },

  createCategory: async (data: any): Promise<ApiResponse<any>> => {
    let doc: any = null;
    try {
      doc = await db.categories.insertOne(data);
      dataEvents.emit('category_updated', doc);
      dataEvents.emit('refresh_data');
    } catch (err: any) {
      console.error('[createCategory] local insert error:', err);
    }

    request('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => {});

    return { status: 201, data: doc || data };
  },

  updateCategory: async (id: string, data: any): Promise<ApiResponse<any>> => {
    let updated: any = null;
    try {
      if (id) {
        updated = await db.categories.updateOne(id, data);
      }
      if (!updated && (data.previousName || data.name)) {
        const all = await db.categories.getAll();
        const found = all.find(
          (c: any) =>
            (data.previousName && c.name?.toLowerCase() === data.previousName.toLowerCase()) ||
            c.name?.toLowerCase() === data.name?.toLowerCase()
        );
        if (found) {
          updated = await db.categories.updateOne(found._id || found.id, data);
        } else {
          updated = await db.categories.insertOne(data);
        }
      }

      // Cascade category rename to existing expenses
      if (data.previousName && data.name && data.previousName !== data.name) {
        const allExpenses = await db.expenses.getAll();
        for (const exp of allExpenses) {
          if (exp.category === data.previousName) {
            await db.expenses.updateOne(exp._id || exp.id, { category: data.name });
          }
        }
      }

      const payload = updated || { ...data, _id: id, id };
      dataEvents.emit('category_updated', payload);
      dataEvents.emit('refresh_data');
    } catch (err: any) {
      console.error('[updateCategory] local update error:', err);
    }

    const target = id || data.previousName || data.name;
    if (target) {
      request(`/api/categories/${encodeURIComponent(target)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }).catch(() => {});
    }

    return { status: 200, data: updated || { ...data, _id: id } };
  },

  deleteCategory: async (id: string): Promise<ApiResponse<any>> => {
    try {
      await db.categories.deleteOne(id);
      dataEvents.emit('category_deleted', id);
    } catch (err: any) {
      console.error('[deleteCategory] local delete error:', err);
    }

    request(`/api/categories/${id}`, { method: 'DELETE' }).catch(() => {});

    return { status: 200, data: { success: true } };
  },

  getBudgets: async (): Promise<ApiResponse<any[]>> => {
    const res = await request('/api/budgets', { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) return res;

    try {
      const cats = await db.categories.getAll();
      const expenses = await db.expenses.getAll();

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const monthExpenses = expenses.filter((e) => {
        const d = new Date(e.date || e.createdAt);
        return d >= startOfMonth && d <= endOfMonth;
      });

      // Budgets are opt-in: only categories the user actually gave a limit to
      const budgetList = cats
        .filter((cat) => Number(cat.limit) > 0)
        .map((cat) => {
          const spent = monthExpenses
            .filter((e) => e.category === cat.name)
            .reduce((sum, e) => sum + (e.amount || 0), 0);

          const limit = cat.limit;
          const percentage = Math.round((spent / limit) * 100);

          let status = 'normal';
          if (cat.alertEnabled && percentage >= (cat.alertPercent || 90)) status = 'warning';
          else if (percentage >= (cat.criticalThreshold || 95)) status = 'critical';
          else if (!cat.alertEnabled && percentage >= (cat.warningThreshold || 80)) status = 'warning';

          return {
            _id: cat._id,
            categoryName: cat.name,
            categoryColor: cat.color || '#2dd4bf',
            categoryIcon: cat.icon || 'folder-outline',
            spent,
            limit,
            percentage,
            status,
            remaining: Math.max(0, limit - spent),
          };
        });

      return { status: 200, data: budgetList };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  // ── Recurring Subscriptions & Auto-Add ──────────────────────────────────────
  getRecurringExpenses: async (): Promise<ApiResponse<any[]>> => {
    const res = await request('/api/recurring', { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) return res;

    try {
      const list = await db.recurring.getAll();
      return { status: 200, data: list };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  addRecurringExpense: async (data: any): Promise<ApiResponse<any>> => {
    const res = await request('/api/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.status === 201 || res.status === 200) return res;

    try {
      const doc = await db.recurring.insertOne({
        title: data.title,
        amount: data.amount,
        frequency: data.frequency || 'monthly',
        category: data.category || 'Subscriptions',
        categoryId: data.categoryId,
        startDate: data.startDate || new Date().toISOString(),
        active: data.active !== undefined ? data.active : true,
      });
      return { status: 201, data: doc };
    } catch (err: any) {
      return { status: 500, error: err.message };
    }
  },

  updateRecurringExpense: async (id: string, data: any): Promise<ApiResponse<any>> => {
    const res = await request(`/api/recurring/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (res.status === 200) return res;

    try {
      await db.recurring.updateOne(id, data);
      return { status: 200, data: { ...data, _id: id } };
    } catch (err: any) {
      return { status: 500, error: err.message };
    }
  },

  triggerRecurringExpense: async (id: string): Promise<ApiResponse<any>> => {
    const res = await request(`/api/recurring/${id}/run-now`, {
      method: 'POST',
    });
    if (res.status === 200) return res;

    try {
      const rec = await db.recurring.findOne((r) => (r._id || r.id) === id);
      if (rec) {
        await db.expenses.insertOne({
          title: rec.title,
          amount: rec.amount,
          category: rec.category || 'Subscriptions',
          date: new Date().toISOString(),
          paymentMethod: 'Auto-Debit',
          notes: `Subscription payment for ${rec.title}`,
          isRecurring: true,
          recurringId: id,
        });
      }
      return { status: 200, data: { success: true } };
    } catch (err: any) {
      return { status: 500, error: err.message };
    }
  },

  deleteRecurringExpense: async (id: string): Promise<ApiResponse<any>> => {
    const res = await request(`/api/recurring/${id}`, {
      method: 'DELETE',
    });
    if (res.status === 200) return res;

    try {
      await db.recurring.deleteOne(id);
      return { status: 200, data: { success: true } };
    } catch (err: any) {
      return { status: 500, error: err.message };
    }
  },

  // ── Split & Groups ─────────────────────────────────────────────────────────
  getSplitSummary: async (): Promise<ApiResponse<any>> => {
    const res = await request('/api/split/summary', { method: 'GET' });
    if (res.status === 200 && res.data) return res;

    return {
      status: 200,
      data: {
        totalOwedToYou: 1200,
        totalYouOwe: 450,
        netBalance: 750,
      },
    };
  },

  getSplitGroups: async (): Promise<ApiResponse<any[]>> => {
    const res = await request('/api/split/groups', { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) return res;

    try {
      const list = await db.splitGroups.getAll();
      return { status: 200, data: list };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  createSplitGroup: async (data: any): Promise<ApiResponse<any>> => {
    const res = await request('/api/split/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.status === 201 || res.status === 200) return res;

    try {
      const doc = await db.splitGroups.insertOne({
        name: data.name,
        currency: data.currency || 'INR',
        members: data.members || [],
      });
      return { status: 201, data: doc };
    } catch (err: any) {
      return { status: 500, error: err.message, data: undefined };
    }
  },

  getSplitExpenses: async (groupId: string): Promise<ApiResponse<any[]>> => {
    const res = await request(`/api/split/expenses?groupId=${groupId}`, { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) return res;

    try {
      const list = await db.splitExpenses.find((e) => e.groupId === groupId);
      return { status: 200, data: list };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  createSplitExpense: async (data: any): Promise<ApiResponse<any>> => {
    let splitDoc: any = null;
    const res = await request('/api/split/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.status === 201 || res.status === 200) {
      splitDoc = res.data;
    }

    try {
      const doc = await db.splitExpenses.insertOne({
        _id: splitDoc?._id || splitDoc?.id || `split_exp_${Date.now()}`,
        groupId: data.groupId,
        title: data.title || data.description,
        amount: data.amount,
        paidBy: data.paidBy,
        splitBetween: data.splitBetween || [],
        isSettled: false,
        date: data.date || new Date().toISOString(),
      });
      if (!splitDoc) splitDoc = doc;
    } catch (err: any) {
      console.warn('[createSplitExpense] local save error:', err);
    }

    try {
      const auth = await getStoredAuth();
      if ((auth.user?.autoSyncSplit ?? cachedUser?.autoSyncSplit) !== false) {
        await api.syncSplitExpenses(true);
      }
    } catch (_) {}

    if (splitDoc) return { status: 201, data: splitDoc };
    return res;
  },

  addSplitExpense: async (groupIdOrData: any, maybeData?: any): Promise<ApiResponse<any>> => {
    const payload = maybeData
      ? { ...maybeData, groupId: groupIdOrData, title: maybeData.description || maybeData.title }
      : groupIdOrData;
    return api.createSplitExpense(payload);
  },

  settleSplitExpense: async (id: string): Promise<ApiResponse<any>> => {
    const res = await request(`/api/split/expenses/${id}/settle`, { method: 'PUT' });
    if (res.status === 200) return res;

    try {
      const updated = await db.splitExpenses.updateOne(id, { isSettled: true });
      return { status: 200, data: updated };
    } catch (err: any) {
      return { status: 500, error: err.message, data: undefined };
    }
  },

  getSplitAllExpenses: async (): Promise<ApiResponse<any[]>> => {
    const res = await request('/api/split/groups/all/expenses', { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) return res;

    try {
      const list = await db.splitExpenses.getAll();
      return { status: 200, data: list };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  // ── Tiffin Tracker ─────────────────────────────────────────────────────────
  getTiffinGroups: async (): Promise<ApiResponse<any[]>> => {
    const res = await request('/api/tiffin/groups', { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) {
      const formatted = res.data.map((g: any) => ({
        ...g,
        inviteCode: g.inviteCode && /^\d{4}$/.test(String(g.inviteCode)) ? String(g.inviteCode) : getStaticGroupCode(g),
      }));
      return { ...res, data: formatted };
    }

    try {
      const list = await db.tiffinGroups.getAll();
      const formatted = list.map((g) => ({
        ...g,
        inviteCode: g.inviteCode && /^\d{4}$/.test(String(g.inviteCode)) ? String(g.inviteCode) : getStaticGroupCode(g),
      }));
      return { status: 200, data: formatted };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  getTiffinGroupDetails: async (groupId: string, month?: string): Promise<ApiResponse<any>> => {
    const query = month ? `?month=${month}` : '';
    const res = await request(`/api/tiffin/groups/${groupId}${query}`, { method: 'GET' });
    if (res.status === 200 && res.data) {
      const inviteCode =
        res.data.inviteCode && /^\d{4}$/.test(String(res.data.inviteCode))
          ? String(res.data.inviteCode)
          : getStaticGroupCode(res.data.group || groupId);
      return {
        ...res,
        data: {
          ...res.data,
          inviteCode,
        },
      };
    }

    try {
      const group = await db.tiffinGroups.findById(groupId);
      const entries = await db.tiffinEntries.find((e) => e.groupId === groupId);
      const cycleTotal = entries.reduce((s, e) => s + (e.totalPrice || 0), 0);
      const cycleQuantity = entries.reduce((s, e) => s + (e.count || 1), 0);
      const inviteCode =
        group?.inviteCode && /^\d{4}$/.test(String(group.inviteCode))
          ? String(group.inviteCode)
          : getStaticGroupCode(group || groupId);
      return {
        status: 200,
        data: {
          group: group || { _id: groupId, name: 'Tiffin Group', defaultPrice: 80, members: [] },
          entries,
          todayEntries: entries.slice(0, 3),
          cycleTotal,
          cycleQuantity,
          inviteCode,
          isCreator: true,
          canWrite: true,
        },
      };
    } catch (err: any) {
      return { status: 500, error: err.message, data: undefined };
    }
  },

  joinTiffinGroupByCode: async (code: string): Promise<ApiResponse<any>> => {
    const clean = code.trim();
    const res = await request('/api/tiffin/join/code', {
      method: 'POST',
      body: JSON.stringify({ code: clean }),
    });
    if (res.status === 200 || res.status === 201) return res;

    // Offline / Local engine fallback
    try {
      const all = await db.tiffinGroups.getAll();
      const matched = all.find(
        (g) => g.inviteCode === clean || getStaticGroupCode(g) === clean
      );
      if (!matched) {
        return { status: 404, error: 'Invalid or expired tiffin code.' };
      }
      return {
        status: 200,
        data: { message: 'Joined successfully!', groupId: matched._id, groupName: matched.name },
      };
    } catch (err: any) {
      return { status: 500, error: err.message };
    }
  },

  regenerateTiffinInviteCode: async (groupId: string): Promise<ApiResponse<any>> => {
    const res = await request(`/api/tiffin/groups/${groupId}/invite`, { method: 'POST' });
    if (res.status === 200 && res.data?.inviteCode) return res;

    const staticCode = getStaticGroupCode(groupId);
    return { status: 200, data: { inviteCode: staticCode } };
  },

  getTiffinTransactions: async (month?: string): Promise<ApiResponse<any[]>> => {
    const query = month ? `?month=${month}` : '';
    const res = await request(`/api/tiffin/transactions${query}`, { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) return res;

    try {
      const list = await db.tiffinEntries.getAll();
      const monthEntries = month && month !== 'all'
        ? list.filter((entry) => {
            const date = new Date(entry.date || entry.createdAt);
            return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 7) === month;
          })
        : list;
      return { status: 200, data: monthEntries };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  createTiffinGroup: async (data: any): Promise<ApiResponse<any>> => {
    const res = await request('/api/tiffin/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.status === 201 || res.status === 200) {
      const group = res.data;
      if (group) {
        group.inviteCode =
          group.inviteCode && /^\d{4}$/.test(String(group.inviteCode))
            ? String(group.inviteCode)
            : getStaticGroupCode(group);
      }
      return res;
    }

    try {
      const tempId = Date.now().toString();
      const inviteCode = getStaticGroupCode(tempId + (data.name || ''));
      const doc = await db.tiffinGroups.insertOne({
        name: data.name,
        pricePerMeal: data.pricePerMeal || data.defaultPrice || 80,
        monthlyTarget: data.monthlyTarget || 60,
        inviteCode,
      });
      return { status: 201, data: doc };
    } catch (err: any) {
      return { status: 500, error: err.message, data: undefined };
    }
  },

  updateTiffinGroup: async (groupId: string, data: any): Promise<ApiResponse<any>> => {
    const res = await request(`/api/tiffin/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (res.status === 200) return res;

    try {
      await db.tiffinGroups.updateOne(groupId, data);
      return { status: 200, data: { ...data, _id: groupId } };
    } catch (err: any) {
      return { status: 500, error: err.message };
    }
  },

  getTiffinEntries: async (groupId: string, month?: string): Promise<ApiResponse<any[]>> => {
    // 1. Try group details endpoint which contains full list of entries
    try {
      const detailsRes = await api.getTiffinGroupDetails(groupId, month);
      if (detailsRes.status === 200 && detailsRes.data) {
        const list = detailsRes.data.allEntries || detailsRes.data.entries || [];
        if (Array.isArray(list) && list.length > 0) {
          // Mirror the server list into the local cache. Entries are REPLACED
          // (not appended) so edits/deletions made on the web never linger as
          // stale copies in the offline fallback.
          const normalized = list.map((item: any) => ({
            ...item,
            groupId,
            _id: item._id || item.id,
            id: item._id || item.id,
          }));
          const otherGroups = await db.tiffinEntries.find(
            (e) => String(e.groupId) !== String(groupId)
          );
          await db.tiffinEntries.saveAll([...otherGroups, ...normalized]);
          return { status: 200, data: list };
        }
      }
    } catch (_) {}

    // 2. Direct entries endpoint
    const query = month ? `?month=${month}` : '';
    const res = await request(`/api/tiffin/groups/${groupId}/entries${query}`, { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) return res;

    // 3. Fallback to local memory DB
    try {
      const list = await db.tiffinEntries.find((e) => String(e.groupId) === String(groupId));
      return { status: 200, data: list };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  logTiffinMeal: async (data: any): Promise<ApiResponse<any>> => {
    const groupId = data.groupId;
    const url = groupId ? `/api/tiffin/groups/${groupId}/entries` : '/api/tiffin/entries';
    const isNoMeal = data.noTiffin === true || data.mealType === 'none';
    let entryDoc: any = null;

    // 1. Server request
    const res = await request(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (res.status === 201 || res.status === 200) {
      entryDoc = res.data;
    } else if (res.status >= 400) {
      // The server rejected the write (e.g. a record for this date/meal
      // already exists). Surface the reason instead of silently creating a
      // local-only phantom entry that never syncs.
      return { status: res.status, error: res.error || 'Failed to save tiffin entry' };
    }

    // 2. Persist a local mirror so the tracker works offline. When the server
    // was simply unreachable (status 0) the copy is marked pending and
    // replayed on the next successful sync.
    const offline = !entryDoc;
    try {
      const entryId = entryDoc?._id || entryDoc?.id || `pending_${Date.now()}`;
      const localData = {
        _id: entryId,
        id: entryId,
        groupId: data.groupId,
        mealType: isNoMeal ? 'none' : (data.mealType || 'lunch'),
        count: isNoMeal ? 0 : (data.count || 1),
        quantity: isNoMeal ? 0 : (data.quantity || data.count || 1),
        baseQuantity: isNoMeal ? 0 : (data.baseQuantity || 1),
        splitMemberIds: data.splitMemberIds || [],
        participantMemberIds: data.splitMemberIds || [],
        participantQuantities: data.extras || {},
        extras: data.extras || {},
        memberBills: data.memberBills || {},
        extraPrice: isNoMeal ? 0 : (data.extraPrice || 0),
        totalPrice: isNoMeal ? 0 : (data.totalPrice || 80),
        totalCost: isNoMeal ? 0 : (data.totalPrice || 80),
        noTiffin: isNoMeal,
        notes: data.notes || '',
        date: data.date || new Date().toISOString(),
        participants: data.participants || [],
        ...(offline ? { isOfflinePending: true } : {}),
      };
      const existingLocal = await db.tiffinEntries.findById(entryId);
      if (existingLocal) {
        await db.tiffinEntries.updateOne(entryId, localData);
      } else {
        await db.tiffinEntries.insertOne(localData);
      }
      if (offline) {
        entryDoc = localData;
        try {
          const queue = await readPendingTiffinWrites();
          queue.push({ localId: entryId, payload: data });
          await writePendingTiffinWrites(queue);
        } catch (queueErr) {
          console.warn('[logTiffinMeal] queue error:', queueErr);
        }
      }
    } catch (err: any) {
      console.warn('[logTiffinMeal] local save error:', err);
    }

    // 3. Trigger autoSync into Expense Tracker if enabled
    try {
      const auth = await getStoredAuth();
      const isAutoSync = auth.user?.autoSyncTiffin ?? cachedUser?.autoSyncTiffin;
      if (isAutoSync !== false) {
        await api.syncTiffinExpenses(true);
      }
    } catch (syncErr) {
      console.warn('[logTiffinMeal] auto-sync error:', syncErr);
    }

    if (entryDoc) return { status: 201, data: entryDoc };
    return res;
  },

  addTiffinEntry: async (groupIdOrData: any, maybeData?: any): Promise<ApiResponse<any>> => {
    const payload = maybeData
      ? { ...maybeData, groupId: groupIdOrData }
      : groupIdOrData;
    return api.logTiffinMeal(payload);
  },

  updateTiffinEntry: async (groupId: string, entryId: string, data: any): Promise<ApiResponse<any>> => {
    const res = await request(`/api/tiffin/groups/${groupId}/entries/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    // Server actively rejected the edit — surface it instead of pretending
    // success while the ledger stays unchanged.
    if (res.status >= 400) {
      return { status: res.status, error: res.error || 'Failed to update tiffin entry' };
    }

    try {
      await db.tiffinEntries.updateOne(entryId, data);
      const auth = await getStoredAuth();
      const isAutoSync = auth.user?.autoSyncTiffin ?? cachedUser?.autoSyncTiffin;
      if (isAutoSync !== false) {
        // Clean old synced entry and re-sync
        const syncRef = `tiffin_${entryId}_${groupId}`;
        const allExp = await db.expenses.getAll();
        const filtered = allExp.filter((e) => e.syncRefId !== syncRef);
        if (filtered.length !== allExp.length) {
          await db.expenses.saveAll(filtered);
        }
        await api.syncTiffinExpenses(true);
      }
    } catch (err: any) {
      console.warn('[updateTiffinEntry] error:', err);
    }

    if (res.status === 200) return res;
    // Offline (status 0): keep the local edit; the next successful sync
    // re-fetches the authoritative copy.
    return { status: 200, data: { ...data, _id: entryId } };
  },

  deleteTiffinEntry: async (groupId: string, entryId: string): Promise<ApiResponse<any>> => {
    const res = await request(`/api/tiffin/groups/${groupId}/entries/${entryId}`, {
      method: 'DELETE',
    });

    // Server actively rejected the delete — keep the record consistent
    if (res.status >= 400) {
      return { status: res.status, error: res.error || 'Failed to delete tiffin entry' };
    }

    try {
      await db.tiffinEntries.deleteOne(entryId);
      // Remove synced expense from Expense Tracker immediately
      const syncRef = `tiffin_${entryId}_${groupId}`;
      const allExp = await db.expenses.getAll();
      const targetExp = allExp.find((e) => e.syncRefId === syncRef);
      if (targetExp) {
        await db.expenses.deleteOne(targetExp._id || targetExp.id);
        dataEvents.emit('expense_deleted', targetExp._id || targetExp.id);
        dataEvents.emit('category_updated');
        dataEvents.emit('refresh_data');
      }
    } catch (err: any) {
      console.warn('[deleteTiffinEntry] error:', err);
    }

    if (res.status === 200) return res;
    return { status: 200, data: { success: true } };
  },



  // ── AI Chatbot ─────────────────────────────────────────────────────────────
  // ── AI Chatbot ─────────────────────────────────────────────────────────────
  sendChatMessage: async (data: {
    message?: string;
    mode?: 'simple' | 'agentic';
    history?: any[];
    requestId?: string;
    confirmedAction?: {
      toolName: string;
      params: any;
    };
  }): Promise<ApiResponse<{
    response: string;
    intent?: string;
    form?: any;
    actionCard?: any;
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
    verifiedData?: any;
    pendingAction?: any;
    reply?: string;
    text?: string;
    parsedExpense?: any;
  }>> => {
    const res = await request('/api/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (res.status === 200 && res.data) {
      return res;
    }

    // Direct local fallback if backend network is temporarily unreachable
    const text = (data.message || '').trim();
    const amountMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rs|k)?/i);
    let amount: number | undefined;
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    let paymentMethod = 'UPI';
    if (/cash/i.test(text)) paymentMethod = 'Cash';
    else if (/credit/i.test(text)) paymentMethod = 'Credit Card';
    else if (/debit/i.test(text)) paymentMethod = 'Debit Card';

    // Match real category from local database
    let category = 'Others';
    let categoryId: string | undefined;
    try {
      const localCats = await db.categories.getAll();
      const cleanLower = text.toLowerCase();

      if (/petrol|fuel|diesel|uber|ola|cab|auto|flight|train/i.test(cleanLower)) {
        const found = localCats.find((c) => /travel|commute/i.test(c.name));
        if (found) { category = found.name; categoryId = found._id || found.id; }
      } else if (/coffee|starbucks|pizza|burger|dinner|lunch|breakfast|food|restaurant|swiggy|zomato/i.test(cleanLower)) {
        const found = localCats.find((c) => /food|dining/i.test(c.name));
        if (found) { category = found.name; categoryId = found._id || found.id; }
      } else if (/grocer|vegetable|milk|blinkit|zepto|instamart/i.test(cleanLower)) {
        const found = localCats.find((c) => /grocer/i.test(c.name)) || localCats.find((c) => /food|dining/i.test(c.name));
        if (found) { category = found.name; categoryId = found._id || found.id; }
      } else if (/cloth|shirt|zara|shopping|amazon|flipkart/i.test(cleanLower)) {
        const found = localCats.find((c) => /shop/i.test(c.name));
        if (found) { category = found.name; categoryId = found._id || found.id; }
      } else if (/electricity|wifi|rent|bill|recharge/i.test(cleanLower)) {
        const found = localCats.find((c) => /bill|util/i.test(c.name));
        if (found) { category = found.name; categoryId = found._id || found.id; }
      } else if (/movie|pvr|cinema|netflix|spotify/i.test(cleanLower)) {
        const found = localCats.find((c) => /entertainment/i.test(c.name));
        if (found) { category = found.name; categoryId = found._id || found.id; }
      }
    } catch (_) {}

    let parsedExpense: any = null;
    if (amount && amount > 0) {
      parsedExpense = {
        amount,
        category,
        categoryId,
        paymentMethod,
        date: new Date().toISOString(),
        title: text.slice(0, 40),
        isComplete: true,
        saved: false,
      };
    }

    let defaultReply = "I've reviewed your request.";
    if (parsedExpense) {
      defaultReply = `I detected an expense of ₹${parsedExpense.amount} for "${parsedExpense.category}" via ${parsedExpense.paymentMethod}. Tap below to confirm and save:`;
    }

    return {
      status: 200,
      data: {
        response: defaultReply,
        intent: parsedExpense ? 'expense.create' : 'general.answer',
        form: parsedExpense,
        actionCard: parsedExpense ? { type: 'expense_preview', data: parsedExpense } : null,
        pendingAction: parsedExpense ? { toolName: 'create_expense', params: parsedExpense } : null,
      },
    };
  },


  // ── Notifications ──────────────────────────────────────────────────────────
  getNotifications: async (): Promise<ApiResponse<any[]>> => {
    const res = await request('/api/notifications', { method: 'GET' });
    if (res.status === 200 && Array.isArray(res.data)) return res;

    try {
      const list = await db.notifications.getAll();
      return { status: 200, data: list };
    } catch (err: any) {
      return { status: 500, error: err.message, data: [] };
    }
  },

  markNotificationsRead: async (): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await request('/api/notifications/mark-read', { method: 'PUT' });
    if (res.status === 200) return res;

    try {
      const list = await db.notifications.getAll();
      const updated = list.map((n) => ({ ...n, isRead: true }));
      await db.notifications.saveAll(updated);
      return { status: 200, data: { success: true } };
    } catch (err: any) {
      return { status: 500, error: err.message, data: { success: false } };
    }
  },

  // ── User Profile ───────────────────────────────────────────────────────────
  getProfile: async (): Promise<ApiResponse<any>> => {
    const res = await request('/api/profile', { method: 'GET' });
    if (res.status === 200 && res.data) return res;
    return { status: 200, data: { user: cachedUser } };
  },

  updateProfile: async (data: any): Promise<ApiResponse<any>> => {
    const res = await request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (cachedUser) {
      cachedUser = { ...cachedUser, ...data };
      if (cachedToken) {
        await setStoredAuth(cachedToken, cachedUser);
      }
    }

    // Auto-create local categories and sync tiffin/split data
    try {
      if (data.autoSyncTiffin !== undefined) {
        await api.syncTiffinExpenses(Boolean(data.autoSyncTiffin));
      }
      if (data.autoSyncSplit !== undefined) {
        await api.syncSplitExpenses(Boolean(data.autoSyncSplit));
      }
    } catch (e) {
      console.warn('Local category auto-sync error:', e);
    }

    if (res.status === 200) return res;
    return { status: 200, data: { success: true, user: cachedUser } };
  },

  // ── Sync Tiffin Expenses ───────────────────────────────────────────────────
  syncTiffinExpenses: async (enabled: boolean): Promise<void> => {
    try {
      const allExpenses = await db.expenses.getAll();
      const nonTiffin = allExpenses.filter(
        (e) => !(e.syncSource === 'tiffin' || (e.category === 'Tiffin Expense' && e.syncRefId))
      );

      if (!enabled) {
        if (nonTiffin.length !== allExpenses.length) {
          await db.expenses.saveAll(nonTiffin);
          dataEvents.emit('expense_deleted', 'all_tiffin_synced');
          dataEvents.emit('category_updated');
          dataEvents.emit('refresh_data');
        }
        return;
      }

      const cats = await db.categories.getAll();
      let tiffinCat = cats.find((c) => c.name?.toLowerCase() === 'tiffin expense');
      if (!tiffinCat) {
        tiffinCat = await db.categories.insertOne({
          name: 'Tiffin Expense',
          color: '#ea580c',
          icon: 'restaurant-outline',
          isDefault: false,
        });
      }

      const groupsRes = await api.getTiffinGroups();
      const groups = (groupsRes.data && Array.isArray(groupsRes.data) && groupsRes.data.length > 0)
        ? groupsRes.data
        : await db.tiffinGroups.getAll();

      const authData = await getStoredAuth();
      const currentUser = authData.user || cachedUser;
      const currentUserId = String(currentUser?._id || currentUser?.id || '');
      const currentUserName = (currentUser?.name || '').toLowerCase().trim();
      const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();

      const newSyncedList: any[] = [];
      const seenRefIds = new Set<string>();

      for (const group of groups) {
        const gId = String(group._id || group.id);
        const gName = group.name || 'Tiffin Group';
        const members = Array.isArray(group.members) && group.members.length > 0
          ? group.members
          : [{ name: 'You' }];

        let userMemberIdx = -1;
        let userMember = members.find((m: any, idx: number) => {
          const mUserId = String(m.userId || '');
          const mMemberId = String(m._id || '');
          const mEmail = (m.email || '').toLowerCase().trim();
          const mName = (m.name || '').toLowerCase().trim();
          const match = (
            (currentUserId && (mUserId === currentUserId || mMemberId === currentUserId)) ||
            (currentUserEmail && mEmail === currentUserEmail) ||
            (currentUserName && mName === currentUserName) ||
            mName === 'you' ||
            mName === 'me' ||
            mName === 'self' ||
            (members.length === 1 && idx === 0)
          );
          if (match) {
            userMemberIdx = idx;
            return true;
          }
          return false;
        });

        if (!userMember && members.length > 0) {
          // If user is group creator, member 0 represents creator if unlinked
          const isCreator = String(group.createdBy || '') === currentUserId;
          if (isCreator || members.length <= 1) {
            userMember = members[0];
            userMemberIdx = 0;
          }
        }

        const candidateKeys = [
          userMember ? String(userMember._id || '') : '',
          userMember ? String(userMember.userId || '') : '',
          userMemberIdx >= 0 ? String(userMemberIdx) : '',
          currentUserId,
        ].filter(Boolean);

        const entriesRes = await api.getTiffinEntries(gId);
        const entries = (entriesRes.data && Array.isArray(entriesRes.data))
          ? entriesRes.data
          : await db.tiffinEntries.find((e) => String(e.groupId) === gId);

        const groupPrice = Number(group.pricePerTiffin || group.defaultPrice || 100);

        for (const entry of entries) {
          if (entry.noTiffin === true || entry.mealType === 'none') continue;
          const eId = String(entry._id || entry.id);
          const syncRef = `tiffin_${eId}_${gId}_${userMember?._id || userMemberIdx || '0'}`;

          if (seenRefIds.has(syncRef)) continue;

          const entryPrice = Number(entry.pricePerTiffin || groupPrice);
          let userBill = 0;

          // 1. Check memberBills
          if (entry.memberBills && typeof entry.memberBills === 'object') {
            for (const key of candidateKeys) {
              if (entry.memberBills[key] !== undefined) {
                const raw = entry.memberBills[key];
                const val = typeof raw === 'object' && raw !== null ? (raw.total ?? raw.amount ?? raw.base) : raw;
                const num = Number(val);
                if (!isNaN(num) && num > 0) {
                  userBill = num;
                  break;
                }
              }
            }
          }

          // 2. Web shared-split model (baseQuantity > 0 & participantMemberIds / splitMemberIds)
          if (userBill <= 0) {
            const baseQty = Math.floor(Number(entry.baseQuantity) || 0);
            const splitIds: string[] = Array.isArray(entry.participantMemberIds) && entry.participantMemberIds.length > 0
              ? entry.participantMemberIds.map(String)
              : (Array.isArray(entry.splitMemberIds) && entry.splitMemberIds.length > 0
                ? entry.splitMemberIds.map(String)
                : []);

            if (baseQty > 0 && splitIds.length > 0) {
              const uniqueSplit = [...new Set(splitIds.filter(Boolean))];
              const isInSplit = candidateKeys.some((k) => uniqueSplit.includes(k));
              if (isInSplit) {
                userBill += (baseQty * entryPrice) / uniqueSplit.length;
              }
              const extrasMap = entry.participantQuantities || entry.extras || {};
              for (const k of candidateKeys) {
                if (extrasMap[k] !== undefined) {
                  const extraCount = Math.max(0, Math.floor(Number(extrasMap[k]) || 0));
                  userBill += extraCount * entryPrice;
                  break;
                }
              }
            } else if (splitIds.length > 0) {
              const uniqueSplit = [...new Set(splitIds.filter(Boolean))];
              const isInSplit = candidateKeys.some((k) => uniqueSplit.includes(k));
              if (isInSplit) {
                const extrasMap = entry.participantQuantities || entry.extras || {};
                let qty = 1;
                for (const k of candidateKeys) {
                  if (extrasMap[k] !== undefined) {
                    qty = Math.max(1, Math.floor(Number(extrasMap[k]) || 1));
                    break;
                  }
                }
                userBill = qty * entryPrice;
              }
            } else if (Array.isArray(entry.participants) && entry.participants.length > 0) {
              const isInParticipants = entry.participants.some((p: any) => {
                const pId = String(typeof p === 'object' ? (p.memberId || p._id || p.userId) : p);
                return candidateKeys.includes(pId);
              });
              if (isInParticipants) {
                const total = Number(entry.totalCost ?? entry.totalPrice ?? (entryPrice * entry.participants.length));
                userBill = total / entry.participants.length;
              }
            } else if (members.length > 1) {
              // Group-wide split across all members (never give 100% to creator when members exist)
              const total = Number(entry.totalCost ?? entry.totalPrice ?? (entryPrice * (entry.quantity || entry.count || 1)));
              userBill = total / members.length;
            } else if (members.length <= 1) {
              userBill = Number(entry.totalCost ?? entry.totalPrice ?? entryPrice);
            }
          }

          if (userBill > 0) {
            const mealName = entry.mealType || 'Meal';
            const formattedMeal = mealName.charAt(0).toUpperCase() + mealName.slice(1);
            const roundedAmount = Math.round(userBill * 100) / 100;
            const newExp = {
              _id: `tiffin_exp_${eId}_${userMember?._id || userMemberIdx || '0'}`,
              title: `Tiffin: ${formattedMeal} (${gName})`,
              amount: roundedAmount,
              category: 'Tiffin Expense',
              categoryId: tiffinCat?._id || tiffinCat?.id,
              date: entry.date || entry.createdAt || new Date().toISOString(),
              paymentMethod: 'Tiffin Tracker',
              notes: `Group: ${gName} · Share: ₹${roundedAmount}${entry.notes ? ` · ${entry.notes}` : ''}`,
              syncSource: 'tiffin',
              syncRefId: syncRef,
              groupName: gName,
              groupId: gId,
              mealType: formattedMeal,
              quantity: entry.quantity || entry.count || 1,
            };

            newSyncedList.push(newExp);
            seenRefIds.add(syncRef);
          }
        }
      }

      // Don't double-count meals the server already recorded in the tracker:
      // legacy backfill rows carry no syncRefId but the same title + day.
      const coveredTiffinKeys = new Set(
        nonTiffin
          .filter((e) => e.category === 'Tiffin Expense' || /^Tiffin:/i.test(e.title || ''))
          .map((e) => `${e.title}::${dateKeyOf(e.date || e.createdAt)}`)
      );
      const derivedRows = newSyncedList.filter(
        (e) => !coveredTiffinKeys.has(`${e.title}::${dateKeyOf(e.date)}`)
      );

      // Save non-tiffin + newly calculated split tiffin items
      const finalExpenses = [...nonTiffin, ...derivedRows];
      finalExpenses.sort(
        (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
      );
      await db.expenses.saveAll(finalExpenses);

      if (newSyncedList.length > 0) {
        dataEvents.emit('expense_added', newSyncedList[0]);
      }
      dataEvents.emit('category_updated');
      dataEvents.emit('refresh_data');
    } catch (err) {
      console.error('[syncTiffinExpenses] Error:', err);
    }
  },


  // ── Sync Split Expenses (Supports multiple groups) ──────────────────────────
  syncSplitExpenses: async (enabled: boolean): Promise<void> => {
    try {
      const allExpenses = await db.expenses.getAll();
      if (!enabled) {
        const remaining = allExpenses.filter(
          (e) => !(e.syncSource === 'split' || (e.category === 'Split Expense' && e.syncRefId))
        );
        if (remaining.length !== allExpenses.length) {
          await db.expenses.saveAll(remaining);
          dataEvents.emit('expense_deleted', 'all_split_synced');
          dataEvents.emit('category_updated');
        }
        return;
      }

      const cats = await db.categories.getAll();
      let splitCat = cats.find((c) => c.name?.toLowerCase() === 'split expense');
      if (!splitCat) {
        splitCat = await db.categories.insertOne({
          name: 'Split Expense',
          color: '#8b5cf6',
          icon: 'people-outline',
          isDefault: false,
        });
      }

      const groupsRes = await api.getSplitGroups();
      const groups = (groupsRes.data && Array.isArray(groupsRes.data) && groupsRes.data.length > 0)
        ? groupsRes.data
        : await db.splitGroups.getAll();

      const currentUser = cachedUser || (await getStoredAuth()).user;
      const currentUserId = String(currentUser?._id || currentUser?.id || '');
      const currentUserName = (currentUser?.name || '').toLowerCase().trim();
      const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();

      let hasNewSync = false;
      const currentExpenses = await db.expenses.getAll();
      const existingRefIds = new Set(
        currentExpenses.map((e) => e.syncRefId).filter(Boolean)
      );

      for (const group of groups) {
        const gId = String(group._id || group.id);
        const gName = group.name || 'Split Group';
        const members = Array.isArray(group.members) ? group.members : [];

        const userMember = members.find((m: any) => {
          const mUserId = String(m.userId || m._id || '');
          const mEmail = (m.email || '').toLowerCase().trim();
          const mName = (m.name || '').toLowerCase().trim();
          return (
            (currentUserId && mUserId === currentUserId) ||
            (currentUserEmail && mEmail === currentUserEmail) ||
            (currentUserName && (mName === currentUserName || mName === 'you' || mName === 'me'))
          );
        });

        const userBelongs = userMember || String(group.createdBy || '') === currentUserId || members.length <= 1;
        if (!userBelongs) continue;

        const userMemberId = userMember ? String(userMember.userId || userMember._id || '') : currentUserId;

        const expensesRes = await api.getSplitExpenses(gId);
        const splitList = (expensesRes.data && Array.isArray(expensesRes.data))
          ? expensesRes.data
          : await db.splitExpenses.find((e) => String(e.groupId) === gId);

        for (const exp of splitList) {
          const expId = String(exp._id || exp.id);
          const syncRef = `split_${expId}_${gId}`;

          if (existingRefIds.has(syncRef)) continue;

          let userShare = 0;
          if (Array.isArray(exp.splitBetween) && exp.splitBetween.length > 0) {
            const mySplit = exp.splitBetween.find((s: any) => {
              const sUserId = String(s.userId || s._id || '');
              const sEmail = (s.email || '').toLowerCase().trim();
              const sName = (s.name || '').toLowerCase().trim();
              return (
                (userMemberId && sUserId === userMemberId) ||
                (currentUserId && sUserId === currentUserId) ||
                (currentUserEmail && sEmail === currentUserEmail) ||
                (currentUserName && (sName === currentUserName || sName === 'you' || sName === 'me'))
              );
            });

            if (mySplit && mySplit.amount !== undefined) {
              userShare = Number(mySplit.amount);
            } else {
              userShare = Math.round((Number(exp.amount) / exp.splitBetween.length) * 100) / 100;
            }
          } else {
            const memberCount = Math.max(members.length, 1);
            userShare = Math.round((Number(exp.amount) / memberCount) * 100) / 100;
          }

          if (userShare > 0) {
            const expTitle = exp.description || exp.title || 'Shared Bill';
            const isPayer = String(exp.paidBy || '') === currentUserId || String(exp.paidBy || '') === userMemberId;
            const newExp = {
              _id: `split_exp_${expId}`,
              title: `Split: ${expTitle} (${gName})`,
              amount: userShare,
              category: 'Split Expense',
              categoryId: splitCat?._id || splitCat?.id,
              date: exp.date || exp.createdAt || new Date().toISOString(),
              paymentMethod: isPayer ? 'Paid by You' : 'Split Share',
              notes: `Group: ${gName} · Total bill: ₹${Number(exp.amount || userShare).toLocaleString()}${exp.description ? ` · ${exp.description}` : ''}`,
              syncSource: 'split',
              syncRefId: syncRef,
              groupName: gName,
              groupId: gId,
              totalBill: exp.amount,
              paidBy: exp.paidBy,
            };

            await db.expenses.insertOne(newExp);
            existingRefIds.add(syncRef);
            hasNewSync = true;
          }
        }
      }

      if (hasNewSync) {
        dataEvents.emit('expense_added');
        dataEvents.emit('category_updated');
      }
    } catch (err) {
      console.error('[syncSplitExpenses] Error:', err);
    }
  },

  // ── Reset Data ─────────────────────────────────────────────────────────────
  resetData: async (scope: 'expenses' | 'all' = 'expenses'): Promise<ApiResponse<any>> => {
    const res = await request('/api/profile/reset-data', {
      method: 'POST',
      body: JSON.stringify({ scope }),
    });

    try {
      await db.expenses.saveAll([]);
      await db.budgets.saveAll([]);
      await db.recurring.saveAll([]);
      await db.incomes.saveAll([]);

      const defaults = [
        { _id: createObjectId(), name: 'Food & Dining', color: '#A78BFA', icon: 'fast-food-outline', isDefault: true },
        { _id: createObjectId(), name: 'Shopping', color: '#84CC16', icon: 'cart-outline', isDefault: true },
        { _id: createObjectId(), name: 'Travel & Commute', color: '#38BDF8', icon: 'car-outline', isDefault: true },
        { _id: createObjectId(), name: 'Bills & Utilities', color: '#F59E0B', icon: 'flash-outline', isDefault: true },
        { _id: createObjectId(), name: 'Entertainment', color: '#F472B6', icon: 'film-outline', isDefault: true },
        { _id: createObjectId(), name: 'Others', color: '#9CA3AF', icon: 'ellipsis-horizontal-outline', isDefault: true },
      ];
      await db.categories.saveAll(defaults);

      if (scope === 'all') {
        await db.tiffinGroups.saveAll([]);
        await db.tiffinEntries.saveAll([]);
        await db.splitGroups.saveAll([]);
        await db.splitExpenses.saveAll([]);
      }

      try {
        const { clearAllDetectedTransactions } = require('./smsTransactionStore');
        if (typeof clearAllDetectedTransactions === 'function') {
          await clearAllDetectedTransactions();
        }
      } catch (_) {}

      dataEvents.emit('expense_deleted', 'all');
      dataEvents.emit('category_updated');
      dataEvents.emit('refresh_data');
    } catch (localErr) {
      console.error('Local reset error:', localErr);
    }

    if (res.status === 200) return res;
    return { status: 200, data: { success: true, message: 'Data reset successfully' } };
  },

  // ── Unified Complete User Account Sync ─────────────────────────────────────
  syncUserData: async (options?: { force?: boolean }): Promise<{ success: boolean; stats?: any }> => {
    try {
      const auth = await getStoredAuth();
      if (!auth.token) {
        return { success: false, stats: { reason: 'No auth token found' } };
      }

      // Fetch all domain data from server concurrently
      const [
        resExpenses,
        resCategories,
        resBudgets,
        resRecurring,
        resIncomeHistory,
        resSplitGroups,
        resTiffinGroups,
        resNotifications,
      ] = await Promise.all([
        request('/api/expenses?limit=5000&sortBy=date&sortOrder=desc', { method: 'GET' }),
        request('/api/categories', { method: 'GET' }),
        request('/api/budgets', { method: 'GET' }),
        request('/api/recurring', { method: 'GET' }),
        request('/api/income/history', { method: 'GET' }),
        request('/api/split/groups', { method: 'GET' }),
        request('/api/tiffin/groups', { method: 'GET' }),
        request('/api/notifications', { method: 'GET' }),
      ]);

      const stats: any = {};

      // 1. Categories
      if (resCategories.status === 200 && Array.isArray(resCategories.data) && resCategories.data.length > 0) {
        await db.categories.saveAll(resCategories.data);
        stats.categories = resCategories.data.length;
      }

      // 2. Expenses (purge demo seeds and merge local unpersisted/offline transactions)
      if (resExpenses.status === 200 && Array.isArray(resExpenses.data)) {
        const localCurrent = await db.expenses.getAll();
        const nonSeedLocal = localCurrent.filter(
          (e) => !e.isSeed && !/^(Starbucks Coffee & Snacks|Uber to Office|D-Mart Monthly Groceries|Wi-Fi Fiber Broadband|Zara Casual Shirts)$/i.test(e.title || '')
        );
        const localPending = nonSeedLocal.filter(
          (e) => e.syncSource === 'tiffin' || e.syncSource === 'split' || e.syncSource === 'sms_auto' || e.isOfflinePending
        );
        // Drop derived rows the server already carries (double-count guard)
        const dedupedPending = dropRowsDuplicatedByServer(localPending, resExpenses.data);
        const serverIds = new Set(resExpenses.data.map((e: any) => e._id || e.id));

        const merged = [...resExpenses.data];
        for (const lp of dedupedPending) {
          if (!serverIds.has(lp._id || lp.id)) {
            merged.push(lp);
          }
        }
        merged.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
        await db.expenses.saveAll(merged);
        stats.expenses = merged.length;
      }

      // 3. Budgets
      if (resBudgets.status === 200 && Array.isArray(resBudgets.data)) {
        await db.budgets.saveAll(resBudgets.data);
        stats.budgets = resBudgets.data.length;
      }

      // 4. Recurring
      if (resRecurring.status === 200 && Array.isArray(resRecurring.data)) {
        await db.recurring.saveAll(resRecurring.data);
        stats.recurring = resRecurring.data.length;
      }

      // 5. Incomes
      if (resIncomeHistory.status === 200 && Array.isArray(resIncomeHistory.data)) {
        await db.incomes.saveAll(resIncomeHistory.data);
        stats.incomes = resIncomeHistory.data.length;
      }

      // 6. Split Groups
      if (resSplitGroups.status === 200 && Array.isArray(resSplitGroups.data)) {
        await db.splitGroups.saveAll(resSplitGroups.data);
        stats.splitGroups = resSplitGroups.data.length;
      }

      // 7. Tiffin Groups
      if (resTiffinGroups.status === 200 && Array.isArray(resTiffinGroups.data)) {
        const formatted = resTiffinGroups.data.map((g: any) => ({
          ...g,
          inviteCode: g.inviteCode && /^\d{4}$/.test(String(g.inviteCode)) ? String(g.inviteCode) : getStaticGroupCode(g),
        }));
        await db.tiffinGroups.saveAll(formatted);
        stats.tiffinGroups = formatted.length;
      }

      // 8. Notifications
      if (resNotifications.status === 200 && Array.isArray(resNotifications.data)) {
        await db.notifications.saveAll(resNotifications.data);
        stats.notifications = resNotifications.data.length;
      }

      // Replay tiffin meals that were logged while the server was unreachable
      try {
        await replayPendingTiffinWrites();
      } catch (replayErr) {
        console.warn('[syncUserData] pending tiffin replay error:', replayErr);
      }

      // Emit instant notifications so all screens update
      dataEvents.emit('refresh_data');
      dataEvents.emit('category_updated');
      dataEvents.emit('expenses_synced');

      return { success: true, stats };
    } catch (err: any) {
      console.error('[syncUserData] Critical error during user sync:', err);
      return { success: false, stats: { error: err.message || 'Sync failed' } };
    }
  },

  // ── Clear Local User Cache on Logout ───────────────────────────────────────
  clearLocalUserCache: async (): Promise<void> => {
    try {
      clearAllMongoCollections();
      await db.expenses.saveAll([]);
      await db.budgets.saveAll([]);
      await db.recurring.saveAll([]);
      await db.incomes.saveAll([]);
      await db.splitGroups.saveAll([]);
      await db.splitExpenses.saveAll([]);
      await db.tiffinGroups.saveAll([]);
      await db.tiffinEntries.saveAll([]);
      await db.notifications.saveAll([]);
    } catch (err) {
      console.error('[clearLocalUserCache] Error:', err);
    }
  },
};
