import fs from 'node:fs';
import path from 'node:path';

describe('SwipeableMessage action layout', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../components/chat/BrightChatSurface.tsx'),
    'utf8',
  );

  it('keeps destructive actions invisible until the message is swiped', () => {
    expect(source).toContain('opacity: translateX.value < -10 ? 1 : 0');
    expect(source).toMatch(
      /<Animated\.View\s+style=\{\[swipeStyles\.actionsContainer, \{ width: totalActionWidth \}, actionsStyle\]\}/,
    );
  });

  it('keeps actions fixed on the right while only the foreground message translates', () => {
    const actionsStyle = source.match(
      /const actionsStyle = useAnimatedStyle\(\(\) => \(\{([\s\S]*?)\}\)\);/,
    )?.[1];

    expect(actionsStyle).toBeDefined();
    expect(actionsStyle).not.toContain('transform');
  });

  it('does not nest swipe actions inside the inverted private-message list', () => {
    const privateChatSource = fs.readFileSync(
      path.resolve(__dirname, '../../app/social/dm/[id].tsx'),
      'utf8',
    );

    expect(privateChatSource).not.toContain('SwipeableMessage');
    expect(privateChatSource).toContain('onLongPress={() => handleMessageOptions(item)}');
  });
});
