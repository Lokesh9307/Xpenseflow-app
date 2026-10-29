package com.xpenseflow.app

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

        val hasAmount = Regex("(?i)(?:rs\\.?|inr|₹)\\s*[0-9,]+(?:\\.[0-9]{1,2})?")
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
        val match = Regex("(?i)(?:rs\\.?|inr|₹)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)")
            .find(body) ?: return null
        return match.groupValues[1].replace(",", "").removeSuffix(".00")
    }
}
