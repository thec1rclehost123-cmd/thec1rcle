import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexSource = readFileSync(resolve(__dirname, '../../app/index.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(__dirname, '../../app/_layout.tsx'), 'utf8');
const deepLinkSource = readFileSync(resolve(__dirname, '../../lib/deeplinks.ts'), 'utf8');

describe('boot routing ownership contract', () => {
  it('keeps route selection in the boot coordinator instead of the index screen', () => {
    expect(indexSource).toContain('resolveBootState');
    expect(indexSource).not.toContain('resolveFirstRunStage');
    expect(indexSource).not.toContain('useFirstRunStore().load');
    expect(indexSource).not.toContain("'/api/v1/users/me/onboarding'");
  });

  it('holds the native splash until authentication resolves', () => {
    expect(layoutSource).toContain('state.initialized || state.authSyncFailed');
    expect(layoutSource).toContain('if (bootResolved)');
    expect(layoutSource).not.toContain('onLayout={onLayoutRootView}');
  });

  it('preserves pending deep links during boot and cached offline sessions', () => {
    expect(deepLinkSource).toContain('!authState.initialized || authState.authSyncInProgress');
    expect(deepLinkSource).toContain('usingCachedSession) return false');
  });
});
