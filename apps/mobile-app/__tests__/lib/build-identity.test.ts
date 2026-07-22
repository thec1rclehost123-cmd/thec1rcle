import { resolveBuildIdentity } from '@/lib/buildIdentity';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

describe('build identity', () => {
  it('displays the native binary identity in a development client', () => {
    expect(
      resolveBuildIdentity({
        nativeApplicationVersion: '0.9.0',
        nativeBuildVersion: '17',
        configuredVersion: '1.0.0',
        appEnvironment: 'development',
      }),
    ).toMatchObject({
      appVersion: '0.9.0',
      buildVersion: '17',
      runtimeLabel: 'Development client',
      status: 'development',
      issues: [],
    });
  });

  it('verifies a production binary whose native and configured versions agree', () => {
    expect(
      resolveBuildIdentity({
        nativeApplicationVersion: '1.0.0',
        nativeBuildVersion: '42',
        configuredVersion: '1.0.0',
        appEnvironment: 'production',
      }),
    ).toMatchObject({
      appVersion: '1.0.0',
      buildVersion: '42',
      runtimeLabel: 'Production',
      status: 'verified',
      statusLabel: 'Verified',
      issues: [],
    });
  });

  it('flags a stale or incomplete production release candidate without hiding its native values', () => {
    const identity = resolveBuildIdentity({
      nativeApplicationVersion: '0.9.0',
      nativeBuildVersion: null,
      configuredVersion: '1.0.0',
      appEnvironment: 'production',
    });

    expect(identity).toMatchObject({
      appVersion: '0.9.0',
      buildVersion: 'Unavailable',
      status: 'mismatch',
      statusLabel: 'Mismatch',
    });
    expect(identity.issues).toEqual([
      'Native build version is unavailable.',
      'Native version 0.9.0 does not match release version 1.0.0.',
    ]);
  });
});
