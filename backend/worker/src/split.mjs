import { getDocument, insertDocument, listDocuments, listMemberGroups, saveDocument } from './db.mjs';
import { HttpError } from './errors.mjs';
import { json, protectedUser, readJson, routeMatch } from './http.mjs';

const idString = (value) => {
  if (value && typeof value === 'object') return String(value._id ?? value.userId ?? '');
  return value == null ? '' : String(value);
};
const round2 = (value) => Math.round(Number(value) * 100) / 100;

function sharesOf(expense) {
  if (Array.isArray(expense.splits) && expense.splits.length) {
    return expense.splits.map((share) => ({
      userId: share.userId,
      amount: Number(share.shareAmount) || 0,
      status: share.status || 'unpaid',
      transactionId: share.transactionId,
    }));
  }
  return (expense.splitBetween || []).map((share) => ({
    userId: share.userId,
    amount: Number(share.amount) || 0,
    status: share.status || 'unpaid',
    transactionId: share.transactionId,
  }));
}

function equalShares(amount, memberIds) {
  if (!memberIds.length) return [];
  const totalCents = Math.round(round2(amount) * 100);
  const baseCents = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - baseCents * memberIds.length;
  return memberIds.map((id, index) => ({
    userId: id,
    shareAmount: (baseCents + (index < remainder ? 1 : 0)) / 100,
    status: 'unpaid',
  }));
}

async function populatedUser(env, id) {
  const user = await getDocument(env, 'users', idString(id));
  return user ? { _id: user._id, name: user.name, avatar: user.avatar || '' } : id;
}

async function mobileExpense(env, expense, groupName) {
  const title = expense.title || expense.description || 'Shared Expense';
  const shares = sharesOf(expense);
  const splitBetween = Array.isArray(expense.splitBetween) && expense.splitBetween.length
    ? expense.splitBetween
    : shares;
  const [paidBy, populatedSplits] = await Promise.all([
    populatedUser(env, expense.paidBy),
    Promise.all((expense.splits || []).map(async (share) => ({
      ...share,
      userId: await populatedUser(env, share.userId),
    }))),
  ]);
  const output = {
    ...expense,
    title,
    description: expense.description || title,
    paidBy,
    splitBetween,
    isSettled: expense.isSettled ?? (shares.length > 0 && shares.every((share) => share.status === 'paid')),
    date: expense.date || expense.createdAt,
  };
  if (populatedSplits.length) output.splits = populatedSplits;
  if (groupName) output.groupName = groupName;
  return output;
}

async function recomputeBalances(env, groupId) {
  const expenses = await listDocuments(env, 'split_expenses', { groupId });
  const amounts = {};
  const add = (from, to, amount) => {
    if (!from || !to || from === to) return;
    amounts[from] ||= {};
    amounts[from][to] = (amounts[from][to] || 0) + amount;
  };
  for (const expense of expenses) {
    for (const share of sharesOf(expense)) {
      if (share.status !== 'paid') add(idString(share.userId), idString(expense.paidBy), share.amount);
    }
  }
  const balances = {};
  for (const from of Object.keys(amounts)) {
    for (const to of Object.keys(amounts[from])) {
      const net = round2((amounts[from][to] || 0) - (amounts[to]?.[from] || 0));
      if (net > 0.5) {
        balances[from] = round2((balances[from] || 0) - net);
        balances[to] = round2((balances[to] || 0) + net);
      }
    }
  }
  const group = await getDocument(env, 'split_groups', groupId);
  if (group) {
    group.cachedBalances = balances;
    await saveDocument(env, 'split_groups', group);
  }
  return balances;
}

async function getMembership(env, groupId, userId) {
  const group = await getDocument(env, 'split_groups', groupId);
  const member = group && (
    String(group.createdBy) === userId ||
    (group.members || []).some((item) => String(item.userId || '') === userId)
  );
  if (!group || !member) throw new HttpError(404, 'Group not found or access denied');
  return group;
}

async function syncToPersonalExpenses(env, group, expense, payerId) {
  const splits = expense.splits || [];
  for (const share of splits) {
    const userId = idString(share.userId);
    if (!userId || userId === payerId || Number(share.shareAmount) <= 0) continue;

    let category = (await listDocuments(env, 'categories', { ownerId: userId }))
      .find((item) => item.name === 'Split Expense' || item.name === 'Split Expenses');
    const user = await getDocument(env, 'users', userId);
    if (user?.autoSyncSplit && !category) {
      category = await insertDocument(env, 'categories', {
        userId,
        name: 'Split Expense',
        limit: 5000,
        color: '#8b5cf6',
        icon: 'people-outline',
        isDefault: false,
      });
    }
    if (!user?.autoSyncSplit) continue;

    const personal = await insertDocument(env, 'expenses', {
      userId,
      title: `${expense.title || expense.description} (${group.name})`,
      amount: Number(share.shareAmount),
      category: category.name,
      categoryId: category._id,
      date: expense.date || new Date().toISOString(),
      paymentMethod: 'Split Share',
      notes: `Group: ${group.name}`,
      sourceType: 'split',
      splitGroupId: group._id,
      splitExpenseId: expense._id,
    });
    share.transactionId = personal._id;
  }
  expense.splits = splits;
  expense.splitBetween = splits.map((share) => ({
    userId: share.userId,
    amount: share.shareAmount,
    status: share.status,
    transactionId: share.transactionId,
  }));
  await saveDocument(env, 'split_expenses', expense);
}

async function handleSummary(env, userId) {
  const groups = await listMemberGroups(env, 'split_groups', userId);
  const expenses = [];
  for (const group of groups) {
    expenses.push(...await listDocuments(env, 'split_expenses', { groupId: group._id }));
  }
  let totalYouOwe = 0;
  let totalOwedToYou = 0;
  for (const expense of expenses) {
    const shares = sharesOf(expense);
    if (idString(expense.paidBy) === userId) {
      for (const share of shares) {
        if (idString(share.userId) !== userId && share.status !== 'paid') totalOwedToYou += share.amount;
      }
    } else {
      const mine = shares.find((share) => idString(share.userId) === userId);
      if (mine && mine.status !== 'paid') totalYouOwe += mine.amount;
    }
  }
  return {
    totalOwedToYou: round2(totalOwedToYou),
    totalYouOwe: round2(totalYouOwe),
    netBalance: round2(totalOwedToYou - totalYouOwe),
  };
}

export async function handleSplitRequest(request, env, url) {
  if (!url.pathname.startsWith('/api/split/')) return null;
  const user = await protectedUser(request, env);
  const userId = user.id;
  const method = request.method.toUpperCase();
  const path = url.pathname;

  if (method === 'GET' && path === '/api/split/summary') {
    return json(await handleSummary(env, userId));
  }
  if (method === 'GET' && path === '/api/split/groups') {
    return json(await listMemberGroups(env, 'split_groups', userId));
  }
  if (method === 'POST' && path === '/api/split/groups') {
    const body = await readJson(request);
    if (!body.name) throw new HttpError(400, 'Group name is required');
    const group = await insertDocument(env, 'split_groups', {
      name: body.name,
      currency: body.currency || 'INR',
      createdBy: userId,
      defaultSplitType: 'equal',
      members: [{
        _id: crypto.randomUUID().replaceAll('-', ''),
        userId,
        name: user.name,
        email: user.email,
        role: 'admin',
        joinedAt: new Date().toISOString(),
        reliabilityScore: 100,
      }],
      cachedBalances: {},
      archived: false,
    });
    return json(group, 201);
  }
  if (method === 'POST' && routeMatch(path, /^\/api\/split\/groups\/([^/]+)\/expenses$/)) {
    const [groupId] = routeMatch(path, /^\/api\/split\/groups\/([^/]+)\/expenses$/);
    const group = await getMembership(env, groupId, userId);
    const body = await readJson(request);
    const title = String(body.description || '').trim();
    const amount = Number.parseFloat(body.amount);
    if (!title || !amount) throw new HttpError(400, 'Description and amount required');
    const memberIds = (group.members || []).map((member) => idString(member.userId)).filter(Boolean);
    const splits = equalShares(amount, memberIds);
    const expense = await insertDocument(env, 'split_expenses', {
      groupId,
      title,
      description: title,
      amount,
      paidBy: userId,
      splitType: 'equal',
      splits,
      splitBetween: splits.map((share) => ({ userId: share.userId, amount: share.shareAmount, status: 'unpaid' })),
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      isSettled: false,
    });
    await syncToPersonalExpenses(env, group, expense, userId);
    await recomputeBalances(env, groupId);
    return json(expense, 201);
  }
  if (method === 'GET' && path === '/api/split/expenses') {
    const groupId = url.searchParams.get('groupId');
    if (!groupId) throw new HttpError(400, 'groupId is required');
    await getMembership(env, groupId, userId);
    const expenses = await listDocuments(env, 'split_expenses', { groupId, limit: 200 });
    const output = [];
    for (const expense of expenses) output.push(await mobileExpense(env, expense));
    return json(output);
  }
  if (method === 'POST' && path === '/api/split/expenses') {
    const body = await readJson(request);
    const group = await getMembership(env, String(body.groupId || ''), userId);
    const title = String(body.title || body.description || '').trim();
    const amount = round2(Number.parseFloat(body.amount));
    if (!title || !Number.isFinite(amount) || amount < 1) {
      throw new HttpError(400, 'groupId, title and amount (≥ 1) are required');
    }
    const memberIds = [...new Set((group.members || []).map((member) => idString(member.userId)).filter(Boolean))];
    let participantIds = [];
    if (Array.isArray(body.splitBetween) && body.splitBetween.length) {
      participantIds = body.splitBetween.map((item) => idString(item.userId || item)).filter(Boolean);
    } else if (Array.isArray(body.includedMemberIds) && body.includedMemberIds.length) {
      participantIds = body.includedMemberIds.map(String);
    } else {
      participantIds = memberIds;
    }
    participantIds = [...new Set(participantIds)].filter((id) => memberIds.includes(id));
    if (!participantIds.length) participantIds = memberIds.length ? memberIds : [userId];
    const payerId = body.paidBy && memberIds.includes(String(body.paidBy)) ? String(body.paidBy) : userId;
    let splits;
    if (Array.isArray(body.splitBetween) && body.splitBetween.length) {
      const amounts = new Map(body.splitBetween.map((item) => [
        idString(item.userId || item),
        round2(Number.parseFloat(item.amount) || 0),
      ]));
      if (participantIds.every((id) => amounts.get(id) > 0)) {
        splits = participantIds.map((id) => ({ userId: id, shareAmount: amounts.get(id), status: 'unpaid' }));
      }
    }
    if (!splits) splits = equalShares(amount, participantIds);
    splits = splits.map((share) => ({ ...share, status: idString(share.userId) === payerId ? 'paid' : 'unpaid' }));
    const expense = await insertDocument(env, 'split_expenses', {
      groupId: group._id,
      paidBy: payerId,
      title,
      description: title,
      amount,
      category: body.category || null,
      splitType: 'equal',
      splits,
      splitBetween: splits.map((share) => ({
        userId: share.userId,
        amount: share.shareAmount,
        status: share.status,
      })),
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      isSettled: false,
      disputeWindowEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await syncToPersonalExpenses(env, group, expense, payerId);
    await recomputeBalances(env, group._id);
    return json(await mobileExpense(env, expense), 201);
  }
  if (method === 'PUT' && routeMatch(path, /^\/api\/split\/expenses\/([^/]+)\/settle$/)) {
    const [expenseId] = routeMatch(path, /^\/api\/split\/expenses\/([^/]+)\/settle$/);
    const expense = await getDocument(env, 'split_expenses', expenseId);
    if (!expense) throw new HttpError(404, 'Expense not found');
    await getMembership(env, expense.groupId, userId);
    for (const share of expense.splits || []) share.status = 'paid';
    for (const share of expense.splitBetween || []) share.status = 'paid';
    expense.isSettled = true;
    await saveDocument(env, 'split_expenses', expense);
    await recomputeBalances(env, expense.groupId);
    return json(await mobileExpense(env, expense));
  }
  if (method === 'GET' && path === '/api/split/groups/all/expenses') {
    const groups = (await listMemberGroups(env, 'split_groups', userId))
      .filter((group) => group.archived !== true);
    const names = new Map(groups.map((group) => [group._id, group.name]));
    const output = [];
    for (const group of groups) {
      const expenses = await listDocuments(env, 'split_expenses', { groupId: group._id, limit: 200 });
      for (const expense of expenses) output.push(await mobileExpense(env, expense, names.get(group._id)));
    }
    output.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json(output.slice(0, 200));
  }
  return null;
}
