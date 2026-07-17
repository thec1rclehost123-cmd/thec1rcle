'use client';

import { useEffect, useState, use, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, Share2, ArrowLeft, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import ShimmerImage from '../../../components/ShimmerImage';
import { formatEventDate, formatTimeIST } from '@c1rcle/core/time';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse w-[200px] h-[200px] rounded-2xl bg-black/5 dark:bg-white/5" />
  ),
});

export default function TicketPageClient({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const { id } = params;

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/v1/tickets/public/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load ticket details');
      }
      setTicket(data.ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Ticket for ${ticket?.eventTitle}`,
          text: `Here is my ticket for ${ticket?.eventTitle}:`,
          url: shareUrl,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!ticket) return;
    const QRCode = (await import('qrcode')).default;
    const canvas = document.createElement('canvas');
    const qrValue = ticket.qrPayload || ticket.entitlementId;
    await QRCode.toCanvas(canvas, qrValue, {
      width: 300,
      margin: 2,
    });
    const link = document.createElement('a');
    link.download = `ticket-${ticket.entitlementId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange" />
          <p className="text-sm text-zinc-400 font-medium">Verifying Ticket...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-white mb-2">Failed to load ticket</h2>
        <p className="text-sm text-zinc-400 max-w-sm mb-6">
          {error || 'This ticket may be invalid or expired.'}
        </p>
        <Link
          href="/explore"
          className="px-6 py-2.5 rounded-full bg-orange text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
        >
          Browse Events
        </Link>
      </div>
    );
  }

  const dateString = ticket.eventStartAt ? formatEventDate(ticket.eventStartAt) : 'TBD';
  const timeString = ticket.eventStartAt ? formatTimeIST(ticket.eventStartAt) : 'TBD';

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col justify-center py-12 px-4 sm:px-6">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-orange/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-orange/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center">
        {/* Back Link */}
        <Link
          href="/tickets"
          className="self-start flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK TO TICKETS
        </Link>

        {/* Ticket Container */}
        <div className="w-full bg-zinc-900/60 backdrop-blur-3xl border border-white/10 rounded-[36px] overflow-hidden shadow-2xl p-6 sm:p-8 flex flex-col items-center">
          {/* Event Poster */}
          {ticket.posterUrl && (
            <div className="relative aspect-[3/4] w-32 overflow-hidden rounded-2xl border border-white/10 shadow-lg mb-6">
              <ShimmerImage
                src={ticket.posterUrl}
                alt={ticket.eventTitle}
                fill
                className="object-cover"
              />
            </div>
          )}

          <h2 className="text-xl sm:text-2xl font-black uppercase text-center text-white tracking-tight mb-2">
            {ticket.eventTitle}
          </h2>

          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6">
            {dateString} • {timeString}
          </p>

          {/* QR Code */}
          <div className="relative w-full aspect-square max-w-[200px] flex flex-col justify-center items-center bg-white rounded-3xl p-4 shadow-inner mb-6">
            <QRCodeSVG
              value={ticket.qrPayload || ticket.entitlementId}
              size={180}
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              level="H"
            />
            {ticket.checkedIn && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4">
                <CheckCircle className="h-10 w-10 text-emerald-500 mb-2 animate-bounce" />
                <span className="text-xs font-black uppercase text-emerald-600 tracking-wider">
                  Checked In
                </span>
              </div>
            )}
          </div>

          {/* Ticket Info */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white">
              {ticket.ticketType}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold tracking-widest">
              ID: {ticket.entitlementId}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-4 w-full">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-widest transition-all text-white"
            >
              <Share2 className="h-4 w-4" />
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-orange hover:bg-orange-600 text-xs font-black uppercase tracking-widest transition-all shadow-lg text-white"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
