package com.xpenseflow.app

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
