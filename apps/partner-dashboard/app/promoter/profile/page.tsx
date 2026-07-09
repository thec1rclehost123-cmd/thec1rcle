'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Instagram,
  Phone,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Edit3,
  Save,
  Loader2,
  Globe,
  Camera,
  UserCircle,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import ImageCropModal from '@/components/ui/ImageCropModal';
import { useToast } from '@/components/ui/Toast';

export default function ProfilePage() {
  const { profile, user: authUser } = useDashboardAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phone: '',
    instagram: '',
    bio: '',
    city: 'Pune',
    website: '',
    handle: '',
    avatarUrl: '',
    coverImageUrl: '',
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [backdropPreview, setBackdropPreview] = useState<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const [cropModal, setCropModal] = useState<{
    src: string;
    aspect: number;
    type: 'logo' | 'cover';
  } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const promoterId = profile?.activeMembership?.partnerId;

  useEffect(() => {
    async function fetchProfile() {
      if (!promoterId || !authUser) {
        setLoading(false);
        return;
      }
      try {
        const token = await authUser.getIdToken();
        const res = await fetch('/api/partners/promoters/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
        const payload = await res.json();
        const data = payload?.profile || {};
        setFormData({
          displayName: data.displayName || data.name || '',
          email: data.email || '',
          phone: data.phone || data.contactPhone || '',
          instagram: data.instagram || '',
          bio: data.bio || data.summary || '',
          city: data.city || 'Pune',
          website: data.website || '',
          handle: data.handle || data.username || '',
          avatarUrl: data.avatarUrl || data.profileImage || data.photoURL || '',
          coverImageUrl:
            data.coverImageUrl || data.coverImage || data.coverURL || data.backdropURL || '',
        });
      } catch (err) {
        console.error('Failed to fetch promoter:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [authUser, promoterId]);

  const openCropModal = (file: File, type: 'logo' | 'cover') => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropModal({
        src: ev.target?.result as string,
        aspect: type === 'logo' ? 1 : 21 / 9,
        type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropModal(file, 'logo');
    e.target.value = '';
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropModal(file, 'cover');
    e.target.value = '';
  };

  const handleCropConfirm = async (dataUrl: string) => {
    if (!cropModal || !authUser || !promoterId) return;
    const { type } = cropModal;
    setCropModal(null);

    const isLogo = type === 'logo';
    if (isLogo) {
      setPhotoPreview(dataUrl);
      setAvatarUploading(true);
    } else {
      setBackdropPreview(dataUrl);
      setCoverUploading(true);
    }

    try {
      const token = await authUser.getIdToken();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${type}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const fd = new FormData();
      fd.append('file', file);
      fd.append('promoterId', promoterId);
      fd.append('type', type);

      const fieldName = isLogo ? 'profileImage' : 'coverImage';
      const res = await fetch(`/api/partners/promoters/upload?field=${fieldName}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd as any,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (isLogo) {
        setFormData((s) => ({ ...s, avatarUrl: data.url }));
        toastSuccess('Profile image uploaded successfully.');
      } else {
        setFormData((s) => ({ ...s, coverImageUrl: data.url }));
        toastSuccess('Cover image uploaded successfully.');
      }
    } catch (err: any) {
      toastError('Upload failed', err.message || 'Could not upload photo.');
      if (isLogo) setPhotoPreview(null);
      else setBackdropPreview(null);
    } finally {
      if (isLogo) setAvatarUploading(false);
      else setCoverUploading(false);
    }
  };

  const handleSave = async () => {
    if (!promoterId || !authUser) return;
    setSaving(true);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/partners/promoters/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: formData.displayName,
          phone: formData.phone,
          instagram: formData.instagram,
          bio: formData.bio,
          city: formData.city,
          website: formData.website,
          handle: formData.handle,
          profileImage: formData.avatarUrl,
          avatarUrl: formData.avatarUrl,
          photoURL: formData.avatarUrl,
          coverImage: formData.coverImageUrl,
          coverURL: formData.coverImageUrl,
          backdropURL: formData.coverImageUrl,
        }),
      });
      if (!res.ok) throw new Error(`Profile save failed: ${res.status}`);

      // Refresh
      const refreshRes = await fetch('/api/partners/promoters/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshRes.ok) {
        const payload = await refreshRes.json();
        const data = payload?.profile || {};
        setFormData({
          displayName: data.displayName || data.name || '',
          email: data.email || '',
          phone: data.phone || data.contactPhone || '',
          instagram: data.instagram || '',
          bio: data.bio || data.summary || '',
          city: data.city || 'Pune',
          website: data.website || '',
          handle: data.handle || data.username || '',
          avatarUrl: data.avatarUrl || data.profileImage || data.photoURL || '',
          coverImageUrl:
            data.coverImageUrl || data.coverImage || data.coverURL || data.backdropURL || '',
        });
      }
      setPhotoPreview(null);
      setBackdropPreview(null);
      setEditMode(false);
      toastSuccess('Success', 'Profile saved successfully.');
    } catch (err: any) {
      toastError('Save failed', err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#f46a3a]" />
      </div>
    );
  }

  const displayAvatar = photoPreview || formData.avatarUrl;
  const displayCover = backdropPreview || formData.coverImageUrl;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header / ID Card */}
      <div
        className="relative overflow-hidden shadow-xl"
        style={{
          borderRadius: 'var(--v-r-xl)',
          background: 'var(--v-card)',
          border: '1px solid var(--border-default)',
        }}
      >
        <section className="relative w-full group">
          <div className="relative h-48 w-full overflow-hidden bg-surface-elevated">
            {displayCover ? (
              <img
                src={displayCover}
                alt="Cover"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(135deg, var(--surface-tertiary) 0%, var(--surface-elevated) 50%, var(--surface-secondary) 100%)',
                }}
              />
            )}

            <div
              className="absolute inset-0 opacity-90"
              style={{
                background: 'linear-gradient(to top, var(--surface-base) 0%, transparent 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

            {(coverUploading || avatarUploading) && (
              <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
                <Loader2 size={12} className="text-white animate-spin" />
                <span className="text-[11px] font-semibold text-white">Uploading…</span>
              </div>
            )}

            {editMode && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                  onClick={() => coverFileRef.current?.click()}
                  className="bg-black/40 backdrop-blur-md border border-white/30 px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-black/60 transition-all font-bold text-white shadow-xl"
                >
                  <Camera className="w-5 h-5" />
                  Change Cover
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="px-8 pb-8 relative">
          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between -mt-16 mb-6 gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <div
                className="w-28 h-28 rounded-[2rem] bg-surface-base border-4 shadow-xl overflow-hidden relative group-avatar"
                style={{ borderColor: 'var(--surface-base)' }}
              >
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-elevated/40">
                    <UserCircle className="w-12 h-12 text-text-tertiary" />
                  </div>
                )}
                {editMode && (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center text-white cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Camera className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="pb-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-text-primary flex items-center justify-center sm:justify-start gap-2">
                  {formData.displayName || 'Unnamed Promoter'}
                  <CheckCircle2 className="w-5 h-5 text-[#f46a3a]" />
                </h1>
                <p className="text-sm font-medium text-text-tertiary">
                  Verified Promoter — Since 2026
                </p>
              </div>
            </div>

            <button
              onClick={() => (editMode ? handleSave() : setEditMode(true))}
              disabled={saving}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all shrink-0 ${
                editMode
                  ? 'bg-[#f46a3a] text-white hover:bg-[#e05626]'
                  : 'bg-surface-secondary text-text-primary hover:bg-surface-tertiary border border-border-default'
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editMode ? (
                <Save className="w-4 h-4" />
              ) : (
                <Edit3 className="w-4 h-4" />
              )}
              {editMode ? 'Save Changes' : 'Edit Profile'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            {/* Contact Information */}
            <div className="space-y-6">
              <SectionHeader title="Contact & Profile Info" />
              <div className="grid grid-cols-1 gap-4">
                {editMode ? (
                  <ProfileItem
                    icon={User}
                    label="Display Name"
                    value={formData.displayName}
                    editing={editMode}
                    onChange={(val: any) => setFormData({ ...formData, displayName: val })}
                    placeholder="Enter display name"
                  />
                ) : null}

                <ProfileItem
                  icon={User}
                  label="Username / Handle"
                  value={formData.handle}
                  editing={editMode}
                  onChange={(val: any) => setFormData({ ...formData, handle: val })}
                  placeholder="@handle"
                />

                <ProfileItem icon={Mail} label="Email Address" value={formData.email} readOnly />

                <ProfileItem
                  icon={Phone}
                  label="Contact Number"
                  value={formData.phone}
                  editing={editMode}
                  onChange={(val: any) => setFormData({ ...formData, phone: val })}
                  placeholder="+91 00000 00000"
                />

                <ProfileItem
                  icon={Instagram}
                  label="Instagram Handle"
                  value={formData.instagram}
                  editing={editMode}
                  onChange={(val: any) => setFormData({ ...formData, instagram: val })}
                  placeholder="@username"
                />

                <ProfileItem
                  icon={Globe}
                  label="Website URL"
                  value={formData.website}
                  editing={editMode}
                  onChange={(val: any) => setFormData({ ...formData, website: val })}
                  placeholder="https://yoursite.com"
                />

                <ProfileItem
                  icon={MapPin}
                  label="Primary City"
                  value={formData.city}
                  editing={editMode}
                  onChange={(val: any) => setFormData({ ...formData, city: val })}
                />
              </div>
            </div>

            {/* Bio / About Section */}
            <div className="space-y-6">
              <SectionHeader title="About / Background" />
              <div className="p-6 rounded-2xl bg-surface-secondary border border-border-subtle">
                {editMode ? (
                  <textarea
                    className="w-full bg-surface-base border border-border-default rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-[#f46a3a] outline-none min-h-[120px] text-text-primary"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Briefly describe your reach and experience..."
                  />
                ) : (
                  <p className="text-sm font-medium text-text-secondary leading-relaxed italic">
                    "
                    {formData.bio ||
                      'No biography provided. Tell venues and hosts about your impact!'}
                    "
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                <ShieldCheck className="w-5 h-5 text-[#f46a3a] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-[#f46a3a] uppercase tracking-widest mb-1">
                    Reputation Shield
                  </p>
                  <p className="text-[11px] text-text-tertiary leading-tight">
                    Your verified status and connection stats are automatically included in
                    partnership requests.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <input
        ref={coverFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverChange}
      />

      {/* ── Crop Modal ── */}
      {cropModal && (
        <ImageCropModal
          imageSrc={cropModal.src}
          aspect={cropModal.aspect}
          title={cropModal.type === 'logo' ? 'Adjust Profile Photo' : 'Adjust Cover Photo'}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropModal(null)}
        />
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4">
      <h3 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest whitespace-nowrap">
        {title}
      </h3>
      <div className="h-px bg-border-subtle w-full" />
    </div>
  );
}

function ProfileItem({ icon: Icon, label, value, readOnly, editing, onChange, placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest ml-1">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
          editing && !readOnly
            ? 'bg-surface-base border-[#f46a3a] shadow-sm'
            : 'bg-surface-secondary border-transparent'
        }`}
      >
        <Icon
          className={`w-4 h-4 ${editing && !readOnly ? 'text-[#f46a3a]' : 'text-text-tertiary'}`}
        />
        {editing && !readOnly ? (
          <input
            className="flex-1 bg-transparent border-0 p-0 text-sm font-semibold outline-none text-text-primary"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <span
            className={`text-sm font-semibold ${value ? 'text-text-primary' : 'text-text-tertiary italic'}`}
          >
            {value || `Set your ${label.toLowerCase()}`}
          </span>
        )}
      </div>
    </div>
  );
}
