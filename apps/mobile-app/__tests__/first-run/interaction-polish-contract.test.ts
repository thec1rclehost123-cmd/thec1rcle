/* global __dirname */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mobile = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(mobile, path), 'utf8');

describe('first-run interaction polish contract', () => {
  it('keeps Send code inline and reachable above the keyboard', () => {
    const phone = read('app/(auth)/phone.tsx');
    expect(phone).toContain('style={styles.inlineAction}');
    expect(phone).toContain('label="Send code"');
    expect(phone).not.toContain('action={');
  });

  it('makes the complete OTP surface focus the native number input', () => {
    const controls = read('components/first-run/index.tsx');
    expect(controls).toContain('onPress={() => input.current?.focus()}');
    expect(controls).toContain('...StyleSheet.absoluteFillObject');
    expect(controls).toContain('keyboardType="number-pad"');
  });

  it('keeps guest entry visually aligned with the other login actions', () => {
    const login = read('app/(auth)/login.tsx');
    expect(login).toContain('<Text style={s.emailBtnText}>Explore as Guest</Text>');
    expect(login).toContain('style={s.emailBtn}');
    expect(login).not.toContain('>Skip<');
  });

  it('opens the event location as native platform directions', () => {
    const event = read('app/event/[id].tsx');
    expect(event).toContain('Open in Apple Maps');
    expect(event).toContain('Open in Google Maps');
    expect(event).toContain('google.navigation:q=');
    expect(event).toContain('maps.apple.com/?daddr=');
    expect(event).toContain('google.com/maps/dir/?api=1&destination=');
  });

  it('uses the upgraded Join experience on shared guest gates', () => {
    const sheet = read('components/ui/AuthSheet.tsx');
    const fullScreen = read('components/ui/GuestAuthPrompt.tsx');
    const inbox = read('app/(tabs)/inbox.tsx');

    for (const source of [sheet, fullScreen]) {
      expect(source).toContain('UNLOCK THE FULL NIGHT');
      expect(source).toContain('Make this night yours');
      expect(source).toContain('Join THE C1RCLE');
      expect(source).toContain('Keep exploring');
    }
    expect(inbox).toContain('return <GuestAuthPrompt');
  });
});
