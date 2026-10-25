/**
 * Expo Config Plugin: withSmsReceiver
 * 
 * Injects a native Kotlin SMS BroadcastReceiver and a ReactNative NativeModule 
 * into the Android project at prebuild time.
 * 
 * What this plugin does:
 * 1. Adds RECEIVE_SMS + READ_SMS permissions to AndroidManifest.xml
 * 2. Registers a BroadcastReceiver for SMS_RECEIVED action
 * 3. Creates Kotlin files:
 *    - SmsBroadcastReceiver.kt   → captures incoming SMS
 *    - SmsListenerModule.kt      → bridges events to React Native JS
 *    - SmsListenerPackage.kt     → registers the native module
 * 4. Wires the package into MainApplication
 */

const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ── 1. Add SMS Permissions + BroadcastReceiver to AndroidManifest ────────────
function withSmsPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Add permissions if not present
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    // Filter out dangerous/unused permissions if previously added
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

      // ── SmsBroadcastReceiver.kt ──────────────────────────────────────────
      const receiverKt = `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/**
 * Native BroadcastReceiver that captures incoming SMS messages.
 * Extracts sender address and message body, then forwards to
 * the SmsListenerModule for React Native event emission.
 */
class SmsBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        // Group multi-part SMS by originating address
        val grouped = mutableMapOf<String, StringBuilder>()
        for (msg in messages) {
            val sender = msg.originatingAddress ?: "UNKNOWN"
            grouped.getOrPut(sender) { StringBuilder() }.append(msg.messageBody ?: "")
        }

        // Forward each complete message to the React Native bridge
        for ((sender, body) in grouped) {
            SmsListenerModule.onSmsReceived(sender, body.toString())
        }
    }
}
`;
      fs.writeFileSync(path.join(srcDir, 'SmsBroadcastReceiver.kt'), receiverKt);

      // ── SmsListenerModule.kt ─────────────────────────────────────────────
      const moduleKt = `package ${packageName}

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native NativeModule that:
 * 1. Receives SMS events from SmsBroadcastReceiver (static callback)
 * 2. Emits "onSmsReceived" events to JavaScript
 * 3. Exposes startListening/stopListening methods
 */
class SmsListenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsListenerModule"

    companion object {
        private var instance: SmsListenerModule? = null
        private var isListening: Boolean = false

        /**
         * Called by SmsBroadcastReceiver when an SMS arrives.
         * This is a static method so the BroadcastReceiver can call it
         * without a direct reference to the React context.
         */
        fun onSmsReceived(sender: String, body: String) {
            if (!isListening) return
            val module = instance ?: return
            val ctx = module.reactApplicationContext ?: return

            if (!ctx.hasActiveReactInstance()) return

            val params = Arguments.createMap().apply {
                putString("sender", sender)
                putString("body", body)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onSmsReceived", params)
        }
    }

    init {
        instance = this
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        isListening = true
        promise.resolve(true)
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        isListening = false
        promise.resolve(true)
    }

    @ReactMethod
    fun isActive(promise: Promise) {
        promise.resolve(isListening)
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
    let contents = cfg.modResults.contents;
    const packageName = cfg.android?.package || 'com.xpenseflow.app';

    // Add import if not present
    const importLine = `import ${packageName}.SmsListenerPackage`;
    if (!contents.includes(importLine)) {
      // Add import after the last import statement
      const lastImportIndex = contents.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const lineEnd = contents.indexOf('\n', lastImportIndex);
        contents =
          contents.slice(0, lineEnd + 1) +
          importLine +
          '\n' +
          contents.slice(lineEnd + 1);
      } else {
        contents = importLine + '\n' + contents;
      }
    }

    // Add package registration if not present
    if (!contents.includes('SmsListenerPackage()')) {
      // 1. Kotlin: PackageList(this).packages.apply { ... }
      if (contents.includes('PackageList(this).packages.apply')) {
        contents = contents.replace(
          /PackageList\(this\)\.packages\.apply\s*\{/,
          'PackageList(this).packages.apply {\n              add(SmsListenerPackage())'
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
      else if (/packages\.add\(new \w+\(\)\)/.test(contents)) {
        contents = contents.replace(
          /packages\.add\(new \w+\(\)\)/,
          (match) => `${match}\n          packages.add(new SmsListenerPackage())`
        );
      } else if (/(packages\.add\([^)]+\))/.test(contents)) {
        contents = contents.replace(
          /(packages\.add\([^)]+\))/,
          (match) => `${match}\n          packages.add(new SmsListenerPackage())`
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
