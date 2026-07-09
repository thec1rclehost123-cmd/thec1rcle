'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Mail,
  Instagram,
  Phone,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Save,
  Loader2,
  Globe,
  Camera,
  UserCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import ImageCropModal from '@/components/ui/ImageCropModal';
import { useToast } from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: '15px',
  outline: 'none',
  width: '100%',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
};

const FormGroup = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <label className="text-[12px] font-bold uppercase tracking-wider text-text-secondary ml-0.5 block">
      {label}
    </label>
    {children}
    {description && <p className="text-[11px] text-text-tertiary ml-0.5 mt-1">{description}</p>}
  </div>
);

export default function ProfilePage({
  setActions,
}: {
  setActions?: (node: React.ReactNode) => void;
}) {
  const { profile, user: authUser } = useDashboardAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phone: '',
    instagram: '',
    bio: '',
    city: 'Pune',
    username: '',
    website: '',
    avatarUrl: '',
    coverImageUrl: '',
  });

  const [loadedData, setLoadedData] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [backdropPreview, setBackdropPreview] = useState<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const [isHeroEditing, setIsHeroEditing] = useState(false);
  const [cropModal, setCropModal] = useState<{
    src: string;
    aspect: number;
    type: 'logo' | 'cover';
  } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const promoterId = profile?.activeMembership?.partnerId;

  // Load existing data
  useEffect(() => {
    async function fetchProfile() {
      if (!promoterId) return;
      try {
        const token = await authUser?.getIdToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/profile?profileId=${promoterId}&type=promoter`, { headers });
        if (!res.ok) throw new Error('Failed to fetch');
        const { profile: data } = await res.json();

        if (data) {
          const loaded = {
            displayName: data.displayName || data.name || '',
            email: data.email || '',
            phone: data.phone || data.contactPhone || '',
            instagram: data.instagram || '',
            bio: data.bio || data.summary || '',
            city: data.city || 'Pune',
            username: data.handle || data.username || '',
            website: data.website || '',
            avatarUrl: data.avatarUrl || data.profileImage || data.photoURL || '',
            coverImageUrl:
              data.coverImageUrl || data.coverImage || data.coverURL || data.backdropURL || '',
          };
          setFormData(loaded);
          setLoadedData(loaded);
        }
      } catch (err) {
        console.error('Failed to fetch promoter:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [promoterId, authUser]);

  // Track changes to show/hide save action
  useEffect(() => {
    if (!loadedData) {
      setHasChanges(false);
      return;
    }
    const keys = Object.keys(loadedData) as (keyof typeof loadedData)[];
    const changed = keys.some((k) => formData[k] !== loadedData[k]);
    setHasChanges(changed);
  }, [formData, loadedData]);

  const handleSave = useCallback(async () => {
    if (!promoterId) return;
    setSaving(true);
    try {
      const normalizedHandle = formData.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const token = await authUser?.getIdToken();
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId: promoterId,
          type: 'promoter',
          action: 'updateProfile',
          data: {
            displayName: formData.displayName,
            phone: formData.phone,
            instagram: formData.instagram,
            bio: formData.bio,
            city: formData.city,
            username: normalizedHandle,
            handle: normalizedHandle,
            website: formData.website,
            email: formData.email,
            profileImage: formData.avatarUrl,
            avatarUrl: formData.avatarUrl,
            photoURL: formData.avatarUrl,
            coverImage: formData.coverImageUrl,
            coverURL: formData.coverImageUrl,
            backdropURL: formData.coverImageUrl,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) throw new Error('Update failed');

      setPhotoPreview(null);
      setBackdropPreview(null);

      // Update loadedData to match current formData
      setLoadedData(formData);
      toastSuccess('Profile updated', 'Your promoter profile has been saved.');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toastError('Save failed', err.message || 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  }, [promoterId, formData, authUser, toastSuccess, toastError]);

  // Integrate with SettingsHub actions if available
  useEffect(() => {
    if (setActions) {
      if (hasChanges) {
        setActions(
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-8 rounded-xl bg-[#f46a3a] text-white text-[13px] font-black uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>,
        );
      } else {
        setActions(null);
      }
    }
  }, [hasChanges, saving, handleSave, setActions]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <Loader2 className="w-12 h-12 text-[#f46a3a] animate-spin" />
        <p className="text-[14px] font-black uppercase tracking-[0.3em] text-text-tertiary">
          Loading Persona
        </p>
      </div>
    );
  }

  const displayAvatar = photoPreview || formData.avatarUrl;
  const displayCover = backdropPreview || formData.coverImageUrl;

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Profile Hero card */}
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

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <button
                onClick={() => setIsHeroEditing(true)}
                className="bg-black/40 backdrop-blur-md border border-white/30 px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-black/60 transition-all font-bold text-white shadow-xl"
              >
                <Camera className="w-5 h-5" />
                Edit Hero &amp; Visuals
              </button>
            </div>
          </div>
        </section>

        <div className="px-8 pb-8 relative">
          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between -mt-16 mb-6 gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <div
                className="w-28 h-28 rounded-[2rem] bg-surface-base border-4 shadow-xl overflow-hidden relative group-avatar cursor-pointer"
                style={{ borderColor: 'var(--surface-base)' }}
                onClick={() => fileRef.current?.click()}
              >
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-elevated/40">
                    <UserCircle className="w-12 h-12 text-text-tertiary" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6" />
                </div>
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

            {!setActions && hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl font-bold bg-[#f46a3a] text-white hover:bg-[#e05626] transition-all shrink-0 shadow-lg shadow-orange-500/10"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            {/* Contact Details */}
            <div className="space-y-6">
              <SectionHeader title="Contact Details" />
              <div className="grid grid-cols-1 gap-6">
                <FormGroup label="Display Name" description="Used on listing and profile headers">
                  <input
                    type="text"
                    value={formData.displayName}
                    style={inputStyle}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Enter display name"
                    className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                  />
                </FormGroup>

                <FormGroup label="Username / Handle" description="Your unique profile URL handle">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-bold text-[15px]">
                      c1rcle.app/
                    </span>
                    <input
                      type="text"
                      value={formData.username}
                      style={{ ...inputStyle, paddingLeft: '98px' }}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                        })
                      }
                      placeholder="handle"
                      className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                    />
                  </div>
                </FormGroup>

                <FormGroup
                  label="Email Address"
                  description="Preferred email for updates and payouts"
                >
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      type="email"
                      value={formData.email}
                      style={{ ...inputStyle, paddingLeft: '44px' }}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                    />
                  </div>
                </FormGroup>

                <FormGroup
                  label="Phone Number"
                  description="Direct contact for booking coordination"
                >
                  <div className="relative">
                    <Phone
                      size={15}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      type="text"
                      value={formData.phone}
                      style={{ ...inputStyle, paddingLeft: '44px' }}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 00000 00000"
                      className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                    />
                  </div>
                </FormGroup>

                <FormGroup label="Instagram Handle" description="Link your active brand handle">
                  <div className="relative">
                    <Instagram
                      size={15}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      type="text"
                      value={formData.instagram}
                      style={{ ...inputStyle, paddingLeft: '44px' }}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                      placeholder="@username"
                      className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                    />
                  </div>
                </FormGroup>

                <FormGroup label="Website URL" description="Your primary external landing page">
                  <div className="relative">
                    <Globe
                      size={15}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      type="text"
                      value={formData.website}
                      style={{ ...inputStyle, paddingLeft: '44px' }}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://yoursite.com"
                      className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                    />
                  </div>
                </FormGroup>

                <FormGroup label="Primary City" description="Your base market for promoting events">
                  <div className="relative">
                    <MapPin
                      size={15}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      type="text"
                      value={formData.city}
                      style={{ ...inputStyle, paddingLeft: '44px' }}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Pune"
                      className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                    />
                  </div>
                </FormGroup>
              </div>
            </div>

            {/* Bio / About Section */}
            <div className="space-y-6">
              <SectionHeader title="The Manifesto" />
              <FormGroup
                label="About / Description"
                description="Explain your audience reach, network, and genres"
              >
                <textarea
                  style={{ ...inputStyle, resize: 'none', lineHeight: '1.6', minHeight: '160px' }}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Describe your experience and network..."
                  className="focus:border-[#f46a3a] focus:ring-4 focus:ring-[#f46a3a]/10"
                />
              </FormGroup>

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

      {/* Edit Visuals Modal */}
      <AnimatePresence>
        {isHeroEditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 flex items-end justify-center p-4 pb-8"
            style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => e.target === e.currentTarget && setIsHeroEditing(false)}
          >
            <motion.div
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-200"
              style={{
                background: 'var(--v-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--v-r-xl)',
                boxShadow: 'var(--v-shadow-hero)',
              }}
            >
              <div className="px-6 pt-5 pb-2">
                <h3 className="text-[15px] font-bold text-text-primary">Edit Hero &amp; Visuals</h3>
                <p className="text-[12px] text-text-tertiary mt-0.5">
                  Choose what you want to update
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                <button
                  onClick={() => {
                    setIsHeroEditing(false);
                    coverFileRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl transition-colors"
                  style={{ border: '1px solid var(--border-default)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--surface-tertiary)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--surface-tertiary)' }}
                  >
                    <ImageIcon size={18} className="text-text-secondary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-text-primary">Cover Photo</p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">Hero background</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsHeroEditing(false);
                    fileRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl transition-colors"
                  style={{ border: '1px solid var(--border-default)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--surface-tertiary)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--surface-tertiary)' }}
                  >
                    <UserCircle size={18} className="text-text-secondary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-text-primary">Profile Photo</p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">Your avatar / logo</p>
                  </div>
                </button>
              </div>
              <div className="px-4 pb-4">
                <button
                  onClick={() => setIsHeroEditing(false)}
                  className="w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--surface-tertiary)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
