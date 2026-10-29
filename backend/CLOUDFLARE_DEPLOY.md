# Free Cloudflare backend

The backend is being migrated from the Render/Express/MongoDB service to a
Cloudflare Worker with D1 and Firebase Authentication. This uses the free tiers
only while the account remains within the providers' current limits. There is no
EAS build involved. Do not remove the Render service or MongoDB database until
the migration and mobile-app smoke tests have passed.

> **Migration status:** the Worker is a partial port of the Express API. Verify
> every feature used by the app before directing production traffic to it.
> Deploying the Worker does not by itself mean that feature parity or a
> successful migration has been proven.

## Cloudflare Pages build error

The `npx expo export -p web` command is a Cloudflare Pages web-build command;
it is not needed to deploy this API. XpenseFlow's backend is deployed as a
Cloudflare Worker by `.github/workflows/deploy-cloudflare-backend.yml`, which
runs Wrangler from this `backend` directory. Do not use the mobile app's
repository root as a Pages project with that custom build command. Configure
the Worker through the setup below instead; no Expo web export or EAS cloud
build is involved.

## Free-tier resources

- Cloudflare Workers Free runs the stateless API.
- Cloudflare D1 Free stores application records.
- Firebase Authentication's no-cost tier handles email/password identity and
  verification/reset links.
- Current documented free allowances include 100,000 Worker requests per day
  with 10 ms CPU per invocation, D1 up to 5 million rows read and 100,000 rows
  written per day with 5 GB total storage, and up to 50,000 monthly active
  users for non-phone Firebase Authentication. See the [Workers pricing
  limits](https://developers.cloudflare.com/workers/platform/pricing/),
  [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), and
  [Firebase pricing](https://firebase.google.com/pricing) pages for current
  terms. Free-tier overages can stop requests; do not upgrade or enable billing
  without choosing to do so.
- Keep each provider within its current free quota; quotas, plan terms, and
  availability can change. Do not enable a paid plan or Cloudflare Containers.

## One-time setup

1. Create a Firebase project on the no-cost plan. Enable **Email/Password**
   sign-in. Copy its Web API key from Firebase project settings; the key is
   public client configuration, but configure it as a Worker secret here.
2. From this directory, install the locked backend dependencies and create D1:

   ```powershell
   npm ci
   npx wrangler login
   npx wrangler d1 create xpenseflow-db
   ```

3. Copy the D1 database ID printed by Wrangler into `wrangler.jsonc`, replacing
   the all-zero placeholder. Do not deploy while the placeholder remains.
4. In Cloudflare, create a token that can deploy Workers and manage D1 for the
   correct account. In GitHub repository **Settings → Secrets and variables →
   Actions**, add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. Push to `main` or run **Deploy Cloudflare Worker backend** from the Actions
   tab. The workflow applies the checked-in D1 migration and deploys the Worker.
   A configured D1 ID and GitHub secrets are required.
6. After the first deployment, set runtime secrets from this directory. Wrangler
   prompts for their values; do not put them in source control:

   ```powershell
   npx wrangler secret put FIREBASE_API_KEY
   npx wrangler secret put JWT_SECRET
   ```

   Use a newly generated, strong JWT secret. Replacing the existing Render JWT
   secret invalidates old Render sessions but does not affect the Firebase
   password hashes. After configuring the secrets, verify
   `https://<worker-url>/api/health` returns HTTP 200 and reports the database
   and authentication as configured.

## Safely migrate data

The export contains private financial records and password hashes. It is
ignored by Git; keep it on a trusted local machine and never attach or upload it.
The export script reads `MONGODB_URI` from `backend/.env` and does not modify
MongoDB.

1. Keep the existing MongoDB/Render service running. In `backend/.env`, set the
   existing MongoDB connection string locally, then export:

   ```powershell
   npm run data:export
   ```

2. Create a Firebase service-account key for the same Firebase project, save it
   outside the repository, and set its path locally:

   ```powershell
   $env:FIREBASE_SERVICE_ACCOUNT_PATH = 'C:\secure-path\firebase-service-account.json'
   npm run data:import:firebase
   ```

   This preserves each MongoDB user ID as the Firebase UID so references in
   financial records remain stable. Bcrypt hashes are imported as BCRYPT. Users
   without a supported bcrypt hash are imported without a password and must use
   **Forgot Password** to set one. The script does not delete MongoDB users.
3. Import the exported records into D1. Set these temporary environment
   variables in the same PowerShell session, then run the import:

   ```powershell
   $env:CLOUDFLARE_ACCOUNT_ID = '<account-id>'
   $env:D1_DATABASE_ID = '<database-id>'
   $env:CLOUDFLARE_API_TOKEN = '<temporary D1 API token>'
   npm run data:import:d1
   ```

   The token is sent only to Cloudflare by the local import script. Do not paste
   it into chat, a file in the repository, or a terminal transcript you intend
   to share. Clear the session variables after the import:

   ```powershell
   Remove-Item Env:CLOUDFLARE_ACCOUNT_ID, Env:D1_DATABASE_ID, Env:CLOUDFLARE_API_TOKEN
   ```

4. The D1 import is an upsert and does not delete source records. Review the
   import counts and verify representative user, expense, split, and Tiffin
   records before switching app traffic.

## Point a new mobile build at the Worker

Only switch after checking API parity, data, and the health endpoint. In GitHub
repository **Settings → Secrets and variables → Actions → Variables**, set
`EXPO_PUBLIC_API_URL` to the Worker origin (scheme and hostname only, without
`/api`). Build and install a new APK using the Android APK workflow. The new
mobile app detects the server's auth mode: it uses Firebase email links with
the Worker and retains the existing 4-digit OTP flow with Render. An older APK
that still expects 4-digit OTPs is not compatible with the Worker. A build-time
`EXPO_PUBLIC_API_URL` takes precedence over any URL saved by an older app, so a
later build can point back to Render. Old Render JWT sessions will be rejected
after the Worker secret changes; the app clears the expired token and asks the
user to sign in again without deleting the local finance cache.

The app's first login after cutover should be followed by checks of profile,
expense/income, budget, recurring, notification, split, Tiffin, and chat flows.
Keep Render and MongoDB running and unchanged for rollback. **They are not
automatically synchronized with D1 after cutover.** Before rolling back after
new writes have reached D1, export and reconcile those new records; simply
pointing the app back at Render would otherwise show stale data.

## Limitations and security

- The Worker currently ports only a subset of the existing Express routes and
  behavior. In particular, complex split settlement, recurring, and AI chat
  parity must be verified before a production cutover.
- D1 is a relational service with SQLite semantics, not MongoDB. Inspect
  Worker logs and D1 usage; free-tier requests/rows/storage are capped.
- Firebase reset and verification actions open Firebase's secure hosted
  action page in the browser. Users return to the app and sign in after
  completing the link action.
- Never commit Mongo exports, service-account JSON, `.env`, or API tokens.
  Rotate any credentials that were previously exposed. Retain the old MongoDB
  backup until the new deployment and rollback window are complete.
- This setup is for a debug/test APK and a no-cost backend. It does not create a
  production-signed Android release.
