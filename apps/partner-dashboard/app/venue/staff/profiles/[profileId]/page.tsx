import { StaffProfileEditorClient } from './PageClient';

export const metadata = { title: 'Edit Access Profile — Venue' };

export default async function ProfileEditorPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  return <StaffProfileEditorClient profileId={profileId} />;
}
