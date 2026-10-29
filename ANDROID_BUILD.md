# Android APK

The GitHub Actions workflow at `.github/workflows/android-apk.yml` builds an
installable Android **release-variant APK** from the existing native project
with Gradle; it does not use EAS Build. The release variant embeds the
JavaScript app, so you can install and launch it without running Metro. Push
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
`./gradlew assembleRelease --no-daemon`, verifies the APK's application ID
(`com.xpenseflow.app`) and embedded JavaScript bundle, and uploads
`xpenseflow-android-apk` for seven days. Download that artifact from the
completed workflow run and extract `app-release.apk`.

The native `android/` project must be included in the repository: it was
previously excluded by `.gitignore`. Stage its source files along with this
workflow when committing; build outputs, local SDK settings, and debug
keystores remain ignored. The workflow builds this native project directly and
does not regenerate it with Expo Prebuild.

## Install and use

This APK contains the JavaScript bundle and starts without Metro. The app uses
the `EXPO_PUBLIC_API_URL` value embedded during the build, or
`https://xpenseflow-backend.onrender.com` if that variable is unset. An API URL
saved in the app takes precedence. To use the Cloudflare backend, set the
GitHub repository variable `EXPO_PUBLIC_API_URL` to the deployed Worker base
URL (without an `/api` suffix), then build and install a new APK. Features that
require the backend need an internet connection and that service to be
available.

1. Download `xpenseflow-android-apk` from the completed GitHub Actions run and
   extract `app-release.apk`.
2. Transfer the APK to your Android phone, tap it, and allow your browser or
   file manager to install apps from that source if Android asks.
3. Open **XpenseFlow** and sign in or create an account. An internet
   connection is needed for backend features.

The workflow signs this sideloadable test build with a temporary debug key; it
does not use or replace an EAS production keystore. It is not signed for
Google Play distribution. Each run has a different key, so uninstall an
earlier workflow build before installing a newer one if Android reports a
signing-certificate mismatch. A persistent production signing key is needed
for Play Store releases and seamless APK upgrades.

## EAS Updates

This workflow leaves `app.json` and the Expo Updates configuration unchanged.
It builds the existing native project directly and does not run EAS Build,
Expo Prebuild, or EAS Update. The previous runtime-version-policy warning was
about EAS bare-workflow builds; this workflow does not use EAS cloud
compilation and requires no `EXPO_TOKEN`. Preserve the runtime-version
strategy you intend to use for EAS Updates.
