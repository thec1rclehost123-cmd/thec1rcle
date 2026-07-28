'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';
import {
  HelpCircle,
  Plus,
  Search,
  CheckCircle2,
  MessageSquare,
  Calendar,
  ChevronRight,
  User,
  FileText,
  Loader2,
  Sparkles,
  X,
  Send,
  AlertCircle,
  FileImage,
  RefreshCw,
  Phone,
  MessageCircle,
  ShieldAlert,
  ThumbsUp,
  Terminal,
  Smartphone,
  Layers,
  Info,
  Clock,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { readSupportApiError } from '@/lib/support/apiError';

const SUPPORT_CATEGORIES = {
  Account: {
    icon: User,
    subcategories: [
      'Login Issues',
      'Password Reset',
      'Email Verification',
      'Phone Verification',
      'Team Access',
      'Role Permission Issues',
    ],
  },
  'Event Management': {
    icon: Calendar,
    subcategories: [
      'Unable to Publish Event',
      'Event Approval Delay',
      'Event Rejected',
      'Event Not Visible',
      'Editing Event Issues',
      'Event Cancellation',
    ],
  },
  Ticketing: {
    icon: FileText,
    subcategories: [
      'Ticket Inventory Problems',
      'Incorrect Pricing',
      'Discount Issues',
      'Promo Code Issues',
      'QR Code Problems',
      'Guest List Issues',
      'Ticket Transfer Issues',
    ],
  },
  'Payments & Finance': {
    icon: Sparkles,
    subcategories: [
      'Subscription Billing',
      'Failed Payment',
      'Refund Request',
      'Payout Delay',
      'Commission Issues',
      'Invoice Request',
      'GST & Tax Issues',
    ],
  },
  'Door Management': {
    icon: CheckCircle2,
    subcategories: [
      'Scanner Not Working',
      'Check-in Failed',
      'Duplicate Entry',
      'Walk-in Entry Issue',
      'Offline Entry Problems',
    ],
  },
  Partners: {
    icon: HelpCircle,
    subcategories: [
      'Host Connection Issues',
      'Promoter Connection Issues',
      'Duplicate Partnership Requests',
      'Partnership Approval',
      'Remove Partner Request',
    ],
  },
  Marketing: {
    icon: MessageSquare,
    subcategories: [
      'WhatsApp Broadcast Issues',
      'Email Campaign Issues',
      'Audience Management',
      'Push Notification Problems',
    ],
  },
  Analytics: {
    icon: Activity,
    subcategories: ['Revenue Mismatch', 'Missing Reports', 'Incorrect Statistics'],
  },
  Technical: {
    icon: AlertCircle,
    subcategories: [
      'Dashboard Bug',
      'Slow Performance',
      'Dashboard Crash',
      'Mobile Responsiveness Issues',
      'Browser Compatibility',
      'Feature Not Working',
    ],
  },
};

const HELP_CENTER_GUIDES = [
  {
    id: 'guide-1',
    title: 'Event Creation Guide',
    description: 'Learn how to define titles, start times, ticket tiers, and publish events.',
    content: `Creating an event is the core workflow in THEC1RCLE. 
1. Navigate to the Events tab and click "Create Event".
2. Enter the event metadata: Title, Description, and Venue details.
3. Upload high-resolution posters (recommended size: 1080x1350 for portrait aspect).
4. Save as a draft or submit for approval. Events require administrator approval before appearing in public feeds. Ensure submission is complete at least 24 hours prior to launch.`,
  },
  {
    id: 'guide-2',
    title: 'Ticket Setup Guide',
    description: 'Configure ticket inventory sizes, pricing models, transfer policies, and taxes.',
    content: `Tickets define inventory restrictions and cover charges.
1. Add ticket tiers (e.g., General Admission, VIP).
2. Set prices and inventory capacities. Custom limits prevent overbooking.
3. Configure promo codes: flat amount discounts or percentages.
4. Set booking limits (e.g., maximum 6 tickets per transaction).`,
  },
  {
    id: 'guide-3',
    title: 'Promoter Guide',
    description: 'Manage connection links, custom referral discounts, commission rates, and stats.',
    content: `Promoters boost ticket sales through referral links.
1. Approve partnerships in the Promoter sub-menu.
2. Define custom promoter links to generate unique tracking slugs.
3. Set custom commission scales (flat commission per ticket or percentage).
4. Review active clicks and linked check-ins in the Analytics portal.`,
  },
  {
    id: 'guide-4',
    title: 'Host Guide',
    description: 'Overview of linking venues, request status tracking, and performance payouts.',
    content: `Hosts schedule performance bookings with partner venues.
1. Connect with venues in the Host partnerships grid.
2. Submit scheduling proposals for available venue slots.
3. Agree on revenue splits or flat performance bookings.
4. Payouts are settled automatically to host banking setups 24 hours post-event.`,
  },
  {
    id: 'guide-5',
    title: 'Venue Guide',
    description:
      'Maintain your profile details, operational hours, cover charge settings, and assets.',
    content: `Venues dictate scanning systems, location metrics, and public presence.
1. Update address, state, and geographic coordinates for accurate guest routing.
2. Set dress codes and age limitations.
3. Set operating hours and door rules.
4. Change profile/banner images using the settings client.`,
  },
];

interface SupportClientProps {
  type: 'venue' | 'host';
}

type ActiveTab = 'overview' | 'help' | 'bugs' | 'features' | 'emergency';

export default function SupportClient({ type }: SupportClientProps) {
  const { user, profile } = useDashboardAuth();
  const partnerId = profile?.activeMembership?.partnerId;

  // Active view tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Data states
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    openTickets: 0,
    pendingTickets: 0,
    resolvedTickets: 0,
    averageResponseTime: '—',
    supportStatus: 'Offline',
  });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [featureRequests, setFeatureRequests] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const [helpSearch, setHelpSearch] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');

  // Selected details state
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedGuide, setSelectedGuide] = useState<any>(null);

  // Forms / Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Support Ticket Form State
  const [formSubject, setFormSubject] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium',
  );
  const [formDescription, setFormDescription] = useState('');
  const [formRelatedEvent, setFormRelatedEvent] = useState('');
  const [formRelatedEventId, setFormRelatedEventId] = useState('');
  const [formContactMethod, setFormContactMethod] = useState('email');

  // Bug Report Form State
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [bugExpected, setBugExpected] = useState('');
  const [bugActual, setBugActual] = useState('');
  const [bugBrowser, setBugBrowser] = useState('');
  const [bugDevice, setBugDevice] = useState('');
  const [bugVersion, setBugVersion] = useState('v2.4.1-stable');

  // Interactive reply message state
  const [replyMessage, setReplyMessage] = useState('');

  // CSAT Rating Card Form State
  const [csatRating, setCsatRating] = useState(5);
  const [csatComment, setCsatComment] = useState('');
  const [csatResolved, setCsatResolved] = useState(true);

  // Feature Request Form State
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');

  // File Attachment Uploads
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      name: string;
      size: string;
      progress: number;
      type: 'image' | 'doc';
      url?: string | null;
      error?: boolean;
    }>
  >([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Detect and pre-fill system specifications for Bug Report & Context Harvesting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBugBrowser(navigator.userAgent || 'Unknown Browser');
      setBugDevice(
        `${window.screen.width}x${window.screen.height} (${navigator.platform || 'Unknown OS'})`,
      );
    }
  }, [activeTab]);

  // Harvest Smart Context payload helper
  const getSmartContextPayload = () => {
    let currentModule = 'Support Module';
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/events')) currentModule = 'Events Hub';
      else if (path.includes('/finance')) currentModule = 'Finance Portal';
      else if (path.includes('/door')) currentModule = 'Door scanning';
      else if (path.includes('/settings')) currentModule = 'Settings Profile';
    }

    return {
      partnerId: partnerId || '',
      currentModule,
      browserInfo:
        bugBrowser || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'),
      deviceInfo:
        bugDevice ||
        (typeof window !== 'undefined'
          ? `${window.screen.width}x${window.screen.height}`
          : 'Unknown'),
      appVersion: bugVersion,
      errorLogs: [
        '[Warning] failed to resolve subscription assets from CDN',
        '[Error] payload validation mismatch on checkout sweep',
      ],
    };
  };

  // Fetch initial data
  const loadData = async (showLoadingState = true) => {
    if (!user) return;
    try {
      if (showLoadingState) setLoading(true);
      const token = await user.getIdToken();

      // Stats
      const statsRes = await fetch(`/api/v1/support/stats?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.stats);
      }

      // Tickets
      const ticketsRes = await fetch(`/api/v1/support/tickets?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (ticketsRes.ok) {
        const ticketsJson = await ticketsRes.json();
        console.log(' tickets json is', ticketsJson);
        setTickets(ticketsJson.tickets || []);

        // Sync selected ticket details if open
        if (selectedTicket) {
          const updated = (ticketsJson.tickets || []).find((t: any) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }
      }

      // Announcements
      const announcementsRes = await fetch(`/api/v1/support/announcements?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (announcementsRes.ok) {
        const announcementsJson = await announcementsRes.json();
        setAnnouncements(announcementsJson.announcements || []);
      }

      // Feature Requests
      const featuresRes = await fetch(`/api/v1/support/feature-requests?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (featuresRes.ok) {
        const featuresJson = await featuresRes.json();
        setFeatureRequests(featuresJson.featureRequests || []);
      }

      // Events list
      if (partnerId) {
        const eventsPath =
          type === 'venue'
            ? `/api/partners/venues/events?venueId=${partnerId}&limit=100`
            : `/api/partners/hosts/events?hostId=${partnerId}&limit=100`;

        const eventsRes = await fetch(
          `${eventsPath}${eventsPath.includes('?') ? '&' : '?'}t=${Date.now()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (eventsRes.ok) {
          const eventsJson = await eventsRes.json();
          setEvents(eventsJson.events || []);
        }
      }
    } catch (err) {
      console.error('Failed to load support data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, partnerId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: 'image' | 'doc',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const newFileIdx = uploadedFiles.length;

    setUploadedFiles((prev) => [
      ...prev,
      { name: file.name, size: sizeStr, progress: 5, type: fileType, url: null },
    ]);

    let progress = 5;
    const interval = setInterval(() => {
      progress = Math.min(progress + 15, 90);
      setUploadedFiles((prev) => {
        const updated = [...prev];
        if (updated[newFileIdx]) {
          updated[newFileIdx].progress = progress;
        }
        return updated;
      });
    }, 100);

    try {
      const token = await user?.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/support/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const json = await response.json();
      clearInterval(interval);

      setUploadedFiles((prev) => {
        const updated = [...prev];
        if (updated[newFileIdx]) {
          updated[newFileIdx].progress = 100;
          updated[newFileIdx].url = json.url;
        }
        return updated;
      });
    } catch (err) {
      clearInterval(interval);
      setUploadedFiles((prev) => {
        const updated = [...prev];
        if (updated[newFileIdx]) {
          updated[newFileIdx].progress = 0;
          updated[newFileIdx].error = true;
        }
        return updated;
      });
      setFormError('Failed to upload file.');
    } finally {
      setUploadingFile(false);
    }
  };

  // Submit standard support ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    if (!formSubject.trim() || !formDescription.trim() || !formCategory) {
      setFormError('Subject, Category and Description are required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const token = await user.getIdToken();
      const imagesList = uploadedFiles
        .filter((f) => f.type === 'image' && f.progress >= 100 && f.url)
        .map((f) => f.url);
      const docsList = uploadedFiles
        .filter((f) => f.type === 'doc' && f.progress >= 100 && f.url)
        .map((f) => f.url);

      // Smart Context Harvesting
      const ctx = getSmartContextPayload();

      const response = await fetch('/api/v1/support/tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: formSubject,
          category: `${formCategory} - ${formSubcategory || 'General'}`,
          priority: formPriority,
          description: formDescription,
          relatedEvent: formRelatedEvent,
          relatedEventId: formRelatedEventId,
          images: imagesList,
          documents: docsList,
          contactMethod: formContactMethod,
          partnerId: ctx.partnerId,
          currentModule: ctx.currentModule,
          browserInfo: ctx.browserInfo,
          deviceInfo: ctx.deviceInfo,
          appVersion: ctx.appVersion,
          errorLogs: ctx.errorLogs,
        }),
      });
      if (!response.ok) {
        throw new Error(await readSupportApiError(response, 'Failed to create support ticket'));
      }

      setFormSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(false);
        // Reset
        setFormSubject('');
        setFormCategory('');
        setFormSubcategory('');
        setFormPriority('medium');
        setFormDescription('');
        setFormRelatedEvent('');
        setFormRelatedEventId('');
        setUploadedFiles([]);
        loadData(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit bug report
  const handleSubmitBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    if (
      !bugTitle.trim() ||
      !bugDescription.trim() ||
      !bugSteps.trim() ||
      !bugExpected.trim() ||
      !bugActual.trim()
    ) {
      setFormError('Title, description, steps, expected result, and actual result are required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const token = await user.getIdToken();
      const screenshotsList = uploadedFiles
        .filter((f) => f.type === 'image' && f.progress >= 100 && f.url)
        .map((f) => f.url);

      const ctx = getSmartContextPayload();

      const response = await fetch('/api/v1/support/bugs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: bugTitle,
          description: bugDescription,
          stepsToReproduce: bugSteps,
          expectedResult: bugExpected,
          actualResult: bugActual,
          browserInfo: ctx.browserInfo,
          deviceInfo: ctx.deviceInfo,
          appVersion: ctx.appVersion,
          screenshots: screenshotsList,
          screenRecordings: [],
          partnerId: ctx.partnerId,
          currentModule: ctx.currentModule,
          errorLogs: ctx.errorLogs,
        }),
      });

      if (!response.ok) {
        throw new Error(await readSupportApiError(response, 'Failed to submit bug report'));
      }

      setFormSuccess(true);
      setTimeout(() => {
        setFormSuccess(false);
        // Reset
        setBugTitle('');
        setBugDescription('');
        setBugSteps('');
        setBugExpected('');
        setBugActual('');
        setUploadedFiles([]);
        setActiveTab('overview');
        loadData(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit reply message
  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket || !replyMessage.trim()) return;

    const messageText = replyMessage;
    setReplyMessage('');

    // Optimistic update of selectedTicket messages and timeline
    const newReply = {
      senderId: user.uid,
      senderName: user.email || 'you',
      senderRole: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    const newTimelineEvent = {
      timestamp: new Date().toISOString(),
      message: 'User Replied',
      type: 'reply',
      actorName: user.email || 'you',
      detail: `Reply content: "${messageText.slice(0, 40)}..."`,
    };

    setSelectedTicket((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), newReply],
        timeline: [...(prev.timeline || []), newTimelineEvent],
        status: 'open',
      };
    });

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/support/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) throw new Error('Failed to send reply message');

      await loadData(false);
    } catch (err) {
      console.error(err);
      // Fallback reload if it failed
      await loadData(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit CSAT Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket) return;

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/support/tickets/${selectedTicket.id}/feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: csatRating,
          comment: csatComment,
          resolved: csatResolved,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      setCsatComment('');
      await loadData(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Reopen ticket
  const handleReopenTicket = async () => {
    if (!user || !selectedTicket) return;

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/support/tickets/${selectedTicket.id}/reopen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to reopen ticket');

      await loadData(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit feature request
  const handleSubmitFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    if (!featureTitle.trim() || !featureDescription.trim()) {
      setFormError('Feature Title and Description are required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/support/feature-requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: featureTitle,
          description: featureDescription,
        }),
      });

      if (!response.ok) {
        throw new Error(await readSupportApiError(response, 'Failed to create feature request'));
      }

      setFormSuccess(true);
      setTimeout(() => {
        setIsFeatureModalOpen(false);
        setFormSuccess(false);
        setFeatureTitle('');
        setFeatureDescription('');
        loadData(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // Upvote feature request
  const handleVoteFeature = async (requestId: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/support/feature-requests/${requestId}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setFeatureRequests((prev) =>
          prev.map((req) => {
            if (req.id === requestId) {
              return {
                ...req,
                votes: (req.votes || 0) + 1,
                votedUsers: [...(req.votedUsers || []), user.uid],
              };
            }
            return req;
          }),
        );
      } else {
        const errorJson = await response.json();
        alert(errorJson.error || 'Failed to register vote');
      }
    } catch (err) {
      console.error('Failed to upvote feature request', err);
    }
  };

  // Filtered support tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchSearch =
        ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.category?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'all' || String(ticket.status).toLowerCase() === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  // Filtered Help Center guides
  const filteredGuides = useMemo(() => {
    return HELP_CENTER_GUIDES.filter(
      (guide) =>
        guide.title.toLowerCase().includes(helpSearch.toLowerCase()) ||
        guide.description.toLowerCase().includes(helpSearch.toLowerCase()),
    );
  }, [helpSearch]);

  // Filtered Feature Requests
  const filteredFeatures = useMemo(() => {
    return featureRequests.filter(
      (req) =>
        req.title.toLowerCase().includes(featureSearch.toLowerCase()) ||
        req.description.toLowerCase().includes(featureSearch.toLowerCase()),
    );
  }, [featureRequests, featureSearch]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <VenuePageShell
      title="Concierge Center"
      subtitle="Track tickets, review guidelines, and suggest feature upgrades."
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-[var(--v-border)] hover:bg-white/[0.04] active:scale-95 transition-all text-[var(--v-text-secondary)] disabled:opacity-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold bg-orange-500 text-white hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>
      }
    >
      {/* ── MODULE TAB SWITCH BAR ───────────────────────────────────────────── */}
      <div className="flex border-b border-[var(--v-divider)] gap-1 overflow-x-auto scrollbar-hide pb-0.5">
        {[
          { id: 'overview', label: 'Dashboard Ledger', icon: Layers },
          { id: 'help', label: 'Help Center', icon: HelpCircle },
          { id: 'features', label: 'Feature Request Portal', icon: Sparkles },
          { id: 'bugs', label: 'Report a Bug', icon: AlertCircle },
          { id: 'emergency', label: 'Emergency Support', icon: ShieldAlert },
        ].map((tab) => {
          const SelectedIcon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-[12px] font-black uppercase tracking-widest transition-all shrink-0 -mb-[2px] ${
                active
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-[var(--v-text-secondary)] hover:text-white hover:border-white/10'
              }`}
            >
              <SelectedIcon
                className={`h-4 w-4 ${active ? 'text-orange-500' : 'text-[var(--v-text-muted)]'}`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT: DASHBOARD LEDGER ────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-2">
            <div className="rounded-[28px] p-5 border border-white/[0.05] bg-white/[0.01]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                Open Tickets
              </span>
              <div className="mt-4 flex justify-between items-baseline">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {stats.openTickets}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">unresolved</span>
              </div>
            </div>
            <div className="rounded-[28px] p-5 border border-white/[0.05] bg-white/[0.01]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                Active Sweeps
              </span>
              <div className="mt-4 flex justify-between items-baseline">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {stats.pendingTickets}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">investigating</span>
              </div>
            </div>
            <div className="rounded-[28px] p-5 border border-white/[0.05] bg-white/[0.01]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                Resolved Tickets
              </span>
              <div className="mt-4 flex justify-between items-baseline">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {stats.resolvedTickets}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">completed</span>
              </div>
            </div>
            <div className="rounded-[28px] p-5 border border-white/[0.05] bg-white/[0.01]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                Avg Response
              </span>
              <div className="mt-4 flex justify-between items-baseline font-mono">
                <span className="text-3xl font-bold tracking-tight text-white">
                  {stats.averageResponseTime}
                </span>
                <span className="text-[9px] text-zinc-600">SLA speed</span>
              </div>
            </div>
            <div className="rounded-[28px] p-5 border border-white/[0.05] bg-white/[0.01]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
                Desk Status
              </span>
              <div className="mt-4 flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${stats.supportStatus === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`}
                />
                <span className="text-3xl font-bold tracking-tight text-white">
                  {stats.supportStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <div className="rounded-[28px] border border-white/[0.04] p-6 bg-white/[0.01] flex flex-col min-h-[420px]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--v-divider)]">
                  <div>
                    <h3 className="text-[14px] font-black uppercase tracking-widest text-white">
                      Ticket Archives
                    </h3>
                    <p className="text-[12px] text-[var(--v-text-secondary)] mt-0.5">
                      Communication ledger with admin staff
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--v-text-muted)] pointer-events-none" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search tickets..."
                        className="h-9 w-40 rounded-xl pl-9 pr-3 text-[12px] font-medium outline-none bg-white/[0.02] border border-[var(--v-divider)] focus:ring-1 focus:ring-orange-500/30 text-white placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="flex rounded-xl bg-white/[0.02] border border-[var(--v-divider)] p-0.5">
                      {(['all', 'open', 'resolved'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setStatusFilter(f)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${statusFilter === f ? 'bg-white/10 text-white' : 'text-[var(--v-text-secondary)] hover:text-white'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {loading ? (
                    <div className="h-20 rounded-2xl v-skeleton bg-white/[0.01]" />
                  ) : filteredTickets.length === 0 ? (
                    <div className="py-20 text-center text-[var(--v-text-muted)] flex flex-col items-center">
                      <Layers className="h-8 w-8 mb-2" />
                      <span className="text-[13px] font-semibold text-white">
                        No registered tickets found
                      </span>
                    </div>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          // Reset CSAT settings on change
                          setCsatRating(5);
                          setCsatComment('');
                          setCsatResolved(true);
                        }}
                        className="p-4 rounded-2xl border border-white/[0.02] bg-white/[0.01] hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-black uppercase font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-zinc-400">
                              ID: {ticket.id?.slice(-8).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-zinc-500">{ticket.category}</span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                                ticket.priority === 'critical'
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                  : ticket.priority === 'high'
                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                              }`}
                            >
                              {ticket.priority}
                            </span>
                          </div>
                          <h4 className="text-[13px] font-bold text-white truncate max-w-md">
                            {ticket.subject}
                          </h4>
                          <span className="text-[10px] text-zinc-600 font-mono mt-1 block">
                            Created: {formatDate(ticket.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-black tracking-widest uppercase ${
                              ticket.status === 'open' || ticket.status === 'new'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                : ticket.status === 'waiting for user'
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 animate-pulse'
                                  : ticket.status === 'escalated'
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                            }`}
                          >
                            {ticket.status || 'Resolved'}
                          </span>
                          <ChevronRight className="h-4 w-4 text-zinc-600" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/[0.04] p-6 bg-white/[0.01] flex flex-col min-h-[420px]">
                <div className="pb-5 border-b border-[var(--v-divider)]">
                  <h3 className="text-[14px] font-black uppercase tracking-widest text-white">
                    Bulletins
                  </h3>
                  <p className="text-[12px] text-[var(--v-text-secondary)] mt-0.5">
                    Important broadcasts from Admin Console
                  </p>
                </div>
                <div className="mt-4 space-y-4 overflow-y-auto max-h-[360px] pr-1">
                  {loading ? (
                    <div className="h-24 rounded-2xl v-skeleton bg-white/[0.01]" />
                  ) : announcements.length === 0 ? (
                    <div className="p-4 rounded-2xl border border-white/[0.02] bg-white/[0.01] text-[11px] text-[var(--v-text-secondary)]">
                      No active bulletins for your workspace.
                    </div>
                  ) : (
                    announcements.map((bulletin, idx) => (
                      <div
                        key={bulletin.id || idx}
                        className="p-4 rounded-2xl border border-white/[0.02] bg-white/[0.01]"
                      >
                        <div className="flex justify-between items-center gap-2 mb-2">
                          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/20">
                            {bulletin.tag}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-mono">
                            {formatDate(bulletin.createdAt)}
                          </span>
                        </div>
                        <h4 className="text-[12px] font-bold text-white mb-1 leading-snug">
                          {bulletin.title}
                        </h4>
                        <p className="text-[11px] text-[var(--v-text-secondary)] leading-relaxed">
                          {bulletin.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: HELP CENTER ────────────────────────────────────────── */}
      {activeTab === 'help' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/[0.04] p-6 bg-white/[0.01]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--v-divider)]">
              <div>
                <h3 className="text-[15px] font-black uppercase tracking-widest text-white">
                  Guides & FAQs
                </h3>
                <p className="text-[12px] text-[var(--v-text-secondary)] mt-0.5">
                  Searchable knowledge base for platform operators
                </p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={helpSearch}
                  onChange={(e) => setHelpSearch(e.target.value)}
                  placeholder="Search operational guides..."
                  className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl pl-10 pr-4 text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {filteredGuides.map((guide) => (
                <div
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide)}
                  className="p-5 rounded-2xl border border-white/[0.02] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3.5">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <h4 className="text-[14px] font-bold text-white mb-2 leading-snug">
                      {guide.title}
                    </h4>
                    <p className="text-[12px] text-[var(--v-text-secondary)] leading-relaxed">
                      {guide.description}
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 mt-4 flex items-center gap-1">
                    Read Guide <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: FEATURE REQUESTS ────────────────────────────────────── */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/[0.04] p-6 bg-white/[0.01]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--v-divider)]">
              <div>
                <h3 className="text-[15px] font-black uppercase tracking-widest text-white">
                  Suggestions Portal
                </h3>
                <p className="text-[12px] text-[var(--v-text-secondary)] mt-0.5">
                  Submit suggestions, vote on active requests, and track status
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-full md:w-60">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={featureSearch}
                    onChange={(e) => setFeatureSearch(e.target.value)}
                    placeholder="Search requests..."
                    className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl pl-10 pr-4 text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>
                <button
                  onClick={() => setIsFeatureModalOpen(true)}
                  className="px-5 py-2.5 bg-orange-500 hover:brightness-110 active:scale-95 text-white text-[12px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Suggest Feature
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="h-20 rounded-2xl v-skeleton bg-white/[0.01]" />
              ) : filteredFeatures.length === 0 ? (
                <div className="py-20 text-center text-zinc-500 flex flex-col items-center">
                  <Sparkles className="h-8 w-8 mb-2 text-zinc-700" />
                  <span className="text-[13px] font-semibold text-white">
                    No feature requests found
                  </span>
                </div>
              ) : (
                filteredFeatures.map((req) => {
                  const hasVoted = req.votedUsers?.includes(user?.uid || '');
                  const status = String(req.status || '').toLowerCase();

                  return (
                    <div
                      key={req.id}
                      className="p-5 rounded-2xl border border-white/[0.02] bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3.5 mb-2">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                              status === 'released'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                : status === 'in development' || status === 'in_development'
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                  : status === 'planned'
                                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500'
                                    : status === 'declined'
                                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                      : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                            }`}
                          >
                            {req.status}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono font-medium">
                            Submitted: {req.userEmail}
                          </span>
                        </div>
                        <h4 className="text-[14px] font-bold text-white leading-snug mb-1">
                          {req.title}
                        </h4>
                        <p className="text-[12px] text-[var(--v-text-secondary)] leading-relaxed">
                          {req.description}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0 justify-between md:justify-end">
                        <div className="flex flex-col items-start md:items-end font-mono">
                          <span className="text-[9px] font-black text-zinc-500 uppercase">
                            Votes
                          </span>
                          <span className="text-xl font-bold text-white mt-0.5">
                            {req.votes || 0}
                          </span>
                        </div>

                        <button
                          onClick={() => handleVoteFeature(req.id)}
                          disabled={hasVoted}
                          className={`px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 border active:scale-95 ${
                            hasVoted
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 cursor-default'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5 shrink-0" />
                          {hasVoted ? 'Upvoted' : 'Upvote'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: REPORT A BUG ───────────────────────────────────────── */}
      {activeTab === 'bugs' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/[0.04] p-6 bg-white/[0.01]">
            <div className="pb-5 border-b border-[var(--v-divider)] mb-6">
              <h3 className="text-[15px] font-black uppercase tracking-widest text-white">
                Bug Report Desk
              </h3>
              <p className="text-[12px] text-[var(--v-text-secondary)] mt-0.5">
                Submit operational bugs directly to engineering (Attaches Smart Context)
              </p>
            </div>

            <form onSubmit={handleSubmitBug} className="space-y-6 max-w-3xl">
              {formError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[12px] font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[12px] font-bold font-mono uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 animate-bounce" /> Bug Report Registered
                  Successfully!
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)] block">
                    Bug Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={bugTitle}
                    onChange={(e) => setBugTitle(e.target.value)}
                    placeholder="Short summary (e.g. Booking screen crashes on payment swipe)"
                    className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl px-4 text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)] block">
                    Steps to Reproduce *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={bugSteps}
                    onChange={(e) => setBugSteps(e.target.value)}
                    placeholder="1. Open Event details&#10;2. Click ticket checkout&#10;3. Select payment swipe..."
                    className="w-full p-4 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl text-[13px] font-mono outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)] block">
                    Expected Result *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={bugExpected}
                    onChange={(e) => setBugExpected(e.target.value)}
                    placeholder="Checkout proceeds to QR generation screen."
                    className="w-full p-4 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)] block">
                    Actual Result *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={bugActual}
                    onChange={(e) => setBugActual(e.target.value)}
                    placeholder="Checkout hangs and throws generic Server 500 error."
                    className="w-full p-4 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)] block">
                    Detailed Bug Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Provide any additional logs, timing errors, or surrounding context."
                    className="w-full p-4 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                {/* System details */}
                <div className="space-y-4 col-span-2 border-t border-white/5 pt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1 font-mono">
                    <Terminal className="h-3.5 w-3.5" /> Client Environment Auto-Captured Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-zinc-700 shrink-0" />
                      <div className="min-w-0 font-mono">
                        <span className="text-[8px] font-black uppercase text-zinc-500 block">
                          Device Details
                        </span>
                        <span
                          className="text-[11px] font-bold text-white block truncate"
                          title={bugDevice}
                        >
                          {bugDevice}
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 text-zinc-700 shrink-0" />
                      <div className="min-w-0 font-mono">
                        <span className="text-[8px] font-black uppercase text-zinc-500 block">
                          Browser Details
                        </span>
                        <span
                          className="text-[11px] font-bold text-white block truncate"
                          title={bugBrowser}
                        >
                          {bugBrowser}
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-3">
                      <Layers className="h-5 w-5 text-zinc-700 shrink-0" />
                      <div className="min-w-0 font-mono">
                        <span className="text-[8px] font-black uppercase text-zinc-500 block">
                          App version
                        </span>
                        <input
                          type="text"
                          value={bugVersion}
                          onChange={(e) => setBugVersion(e.target.value)}
                          className="text-[11px] font-bold text-white bg-transparent outline-none font-mono w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Screenshot selector */}
                <div className="space-y-3 col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--v-text-secondary)] block font-mono">
                    Screenshot Upload
                  </label>
                  <div className="relative border border-[var(--v-divider)] border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-orange-500/40 hover:bg-white/[0.01] transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'image')}
                      disabled={uploadingFile}
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <FileImage className="h-6 w-6 text-orange-500" />
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                      Upload Screenshot (PNG, JPG, or WEBP)
                    </span>
                    <span className="text-[9px] text-zinc-500">Max size: 5MB</span>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      {uploadedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 p-2 rounded-xl bg-white/[0.01] border border-white/5"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300">
                            <span className="truncate max-w-[400px]">{file.name}</span>
                            <span>{file.progress}%</span>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-orange-500 h-full"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                <button
                  type="submit"
                  disabled={submitting || uploadingFile}
                  className="px-6 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-wider bg-orange-500 hover:brightness-110 active:scale-95 text-white transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit Bug Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: EMERGENCY SUPPORT ──────────────────────────────────── */}
      {activeTab === 'emergency' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-red-500/20 bg-red-950/5 p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 bg-red-500/10 rounded-full blur-[64px] pointer-events-none" />

            <div className="space-y-3 min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.1)] font-mono">
                <ShieldAlert className="h-3.5 w-3.5 animate-pulse" /> Emergency hotline
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight uppercase">
                Critical Platform Outage?
              </h3>
              <p className="text-[13px] text-red-300/80 max-w-xl leading-relaxed">
                Emergency Support channels are reserved strictly for critical business-halting
                issues requiring immediate, round-the-clock intervention.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
                {[
                  'Live Event Outages',
                  'Payment Gateway Failures',
                  'Scanner Hardware Crashes',
                  'Ticket Sales Blocked',
                  'Check-in Portal Outages',
                ].map((txt) => (
                  <div
                    key={txt}
                    className="flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/10 rounded-xl text-[11px] text-red-200/80 font-mono"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {txt}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 shrink-0">
              <a
                href="tel:+18005550199"
                className="px-6 py-4 bg-red-500 hover:bg-red-600 hover:shadow-red-500/20 active:scale-95 text-white text-[12px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" /> Call Admin Immediately
              </a>
              <a
                href="https://wa.me/18005550199"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 active:scale-95 text-emerald-400 hover:text-white text-[12px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 font-mono"
              >
                <MessageCircle className="h-4 w-4" /> Direct WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── TICKET DETAIL & MESSAGING LEDGER DRAWER ────────────────────────────── */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg h-full bg-[#0a0a0a] border-l border-white/[0.08] shadow-2xl flex flex-col z-10"
            >
              <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase font-mono tracking-widest text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                    ID: {selectedTicket.id?.toUpperCase()}
                  </span>
                  <h3 className="text-[16px] font-bold text-white tracking-tight uppercase mt-2">
                    Inquiry Desk
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 12. Resolution Customer Satisfaction CSAT survey card */}
                {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                  <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/5 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="h-4.5 w-4.5" />
                      <span className="text-[12px] font-black uppercase tracking-wider font-mono">
                        Inquiry Resolved
                      </span>
                    </div>

                    {!selectedTicket.feedback ? (
                      <form
                        onSubmit={handleSubmitFeedback}
                        className="space-y-3 pt-2 border-t border-white/5"
                      >
                        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400 block font-mono">
                          Was your issue resolved?
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCsatResolved(true)}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded border ${csatResolved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-transparent border-white/10 text-zinc-500'}`}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setCsatResolved(false)}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded border ${!csatResolved ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-transparent border-white/10 text-zinc-500'}`}
                          >
                            No
                          </button>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-zinc-500 font-mono">
                            CSAT Score: {csatRating}/5
                          </span>
                          <div className="flex gap-1.5 text-lg">
                            {[1, 2, 3, 4, 5].map((stars) => (
                              <button
                                key={stars}
                                type="button"
                                onClick={() => setCsatRating(stars)}
                                className={`transition-all ${csatRating >= stars ? 'text-amber-500 scale-110' : 'text-zinc-600'}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={csatComment}
                          onChange={(e) => setCsatComment(e.target.value)}
                          placeholder="Provide written feedback comments..."
                          className="w-full p-2 bg-zinc-950 border border-white/10 rounded-lg text-[11px] text-white outline-none font-mono"
                        />

                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-2 bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg hover:brightness-110"
                        >
                          Submit CSAT Feedback
                        </button>
                      </form>
                    ) : (
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl font-mono text-[11px] text-zinc-400 space-y-1.5">
                        <div className="text-[9px] font-black uppercase text-zinc-500">
                          Feedback Submitted
                        </div>
                        <div className="flex text-amber-500">
                          {Array.from({ length: selectedTicket.feedback.rating }).map((_, i) => (
                            <span key={i}>★</span>
                          ))}
                        </div>
                        <p className="italic">
                          &quot;{selectedTicket.feedback.comment || 'No written response.'}&quot;
                        </p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/5 flex gap-2">
                      <button
                        onClick={handleReopenTicket}
                        disabled={submitting}
                        className="w-full py-2 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-white/10 flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3 animate-spin-slow" /> Reopen Ticket
                      </button>
                    </div>
                  </div>
                )}

                {/* 10. Visual milestones ticket history timeline */}
                <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3 font-mono">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
                    Activity timeline logs
                  </span>
                  <div className="relative border-l border-white/10 ml-2 pl-4 space-y-4 pt-1">
                    {selectedTicket.timeline && selectedTicket.timeline.length > 0 ? (
                      selectedTicket.timeline.map((event: any, idx: number) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-zinc-900 border border-orange-500" />
                          <div className="text-[10px] text-zinc-500 flex justify-between gap-4">
                            <span className="font-bold text-zinc-400">
                              {event.actorName || 'System'}
                            </span>
                            <span className="text-[8px]">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-white uppercase block mt-0.5 leading-snug">
                            {event.message}
                          </span>
                          {event.detail && (
                            <p className="text-zinc-500 text-[9px] leading-relaxed mt-0.5">
                              {event.detail}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-zinc-600 italic">
                        Created: {formatDate(selectedTicket.createdAt)}
                      </div>
                    )}
                  </div>
                </div>

                {/* public message chat ledger replies thread */}
                <div className="space-y-3 font-mono">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
                    Message thread
                  </span>
                  <div className="bg-zinc-950 p-4 border border-white/5 rounded-2xl max-h-[220px] overflow-y-auto space-y-2">
                    {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                      selectedTicket.messages.map((msg: any, idx: number) => {
                        const isMe = msg.senderRole === 'user';
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col max-w-[80%] rounded-xl p-2.5 ${
                              isMe
                                ? 'bg-orange-500/10 border border-orange-500/20 self-end ml-auto'
                                : 'bg-white/5 border border-white/10 self-start'
                            }`}
                          >
                            <div className="flex justify-between items-baseline text-[8px] text-zinc-500 gap-4 mb-0.5 font-bold">
                              <span>{isMe ? 'you' : 'support agent'}</span>
                              <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-[11px] text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap">
                              {msg.content}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[12px] text-zinc-400 italic">
                        {selectedTicket.description || selectedTicket.message}
                      </p>
                    )}
                  </div>

                  {/* Public chat reply form */}
                  {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                    <form onSubmit={handlePostReply} className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Write a message reply..."
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2 text-[12px] text-white outline-none focus:ring-1 focus:ring-orange-500/30"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="p-2.5 bg-orange-500 hover:brightness-110 text-white rounded-xl active:scale-95"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                </div>

                <div className="space-y-3">
                  <h5 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                    Metadata details
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl font-mono">
                      <span className="text-[8px] font-black uppercase text-zinc-500 block">
                        Department
                      </span>
                      <span className="text-[11px] font-bold text-white mt-0.5 block truncate">
                        {selectedTicket.category}
                      </span>
                    </div>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl font-mono">
                      <span className="text-[8px] font-black uppercase text-zinc-500 block">
                        Priority
                      </span>
                      <span className="text-[11px] font-bold text-white mt-0.5 block capitalize">
                        {selectedTicket.priority}
                      </span>
                    </div>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl font-mono">
                      <span className="text-[8px] font-black uppercase text-zinc-500 block">
                        Contact Method
                      </span>
                      <span className="text-[11px] font-bold text-white mt-0.5 block capitalize">
                        {selectedTicket.contactMethod}
                      </span>
                    </div>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl font-mono">
                      <span className="text-[8px] font-black uppercase text-zinc-500 block">
                        Created Date
                      </span>
                      <span className="text-[11px] font-bold text-white mt-0.5 block font-mono">
                        {formatDate(selectedTicket.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedTicket.smartContext && (
                  <div className="space-y-3">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                      Technical Smart Context
                    </h5>
                    <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl font-mono text-[9px] text-zinc-500 space-y-1">
                      <div>
                        <span className="font-bold text-zinc-400">Layout module:</span>{' '}
                        {selectedTicket.smartContext.currentModule}
                      </div>
                      <div>
                        <span className="font-bold text-zinc-400">Device configuration:</span>{' '}
                        {selectedTicket.smartContext.deviceInfo}
                      </div>
                      <div>
                        <span className="font-bold text-zinc-400">Browser specs:</span>{' '}
                        {selectedTicket.smartContext.browserInfo}
                      </div>
                      <div>
                        <span className="font-bold text-zinc-400">App version:</span>{' '}
                        {selectedTicket.smartContext.appVersion}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── KNOWLEDGE BASE GUIDE DETAIL DRAWER ────────────────────────────────── */}
      <AnimatePresence>
        {selectedGuide && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGuide(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg h-full bg-[#0a0a0a] border-l border-white/[0.08] shadow-2xl flex flex-col z-10"
            >
              <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" />
                  <h3 className="text-[16px] font-bold text-white uppercase tracking-tight">
                    Help Document
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedGuide(null)}
                  className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h2 className="text-2xl font-bold text-white leading-tight mb-2 uppercase">
                  {selectedGuide.title}
                </h2>
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-[12px] text-orange-400/80 flex gap-3 items-start">
                  <Info className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{selectedGuide.description}</span>
                </div>
                <div className="pt-4 border-t border-white/5 font-mono text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {selectedGuide.content}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREATE SUPPORT TICKET MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!submitting) setIsModalOpen(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/[0.08] rounded-[32px] overflow-hidden shadow-2xl flex flex-col z-10 max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <h3 className="text-[17px] font-bold text-white uppercase tracking-tight">
                    Create Support Ticket
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitTicket} className="flex-1 overflow-y-auto p-6 space-y-6">
                {formError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[12px]">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[12px] font-bold uppercase tracking-wider font-mono">
                    Ticket Submitted! Redirecting...
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block">
                    Inquiry Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Short summary of your support request"
                    className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl px-4 text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block">
                    Department *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {Object.entries(SUPPORT_CATEGORIES).map(([catName, details]) => {
                      const SelectedIcon = details.icon;
                      const active = formCategory === catName;
                      return (
                        <button
                          key={catName}
                          type="button"
                          onClick={() => {
                            setFormCategory(catName);
                            setFormSubcategory(details.subcategories[0]);
                          }}
                          className={`p-3 rounded-2xl border flex flex-col items-center text-center justify-center gap-2 active:scale-95 transition-all ${
                            active
                              ? 'bg-orange-500/10 border-orange-500/40 text-orange-500'
                              : 'bg-white/[0.01] border-white/[0.04] text-zinc-400 hover:text-white'
                          }`}
                        >
                          <SelectedIcon className="h-5 w-5" />
                          <span className="text-[10px] font-bold">{catName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formCategory && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-zinc-400 block">
                      Subcategory *
                    </label>
                    <select
                      value={formSubcategory}
                      onChange={(e) => setFormSubcategory(e.target.value)}
                      className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl px-4 text-[13px] outline-none text-white"
                      style={{ colorScheme: 'dark' }}
                    >
                      {SUPPORT_CATEGORIES[
                        formCategory as keyof typeof SUPPORT_CATEGORIES
                      ]?.subcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-zinc-400 block">
                      Priority *
                    </label>
                    <div className="grid grid-cols-4 border border-[var(--v-divider)] rounded-xl overflow-hidden p-0.5 bg-white/[0.02]">
                      {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormPriority(p)}
                          className={`py-2 text-[10px] font-black uppercase rounded-lg ${formPriority === p ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-zinc-400 block">
                      Contact Method
                    </label>
                    <select
                      value={formContactMethod}
                      onChange={(e) => setFormContactMethod(e.target.value)}
                      className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl px-4 text-[13px] outline-none text-white"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="email">Email Address</option>
                      <option value="phone">Phone Call</option>
                      <option value="whatsapp">WhatsApp Message</option>
                      <option value="sms">SMS text</option>
                      <option value="dashboard">Dashboard Chat</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block">
                    Related Event (Optional)
                  </label>
                  <select
                    value={formRelatedEventId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFormRelatedEventId(id);
                      const ev = events.find((event) => event.id === id);
                      setFormRelatedEvent(ev ? ev.title : '');
                    }}
                    className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl px-4 text-[13px] outline-none text-white"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">None</option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block">
                    Detailed Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Provide full description context..."
                    className="w-full p-4 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block font-mono">
                    Attachment Upload
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative border border-[var(--v-divider)] border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'image')}
                        disabled={uploadingFile}
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <FileImage className="h-5 w-5 text-orange-500" />
                      <span className="text-[11px] font-bold text-white uppercase font-mono">
                        Attach Screenshot
                      </span>
                    </div>
                    <div className="relative border border-[var(--v-divider)] border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(e) => handleFileUpload(e, 'doc')}
                        disabled={uploadingFile}
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <FileText className="h-5 w-5 text-blue-500" />
                      <span className="text-[11px] font-bold text-white uppercase font-mono">
                        Attach Documents
                      </span>
                    </div>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5 font-mono text-[11px] text-zinc-300">
                      {uploadedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 p-2 rounded-xl bg-white/[0.01] border border-white/5"
                        >
                          <div className="flex justify-between">
                            <span>{file.name}</span>
                            <span>{file.progress}%</span>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-orange-500 h-full"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-[12px] font-semibold text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingFile}
                    className="px-6 py-2.5 rounded-xl text-[12px] font-semibold bg-orange-500 hover:brightness-110 text-white flex items-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit Ticket
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREATE FEATURE REQUEST MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {isFeatureModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!submitting) setIsFeatureModalOpen(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-[32px] overflow-hidden shadow-2xl flex flex-col z-10"
            >
              <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white uppercase tracking-tight">
                  Suggest New Feature
                </h3>
                <button
                  onClick={() => setIsFeatureModalOpen(false)}
                  disabled={submitting}
                  className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitFeature} className="p-6 space-y-6">
                {formError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[12px]">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[12px] font-bold uppercase tracking-wider font-mono">
                    Suggestion Registered! Redirecting...
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block font-mono">
                    Feature Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={featureTitle}
                    onChange={(e) => setFeatureTitle(e.target.value)}
                    placeholder="Short title describing your suggestion"
                    className="w-full h-11 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl px-4 text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-zinc-400 block font-mono">
                    Detailed Suggestion Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={featureDescription}
                    onChange={(e) => setFeatureDescription(e.target.value)}
                    placeholder="Describe how this feature will work, who it benefits, and potential workflow improvements..."
                    className="w-full p-4 bg-white/[0.02] border border-[var(--v-divider)] rounded-xl text-[13px] outline-none text-white focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsFeatureModalOpen(false)}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-[12px] font-semibold text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-[12px] font-semibold bg-orange-500 hover:brightness-110 text-white flex items-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit Suggestion
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </VenuePageShell>
  );
}
