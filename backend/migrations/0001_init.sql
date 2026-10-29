CREATE TABLE IF NOT EXISTS documents (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  owner_id TEXT,
  group_id TEXT,
  lookup_key TEXT,
  date_ms INTEGER,
  created_ms INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE INDEX IF NOT EXISTS documents_owner_date_idx
  ON documents (kind, owner_id, date_ms);

CREATE INDEX IF NOT EXISTS documents_group_date_idx
  ON documents (kind, group_id, date_ms);

CREATE INDEX IF NOT EXISTS documents_lookup_idx
  ON documents (kind, lookup_key);

CREATE UNIQUE INDEX IF NOT EXISTS documents_user_email_unique
  ON documents (lookup_key)
  WHERE kind = 'users' AND lookup_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_tiffin_entry_day_unique
  ON documents (group_id, lookup_key)
  WHERE kind = 'tiffin_entries' AND group_id IS NOT NULL AND lookup_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_budget_unique
  ON documents (owner_id, lookup_key)
  WHERE kind = 'budgets' AND owner_id IS NOT NULL AND lookup_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_expense_reference_unique
  ON documents (lookup_key)
  WHERE kind = 'expenses' AND lookup_key IS NOT NULL;
