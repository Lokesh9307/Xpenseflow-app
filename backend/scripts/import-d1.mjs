import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const exportPath = path.resolve(scriptDirectory, '..', 'migration-data', 'mongo-export.json');
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.D1_DATABASE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !databaseId || !apiToken) {
  throw new Error('Set CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN in the local environment.');
}

const exported = JSON.parse(await readFile(exportPath, 'utf8'));
if (exported.formatVersion !== 1 || !exported.collections) {
  throw new Error('The MongoDB export has an unsupported format.');
}

function lookupKey(kind, document) {
  if (kind === 'users') return String(document.email || '').trim().toLowerCase();
  if (kind === 'budgets') return `${document.categoryId || ''}:${document.month || ''}`;
  if (kind === 'tiffin_entries') {
    return `${new Date(document.date || 0).toISOString().slice(0, 10)}:${document.mealType || ''}`;
  }
  if (kind === 'expenses' && document.syncRefId) return `sync:${document.syncRefId}`;
  if (kind === 'expenses' && document.recurringId) {
    return `recurring:${document.recurringId}:${new Date(document.date || 0).toISOString().slice(0, 10)}`;
  }
  return null;
}

function ownerId(kind, document) {
  return document.userId
    ? String(document.userId)
    : kind === 'users'
      ? String(document._id)
      : kind === 'tiffin_groups' || kind === 'split_groups'
        ? String(document.createdBy || '')
        : kind === 'split_expenses'
          ? String(document.paidBy || '')
          : null;
}

function cleanDocument(kind, source) {
  const document = { ...source, _id: String(source._id || source.id || '') };
  if (!document._id) throw new Error(`Found a ${kind} record without an identifier.`);
  if (kind === 'users') {
    delete document.password;
    delete document.otp;
    delete document.otpExpiry;
  }
  return document;
}

async function execute(sql, params) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare D1 import failed with HTTP ${response.status}; check the D1 ID, token permissions, and migration status.`);
  }
  const result = await response.json();
  if (!result.success) throw new Error('Cloudflare D1 rejected a record; inspect the D1 dashboard for details.');
}

let count = 0;
const insertSql = `INSERT INTO documents
  (kind, id, owner_id, group_id, lookup_key, date_ms, created_ms, data)
  VALUES %VALUES%
  ON CONFLICT(kind, id) DO UPDATE SET
    owner_id = excluded.owner_id,
    group_id = excluded.group_id,
    lookup_key = excluded.lookup_key,
    date_ms = excluded.date_ms,
    created_ms = excluded.created_ms,
    data = excluded.data`;

async function importBatch(records) {
  const rows = records.map((record, rowIndex) => {
    const firstParameter = rowIndex * 8 + 1;
    return `(${Array.from({ length: 8 }, (_, columnIndex) => `?${firstParameter + columnIndex}`).join(', ')})`;
  });
  const params = records.flatMap((record) => [
    record.kind,
    record.id,
    record.ownerId,
    record.groupId,
    record.lookupKey,
    record.dateMs,
    record.createdMs,
    record.data,
  ]);
  await execute(insertSql.replace('%VALUES%', rows.join(', ')), params);
}

for (const [kind, records] of Object.entries(exported.collections)) {
  const rows = records.map((source) => {
    const document = cleanDocument(kind, source);
    const date = document.date || document.createdAt;
    const dateMs = date ? new Date(date).getTime() : null;
    const createdMs = document.createdAt ? new Date(document.createdAt).getTime() : Date.now();
    return {
      kind,
      id: document._id,
      ownerId: ownerId(kind, document),
      groupId: document.groupId ? String(document.groupId) : null,
      lookupKey: lookupKey(kind, document),
      dateMs: Number.isFinite(dateMs) ? dateMs : null,
      createdMs: Number.isFinite(createdMs) ? createdMs : Date.now(),
      data: JSON.stringify(document),
    };
  });

  for (let offset = 0; offset < rows.length; offset += 10) {
    const batch = rows.slice(offset, offset + 10);
    await importBatch(batch);
    count += batch.length;
  }
}

console.log(`Imported ${count} MongoDB records into D1. No source records were deleted.`);
