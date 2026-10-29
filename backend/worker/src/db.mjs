const asDocument = (row) => {
  if (!row) return null;
  return JSON.parse(row.data);
};

const normalizeDocument = (kind, document) => {
  const now = new Date().toISOString();
  const id = String(document._id || document.id || crypto.randomUUID().replaceAll('-', ''));
  return {
    ...document,
    _id: id,
    createdAt: document.createdAt || now,
    updatedAt: document.updatedAt || now,
  };
};

const metadataFor = (kind, document) => {
  const date = document.date || document.createdAt;
  let lookupKey = null;

  if (kind === 'users') lookupKey = String(document.email || '').trim().toLowerCase();
  if (kind === 'budgets') lookupKey = `${document.categoryId || ''}:${document.month || ''}`;
  if (kind === 'expenses' && document.syncRefId) lookupKey = `sync:${document.syncRefId}`;
  if (kind === 'expenses' && !lookupKey && document.recurringId) {
    lookupKey = `recurring:${document.recurringId}:${new Date(date || 0).toISOString().slice(0, 10)}`;
  }
  if (kind === 'tiffin_entries') {
    lookupKey = `${new Date(date || 0).toISOString().slice(0, 10)}:${document.mealType || ''}`;
  }

  return {
    ownerId: document.userId
      ? String(document.userId)
      : kind === 'users'
        ? String(document._id)
        : kind === 'tiffin_groups' || kind === 'split_groups'
          ? String(document.createdBy || '')
          : kind === 'split_expenses'
            ? String(document.paidBy || '')
            : null,
    groupId: document.groupId ? String(document.groupId) : null,
    lookupKey,
    dateMs: date ? new Date(date).getTime() : null,
    createdMs: new Date(document.createdAt).getTime(),
  };
};

export async function getDocument(env, kind, id) {
  const row = await env.DB.prepare(
    'SELECT data FROM documents WHERE kind = ?1 AND id = ?2'
  ).bind(kind, String(id)).first();
  return asDocument(row);
}

export async function findByLookup(env, kind, lookupKey) {
  const row = await env.DB.prepare(
    'SELECT data FROM documents WHERE kind = ?1 AND lookup_key = ?2 LIMIT 1'
  ).bind(kind, String(lookupKey)).first();
  return asDocument(row);
}

export async function listDocuments(env, kind, options = {}) {
  let sql = 'SELECT data FROM documents WHERE kind = ?1';
  const params = [kind];

  if (options.ownerId !== undefined) {
    params.push(String(options.ownerId));
    sql += ` AND owner_id = ?${params.length}`;
  }
  if (options.groupId !== undefined) {
    params.push(String(options.groupId));
    sql += ` AND group_id = ?${params.length}`;
  }
  if (options.startMs !== undefined) {
    params.push(options.startMs);
    sql += ` AND date_ms >= ?${params.length}`;
  }
  if (options.endMs !== undefined) {
    params.push(options.endMs);
    sql += ` AND date_ms < ?${params.length}`;
  }

  const order = options.order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY date_ms ${order}, created_ms ${order}`;
  if (Number.isInteger(options.limit) && options.limit > 0) {
    params.push(options.limit);
    sql += ` LIMIT ?${params.length}`;
  }

  const { results = [] } = await env.DB.prepare(sql).bind(...params).all();
  return results.map(asDocument);
}

export async function listMemberGroups(env, kind, userId, email = '') {
  if (kind !== 'tiffin_groups' && kind !== 'split_groups') {
    throw new Error('Membership lookup is only supported for group documents');
  }
  const { results = [] } = await env.DB.prepare(
    `SELECT data FROM documents
     WHERE kind = ?1
       AND (
         owner_id = ?2
         OR EXISTS (
           SELECT 1
           FROM json_each(documents.data, '$.members') AS member
           WHERE json_extract(member.value, '$.userId') = ?2
              OR (?3 <> '' AND lower(json_extract(member.value, '$.email')) = ?3)
         )
       )
     ORDER BY created_ms DESC`
  ).bind(kind, String(userId), String(email).toLowerCase()).all();
  return results.map(asDocument);
}

export async function insertDocument(env, kind, source) {
  const document = normalizeDocument(kind, source);
  const meta = metadataFor(kind, document);
  await env.DB.prepare(
    `INSERT INTO documents
      (kind, id, owner_id, group_id, lookup_key, date_ms, created_ms, data)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(
    kind,
    document._id,
    meta.ownerId,
    meta.groupId,
    meta.lookupKey,
    Number.isFinite(meta.dateMs) ? meta.dateMs : null,
    Number.isFinite(meta.createdMs) ? meta.createdMs : Date.now(),
    JSON.stringify(document)
  ).run();
  return document;
}

export async function saveDocument(env, kind, source) {
  const document = normalizeDocument(kind, {
    ...source,
    updatedAt: new Date().toISOString(),
  });
  const meta = metadataFor(kind, document);
  await env.DB.prepare(
    `INSERT INTO documents
      (kind, id, owner_id, group_id, lookup_key, date_ms, created_ms, data)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(kind, id) DO UPDATE SET
       owner_id = excluded.owner_id,
       group_id = excluded.group_id,
       lookup_key = excluded.lookup_key,
       date_ms = excluded.date_ms,
       created_ms = excluded.created_ms,
       data = excluded.data`
  ).bind(
    kind,
    document._id,
    meta.ownerId,
    meta.groupId,
    meta.lookupKey,
    Number.isFinite(meta.dateMs) ? meta.dateMs : null,
    Number.isFinite(meta.createdMs) ? meta.createdMs : Date.now(),
    JSON.stringify(document)
  ).run();
  return document;
}

export async function deleteDocument(env, kind, id, ownerId) {
  let sql = 'DELETE FROM documents WHERE kind = ?1 AND id = ?2';
  const params = [kind, String(id)];
  if (ownerId !== undefined) {
    params.push(String(ownerId));
    sql += ` AND owner_id = ?${params.length}`;
  }
  const result = await env.DB.prepare(sql).bind(...params).run();
  return result.meta.changes > 0;
}

export async function deleteDocuments(env, kind, ownerId) {
  const result = await env.DB.prepare(
    'DELETE FROM documents WHERE kind = ?1 AND owner_id = ?2'
  ).bind(kind, String(ownerId)).run();
  return result.meta.changes;
}
