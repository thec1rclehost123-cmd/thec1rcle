const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withEntitlementsPlist,
  withGradleProperties,
  withInfoPlist,
} = require('@expo/config-plugins');

const RELEASE_GRADLE_APPLY = "apply from: './release-hardening.gradle'";

const RELEASE_HARDENING_GRADLE = `
def c1rcleReleaseSigningValues = [
    storeFile: findProperty('C1RCLE_RELEASE_STORE_FILE') ?: System.getenv('C1RCLE_RELEASE_STORE_FILE'),
    storePassword: findProperty('C1RCLE_RELEASE_STORE_PASSWORD') ?: System.getenv('C1RCLE_RELEASE_STORE_PASSWORD'),
    keyAlias: findProperty('C1RCLE_RELEASE_KEY_ALIAS') ?: System.getenv('C1RCLE_RELEASE_KEY_ALIAS'),
    keyPassword: findProperty('C1RCLE_RELEASE_KEY_PASSWORD') ?: System.getenv('C1RCLE_RELEASE_KEY_PASSWORD'),
]
def c1rcleHasAnySigningValue = c1rcleReleaseSigningValues.values().any { it != null && !it.toString().trim().isEmpty() }
def c1rcleHasCompleteSigning = c1rcleReleaseSigningValues.values().every { it != null && !it.toString().trim().isEmpty() }

if (c1rcleHasAnySigningValue && !c1rcleHasCompleteSigning) {
    throw new GradleException('Local Android release signing is incomplete. Set all C1RCLE_RELEASE_* values or none; EAS injects cloud credentials.')
}

if (c1rcleHasCompleteSigning) {
    def c1rcleReleaseSigning = android.signingConfigs.maybeCreate('release')
    c1rcleReleaseSigning.storeFile = file(c1rcleReleaseSigningValues.storeFile)
    c1rcleReleaseSigning.storePassword = c1rcleReleaseSigningValues.storePassword
    c1rcleReleaseSigning.keyAlias = c1rcleReleaseSigningValues.keyAlias
    c1rcleReleaseSigning.keyPassword = c1rcleReleaseSigningValues.keyPassword
    android.buildTypes.release.signingConfig = c1rcleReleaseSigning
}

tasks.register('printReleaseReadiness') {
    group = 'verification'
    description = 'Prints Android release identity and compatibility inputs without exposing credentials.'
    doLast {
        def signing = android.buildTypes.release.signingConfig
        println 'release.applicationId=' + android.defaultConfig.applicationId
        println 'release.versionName=' + android.defaultConfig.versionName
        println 'release.versionCode=' + android.defaultConfig.versionCode
        println 'release.compileSdk=' + rootProject.ext.compileSdkVersion
        println 'release.targetSdk=' + rootProject.ext.targetSdkVersion
        println 'release.minSdk=' + rootProject.ext.minSdkVersion
        println 'release.ndkVersion=' + rootProject.ext.ndkVersion
        println 'release.legacyNativePackaging=' + (findProperty('expo.useLegacyPackaging') ?: 'false')
        println 'release.devLauncherEnabled=' + (findProperty('expo.devlauncher.configureInRelease') ?: 'false')
        println 'release.devMenuEnabled=' + (findProperty('expo.devmenu.configureInRelease') ?: 'false')
        println 'release.signingConfig=' + (signing?.name ?: 'UNCONFIGURED')
    }
}

tasks.register('verifyReleaseReadiness') {
    group = 'verification'
    description = 'Fails unless Android release signing and native settings are release-safe.'
    doLast {
        def signing = android.buildTypes.release.signingConfig
        if (signing == null) {
            throw new GradleException('Android release signing is not configured. Use EAS remote credentials or all C1RCLE_RELEASE_* values.')
        }
        def debugStore = file('debug.keystore').canonicalFile
        def releaseStore = signing.storeFile?.canonicalFile
        if (signing.name == 'debug' || releaseStore == null || releaseStore == debugStore) {
            throw new GradleException('Android release is configured with debug or missing signing credentials.')
        }
        if ((findProperty('expo.devlauncher.configureInRelease') ?: 'false').toBoolean()) {
            throw new GradleException('expo-dev-launcher must be disabled in Android release builds.')
        }
        if ((findProperty('expo.devmenu.configureInRelease') ?: 'false').toBoolean()) {
            throw new GradleException('expo-dev-menu must be disabled in Android release builds.')
        }
        if ((findProperty('expo.useLegacyPackaging') ?: 'false').toBoolean()) {
            throw new GradleException('Legacy native-library packaging is incompatible with the release 16 KB page-size gate.')
        }
        if (rootProject.ext.targetSdkVersion.toInteger() < 36) {
            throw new GradleException('Android targetSdk is below the launch requirement of 36.')
        }
        if (rootProject.ext.compileSdkVersion.toInteger() < rootProject.ext.targetSdkVersion.toInteger()) {
            throw new GradleException('Android compileSdk must be greater than or equal to targetSdk.')
        }
    }
}

tasks.configureEach { task ->
    if (task.name in ['bundleRelease', 'assembleRelease', 'packageRelease']) {
        task.dependsOn tasks.named('verifyReleaseReadiness')
    }
}
`.trimStart();

function findNamedBlock(source, name, startAt = 0) {
  const marker = source.indexOf(`${name} {`, startAt);
  if (marker === -1) return null;
  const open = source.indexOf('{', marker);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return { marker, open, close: index };
  }
  return null;
}

function hardenAndroidBuildGradle(source) {
  const buildTypes = findNamedBlock(source, 'buildTypes');
  if (!buildTypes) throw new Error('Unable to locate Android buildTypes block');
  const release = findNamedBlock(source, 'release', buildTypes.open + 1);
  if (!release || release.close > buildTypes.close) throw new Error('Unable to locate Android release build type');

  const releaseBody = source.slice(release.open + 1, release.close);
  const hardenedReleaseBody = releaseBody.replace(/^\s*signingConfig\s+signingConfigs\.debug\s*$/m, '');
  let result = `${source.slice(0, release.open + 1)}${hardenedReleaseBody}${source.slice(release.close)}`;
  if (!result.includes(RELEASE_GRADLE_APPLY)) result = `${result.trimEnd()}\n\n${RELEASE_GRADLE_APPLY}\n`;
  return result;
}

function upsertGradleProperty(properties, key, value) {
  const filtered = properties.filter((entry) => !(entry.type === 'property' && entry.key === key));
  filtered.push({ type: 'property', key, value });
  return filtered;
}

function isProductionBuild() {
  return process.env.EAS_BUILD_PROFILE === 'production' || process.env.EXPO_PUBLIC_APP_ENV === 'production';
}

function stripAndroidDevMetadata(manifest) {
  manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
    (entry) => entry.$?.['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW',
  );
  for (const application of manifest.application || []) {
    for (const activity of application.activity || []) {
      for (const intentFilter of activity['intent-filter'] || []) {
        intentFilter.data = (intentFilter.data || []).filter(
          (entry) => !String(entry.$?.['android:scheme'] || '').startsWith('exp+'),
        );
      }
    }
  }
  return manifest;
}

function stripIosDevMetadata(infoPlist) {
  if (Array.isArray(infoPlist.NSBonjourServices)) {
    infoPlist.NSBonjourServices = infoPlist.NSBonjourServices.filter((service) => service !== '_expo._tcp');
    if (infoPlist.NSBonjourServices.length === 0) delete infoPlist.NSBonjourServices;
  }
  if (String(infoPlist.NSLocalNetworkUsageDescription || '').includes('Expo Dev Launcher')) {
    delete infoPlist.NSLocalNetworkUsageDescription;
  }
  if (Array.isArray(infoPlist.CFBundleURLTypes)) {
    infoPlist.CFBundleURLTypes = infoPlist.CFBundleURLTypes
      .map((entry) => ({
        ...entry,
        CFBundleURLSchemes: (entry.CFBundleURLSchemes || []).filter((scheme) => !String(scheme).startsWith('exp+')),
      }))
      .filter((entry) => entry.CFBundleURLSchemes.length > 0);
  }
  return infoPlist;
}

function withReleaseHardening(config) {
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = hardenAndroidBuildGradle(mod.modResults.contents);
    return mod;
  });

  config = withGradleProperties(config, (mod) => {
    let properties = mod.modResults;
    properties = upsertGradleProperty(properties, 'EX_DEV_CLIENT_NETWORK_INSPECTOR', 'false');
    properties = upsertGradleProperty(properties, 'expo.devlauncher.configureInRelease', 'false');
    properties = upsertGradleProperty(properties, 'expo.devmenu.configureInRelease', 'false');
    properties = upsertGradleProperty(properties, 'expo.useLegacyPackaging', 'false');
    mod.modResults = properties;
    return mod;
  });

  config = withDangerousMod(config, ['android', async (mod) => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app', 'release-hardening.gradle');
    await fs.promises.writeFile(target, RELEASE_HARDENING_GRADLE, 'utf8');
    return mod;
  }]);

  config = withAndroidManifest(config, (mod) => {
    if (isProductionBuild()) mod.modResults.manifest = stripAndroidDevMetadata(mod.modResults.manifest);
    return mod;
  });

  config = withEntitlementsPlist(config, (mod) => {
    if (isProductionBuild()) mod.modResults['aps-environment'] = 'production';
    return mod;
  });

  config = withInfoPlist(config, (mod) => {
    if (isProductionBuild()) mod.modResults = stripIosDevMetadata(mod.modResults);
    return mod;
  });

  return config;
}

module.exports = withReleaseHardening;
module.exports.RELEASE_HARDENING_GRADLE = RELEASE_HARDENING_GRADLE;
module.exports.hardenAndroidBuildGradle = hardenAndroidBuildGradle;
module.exports.stripAndroidDevMetadata = stripAndroidDevMetadata;
module.exports.stripIosDevMetadata = stripIosDevMetadata;
module.exports.upsertGradleProperty = upsertGradleProperty;
