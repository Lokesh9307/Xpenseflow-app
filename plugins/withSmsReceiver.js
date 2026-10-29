/**
 * Expo Config Plugin: withSmsReceiver
 *
 * Injects a native Kotlin SMS BroadcastReceiver, a persistent queue, and a
 * ReactNative NativeModule into the Android project at prebuild time.
 *
 * What this plugin does:
 * 1. Adds RECEIVE_SMS + POST_NOTIFICATIONS permissions to AndroidManifest.xml
 *    (READ_SMS is not needed)
 * 2. Registers a BroadcastReceiver for SMS_RECEIVED action that runs even
 *    when the app process is dead
 * 3. Creates Kotlin files:
 *    - SmsBroadcastReceiver.kt → captures incoming SMS
 *    - SmsQueue.kt             → persists SMS while RN is not running and
 *                                posts a native heads-up notification
 *    - SmsListenerModule.kt    → bridges events to React Native JS
 *    - SmsListenerPackage.kt   → registers the native module
 * 4. Wires the package into MainApplication
 *
 * Key design point: an SMS arriving while the app is killed is NEVER dropped.
 * It is persisted (capped at 50) and each detected transaction surfaces as a
 * heads-up notification; nothing is ever added as an expense automatically —
 * the JS side drains the queue on next launch and shows the review bottom
 * sheet so the user picks the category before any expense is saved.
 */

const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ── 1. Add SMS + notification Permissions + BroadcastReceiver to Manifest ────
function withSmsPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Add permissions if not present
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    // Keep READ_SMS excluded: the broadcast receiver only needs RECEIVE_SMS.
    manifest['uses-permission'] = manifest['uses-permission'].filter((p) => {
      const name = p.$?.['android:name'];
      return (
        name !== 'android.permission.SYSTEM_ALERT_WINDOW' &&
        name !== 'android.permission.READ_SMS'
      );
    });

    const existingPerms = manifest['uses-permission'].map(
      (p) => p.$?.['android:name']
    );

    const requiredPerms = [
      'android.permission.RECEIVE_SMS',
      'android.permission.POST_NOTIFICATIONS',
    ];

    for (const perm of requiredPerms) {
      if (!existingPerms.includes(perm)) {
        manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // Add BroadcastReceiver to <application>
    const app = manifest.application?.[0];
    if (app) {
      if (!app.receiver) {
        app.receiver = [];
      }

      const receiverName = '.SmsBroadcastReceiver';
      const alreadyRegistered = app.receiver.some(
        (r) => r.$?.['android:name'] === receiverName
      );

      if (!alreadyRegistered) {
        app.receiver.push({
          $: {
            'android:name': receiverName,
            'android:exported': 'true',
            'android:permission': 'android.permission.BROADCAST_SMS',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' },
                },
              ],
            },
          ],
        });
      }
    }

    return cfg;
  });
}

// ── 2. Generate Kotlin Source Files ──────────────────────────────────────────
function withSmsKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const packageName = cfg.android?.package || 'com.xpenseflow.app';
      const packageDir = packageName.replace(/\./g, '/');
      const srcDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...packageDir.split('/')
      );

      // Ensure directory exists
      fs.mkdirSync(srcDir, { recursive: true });

      // ── SmsQueue.kt ──────────────────────────────────────────────────────
      const queueKt = `package ${packageName}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Hold-and-forward queue for transaction SMS received while the React Native
 * JS engine is NOT running (app killed by the user or by the OS).
 *
 * Every incoming SMS captured while the feature is enabled is persisted here.
 * On the next app launch the JS side drains this queue, parses each message
 * and shows the review bottom sheet — nothing is ever added automatically
 * as an expense.
 */
object SmsQueue {

    private const val PREFS = "xpenseflow_sms_queue"
    private const val KEY_ENABLED = "autodetect_enabled"
    private const val KEY_MESSAGES = "messages"
    private const val MAX_MESSAGES = 50
    private const val CHANNEL_ID = "sms_transactions"
    private const val NOTIFICATION_ID = 42100

    fun isEnabled(context: Context): Boolean {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, false)
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_ENABLED, enabled)
            .apply()
    }

    /**
     * Persist an incoming SMS so it is never lost, regardless of app state.
     * Returns the receive timestamp that was recorded, or -1 if the feature
     * is disabled (message intentionally ignored by the receiver).
     */
    fun onSmsArrived(context: Context, sender: String, body: String, timestamp: Long): Long {
        if (!isEnabled(context)) return -1
        val ts = if (timestamp > 0) timestamp else System.currentTimeMillis()
        val messages = readMessages(context)
        val entry = JSONObject()
        entry.put("sender", sender)
        entry.put("body", body)
        entry.put("timestamp", ts)
        messages.put(entry)
        while (messages.length() > MAX_MESSAGES) {
            messages.remove(0)
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MESSAGES, messages.toString())
            .apply()
        return ts
    }

    /** Read all queued messages and clear the queue atomically. */
    fun drain(context: Context): JSONArray {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_MESSAGES, "[]") ?: "[]"
        prefs.edit().putString(KEY_MESSAGES, "[]").apply()
        // Clear the native heads-up notification — JS now owns the review flow
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
        }
        return JSONArray(raw)
    }

    private fun readMessages(context: Context): JSONArray {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_MESSAGES, null)
        return if (raw != null) {
            try {
                JSONArray(raw)
            } catch (e: Exception) {
                JSONArray()
            }
        } else {
            JSONArray()
        }
    }

    // ── Native heads-up notification (fires even when RN is not running) ──
    fun postTransactionNotification(context: Context, amountText: String?) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ensureChannel(nm)
        }

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: return
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (amountText != null) {
            "Transaction detected — " + amountText
        } else {
            "Transaction detected"
        }
        val bodyText = "Tap to review and categorise your expense — nothing is saved until you confirm."

        val builder: Notification.Builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
                .setPriority(Notification.PRIORITY_HIGH)
        }

        val notification = builder
            .setSmallIcon(getIconRes(context))
            .setContentTitle(title)
            .setContentText(bodyText)
            .setStyle(Notification.BigTextStyle().bigText(bodyText))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            nm.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            // Never crash the receiver over a notification failure
        }
    }

    private fun ensureChannel(nm: NotificationManager) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "SMS Transactions",
            NotificationManager.IMPORTANCE_HIGH
        )
        channel.description = "Alerts for auto-detected bank transactions. Tap to categorise."
        channel.enableVibration(true)
        channel.vibrationPattern = longArrayOf(0, 250, 250, 250)
        nm.createNotificationChannel(channel)
    }

    private fun getIconRes(context: Context): Int {
        val res = context.resources.getIdentifier(
            "ic_stat_notify", "mipmap", context.packageName
        )
        if (res != 0) return res
        val fallback = context.resources.getIdentifier(
            "ic_launcher", "mipmap", context.packageName
        )
        return if (fallback != 0) fallback else 1
    }

    /**
     * Very lightweight native heuristic used ONLY to decide whether the SMS
     * is worth a heads-up notification while the app is dead. Real parsing /
     * categorisation still happens in JS on the next launch.
     */
    fun isLikelyTransaction(body: String): Boolean {
        val lower = body.lowercase()
        if (lower.contains("otp")) return false
        if (lower.contains("verification code")) return false

        val hasAmount = Regex("(?i)(?:rs\\\\.?|inr|₹)\\\\s*[0-9,]+(?:\\\\.[0-9]{1,2})?")
            .containsMatchIn(body)
        if (!hasAmount) return false

        val debitOrCredit = listOf(
            "debited", "debit", "credited", "credit", "spent", "paid",
            "purchase", "withdrawn", "transferred", "txn"
        )
        return debitOrCredit.any { lower.contains(it) }
    }

    /** Extract the first amount string (formatted for the notification title). */
    fun extractAmount(body: String): String? {
        val match = Regex("(?i)(?:rs\\\\.?|inr|₹)\\\\s*([0-9][0-9,]*(?:\\\\.[0-9]{1,2})?)")
            .find(body) ?: return null
        return match.groupValues[1].replace(",", "").removeSuffix(".00")
    }
}
`;
      fs.writeFileSync(path.join(srcDir, 'SmsQueue.kt'), queueKt);

      // ── SmsBroadcastReceiver.kt ──────────────────────────────────────────
      const receiverKt = `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/**
 * Native BroadcastReceiver that captures incoming SMS messages — even when
 * the app process is dead. Each message is:
 *  1. Persisted by SmsQueue so it is never lost, and
 *  2. Emitted to React Native (if the JS engine is alive), otherwise a
 *     native heads-up notification is posted telling the user to review.
 *
 * Nothing is ever added as an expense automatically — review via bottom
 * sheet is mandatory.
 */
class SmsBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        context ?: return
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

        // Group multi-part SMS by originating address (keep first-part timestamp)
        val grouped = LinkedHashMap<String, Pair<StringBuilder, Long>>()
        for (msg in messages) {
            val sender = msg.originatingAddress ?: "UNKNOWN"
            val body = msg.messageBody ?: continue
            val ts = msg.timestampMillis
            val existing = grouped[sender]
            if (existing == null) {
                grouped[sender] = Pair(StringBuilder(body), ts)
            } else {
                existing.first.append(body)
            }
        }

        // Forward each complete message to the queue + React Native bridge
        for ((sender, pair) in grouped) {
            val (body, ts) = pair
            val recordedTs = SmsQueue.onSmsArrived(context, sender, body.toString(), ts)
            if (recordedTs < 0) continue // feature disabled — ignore silently

            val emittedToJs = SmsListenerModule.onSmsReceived(sender, body.toString(), recordedTs)
            val likelyTxn = SmsQueue.isLikelyTransaction(body.toString())
            if (!emittedToJs && likelyTxn) {
                SmsQueue.postTransactionNotification(
                    context,
                    SmsQueue.extractAmount(body.toString())
                )
            }
        }
    }
}
`;
      fs.writeFileSync(path.join(srcDir, 'SmsBroadcastReceiver.kt'), receiverKt);

      // ── SmsListenerModule.kt ─────────────────────────────────────────────
      const moduleKt = `package ${packageName}

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native NativeModule that:
 * 1. Receives SMS events from SmsBroadcastReceiver (static callback)
 * 2. Emits "onSmsReceived" events to JavaScript
 * 3. Exposes startListening/stopListening to control the persisted flag
 * 4. Exposes pullQueuedSms so JS can recover messages received while
 *    the app was dead (never add automatically — always review via sheet)
 */
class SmsListenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsListenerModule"

    companion object {
        private var instance: SmsListenerModule? = null

        /**
         * Called by SmsBroadcastReceiver when an SMS arrives.
         * Returns true only if the event was successfully emitted to JS.
         */
        fun onSmsReceived(sender: String, body: String, timestamp: Long): Boolean {
            val module = instance ?: return false
            val ctx = module.reactApplicationContext ?: return false
            if (!ctx.hasActiveReactInstance()) return false
            val ts = if (timestamp > 0) timestamp else System.currentTimeMillis()
            val params = Arguments.createMap().apply {
                putString("sender", sender)
                putString("body", body)
                putDouble("timestamp", ts.toDouble())
            }
            return try {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onSmsReceived", params)
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    init {
        instance = this
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        // Persist so the broadcast receiver keeps the queue & notifications
        // armed after the app process has been killed.
        SmsQueue.setEnabled(reactApplicationContext, true)
        promise.resolve(true)
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        SmsQueue.setEnabled(reactApplicationContext, false)
        promise.resolve(true)
    }

    @ReactMethod
    fun isActive(promise: Promise) {
        promise.resolve(SmsQueue.isEnabled(reactApplicationContext))
    }

    /**
     * Drain the native SMS queue. Returns all messages persisted since the
     * last drain and clears it. JS parses each and shows the review sheet.
     */
    @ReactMethod
    fun pullQueuedSms(promise: Promise) {
        try {
            val out: WritableArray = WritableNativeArray()
            val queue = SmsQueue.drain(reactApplicationContext)
            for (i in 0 until queue.length()) {
                val obj = queue.getJSONObject(i)
                val map = Arguments.createMap()
                map.putString("sender", obj.optString("sender"))
                map.putString("body", obj.optString("body"))
                map.putDouble("timestamp", obj.optDouble("timestamp", System.currentTimeMillis().toDouble()))
                out.pushMap(map)
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("PULL_FAILED", e)
        }
    }

    /**
     * Required for NativeEventEmitter on the JS side.
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN NativeEventEmitter
    }
}
`;
      fs.writeFileSync(path.join(srcDir, 'SmsListenerModule.kt'), moduleKt);

      // ── SmsListenerPackage.kt ────────────────────────────────────────────
      const packageKt = `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage that registers SmsListenerModule with the React Native bridge.
 */
class SmsListenerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(SmsListenerModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;
      fs.writeFileSync(path.join(srcDir, 'SmsListenerPackage.kt'), packageKt);

      return cfg;
    },
  ]);
}

// ── 3. Wire SmsListenerPackage into MainApplication ─────────────────────────
function withSmsMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    // IMPORTANT: build line breaks from a runtime constant instead of string
    // escapes — an import line emitted before the `package` declaration (or a
    // literal "\n" dumped into the file) breaks Kotlin compilation.
    const NEWLINE = String.fromCharCode(10);
    let contents = cfg.modResults.contents;
    const packageName = cfg.android?.package || 'com.xpenseflow.app';

    // NOTE: SmsListenerPackage lives in the SAME package as the application,
    // so Kotlin resolves it without an import statement. Never insert an
    // import line — an import placed before `package` is invalid Kotlin.

    // Add package registration if not present
    if (!contents.includes('SmsListenerPackage()')) {
      // 1. Kotlin: PackageList(this).packages.apply { ... }
      if (contents.includes('PackageList(this).packages.apply')) {
        contents = contents.replace(
          /PackageList\(this\)\.packages\.apply\s*\{/,
          'PackageList(this).packages.apply {'
            + NEWLINE
            + '        add(SmsListenerPackage())'
        );
      }
      // 2. Kotlin: PackageList(this).packages (single expression or without apply)
      else if (contents.includes('PackageList(this).packages')) {
        contents = contents.replace(
          /PackageList\(this\)\.packages/g,
          'PackageList(this).packages.apply { add(SmsListenerPackage()) }'
        );
      }
      // 3. Java: packages.add(...)
      else if (/packages\.add\([^)]+\)/.test(contents)) {
        contents = contents.replace(
          /packages\.add\([^)]+\)/,
          (match) => match + NEWLINE + '          packages.add(new SmsListenerPackage())'
        );
      }
    }

    // Ensure reactHost also includes SmsListenerPackage if reactHost has its own packageList
    if (
      contents.includes('packageList = PackageList(this).packages') &&
      !contents.includes('packageList = PackageList(this).packages.apply { add(SmsListenerPackage()) }')
    ) {
      contents = contents.replace(
        'packageList = PackageList(this).packages',
        'packageList = PackageList(this).packages.apply { add(SmsListenerPackage()) }'
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

// ── Combine all modifications into one plugin ───────────────────────────────
module.exports = function withSmsReceiver(config) {
  config = withSmsPermissions(config);
  config = withSmsKotlinFiles(config);
  config = withSmsMainApplication(config);
  return config;
};
