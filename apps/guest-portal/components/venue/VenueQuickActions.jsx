'use client';

import { useState } from 'react';
import { Heart, Phone, MapPin, MessageCircle, Share2, Navigation } from 'lucide-react';

/**
 * VenueQuickActions - Quick action buttons matching existing app design
 * Includes: Follow, Call, Directions (new), WhatsApp, Share
 */
export default function VenueQuickActions({
  venue,
  isFollowing = false,
  onFollow,
  followersCount = 0,
}) {
  const [copied, setCopied] = useState(false);

  const handleCall = () => {
    const phone = venue.phone || venue.contact?.phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleDirections = () => {
    const address = venue.address || venue.contact?.address;
    const lat =
      venue.coordinates?.lat !== undefined && venue.coordinates?.lat !== null
        ? venue.coordinates.lat
        : venue.location?.latitude;
    const lng =
      venue.coordinates?.lng !== undefined && venue.coordinates?.lng !== null
        ? venue.coordinates.lng
        : venue.location?.longitude;

    if (lat != null && lng != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
        '_blank',
      );
    }
  };

  const handleWhatsApp = () => {
    const phone = venue.whatsapp || venue.phone || venue.contact?.phone;
    if (phone) {
      const message = `Hi, I found ${venue.name} on THE C1RCLE and wanted to inquire about...`;
      window.open(
        `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`,
        '_blank',
      );
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: venue.name,
      text: `Check out ${venue.name} on THE C1RCLE`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // AbortError: user dismissed share sheet — expected
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasPhone = venue.phone || venue.contact?.phone;
  const hasWhatsApp = venue.whatsapp || venue.phone || venue.contact?.phone;
  const hasAddress = venue.address || venue.contact?.address || venue.coordinates;

  const quickActions = [
    {
      id: 'follow',
      icon: Heart,
      label: isFollowing ? 'Following' : 'Follow',
      onClick: onFollow,
      active: isFollowing,
      activeColor: 'text-[#F44A22]',
      activeBg: 'bg-[#F44A22]/10',
      fillActive: true,
      show: true,
    },
    {
      id: 'call',
      icon: Phone,
      label: 'Call',
      onClick: handleCall,
      show: !!hasPhone,
    },
    {
      id: 'directions',
      icon: Navigation,
      label: 'Directions',
      onClick: handleDirections,
      show: !!hasAddress,
    },
    {
      id: 'whatsapp',
      icon: MessageCircle,
      label: 'WhatsApp',
      onClick: handleWhatsApp,
      activeColor: 'text-[#25D366]',
      activeBg: 'bg-[#25D366]/10',
      show: !!hasWhatsApp,
    },
    {
      id: 'share',
      icon: Share2,
      label: copied ? 'Copied!' : 'Share',
      onClick: handleShare,
      show: true,
    },
  ];

  const visibleActions = quickActions.filter((action) => action.show);

  return (
    <div className="flex items-center justify-center gap-3 py-6 overflow-x-auto no-scrollbar">
      {visibleActions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          className={`flex flex-col items-center gap-2 min-w-[72px] py-3 px-4 rounded-2xl border transition-all duration-300 hover:scale-105 ${
            action.active
              ? `${action.activeBg} border-[#F44A22]/20`
              : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              action.active ? action.activeBg : action.activeBg || 'bg-black/5 dark:bg-white/5'
            }`}
          >
            <action.icon
              className={`h-5 w-5 transition-colors ${
                action.active
                  ? `${action.activeColor} ${action.fillActive ? 'fill-current' : ''}`
                  : action.activeColor || 'text-black/60 dark:text-white/60'
              }`}
            />
          </div>
          <span
            className={`text-[9px] font-bold uppercase tracking-widest whitespace-nowrap ${
              action.active ? action.activeColor : 'text-black/50 dark:text-white/50'
            }`}
          >
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}
