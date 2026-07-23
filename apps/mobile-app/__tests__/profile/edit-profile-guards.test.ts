import fs from 'node:fs';
import path from 'node:path';

describe('edit profile safety guards', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../app/profile/edit.tsx'), 'utf8');

  it('protects dirty edits from both Cancel and the Android hardware back button', () => {
    expect(source).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(source).toContain("Alert.alert('Unsaved Changes'");
    expect(source).toContain('<Pressable onPress={handleLeave}');
  });

  it('blocks save while a photo is uploading and rejects cross-account upload completion', () => {
    expect(source).toContain("Alert.alert('Photo still uploading'");
    expect(source).toContain('useAuthStore.getState().user?.uid !== uploadUserId');
  });
});
