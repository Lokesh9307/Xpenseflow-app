package com.xpenseflow.app

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
