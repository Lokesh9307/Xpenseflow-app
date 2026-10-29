const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const exportFile = path.resolve(__dirname, '..', 'migration-data', 'mongo-export.json');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

async function main() {
  if (!serviceAccountPath) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_PATH to a local Firebase service-account JSON file.');
  }
  const data = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
  const users = data.collections?.users || [];
  const serviceAccount = require(path.resolve(serviceAccountPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const auth = admin.auth();
  let imported = 0;
  let passwordResetRequired = 0;
  let alreadyPresent = 0;

  for (let offset = 0; offset < users.length; offset += 1000) {
    const batch = users.slice(offset, offset + 1000);
    const missingEmail = batch.find((user) => !String(user.email || '').trim());
    if (missingEmail) {
      throw new Error(`MongoDB user ${missingEmail._id} has no email address and cannot be migrated to Firebase Authentication.`);
    }

    const existingById = new Map();
    const existingByEmail = new Map();
    for (let lookupOffset = 0; lookupOffset < batch.length; lookupOffset += 50) {
      const lookupBatch = batch.slice(lookupOffset, lookupOffset + 50);
      const identifiers = lookupBatch.flatMap((user) => [
        { uid: String(user._id) },
        { email: String(user.email || '').trim().toLowerCase() },
      ]);
      const existing = await auth.getUsers(identifiers);
      for (const user of existing.users) {
        existingById.set(user.uid, user);
        if (user.email) existingByEmail.set(user.email.toLowerCase(), user);
      }
    }

    const toImport = batch.filter((user) => {
      const uid = String(user._id);
      const email = String(user.email).trim().toLowerCase();
      const existingUid = existingById.get(uid);
      const existingEmail = existingByEmail.get(email);

      if (existingEmail && existingEmail.uid !== uid) {
        throw new Error(`Firebase email ${email} is already assigned to UID ${existingEmail.uid}, not MongoDB UID ${uid}. Resolve this account conflict before importing.`);
      }
      if (existingUid && existingUid.email?.toLowerCase() !== email) {
        throw new Error(`Firebase UID ${uid} already has a different email address. Resolve this account conflict before importing.`);
      }
      return !existingUid;
    });

    const records = toImport.map((user) => {
      const passwordHash = String(user.password || '');
      const record = {
          uid: String(user._id),
          email: String(user.email || '').toLowerCase(),
          displayName: String(user.name || ''),
          photoURL: String(user.avatar || ''),
          emailVerified: Boolean(user.isVerified),
          disabled: false,
        };
      if (/^\$2[aby]\$\d\d\$/.test(passwordHash)) {
        record.passwordHash = Buffer.from(passwordHash);
      } else {
        passwordResetRequired += 1;
      }
      return record;
    });

    if (records.length) {
      const result = await auth.importUsers(records, {
        hash: { algorithm: 'BCRYPT' },
      });
      if (result.failureCount) {
        const codes = result.errors.map((item) => item.error?.code || 'unknown');
        throw new Error(`Firebase rejected ${result.failureCount} imported users (${[...new Set(codes)].join(', ')}). Resolve the account conflicts before switching.`);
      }
      imported += result.successCount;
    }
    alreadyPresent += batch.length - records.length;
  }

  console.log(
    `Firebase user import finished: ${imported} imported, ${alreadyPresent} already present, ` +
    `${passwordResetRequired} imported without a supported bcrypt hash (those users must reset their password). ` +
    'Existing MongoDB users were not changed.'
  );
}

main()
  .catch((error) => {
    console.error('Firebase user import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (admin.apps.length) await Promise.all(admin.apps.map((app) => app.delete()));
  });
