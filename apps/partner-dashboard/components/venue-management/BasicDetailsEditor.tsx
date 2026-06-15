'use client';

import { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Loader2,
  MapPin,
  Clock,
  Phone,
  Globe,
  Instagram,
  Mail,
} from 'lucide-react';
import { getFirebaseStorage } from '@/lib/firebase/client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface VenueDetails {
  displayName?: string;
  name?: string;
  tagline?: string;
  description?: string;
  bio?: string;
  bannerImage?: string;
  coverURL?: string;
  logoImage?: string;
  photoURL?: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  timings?: { [key: string]: string };
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  socialLinks?: { instagram?: string };
  venueType?: string;
  primaryCta?: string;
  hasReservation?: boolean;
}

interface BasicDetailsEditorProps {
  venueId: string;
  venue: VenueDetails;
  onUpdate: (updates: Partial<VenueDetails>) => Promise<void>;
}

const VENUE_TYPES = [
  'Nightclub',
  'Lounge',
  'Bar',
  'Rooftop',
  'Pool Club',
  'Warehouse',
  'Festival Ground',
  'Concert Hall',
  'Restaurant & Bar',
];
const CTA_OPTIONS = [
  { value: 'reservation', label: 'Get Reservation (WhatsApp)' },
  { value: 'tickets', label: 'Buy Tickets' },
  { value: 'whatsapp', label: 'Chat on WhatsApp' },
  { value: 'directions', label: 'Get Directions' },
];

export default function BasicDetailsEditor({ venueId, venue, onUpdate }: BasicDetailsEditorProps) {
  const [uploading, setUploading] = useState<'banner' | 'logo' | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File, type: 'banner' | 'logo') => {
    setUploading(type);
    try {
      const storage = getFirebaseStorage();
      const path = type === 'banner' ? 'banner' : 'logo';
      const storageRef = ref(storage, `venues/${venueId}/${path}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      if (type === 'banner') {
        await onUpdate({ bannerImage: downloadURL, coverURL: downloadURL });
      } else {
        await onUpdate({ logoImage: downloadURL, photoURL: downloadURL });
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(null);
    }
  };

  const bannerUrl = venue.bannerImage || venue.coverURL;
  const logoUrl = venue.logoImage || venue.photoURL;

  return (
    <div className="space-y-8">
      {/* Banner & Logo Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary">Visual Identity</h3>

        {/* Banner */}
        <div
          onClick={() => bannerInputRef.current?.click()}
          className="relative aspect-[21/9] w-full bg-surface-secondary rounded-2xl overflow-hidden cursor-pointer group border border-border-subtle"
        >
          {bannerUrl ? (
            <img
              src={bannerUrl}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              alt=""
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <Upload className="w-8 h-8 text-text-tertiary" />
              <p className="text-sm text-text-tertiary mt-2">Upload Banner Image</p>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploading === 'banner' ? (
              <Loader2 className="w-8 h-8 text-text-primary animate-spin" />
            ) : (
              <Camera className="w-8 h-8 text-text-primary" />
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')}
          />
        </div>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => logoInputRef.current?.click()}
            className="relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer group border-2 border-border-subtle bg-surface-secondary"
          >
            {logoUrl ? (
              <img src={logoUrl} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-text-tertiary" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading === 'logo' ? (
                <Loader2 className="w-5 h-5 text-text-primary animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-text-primary" />
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Venue Logo</p>
            <p className="text-xs text-text-tertiary">Square image, displayed on banner overlay</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditField
            label="Venue Name"
            value={venue.displayName || venue.name}
            onSave={(v) => onUpdate({ displayName: v, name: v })}
          />
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
              Venue Type
            </label>
            <select
              value={venue.venueType || ''}
              onChange={(e) => onUpdate({ venueType: e.target.value })}
              className="w-full px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm"
            >
              <option value="">Select type...</option>
              {VENUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <EditField
          label="Tagline"
          value={venue.tagline}
          placeholder="A short catchy phrase"
          onSave={(v) => onUpdate({ tagline: v })}
        />
        <EditField
          label="Description"
          value={venue.description || venue.bio}
          placeholder="Describe your venue..."
          multiline
          onSave={(v) => onUpdate({ description: v, bio: v })}
        />
      </div>

      {/* Location */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditField
            label="Address"
            value={venue.address}
            icon={<MapPin className="w-4 h-4" />}
            onSave={(v) => onUpdate({ address: v })}
          />
          <EditField label="City" value={venue.city} onSave={(v) => onUpdate({ city: v })} />
          <EditField
            label="Neighborhood"
            value={venue.neighborhood}
            placeholder="e.g., Bandra West"
            onSave={(v) => onUpdate({ neighborhood: v })}
          />
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary">Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditField
            label="Phone"
            value={venue.phone}
            icon={<Phone className="w-4 h-4" />}
            onSave={(v) => onUpdate({ phone: v })}
          />
          <EditField
            label="WhatsApp"
            value={venue.whatsapp}
            placeholder="+91..."
            onSave={(v) => onUpdate({ whatsapp: v })}
          />
          <EditField
            label="Email"
            value={venue.email}
            icon={<Mail className="w-4 h-4" />}
            onSave={(v) => onUpdate({ email: v })}
          />
          <EditField
            label="Website"
            value={venue.website}
            icon={<Globe className="w-4 h-4" />}
            onSave={(v) => onUpdate({ website: v })}
          />
          <EditField
            label="Instagram"
            value={venue.socialLinks?.instagram}
            icon={<Instagram className="w-4 h-4" />}
            placeholder="@yourhandle"
            onSave={(v) => onUpdate({ socialLinks: { ...venue.socialLinks, instagram: v } })}
          />
        </div>
      </div>

      {/* CTA Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary">Primary Action Button</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
              Button Type
            </label>
            <select
              value={venue.primaryCta || 'reservation'}
              onChange={(e) => onUpdate({ primaryCta: e.target.value })}
              className="w-full px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm"
            >
              {CTA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4 p-4 bg-surface-secondary rounded-xl">
            <div className="flex-1">
              <p className="text-sm font-medium">Enable Reservations</p>
              <p className="text-xs text-text-tertiary">Show reservation button</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={venue.hasReservation || false}
                onChange={(e) => onUpdate({ hasReservation: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-elevated after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  placeholder,
  icon,
  multiline,
  onSave,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
  onSave: (v: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const [isDirty, setIsDirty] = useState(false);

  const handleBlur = () => {
    if (isDirty && localValue !== value) {
      onSave(localValue);
      setIsDirty(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">{icon}</div>
        )}
        {multiline ? (
          <textarea
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              setIsDirty(true);
            }}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={3}
            className="w-full px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        ) : (
          <input
            type="text"
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              setIsDirty(true);
            }}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={`w-full px-4 py-3 bg-surface-secondary border border-border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${icon ? 'pl-10' : ''}`}
          />
        )}
      </div>
    </div>
  );
}
