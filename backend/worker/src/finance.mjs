import {
  deleteDocument,
  deleteDocuments,
  findByLookup,
  getDocument,
  insertDocument,
  listDocuments,
  listMemberGroups,
  saveDocument,
} from './db.mjs';
import { HttpError } from './errors.mjs';
import { json, protectedUser, readJson, routeMatch } from './http.mjs';

const defaultCategories = [
  { name: 'Food & Dining', limit: 8000, color: '#A78BFA', icon: 'fast-food-outline' },
  { name: 'Shopping', limit: 5000, color: '#84CC16', icon: 'cart-outline' },
  { name: 'Travel & Commute', limit: 4000, color: '#38BDF8', icon: 'car-outline' },
  { name: 'Bills & Utilities', limit: 6000, color: '#F59E0B', icon: 'flash-outline' },
  { name: 'Entertainment', limit: 3000, color: '#F472B6', icon: 'film-outline' },
  { name: 'Others', limit: 3000, color: '#9CA3AF', icon: 'ellipsis-horizontal-outline' },
];

const round2 = (value) => Math.round(Number(value) * 100) / 100;
const startOfMonth = (year, month) => new Date(year, month - 1, 1);
const endOfMonth = (year, month) => new Date(year, month, 1);

async function seedCategories(env, userId) {
  const found = await listDocuments(env, 'categories', { ownerId: userId });
  if (found.length) return found;
  const seeded = [];
  for (const category of defaultCategories) {
    seeded.push(await insertDocument(env, 'categories', {
      ...category,
      userId,
      isDefault: true,
    }));
  }
  return seeded;
}

async function getCategory(env, userId, categoryId) {
  if (!categoryId) return null;
  const category = await getDocument(env, 'categories', categoryId);
  return category?.userId === userId ? category : null;
}

async function processRecurring(env, userId) {
  const now = new Date();
  const recurring = await listDocuments(env, 'recurring', { ownerId: userId });
  for (const item of recurring) {
    if (!item.active) continue;
    let due = new Date(item.nextDueDate || item.startDate || now);
    if (Number.isNaN(due.getTime()) || due > now) continue;

    const key = `recurring:${item._id}:${due.toISOString().slice(0, 10)}`;
    if (!await findByLookup(env, 'expenses', key)) {
      const expense = await insertDocument(env, 'expenses', {
        userId,
        title: item.title,
        amount: Number(item.amount),
        category: item.category || 'Subscriptions',
        categoryId: item.categoryId || null,
        date: due.toISOString(),
        paymentMethod: 'Auto-Debit',
        notes: `Auto-generated subscription for ${item.title}`,
        isRecurring: true,
        recurringId: item._id,
      });
      await updateBudgetForExpense(env, expense);
    }

    const frequency = item.frequency || 'monthly';
    const nextDue = (date) => {
      const next = new Date(date);
      if (frequency === 'daily') next.setDate(next.getDate() + 1);
      else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
      else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
      else next.setMonth(next.getMonth() + 1);
      return next;
    };
    let next = nextDue(due);
    while (next <= now) next = nextDue(next);
    item.nextDueDate = next.toISOString();
    item.lastProcessedDate = now.toISOString();
    await saveDocument(env, 'recurring', item);
  }
}

async function updateBudgetForExpense(env, expense) {
  if (!expense.categoryId) return;
  const date = new Date(expense.date || Date.now());
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const lookup = `${expense.categoryId}:${month}`;
  const current = await findByLookup(env, 'budgets', lookup);
  if (current) {
    current.spent = Number(current.spent || 0) + Number(expense.amount || 0);
    await saveDocument(env, 'budgets', current);
  } else {
    await insertDocument(env, 'budgets', {
      userId: expense.userId,
      categoryId: expense.categoryId,
      month,
      spent: Number(expense.amount || 0),
      limit: 5000,
    });
  }
}

async function expenseList(request, env, user) {
  await processRecurring(env, user.id);
  const url = new URL(request.url);
  const params = url.searchParams;
  const month = params.get('month');
  let startMs;
  let endMs;
  if (month && month !== 'all' && /^\d{4}-\d{2}$/.test(month)) {
    const [year, value] = month.split('-').map(Number);
    startMs = startOfMonth(year, value).getTime();
    endMs = endOfMonth(year, value).getTime();
  }
  let expenses = await listDocuments(env, 'expenses', {
    ownerId: user.id,
    startMs,
    endMs,
    limit: Math.min(Math.max(parseInt(params.get('limit') || '150', 10) || 150, 1), 5000),
  });

  const categoryName = params.get('category');
  const search = params.get('search')?.toLowerCase();
  const categories = await listDocuments(env, 'categories', { ownerId: user.id });
  const categoriesById = new Map(categories.map((category) => [category._id, category]));
  if (categoryName && categoryName !== 'All') {
    const expected = categoryName.trim().toLowerCase();
    expenses = expenses.filter((expense) => {
      const category = categoriesById.get(String(expense.categoryId));
      return String(expense.category || '').toLowerCase() === expected ||
        String(category?.name || '').toLowerCase() === expected;
    });
  }
  if (search) expenses = expenses.filter((expense) => String(expense.title || '').toLowerCase().includes(search));

  const sortBy = ['date', 'title', 'amount', 'createdAt'].includes(params.get('sortBy'))
    ? params.get('sortBy')
    : 'date';
  const direction = params.get('sortOrder') === 'asc' ? 1 : -1;
  expenses.sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (sortBy === 'amount') return direction * ((Number(left) || 0) - (Number(right) || 0));
    if (sortBy === 'date' || sortBy === 'createdAt') {
      return direction * ((Date.parse(left || '') || 0) - (Date.parse(right || '') || 0));
    }
    return direction * String(left || '').localeCompare(String(right || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return expenses.map((expense) => {
    const categoryDetails = categoriesById.get(String(expense.categoryId));
    const category = (!expense.category || expense.category === 'Others') && categoryDetails?.name
      ? categoryDetails.name
      : expense.category || 'Others';
    return {
      ...expense,
      category,
      categoryId: categoryDetails ? categoryDetails._id : expense.categoryId,
      ...(categoryDetails ? { categoryDetails } : {}),
    };
  });
}

async function addExpense(env, userId, body) {
  const { title, amount, category, categoryId, paymentMethod, date, notes, location } = body;
  const parsedAmount = Number.parseFloat(amount);
  if (!title || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new HttpError(400, 'Title and a positive amount are required');
  }
  const expenseDate = date ? new Date(date) : new Date();
  if (Number.isNaN(expenseDate.getTime())) throw new HttpError(400, 'Expense date is invalid');

  let resolvedId = categoryId || null;
  let resolvedName = category || '';
  if (resolvedId) {
    const existing = await getCategory(env, userId, resolvedId);
    if (existing) resolvedName = existing.name;
    else resolvedId = null;
  }
  if (!resolvedId && resolvedName) {
    let matching = (await listDocuments(env, 'categories', { ownerId: userId }))
      .find((item) => item.name?.trim().toLowerCase() === resolvedName.trim().toLowerCase());
    if (!matching) {
      matching = await insertDocument(env, 'categories', {
        userId,
        name: resolvedName.trim(),
        limit: 5000,
        monthlyLimit: 5000,
        color: '#0D9488',
        icon: 'LayoutGrid',
      });
    }
    resolvedId = matching._id;
    resolvedName = matching.name;
  }
  if (!resolvedName) resolvedName = 'Others';

  const expense = await insertDocument(env, 'expenses', {
    userId,
    title,
    amount: parsedAmount,
    categoryId: resolvedId,
    category: resolvedName,
    paymentMethod: paymentMethod || 'UPI',
    date: expenseDate.toISOString(),
    notes: notes || '',
    location: location || '',
  });
  await updateBudgetForExpense(env, expense);
  return expense;
}

async function deleteOwnerKind(env, kinds, userId) {
  for (const kind of kinds) await deleteDocuments(env, kind, userId);
}

async function resetUserData(env, userId, scope) {
  await deleteOwnerKind(env, ['expenses', 'budgets', 'recurring', 'income', 'categories'], userId);
  await seedCategories(env, userId);
  if (scope === 'all') {
    await deleteOwnerKind(env, ['tiffin_groups', 'tiffin_entries', 'split_groups', 'split_expenses'], userId);
  }
}

async function handleCategories(request, env, user, pathname) {
  const method = request.method.toUpperCase();
  if (pathname === '/api/categories' && method === 'GET') return json(await seedCategories(env, user.id));
  if (pathname === '/api/categories' && method === 'POST') {
    const body = await readJson(request);
    if (!body.name) throw new HttpError(400, 'Category name is required');
    return json(await insertDocument(env, 'categories', {
      userId: user.id,
      name: body.name,
      limit: body.limit || 5000,
      warningThreshold: body.warningThreshold || 80,
      criticalThreshold: body.criticalThreshold || 95,
      color: body.color || '#A78BFA',
      icon: body.icon || 'fast-food-outline',
    }), 201);
  }

  const id = routeMatch(pathname, /^\/api\/categories\/([^/]+)$/)?.[0];
  if (!id) return null;
  const body = method === 'PUT' ? await readJson(request) : {};
  const categories = await listDocuments(env, 'categories', { ownerId: user.id });
  let category = categories.find((item) => item._id === id || item.name === id || item.name === body.previousName);
  if (method === 'PUT') {
    if (!category) {
      category = await insertDocument(env, 'categories', {
        userId: user.id,
        name: body.name || 'New Category',
        limit: body.limit || body.monthlyLimit || 5000,
        color: body.color || '#0D9488',
        icon: body.icon || 'Food & Dining',
      });
    } else {
      if (body.name) category.name = body.name;
      if (body.limit || body.monthlyLimit) category.limit = body.limit || body.monthlyLimit;
      for (const field of ['warningThreshold', 'criticalThreshold', 'color', 'icon']) {
        if (body[field] !== undefined) category[field] = body[field];
      }
      category = await saveDocument(env, 'categories', category);
    }
    return json(category);
  }
  if (method === 'DELETE') {
    if (category) await deleteDocument(env, 'categories', category._id, user.id);
    return json({ success: true, message: 'Category deleted' });
  }
  return null;
}

async function handleExpenses(request, env, user, pathname) {
  const method = request.method.toUpperCase();
  if (pathname === '/api/expenses' && method === 'GET') {
    return json(await expenseList(request, env, user));
  }
  if (pathname === '/api/expenses' && method === 'POST') {
    return json(await addExpense(env, user.id, await readJson(request)), 201);
  }
  if (pathname === '/api/expenses/reset' && method === 'DELETE') {
    await deleteOwnerKind(env, ['expenses', 'budgets'], user.id);
    return json({ success: true, message: 'All expenses and budgets have been reset successfully' });
  }

  const id = routeMatch(pathname, /^\/api\/expenses\/([^/]+)$/)?.[0];
  if (!id) return null;
  if (method === 'PUT') {
    const expense = await getDocument(env, 'expenses', id);
    if (!expense || expense.userId !== user.id) throw new HttpError(404, 'Expense not found');
    const body = await readJson(request);
    const updated = { ...expense, ...body, _id: id, userId: user.id };
    if (body.amount !== undefined) {
      updated.amount = Number.parseFloat(body.amount);
      if (!Number.isFinite(updated.amount) || updated.amount <= 0) {
        throw new HttpError(400, 'Amount must be a positive number');
      }
    }
    if (body.date !== undefined) {
      const date = new Date(body.date);
      if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Expense date is invalid');
      updated.date = date.toISOString();
    }
    if (body.categoryId !== undefined) {
      const category = await getCategory(env, user.id, body.categoryId);
      updated.categoryId = category?._id || null;
      if (category) updated.category = category.name;
    }
    const saved = await saveDocument(env, 'expenses', updated);
    return json(saved);
  }
  if (method === 'DELETE') {
    const deleted = await deleteDocument(env, 'expenses', id, user.id);
    if (!deleted) throw new HttpError(404, 'Expense not found');
    return json({ success: true, message: 'Expense deleted' });
  }
  return null;
}

async function handleIncome(request, env, user, pathname) {
  const method = request.method.toUpperCase();
  if (method === 'GET' && pathname === '/api/income/history') {
    return json(await listDocuments(env, 'income', { ownerId: user.id }));
  }
  if (method === 'GET' && pathname === '/api/income') {
    const now = new Date();
    const start = startOfMonth(now.getFullYear(), now.getMonth() + 1);
    const end = endOfMonth(now.getFullYear(), now.getMonth() + 1);
    const [expenses, incomes] = await Promise.all([
      listDocuments(env, 'expenses', { ownerId: user.id, startMs: start.getTime(), endMs: end.getTime() }),
      listDocuments(env, 'income', { ownerId: user.id, startMs: start.getTime(), endMs: end.getTime() }),
    ]);
    const week = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date();
      day.setDate(day.getDate() - offset);
      const date = day.toISOString().slice(0, 10);
      const matchesDate = (row) => String(row.date || '').slice(0, 10) === date;
      week.push({
        date,
        expense: expenses.filter(matchesDate).reduce((sum, item) => sum + Number(item.amount || 0), 0),
        income: incomes.filter(matchesDate).reduce((sum, item) => sum + Number(item.amount || 0), 0),
      });
    }
    return json({
      monthExpense: expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      monthIncome: incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      week,
    });
  }
  if (method === 'POST' && pathname === '/api/income') {
    const body = await readJson(request);
    if (!body.amount) throw new HttpError(400, 'Amount is required');
    const date = body.date ? new Date(body.date) : new Date();
    if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Income date is invalid');
    return json(await insertDocument(env, 'income', {
      userId: user.id,
      amount: Number.parseFloat(body.amount),
      source: body.source || 'Salary',
      date: date.toISOString(),
      note: body.note || '',
    }), 201);
  }
  return null;
}

async function handleBudgets(request, env, user, pathname) {
  if (request.method !== 'GET' || pathname !== '/api/budgets') return null;
  const url = new URL(request.url);
  const current = new Date();
  const month = url.searchParams.get('month') ||
    `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
  const monthParts = /^(\d{4})-(\d{2})$/.exec(month);
  if (!monthParts || Number(monthParts[2]) < 1 || Number(monthParts[2]) > 12) {
    throw new HttpError(400, 'Month must use YYYY-MM format');
  }
  const year = Number(monthParts[1]);
  const monthNumber = Number(monthParts[2]);
  const [budgets, categories, expenses] = await Promise.all([
    listDocuments(env, 'budgets', { ownerId: user.id }),
    listDocuments(env, 'categories', { ownerId: user.id }),
    listDocuments(env, 'expenses', {
      ownerId: user.id,
      startMs: startOfMonth(year, monthNumber).getTime(),
      endMs: endOfMonth(year, monthNumber).getTime(),
    }),
  ]);
  const byId = new Map(categories.map((item) => [item._id, item]));
  const spentByCategory = new Map();
  for (const expense of expenses) {
    const categoryId = String(expense.categoryId || '');
    if (categoryId) {
      spentByCategory.set(
        categoryId,
        round2((spentByCategory.get(categoryId) || 0) + Number(expense.amount || 0))
      );
    }
  }
  return json(budgets.filter((budget) => budget.month === month).map((budget) => ({
    ...budget,
    spent: spentByCategory.get(String(budget.categoryId)) || 0,
    categoryId: byId.get(String(budget.categoryId)) || budget.categoryId,
  })));
}

function nextRecurringDate(fromDate, frequency) {
  const date = new Date(fromDate);
  if (frequency === 'daily') date.setDate(date.getDate() + 1);
  else if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date;
}

async function handleRecurring(request, env, user, pathname) {
  const method = request.method.toUpperCase();
  if (pathname === '/api/recurring' && method === 'GET') {
    await processRecurring(env, user.id);
    return json(await listDocuments(env, 'recurring', { ownerId: user.id }));
  }
  if (pathname === '/api/recurring' && method === 'POST') {
    const body = await readJson(request);
    if (!body.title || !body.amount) throw new HttpError(400, 'Title and amount are required');
    const start = body.startDate ? new Date(body.startDate) : new Date();
    if (Number.isNaN(start.getTime())) throw new HttpError(400, 'Start date is invalid');
    const frequency = body.frequency || 'monthly';
    const item = await insertDocument(env, 'recurring', {
      userId: user.id,
      title: String(body.title).trim(),
      amount: Number.parseFloat(body.amount),
      category: body.category || 'Subscriptions',
      categoryId: body.categoryId || null,
      frequency,
      startDate: start.toISOString(),
      nextDueDate: nextRecurringDate(start, frequency).toISOString(),
      active: body.active !== false,
      autoCreate: true,
    });
    if (start <= new Date() && item.active) {
      const expense = await insertDocument(env, 'expenses', {
        userId: user.id,
        title: item.title,
        amount: item.amount,
        category: item.category,
        categoryId: item.categoryId,
        date: start.toISOString(),
        paymentMethod: 'Auto-Debit',
        notes: `Initial subscription payment for ${item.title}`,
        isRecurring: true,
        recurringId: item._id,
      });
      await updateBudgetForExpense(env, expense);
      item.lastProcessedDate = new Date().toISOString();
      await saveDocument(env, 'recurring', item);
    }
    return json(item, 201);
  }

  const match = routeMatch(pathname, /^\/api\/recurring\/([^/]+)(?:\/(run-now))?$/);
  if (!match) return null;
  const [id, action] = match;
  const item = await getDocument(env, 'recurring', id);
  if (!item || item.userId !== user.id) throw new HttpError(404, 'Subscription not found');

  if (method === 'PATCH' && !action) {
    const body = await readJson(request);
    if (body.title !== undefined) item.title = String(body.title).trim();
    if (body.amount !== undefined) item.amount = Number.parseFloat(body.amount);
    if (body.category !== undefined) item.category = body.category;
    if (body.categoryId !== undefined) item.categoryId = body.categoryId;
    if (body.frequency !== undefined) {
      item.frequency = body.frequency;
      item.nextDueDate = nextRecurringDate(new Date(), body.frequency).toISOString();
    }
    if (body.active !== undefined) item.active = body.active;
    return json(await saveDocument(env, 'recurring', item));
  }
  if (method === 'POST' && action === 'run-now') {
    const now = new Date();
    const expense = await insertDocument(env, 'expenses', {
      userId: user.id,
      title: item.title,
      amount: item.amount,
      category: item.category || 'Subscriptions',
      categoryId: item.categoryId,
      date: now.toISOString(),
      paymentMethod: 'Auto-Debit',
      notes: `Subscription payment logged for ${item.title}`,
      isRecurring: true,
      recurringId: item._id,
    });
    await updateBudgetForExpense(env, expense);
    item.lastProcessedDate = now.toISOString();
    item.nextDueDate = nextRecurringDate(now, item.frequency).toISOString();
    return json({ success: true, message: 'Expense created successfully', expense, recurring: await saveDocument(env, 'recurring', item) });
  }
  if (method === 'DELETE' && !action) {
    await deleteDocument(env, 'recurring', id, user.id);
    return json({ success: true, message: 'Recurring expense deleted' });
  }
  return null;
}

async function handleNotifications(request, env, user, pathname) {
  const method = request.method.toUpperCase();
  if (method === 'GET' && pathname === '/api/notifications') {
    let notifications = await listDocuments(env, 'notifications', { ownerId: user.id, limit: 30 });
    if (notifications.length === 0) {
      notifications = [await insertDocument(env, 'notifications', {
        userId: user.id,
        title: 'Welcome to XpenseFlow!',
        message: 'Your personal finance and smart expense tracker is ready to use.',
        type: 'info',
        isRead: false,
      })];
    }
    return json(notifications);
  }
  if (method === 'PUT' && ['/api/notifications', '/api/notifications/mark-read'].includes(pathname)) {
    const notifications = await listDocuments(env, 'notifications', { ownerId: user.id });
    for (const notification of notifications) {
      notification.isRead = true;
      await saveDocument(env, 'notifications', notification);
    }
    return json({ success: true });
  }
  return null;
}

async function syncTiffinExpenses(env, user, enabled) {
  const groups = await listMemberGroups(env, 'tiffin_groups', user.id, user.email);
  const userEmail = user.email.toLowerCase();
  if (!enabled) {
    const expenses = await listDocuments(env, 'expenses', { ownerId: user.id });
    for (const expense of expenses.filter((item) => item.syncSource === 'tiffin')) {
      await deleteDocument(env, 'expenses', expense._id, user.id);
    }
    return;
  }

  let category = (await listDocuments(env, 'categories', { ownerId: user.id }))
    .find((item) => item.name === 'Tiffin Expense');
  if (!category) {
    category = await insertDocument(env, 'categories', {
      userId: user.id,
      name: 'Tiffin Expense',
      limit: 5000,
      color: '#ea580c',
      icon: 'restaurant-outline',
      isDefault: false,
    });
  }
  for (const group of groups) {
    const entries = await listDocuments(env, 'tiffin_entries', { groupId: group._id });
    const member = (group.members || []).find((item) =>
      String(item.userId || '') === user.id ||
      String(item.email || '').toLowerCase() === userEmail
    );
    const memberId = String(member?._id || member?.userId || user.id);
    for (const entry of entries.filter((item) => !item.noTiffin)) {
      const amount = Number(entry.memberBills?.[memberId] ?? entry.memberBills?.[user.id] ?? 0);
      if (amount <= 0) continue;
      const syncRefId = `tiffin_${entry._id}_${group._id}_${memberId}`;
      const existing = await findByLookup(env, 'expenses', `sync:${syncRefId}`);
      const document = {
        ...(existing || {}),
        userId: user.id,
        title: `Tiffin: ${(entry.mealType || 'Meal').replace(/^./, (letter) => letter.toUpperCase())} (${group.name})`,
        amount: round2(amount),
        category: 'Tiffin Expense',
        categoryId: category._id,
        date: entry.date || entry.createdAt,
        paymentMethod: 'UPI',
        notes: `Group: ${group.name} · Share: ₹${amount}`,
        syncSource: 'tiffin',
        syncRefId,
      };
      if (existing) await saveDocument(env, 'expenses', document);
      else await insertDocument(env, 'expenses', document);
    }
  }
}

async function handleProfile(request, env, user, pathname) {
  const method = request.method.toUpperCase();
  if (pathname === '/api/profile' && method === 'GET') {
    const profile = await getDocument(env, 'users', user.id);
    if (!profile) throw new HttpError(404, 'User not found');
    return json({ user: profile });
  }
  if (pathname === '/api/profile' && method === 'PUT') {
    const profile = await getDocument(env, 'users', user.id);
    if (!profile) throw new HttpError(404, 'User not found');
    const body = await readJson(request);
    const allowed = ['name', 'avatar', 'isOnboarded', 'currency', 'autoSyncTiffin', 'autoSyncSplit'];
    for (const field of allowed) {
      if (body[field] !== undefined) profile[field] = body[field];
    }
    if (body.autoSyncTiffin !== undefined) await syncTiffinExpenses(env, user, Boolean(body.autoSyncTiffin));
    if (body.autoSyncSplit === false) {
      const expenses = await listDocuments(env, 'expenses', { ownerId: user.id });
      for (const expense of expenses.filter((item) => item.category === 'Split Expense' && /Auto-synced from Split Bills/.test(item.notes || ''))) {
        await deleteDocument(env, 'expenses', expense._id, user.id);
      }
    }
    const saved = await saveDocument(env, 'users', profile);
    return json({ success: true, user: saved });
  }
  if (pathname === '/api/profile/reset-data' && method === 'POST') {
    const body = await readJson(request);
    const scope = body.scope === 'all' ? 'all' : 'expenses';
    await resetUserData(env, user.id, scope);
    return json({
      success: true,
      message: scope === 'all' ? 'All workspace data reset successfully' : 'Expense tracker data reset successfully',
    });
  }
  return null;
}

export async function handleFinanceRequest(request, env, url) {
  if (!url.pathname.startsWith('/api/')) return null;
  const user = await protectedUser(request, env);
  const { pathname } = url;
  return await handleCategories(request, env, user, pathname) ||
    await handleExpenses(request, env, user, pathname) ||
    await handleIncome(request, env, user, pathname) ||
    await handleBudgets(request, env, user, pathname) ||
    await handleRecurring(request, env, user, pathname) ||
    await handleNotifications(request, env, user, pathname) ||
    await handleProfile(request, env, user, pathname);
}
