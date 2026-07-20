'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share2, Copy, Check, Ticket } from 'lucide-react';
import { formatEventDate } from '@c1rcle/core/time';

/**
 * QR Ticket Component
 * Displays a ticket with QR code for event entry
 */
export default function QRTicket({
  qrData,
  ticketName,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  quantity = 1,
  entryType = 'general',
  orderId,
  showActions = true,
}) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);

  useEffect(() => {
    // Load QR code library dynamically
    const loadQRCode = async () => {
      try {
        // Use a simple QR code generator
        if (typeof window !== 'undefined' && canvasRef.current) {
          const QRCode = (await import('qrcode')).default;
          await QRCode.toCanvas(canvasRef.current, qrData, {
            width: 200,
            margin: 2,
            color: {
              dark: '#1d1d1f',
              light: '#ffffff',
            },
          });
          setQrLoaded(true);
        }
      } catch (err) {
        console.error('Failed to generate QR code:', err);
        // Fallback: Show data as text
        setQrLoaded(false);
      }
    };

    if (qrData) {
      loadQRCode();
    }
  }, [qrData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `ticket-${orderId}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ticket for ${eventTitle}`,
          text: `${ticketName} - ${eventDate} at ${eventLocation}`,
          url: window.location.href,
        });
      } catch {
        // AbortError: user dismissed share sheet — expected
      }
    }
  };

  // local formatDate removed, using formatEventDate from core

  const entryTypeLabels = {
    general: 'General Entry',
    stag: 'Stag Entry',
    couple: 'Couple Entry',
    group: 'Group Entry',
    vip: 'VIP Entry',
    table: 'Table Reservation',
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-200 w-full sm:max-w-sm mx-auto relative">
      {/* Independent Cut outs */}
      <div className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 bg-slate-100 rounded-full z-10" />
      <div className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 bg-slate-100 rounded-full z-10" />

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-white/70">THE C1RCLE</p>
            <p className="font-bold">{ticketName}</p>
          </div>
        </div>
      </div>

      {/* Event Info */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-2">{eventTitle}</h2>
        <div className="space-y-1 text-sm text-slate-600">
          <p>
            {formatEventDate(eventDate)} • {eventTime}
          </p>
          <p className="text-slate-500">{eventLocation}</p>
        </div>
      </div>

      {/* QR Code */}
      <div className="p-6 pb-2 flex flex-col items-center">
        <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-slate-200 mb-4">
          <canvas ref={canvasRef} />

          {/* Fallback if QR library not loaded */}
          {!qrLoaded && (
            <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-100 rounded-xl">
              <p className="text-xs text-slate-500 text-center px-4">QR code will appear here</p>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 mb-4">Show this QR code at the venue entrance</p>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>

          {navigator.share && (
            <button
              onClick={handleShare}
              className="py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Share2 className="h-4 w-4 text-slate-600" />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      )}

      {/* Decorative tear line */}
      <div className="w-full border-t-2 border-dashed border-slate-200" />

      {/* Black Footer Section for Entry Details */}
      <div className="bg-[#0a0a0a] text-white">
        <div className="p-6 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/60">Entry Type</span>
            <span className="font-bold text-white text-right">
              {entryTypeLabels[entryType] || entryType}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/60">Quantity</span>
            <span className="font-bold text-white text-right">
              {quantity} {quantity > 1 ? 'tickets' : 'ticket'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/60">Order ID</span>
            <span className="font-mono text-xs text-white/80 text-right">{orderId?.slice(0, 12)}...</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            Keep this ticket safe • Valid for one-time entry only
          </p>
        </div>
      </div>
    </div>
  );
}
