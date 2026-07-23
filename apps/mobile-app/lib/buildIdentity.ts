import * as Application from 'expo-application';
import Constants from 'expo-constants';

type ReleaseIdentityStatus = 'development' | 'verified' | 'mismatch';

export type BuildIdentityInput = {
  nativeApplicationVersion: string | null | undefined;
  nativeBuildVersion: string | null | undefined;
  configuredVersion: string | null | undefined;
  appEnvironment: string | null | undefined;
};

export type BuildIdentity = {
  appVersion: string;
  buildVersion: string;
  runtimeLabel: string;
  status: ReleaseIdentityStatus;
  statusLabel: string;
  issues: string[];
};

function clean(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function resolveBuildIdentity(input: BuildIdentityInput): BuildIdentity {
  const nativeApplicationVersion = clean(input.nativeApplicationVersion);
  const nativeBuildVersion = clean(input.nativeBuildVersion);
  const configuredVersion = clean(input.configuredVersion);
  const appEnvironment = clean(input.appEnvironment)?.toLowerCase() || 'development';
  const isProduction = appEnvironment === 'production';
  const issues: string[] = [];

  if (isProduction) {
    if (!nativeApplicationVersion) issues.push('Native app version is unavailable.');
    if (!nativeBuildVersion) issues.push('Native build version is unavailable.');
    if (!configuredVersion) issues.push('Configured app version is unavailable.');
    if (
      nativeApplicationVersion &&
      configuredVersion &&
      nativeApplicationVersion !== configuredVersion
    ) {
      issues.push(
        `Native version ${nativeApplicationVersion} does not match release version ${configuredVersion}.`,
      );
    }
  }

  const status: ReleaseIdentityStatus = isProduction
    ? issues.length > 0
      ? 'mismatch'
      : 'verified'
    : 'development';

  return {
    // These are deliberately the native binary values. Falling back to app.json
    // would make a stale development client or release candidate look current.
    appVersion: nativeApplicationVersion || 'Unavailable',
    buildVersion: nativeBuildVersion || 'Unavailable',
    runtimeLabel:
      appEnvironment === 'production'
        ? 'Production'
        : appEnvironment === 'preview'
          ? 'Preview build'
          : 'Development client',
    status,
    statusLabel:
      status === 'verified'
        ? 'Verified'
        : status === 'mismatch'
          ? 'Mismatch'
          : 'Development',
    issues,
  };
}

export function getBuildIdentity(): BuildIdentity {
  return resolveBuildIdentity({
    nativeApplicationVersion: Application.nativeApplicationVersion,
    nativeBuildVersion: Application.nativeBuildVersion,
    configuredVersion: Constants.expoConfig?.version,
    appEnvironment: process.env.EXPO_PUBLIC_APP_ENV,
  });
}
