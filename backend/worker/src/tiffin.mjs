import {
  deleteDocument,
  findByLookup,
  getDocument,
  insertDocument,
  listDocuments,
  listMemberGroups,
  saveDocument,
} from './db.mjs';
import { HttpError } from './errors.mjs';
import { json, protectedUser, readJson, routeMatch } from './http.mjs';

const round2 = (value) => Math.round(Number(value) * 100) / 100;
const idString = (value) => value && typeof value === 'object'
  ? String(value._id || value.userId || '')
  : value == null ? '' : String(value);

function staticGroupCode(group) {
  const value = String(group?._id || group?.id || group?.name || '8824');
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return String(Math.abs(hash) % 9000 + 1000);
}

function toUtcMidnight(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Entry date is invalid');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateEntryBills(entry, pricePerUnit, members = []) {
  const price = Number(entry.pricePerTiffin || entry.price || pricePerUnit || 100);
  const bills = {};
  if (entry.memberBills && Object.keys(entry.memberBills).length) {
    for (const [id, value] of Object.entries(entry.memberBills)) {
      const amount = typeof value === 'object' && value !== null
        ? (value.total ?? value.amount ?? value.base)
        : value;
      bills[id] = round2(Number.parseFloat(amount) || 0);
    }
    return bills;
  }

  const baseQuantity = Math.floor(Number(entry.baseQuantity) || 0);
  const participantIds = Array.isArray(entry.participantMemberIds) && entry.participantMemberIds.length
    ? entry.participantMemberIds.map(String)
    : Array.isArray(entry.splitMemberIds) ? entry.splitMemberIds.map(String) : [];
  const extras = entry.participantQuantities || entry.extras || {};

  if (baseQuantity > 0 && participantIds.length) {
    const uniqueIds = [...new Set(participantIds.filter(Boolean))];
    const baseShare = round2(baseQuantity * price / uniqueIds.length);
    for (const id of uniqueIds) bills[id] = baseShare;
    for (const [id, value] of Object.entries(extras)) {
      const extraCount = Math.max(0, Math.floor(Number(value) || 0));
      if (extraCount) bills[id] = round2((bills[id] || 0) + extraCount * price);
    }
    return bills;
  }

  if (participantIds.length) {
    for (const id of new Set(participantIds.filter(Boolean))) {
      const quantity = Math.max(1, Math.floor(Number(extras[id]) || 1));
      bills[id] = round2(quantity * price);
    }
    return bills;
  }

  if (Array.isArray(entry.participants) && entry.participants.length) {
    const total = Number(entry.totalCost ?? entry.totalPrice ?? price * entry.participants.length);
    const share = round2(total / entry.participants.length);
    for (const participant of entry.participants) {
      bills[String(participant.memberId || participant._id || participant.userId)] = share;
    }
    return bills;
  }

  const total = Number(entry.totalCost ?? entry.totalPrice ?? price * (entry.quantity || entry.count || 1));
  if (members.length) {
    const share = round2(total / members.length);
    for (const member of members) bills[String(member._id || member.userId)] = share;
  } else {
    bills[String(entry.userId || entry.addedBy || '0')] = total;
  }
  return bills;
}

function sanitizeSplitPayload(raw, group) {
  if (!raw) return null;
  const baseQuantity = Math.floor(Number(raw.baseQuantity) || 0);
  if (baseQuantity < 1) return null;
  const validIds = new Set((group.members || []).map((member) => String(member._id)));
  const memberIds = [...new Set((Array.isArray(raw.splitMemberIds) ? raw.splitMemberIds : [])
    .map(String)
    .filter((id) => id && validIds.has(id)))];
  if (!memberIds.length) return null;
  const extras = {};
  for (const [id, value] of Object.entries(raw.extras || {})) {
    const quantity = Math.max(0, Math.floor(Number(value) || 0));
    if (quantity && validIds.has(id)) extras[id] = quantity;
  }
  return { baseQuantity, splitMemberIds: memberIds, extras };
}

function normalizeEntry(entry, members = [], priceFallback = 0) {
  const output = { ...entry };
  const price = Number(output.pricePerTiffin || priceFallback || 0);
  const quantity = Number(output.quantity ?? output.count ?? 1);
  output.totalCost ??= output.totalPrice != null ? Number(output.totalPrice) : round2(quantity * price);
  output.totalPrice ??= Number(output.totalCost);
  output.extras = Object.keys(output.extras || {}).length
    ? output.extras
    : { ...(output.participantQuantities || {}) };
  if (!Array.isArray(output.splitMemberIds) || !output.splitMemberIds.length) {
    output.splitMemberIds = [...(output.participantMemberIds || [])];
  }
  if (!Array.isArray(output.participantMemberIds) || !output.participantMemberIds.length) {
    output.participantMemberIds = [...(output.splitMemberIds || [])];
  }
  output.noTiffin ??= output.mealType === 'none';
  output.quantity ??= output.count ?? 1;
  output.count ??= output.quantity ?? 1;
  if (!Object.keys(output.memberBills || {}).length) {
    output.memberBills = output.noTiffin ? {} : calculateEntryBills(output, price, members);
  }
  if (output.perPersonShare == null) {
    const participantCount = new Set([
      ...(output.participantMemberIds || []),
      ...(output.splitMemberIds || []),
    ].map(String)).size;
    output.perPersonShare = participantCount ? round2(Number(output.totalCost) / participantCount) : 0;
  }
  return output;
}

async function memberGroups(env, userId, email) {
  const groups = await listMemberGroups(env, 'tiffin_groups', userId, email);
  return groups.filter((group) => group.archived !== true);
}

async function requireGroup(env, groupId, userId) {
  const group = await getDocument(env, 'tiffin_groups', groupId);
  if (!group) throw new HttpError(404, 'Group not found');
  const isMember = String(group.createdBy) === userId ||
    (group.members || []).some((member) => String(member.userId || '') === userId);
  if (!isMember) throw new HttpError(403, 'Access denied');
  return group;
}

async function syncEntryToExpenses(env, group, entry) {
  for (const member of group.members || []) {
    const email = String(member.email || '').trim().toLowerCase();
    const targetUser = member.userId
      ? await getDocument(env, 'users', member.userId)
      : email
        ? await findByLookup(env, 'users', email)
        : null;
    if (!targetUser) continue;

    const memberId = String(member._id || member.userId || targetUser._id);
    const amount = Number(entry.memberBills?.[memberId] ?? entry.memberBills?.[targetUser._id] ?? 0);
    const syncRefId = `tiffin_${entry._id}_${group._id}_${memberId}`;
    const existing = await findByLookup(env, 'expenses', `sync:${syncRefId}`);
    if (entry.noTiffin || entry.mealType === 'none' || !targetUser.autoSyncTiffin || amount <= 0) {
      if (existing) await deleteDocument(env, 'expenses', existing._id, targetUser._id);
      continue;
    }

    let category = (await listDocuments(env, 'categories', { ownerId: targetUser._id }))
      .find((item) => item.name === 'Tiffin Expense');
    if (!category) {
      category = await insertDocument(env, 'categories', {
        userId: targetUser._id,
        name: 'Tiffin Expense',
        limit: 5000,
        color: '#ea580c',
        icon: 'restaurant-outline',
        isDefault: false,
      });
    }
    const expense = {
      ...(existing || {}),
      userId: targetUser._id,
      title: `Tiffin: ${(entry.mealType || 'Meal').replace(/^./, (letter) => letter.toUpperCase())} (${group.name})`,
      amount: round2(amount),
      category: category.name,
      categoryId: category._id,
      date: entry.date || entry.createdAt,
      paymentMethod: 'UPI',
      notes: `Group: ${group.name} · Share: ₹${amount}${entry.notes ? ` · ${entry.notes}` : ''}`,
      syncSource: 'tiffin',
      syncRefId,
    };
    if (existing) await saveDocument(env, 'expenses', expense);
    else await insertDocument(env, 'expenses', expense);
  }
}

async function listGroupEntries(env, groupId, month) {
  let options = { groupId };
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, value] = month.split('-').map(Number);
    options = {
      groupId,
      startMs: new Date(year, value - 1, 1).getTime(),
      endMs: new Date(year, value, 1).getTime(),
    };
  }
  return listDocuments(env, 'tiffin_entries', options);
}

async function groupSummary(env, group, selectedMonth, userId) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = /^\d{4}-\d{2}$/.test(selectedMonth || '') ? selectedMonth : currentMonth;
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);
  const entries = await listGroupEntries(env, group._id);
  const monthEntries = entries.filter((entry) => {
    const date = new Date(entry.date);
    return date >= start && date < end;
  });
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter((entry) => String(entry.date).slice(0, 10) === todayKey);
  const price = Number(group.pricePerTiffin || group.defaultPrice || 100);
  const total = (list) => list.reduce((sum, entry) =>
    sum + Number(entry.totalCost ?? entry.totalPrice ?? ((entry.quantity ?? entry.count ?? 1) * price)), 0);
  const quantity = (list) => list.reduce((sum, entry) =>
    sum + Number(entry.quantity ?? entry.count ?? (entry.noTiffin ? 0 : 1)), 0);
  const months = new Set([currentMonth, month]);
  for (const entry of entries) {
    if (entry.date) months.add(new Date(entry.date).toISOString().slice(0, 7));
  }

  const memberTotals = {};
  const memberStats = {};
  for (const member of group.members || []) {
    const id = String(member._id || member.userId);
    memberTotals[id] = 0;
    memberStats[id] = {
      memberId: id,
      name: member.name || 'Member',
      email: member.email || '',
      mealsCount: 0,
      extraTiffins: 0,
      baseTotal: 0,
      extraTotal: 0,
      totalDue: 0,
    };
  }
  for (const entry of monthEntries) {
    if (entry.noTiffin || entry.mealType === 'none') continue;
    const bills = calculateEntryBills(entry, Number(entry.pricePerTiffin || price), group.members);
    for (let index = 0; index < group.members.length; index += 1) {
      const member = group.members[index];
      const memberId = String(member._id || member.userId);
      const userId = String(member.userId || '');
      const due = Number(bills[memberId] ?? bills[userId] ?? bills[String(index)] ?? 0);
      if (due <= 0) continue;
      const stats = memberStats[memberId];
      const extras = entry.participantQuantities || entry.extras || {};
      const extraCount = Number.parseInt(extras[memberId] ?? extras[userId] ?? extras[String(index)] ?? 0, 10) || 0;
      const extraTotal = extraCount * Number(entry.pricePerTiffin || price);
      memberTotals[memberId] = round2(memberTotals[memberId] + due);
      stats.totalDue = round2(stats.totalDue + due);
      stats.extraTiffins += extraCount;
      stats.extraTotal = round2(stats.extraTotal + extraTotal);
      stats.baseTotal = round2(stats.baseTotal + Math.max(0, due - extraTotal));
      stats.mealsCount += 1;
    }
  }
  let inviteCode = group.inviteCode;
  if (!/^\d{4}$/.test(String(inviteCode || ''))) inviteCode = staticGroupCode(group);
  const normalized = (items) => items.map((entry) => normalizeEntry(entry, group.members, price));
  return {
    group: { ...group, inviteCode },
    selectedMonth: month,
    availableMonths: [...months].sort().reverse(),
    entries: normalized(monthEntries),
    allEntries: normalized(entries),
    todayEntries: normalized(todayEntries),
    monthTotal: total(monthEntries),
    monthQuantity: quantity(monthEntries),
    cycleTotal: total(monthEntries),
    cycleQuantity: quantity(monthEntries),
    lifetimeTotal: total(entries),
    lifetimeQuantity: quantity(entries),
    memberTotals,
    memberStats: Object.values(memberStats),
    inviteCode,
    isCreator: String(group.createdBy) === userId,
    canWrite: true,
  };
}

async function listGroups(env, user) {
  const groups = await memberGroups(env, user.id, user.email.toLowerCase());
  const result = [];
  for (const group of groups) {
    const entries = await listDocuments(env, 'tiffin_entries', { groupId: group._id });
    const price = Number(group.pricePerTiffin || group.defaultPrice || 100);
    const total = entries.reduce((sum, entry) =>
      sum + Number(entry.totalCost ?? entry.totalPrice ?? ((entry.quantity ?? entry.count ?? 1) * price)), 0);
    const quantity = entries.reduce((sum, entry) =>
      sum + Number(entry.quantity ?? entry.count ?? (entry.noTiffin ? 0 : 1)), 0);
    result.push({
      ...group,
      defaultPrice: price,
      pricePerTiffin: price,
      cycleTotal: total,
      cycleQuantity: quantity,
      entryCount: entries.length,
      inviteCode: /^\d{4}$/.test(String(group.inviteCode || '')) ? group.inviteCode : staticGroupCode(group),
    });
  }
  return result;
}

async function createGroup(env, user, body) {
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Tiffin group name required');
  const price = Number(body.pricePerTiffin || body.defaultPrice || 100);
  const members = [{
    _id: crypto.randomUUID().replaceAll('-', ''),
    userId: user.id,
    name: user.name || 'Admin',
    email: user.email || '',
    memberType: 'joined',
    joinedAt: new Date().toISOString(),
  }];
  for (const member of Array.isArray(body.members) ? body.members : []) {
    if (member.name && member.email && String(member.email).toLowerCase() !== user.email.toLowerCase()) {
      members.push({
        _id: crypto.randomUUID().replaceAll('-', ''),
        name: String(member.name).trim(),
        email: String(member.email).trim().toLowerCase(),
        memberType: 'placeholder',
        joinedAt: new Date().toISOString(),
      });
    }
  }
  const group = {
    _id: crypto.randomUUID().replaceAll('-', ''),
    name,
    pricePerTiffin: price,
    defaultPrice: price,
    createdBy: user.id,
    archived: false,
    currentCycleStartedAt: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    inviteCode: '',
    members,
  };
  group.inviteCode = staticGroupCode(group);
  return insertDocument(env, 'tiffin_groups', group);
}

function createEntryData(group, user, body) {
  const noTiffin = body.noTiffin === true || body.mealType === 'none' || body.count === 0 || body.quantity === 0;
  const mealType = noTiffin ? 'none' : String(body.mealType || 'lunch').toLowerCase();
  const date = toUtcMidnight(body.date);
  const price = Number(group.pricePerTiffin || group.defaultPrice || 100);
  const split = noTiffin ? null : sanitizeSplitPayload({
    baseQuantity: body.baseQuantity !== undefined
      ? body.baseQuantity
      : Number.parseInt(body.quantity || body.count, 10) || 1,
    splitMemberIds: body.splitMemberIds,
    extras: body.extras,
  }, group);

  let splitMemberIds = split?.splitMemberIds || [];
  let extras = split?.extras || {};
  const baseQuantity = noTiffin ? 0 : (split?.baseQuantity ??
    (Number.parseInt(body.baseQuantity || body.quantity || body.count, 10) || 1));
  if (!noTiffin && !splitMemberIds.length) {
    splitMemberIds = (group.members || []).map((member) => String(member._id || member.userId));
    for (const [id, value] of Object.entries(body.extras || {})) {
      const quantity = Math.max(0, Math.floor(Number(value) || 0));
      if (quantity > 0 && splitMemberIds.includes(id)) extras[id] = quantity;
    }
  }
  const extraCount = Object.values(extras).reduce((sum, value) => sum + (Number.parseInt(value, 10) || 0), 0);
  const count = noTiffin ? 0 : baseQuantity + extraCount;
  const extraPrice = noTiffin ? 0 : (Number.parseFloat(body.extraPrice) || 0);
  const totalPrice = noTiffin ? 0 : round2(count * price + extraPrice);
  const memberBills = {};
  if (!noTiffin) {
    const perMember = splitMemberIds.length ? baseQuantity * price / splitMemberIds.length : 0;
    for (const [index, member] of (group.members || []).entries()) {
      const memberId = String(member._id || member.userId || index);
      const clientAmount = body.memberBills?.[memberId] ?? body.memberBills?.[String(index)];
      const participates = splitMemberIds.includes(memberId) || splitMemberIds.includes(String(member.userId));
      const extra = Number.parseInt(extras[memberId] ?? extras[String(index)] ?? 0, 10) || 0;
      memberBills[memberId] = round2(clientAmount !== undefined
        ? Number.parseFloat(clientAmount) || 0
        : (participates ? perMember : 0) + extra * price);
    }
  }
  const participantCount = new Set(splitMemberIds.map(String)).size;
  return {
    groupId: group._id,
    userId: user.id,
    addedBy: user.id,
    date: date.toISOString(),
    mealType,
    count,
    quantity: count,
    baseQuantity,
    pricePerTiffin: price,
    totalCost: totalPrice,
    totalPrice,
    perPersonShare: participantCount ? round2(totalPrice / participantCount) : 0,
    participantMemberIds: splitMemberIds,
    splitMemberIds,
    participantQuantities: extras,
    extras,
    memberBills,
    extraPrice,
    noTiffin,
    participants: Array.isArray(body.participants) ? body.participants : [],
    notes: noTiffin ? (body.notes || 'No one took tiffin today') : (body.notes || ''),
    source: 'manual',
  };
}

async function addEntry(env, group, user, body) {
  const document = createEntryData(group, user, body);
  const lookup = `${document.date.slice(0, 10)}:${document.mealType}`;
  const existing = await env.DB.prepare(
    'SELECT data FROM documents WHERE kind = ?1 AND group_id = ?2 AND lookup_key = ?3 LIMIT 1'
  ).bind('tiffin_entries', group._id, lookup).first();
  if (existing) throw new HttpError(409, `A ${document.mealType} record already exists for this date — edit it instead`);
  try {
    const entry = await insertDocument(env, 'tiffin_entries', document);
    await syncEntryToExpenses(env, group, entry);
    return entry;
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) {
      throw new HttpError(409, `A ${document.mealType} record already exists for this date — edit it instead`);
    }
    throw error;
  }
}

export async function handleTiffinRequest(request, env, url) {
  if (!url.pathname.startsWith('/api/tiffin/')) return null;
  const user = await protectedUser(request, env);
  const userId = user.id;
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'GET' && path === '/api/tiffin/groups') return json(await listGroups(env, user));
  if (method === 'POST' && path === '/api/tiffin/groups') return json(await createGroup(env, user, await readJson(request)), 201);

  if (method === 'POST' && path === '/api/tiffin/join/code') {
    const body = await readJson(request);
    const code = String(body.code || '').trim();
    if (!/^\d{4}$/.test(code)) throw new HttpError(400, 'Enter a valid 4-digit code');
    const groups = (await listDocuments(env, 'tiffin_groups')).filter((group) => group.archived !== true);
    const group = groups.find((item) => item.inviteCode === code || staticGroupCode(item) === code);
    if (!group) throw new HttpError(404, 'Invalid or expired tiffin code.');
    if (String(group.createdBy) === userId ||
      (group.members || []).some((member) => String(member.userId || '') === userId)) {
      return json({ message: 'Already a member', groupId: group._id });
    }
    group.members ||= [];
    group.members.push({
      _id: crypto.randomUUID().replaceAll('-', ''),
      userId,
      name: user.name || 'Member',
      email: user.email || '',
      memberType: 'joined',
      joinedAt: new Date().toISOString(),
    });
    await saveDocument(env, 'tiffin_groups', group);
    return json({ message: 'Joined successfully!', groupId: group._id, groupName: group.name });
  }

  if (method === 'GET' && path === '/api/tiffin/transactions') {
    const groups = await memberGroups(env, userId, user.email.toLowerCase());
    const month = url.searchParams.get('month');
    const output = [];
    for (const group of groups) {
      const entries = await listGroupEntries(env, group._id, month);
      for (const entry of entries) {
        const price = Number(entry.pricePerTiffin || group.pricePerTiffin || group.defaultPrice || 100);
        const count = entry.count ?? entry.quantity ?? 1;
        const total = entry.totalPrice ?? entry.totalCost ?? round2(count * price);
        output.push({
          _id: entry._id,
          groupId: entry.groupId,
          groupName: group.name || 'Tiffin Group',
          date: entry.date,
          mealType: entry.mealType || 'lunch',
          count,
          quantity: entry.quantity ?? entry.count ?? 1,
          extraPrice: entry.extraPrice || 0,
          totalPrice: total,
          totalCost: total,
          baseQuantity: entry.baseQuantity,
          extras: Object.keys(entry.extras || {}).length ? entry.extras : (entry.participantQuantities || {}),
          noTiffin: entry.noTiffin || entry.mealType === 'none',
          notes: entry.notes || '',
          participants: entry.participants || [],
        });
      }
    }
    output.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return json(output.slice(0, 300));
  }

  const groupId = routeMatch(path, /^\/api\/tiffin\/groups\/([^/]+)(?:\/(entries)(?:\/([^/]+))?|\/(invite))?$/);
  if (!groupId) return null;
  const [id, entriesSegment, entryId, inviteSegment] = groupId;

  if (method === 'PATCH' && !entriesSegment && !inviteSegment) {
    const group = await requireGroup(env, id, userId);
    const body = await readJson(request);
    if (body.name && String(body.name).trim()) group.name = String(body.name).trim();
    if (body.defaultPrice !== undefined || body.pricePerTiffin !== undefined) {
      const price = Number.parseFloat(body.pricePerTiffin ?? body.defaultPrice);
      if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, 'Price must be a positive number');
      group.defaultPrice = price;
      group.pricePerTiffin = price;
    }
    return json(await saveDocument(env, 'tiffin_groups', group));
  }
  if (method === 'GET' && !entriesSegment && !inviteSegment) {
    const group = await requireGroup(env, id, userId);
    return json(await groupSummary(env, group, url.searchParams.get('month'), userId));
  }
  if (method === 'POST' && inviteSegment) {
    const group = await requireGroup(env, id, userId);
    if (!/^\d{4}$/.test(String(group.inviteCode || ''))) {
      group.inviteCode = staticGroupCode(group);
      await saveDocument(env, 'tiffin_groups', group);
    }
    return json({ inviteCode: group.inviteCode });
  }
  if (entriesSegment && !entryId && method === 'GET') {
    const group = await requireGroup(env, id, userId);
    const entries = await listGroupEntries(env, id, url.searchParams.get('month'));
    const price = Number(group.pricePerTiffin || group.defaultPrice || 100);
    return json(entries.map((entry) => normalizeEntry(entry, group.members, price)));
  }
  if (entriesSegment && !entryId && method === 'POST') {
    const group = await requireGroup(env, id, userId);
    return json(await addEntry(env, group, user, await readJson(request)), 201);
  }
  if (entriesSegment && entryId && method === 'DELETE') {
    const group = await requireGroup(env, id, userId);
    const entry = await getDocument(env, 'tiffin_entries', entryId);
    if (!entry || entry.groupId !== id) throw new HttpError(404, 'Entry not found');
    await deleteDocument(env, 'tiffin_entries', entryId);
    await syncEntryToExpenses(env, group, { ...entry, noTiffin: true });
    return json({ message: 'Entry deleted' });
  }
  if (entriesSegment && entryId && method === 'PATCH') {
    const group = await requireGroup(env, id, userId);
    const entry = await getDocument(env, 'tiffin_entries', entryId);
    if (!entry || entry.groupId !== id) throw new HttpError(404, 'Entry not found');
    const body = await readJson(request);
    const updated = createEntryData(group, user, {
      ...entry,
      ...body,
      baseQuantity: body.baseQuantity ?? entry.baseQuantity,
      splitMemberIds: body.splitMemberIds ?? entry.splitMemberIds,
      extras: body.extras ?? entry.extras,
      memberBills: body.memberBills ?? entry.memberBills,
      date: body.date ?? entry.date,
    });
    const saved = await saveDocument(env, 'tiffin_entries', { ...entry, ...updated, _id: entry._id, editedAt: new Date().toISOString() });
    await syncEntryToExpenses(env, group, saved);
    return json(normalizeEntry(saved, group.members, group.pricePerTiffin || group.defaultPrice));
  }
  return null;
}
