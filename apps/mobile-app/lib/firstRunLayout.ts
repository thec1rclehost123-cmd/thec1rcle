const ACTION_TOP_PADDING = 12;
const CONTENT_TO_ACTION_GAP = 16;
const IOS_BOTTOM_FLOOR = 8;
const ANDROID_BOTTOM_FLOOR = 36;

type FirstRunPlatform = 'android' | 'ios' | 'web' | 'windows' | 'macos';

export function resolveFirstRunActionBottomPadding(
  safeAreaBottom: number,
  platform: FirstRunPlatform,
): number {
  const safeInset = Number.isFinite(safeAreaBottom) ? Math.max(0, safeAreaBottom) : 0;
  const floor = platform === 'android' ? ANDROID_BOTTOM_FLOOR : IOS_BOTTOM_FLOOR;
  return Math.max(safeInset, floor);
}

export function resolveFirstRunContentBottomInset({
  measuredActionHeight,
  safeAreaBottom,
  platform,
  estimatedControlHeight,
}: {
  measuredActionHeight: number;
  safeAreaBottom: number;
  platform: FirstRunPlatform;
  estimatedControlHeight: number;
}): number {
  const measured = Number.isFinite(measuredActionHeight) ? Math.max(0, measuredActionHeight) : 0;
  const estimatedActionHeight =
    Math.max(0, estimatedControlHeight) +
    ACTION_TOP_PADDING +
    resolveFirstRunActionBottomPadding(safeAreaBottom, platform);
  return Math.ceil(Math.max(measured, estimatedActionHeight) + CONTENT_TO_ACTION_GAP);
}
