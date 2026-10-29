# Android debug APK

The GitHub Actions workflow at `.github/workflows/android-apk.yml` builds the
existing native Android project with Gradle; it does not use EAS Build. Push
mobile application changes to `main` or `master` to start a build, or open the
GitHub repository's **Actions** tab, select **Android APK**, and choose **Run
workflow**. The optional `ref` input builds another branch; leave it blank to
use the branch selected in GitHub.

The workflow uses Node.js 26, Java 17, the checked-in Gradle 9.4.1 wrapper,
Android platform 37.0, build tools 37.0.0, and NDK 27.1.12297006. It installs
the platform from Google's SDK preview channel (`sdkmanager --channel=3`)
because the stable channel does not yet publish API 37. This matches the
compile SDK required by React Native 0.88.1 and Expo SDK 58 dependencies and
avoids bypassing their AAR metadata checks. The workflow runs `npm ci` and
`./gradlew assembleDebug --no-daemon`, verifies that the output APK has
application ID `com.xpenseflow.app`, and uploads `xpenseflow-android-apk` for
seven days. Download that artifact from the completed workflow run and extract
`app-debug.apk`.

The native `android/` project must be included in the repository: it was
previously excluded by `.gitignore`. Stage its source files along with this
workflow when committing; build outputs, local SDK settings, and debug
keystores remain ignored. The workflow builds this native project directly and
does not regenerate it with Expo Prebuild.

## Install and run

This is the existing **debug development-client** variant: `expo-dev-client`
is installed, and React Native's `debug` variant skips bundling the current
JavaScript source. A previously embedded Expo Updates bundle may also be
present in the native project, but the development client is intended to load
the current source from Metro. The workflow reports whether a JavaScript
bundle is present in the finished APK; it does not certify the APK as a
standalone release.

1. Install Android Platform Tools (`adb`) and enable USB debugging on the
   Android phone, or connect the phone and computer to the same Wi-Fi network.
2. From the mobile repository root, install JavaScript dependencies with
   `npm ci` and configure any required local development environment variables
   in the ignored `.env` file. Do not commit `.env` or signing keys.
3. Start Metro with `npx expo start --dev-client --host lan`.
4. Install the downloaded APK using `adb install -r app-debug.apk` (or tap the
   APK on the phone and allow installation from that source).
5. Open the installed XpenseFlow development client and scan the QR code from
   the Expo terminal to load the app from Metro.

The workflow creates a temporary debug signing key when none is present; it
does not use or replace an EAS production keystore. Because each hosted runner
creates its own temporary key, uninstall an APK from a previous workflow run
before installing a new run's APK if Android reports a signing-certificate
mismatch. No production release signing is configured.

## EAS Updates

This workflow leaves `app.json` and the Expo Updates configuration unchanged.
It builds the existing native project directly and does not run EAS Build,
Expo Prebuild, or EAS Update. The previous runtime-version-policy warning was
about EAS bare-workflow builds; this workflow does not use EAS cloud
compilation and requires no `EXPO_TOKEN`. Preserve the runtime-version
strategy you intend to use for EAS Updates.
