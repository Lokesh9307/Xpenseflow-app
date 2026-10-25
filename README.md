# XpenseFlow Mobile (100% Standalone Android App)

A 100% self-contained, standalone mobile application for **XpenseFlow**, built with **React Native Expo** and an embedded on-device **MongoDB Database Engine**. Everything runs directly inside a single Android APK with **zero external backend servers or extra deployments required**.

> **100% Standalone & Zero Dependencies on `myExpense`**:
> - All models, collections, authentication, logic, and state management run inside the native app itself.
> - `myExpense` remains completely untouched.
> - No separate backend server to deploy or keep alive.

---

## 🏗️ Architecture

```
mobile/
├── src/
│   ├── components/                # Header, 4-in-1 FAB, Calculator Modal, Add Modals
│   ├── constants/theme.ts         # Exact Apple-inspired colors (OLED Dark & Warm Ivory)
│   ├── context/
│   │   ├── AuthContext.tsx        # In-App User Session & Storage
│   │   └── ThemeContext.tsx       # Dark & Light Mode Controller
│   ├── navigation/
│   │   ├── BottomTabNavigator.tsx # Floating Bottom Navigation Bar
│   │   └── RootNavigator.tsx      # Auth Stack & App Navigation
│   ├── screens/
│   │   ├── auth/                  # Login, Register, OTP Verify, Forgot Password
│   │   ├── onboarding/            # Currency & Budget Setup
│   │   ├── dashboard/             # Bento Cards, Cash Flow, Week Trend, Recents
│   │   ├── expenses/              # Expense List, Search, Category Filter, CSV Export
│   │   ├── splits/                # Group Bills, Equal & Custom Splits, Balances
│   │   ├── tiffin/                # Meal Tracker (Lunch/Dinner), Monthly Billing
│   │   ├── chatbot/               # AI Chatbot with Agentic Form Pills (Groq Cloud)
│   │   ├── recurring/             # Subscriptions & Recurring Bills
│   │   ├── analytics/             # Category Breakdown, Monthly Trends
│   │   └── profile/               # User Settings, Theme Toggle, Data Management
│   └── services/
│       ├── mongoEngine.ts         # On-Device MongoDB BSON/JSON Collection Engine
│       │                          # (users, expenses, incomes, categories, budgets,
│       │                          #  recurring, splits, tiffin, notifications)
│       └── api.ts                 # Full CRUD operations over Mongo collections
├── assets/                        # App icons and splash screens
├── App.tsx                        # Application Root
├── app.json                       # Android package & Expo configuration
└── .env                           # Environment configuration (Groq AI, etc.)
```

---

## ⚡ 100% Standalone MongoDB Database

The mobile app includes an embedded **MongoDB Collection Engine** (`src/services/mongoEngine.ts`):
- **MongoDB ObjectId**: Standard 24-character hex ObjectIds for all records.
- **Collections**:
  - `db.users`
  - `db.expenses`
  - `db.incomes`
  - `db.categories`
  - `db.budgets`
  - `db.recurring`
  - `db.splitGroups` & `db.splitExpenses`
  - `db.tiffinGroups` & `db.tiffinEntries`
  - `db.notifications`
- **Full CRUD API**: `find()`, `findOne()`, `findById()`, `insertOne()`, `updateOne()`, `deleteOne()`, `count()`.
- **Pre-seeded**: Automatically seeds initial categories, mock expenses, incomes, and split groups on first install for an immediate, beautiful out-of-the-box experience.
- **AI Chatbot**: Uses Groq Cloud LLaMA 3 directly from the device via HTTPS with local Natural Language Expense extraction fallback.

---

## 🚀 Running the Standalone Android App

### Start the Expo App
From the `mobile` directory:
```bash
npm run android
# or
npm run start
```

- Press **`a`** to open in the Android emulator.
- Or scan the QR code using the **Expo Go** app on your physical Android phone.

### Build the Standalone APK
To compile a standalone Android APK:
```bash
npx eas-cli build -p android --profile preview
```
This produces a single, self-contained `.apk` file that installs and runs directly on any Android phone without needing any backend server!
