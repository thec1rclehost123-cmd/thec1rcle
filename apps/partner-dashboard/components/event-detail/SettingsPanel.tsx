"use client";

import { useState } from "react";
import { X, Copy, Check, Upload, QrCode } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettingsKey =
    | "event-info" | "checkout" | "marketing" | "social"
    | "privacy" | "policies" | "health-safety" | "branding" | "embed";

interface SettingsPanelProps {
    open: boolean;
    settingsKey: SettingsKey | null;
    title: string;
    onClose: () => void;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label
            className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: "var(--v-text-tertiary)" }}
        >
            {children}
        </label>
    );
}

function SectionDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--v-text-tertiary)" }}>
                {label}
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--v-border)" }} />
        </div>
    );
}

function ToggleRow({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-4 py-1">
            <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--v-text-primary)" }}>{label}</p>
                {hint && <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>{hint}</p>}
            </div>
            <Toggle checked={checked} onChange={onChange} size="sm" />
        </div>
    );
}

function StyledInput({
    label, placeholder, value, onChange, type = "text",
}: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
}) {
    return (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <Input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                inputSize="sm"
            />
        </div>
    );
}

function StyledSelect({
    label, value, onChange, options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <Select
                value={value}
                onChange={e => onChange(e.target.value)}
                options={options}
            />
        </div>
    );
}

function StyledTextArea({
    label, placeholder, value, onChange, rows = 4,
}: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (v: string) => void;
    rows?: number;
}) {
    return (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <TextArea
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                rows={rows}
            />
        </div>
    );
}

// ─── Display: Event Info (read-only) ─────────────────────────────────────────

const MOCK_EVENT_INFO = {
    title:       "The Circle Launch",
    startDate:   "Tue, 31 Mar 2026",
    startTime:   "9:00 PM",
    endDate:     "Wed, 1 Apr 2026",
    endTime:     "3:00 AM",
    timezone:    "IST — India Standard Time (UTC+5:30)",
    shortDesc:   "The official launch night for The C1rcle — Pune's newest members-only social club.",
    fullDesc:    "Join us for an unforgettable evening as we open the doors to The C1rcle for the very first time. Expect curated music, bespoke cocktails, and an intimate crowd of culture-forward individuals.\n\nEntry by invite only. RSVP required.",
    venueName:   "Epitome Lounge",
    venueAddress: "Koregaon Park Annexe, Pune, Maharashtra 411001",
};

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--v-text-tertiary)" }}
            >
                {label}
            </span>
            <p className="text-[14px] font-medium leading-relaxed whitespace-pre-line"
                style={{ color: "var(--v-text-primary)" }}>
                {value}
            </p>
        </div>
    );
}

function EventInfoDisplay() {
    const e = MOCK_EVENT_INFO;
    return (
        <div className="flex flex-col gap-6">
            {/* Title */}
            <InfoRow label="Event Title" value={e.title} />

            <SectionDivider label="Date & Time" />
            <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Start" value={`${e.startDate}\n${e.startTime}`} />
                <InfoRow label="End"   value={`${e.endDate}\n${e.endTime}`} />
            </div>
            <InfoRow label="Timezone" value={e.timezone} />

            <SectionDivider label="Description" />
            <InfoRow label="Short Description" value={e.shortDesc} />
            <div className="flex flex-col gap-1">
                <span
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--v-text-tertiary)" }}
                >
                    Full Description
                </span>
                <p
                    className="text-[14px] leading-relaxed whitespace-pre-line"
                    style={{ color: "var(--v-text-primary)" }}
                >
                    {e.fullDesc}
                </p>
            </div>

            <SectionDivider label="Venue" />
            <InfoRow label="Venue Name"    value={e.venueName} />
            <InfoRow label="Street Address" value={e.venueAddress} />

            {/* Info callout */}
            <div
                className="flex items-start gap-3 rounded-xl p-4 text-[13px]"
                style={{ background: "var(--v-info-bg)", border: "1px solid rgba(129,140,248,0.2)" }}
            >
                <span style={{ color: "var(--v-info)" }}>ℹ</span>
                <p style={{ color: "var(--v-text-secondary)" }}>
                    To edit event details, go to the event editor from the main Events list.
                </p>
            </div>
        </div>
    );
}

// ─── Form: Checkout ───────────────────────────────────────────────────────────

function CheckoutForm() {
    const [confirmMsg, setConfirmMsg]       = useState("");
    const [includeFees, setIncludeFees]     = useState(false);
    const [longForm, setLongForm]           = useState(false);
    const [legacyRSVP, setLegacyRSVP]      = useState(false);

    return (
        <div className="flex flex-col gap-5">
            <StyledTextArea
                label="Confirmation Message"
                placeholder="Message shown to attendees after checkout…"
                value={confirmMsg}
                onChange={setConfirmMsg}
                rows={3}
            />

            <SectionDivider label="Options" />
            <ToggleRow label="Include Fees in Price" hint="Fees are folded into the displayed ticket price." checked={includeFees} onChange={setIncludeFees} />
            <ToggleRow label="Long Form Add to Cart" hint="Use an expanded product-page style checkout." checked={longForm} onChange={setLongForm} />
            <ToggleRow label="Legacy RSVP Mode" hint="Disable payments and collect RSVPs only." checked={legacyRSVP} onChange={setLegacyRSVP} />

            <SectionDivider label="Custom Checkout Fields" />
            <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                Custom fields let you collect extra information at checkout (e.g. dietary preferences, T-shirt size).
            </p>
            <Button variant="secondary" size="sm" fullWidth>
                + Add Custom Field
            </Button>

            <SectionDivider label="Event Fees" />
            <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                Add flat or percentage-based fees that apply to all ticket types.
            </p>
            <Button variant="secondary" size="sm" fullWidth>
                + Add Fee
            </Button>
        </div>
    );
}

// ─── Form: Marketing ──────────────────────────────────────────────────────────

function MarketingForm() {
    const [fbPixel, setFbPixel]       = useState("");
    const [ttPixel, setTtPixel]       = useState("");
    const [gaId, setGaId]             = useState("");
    const [copied, setCopied]         = useState(false);

    const eventUrl = "https://thec1rcle.com/e/the-circle-launch";

    function copyLink() {
        navigator.clipboard.writeText(eventUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="flex flex-col gap-5">
            <SectionDivider label="Pixel IDs" />
            <StyledInput label="Facebook Pixel ID" placeholder="123456789012345" value={fbPixel} onChange={setFbPixel} />
            <StyledInput label="TikTok Pixel ID" placeholder="C1ABC2DEF3GHI" value={ttPixel} onChange={setTtPixel} />
            <StyledInput label="Google Analytics ID" placeholder="G-XXXXXXXXXX" value={gaId} onChange={setGaId} />

            <SectionDivider label="QR Code" />
            <div
                className="flex flex-col items-center gap-4 p-6 rounded-xl"
                style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
            >
                <div
                    className="w-32 h-32 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--v-card)" }}
                >
                    <QrCode size={64} style={{ color: "var(--v-text-tertiary)" }} />
                </div>
                <p className="text-[12px] text-center" style={{ color: "var(--v-text-tertiary)" }}>
                    QR code for your event page
                </p>
                <div className="flex gap-2 w-full">
                    <Button variant="secondary" size="sm" fullWidth onClick={copyLink}
                        icon={copied ? <Check size={13} /> : <Copy size={13} />}>
                        {copied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button variant="primary" size="sm" fullWidth>
                        Download QR
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Form: Social Features ────────────────────────────────────────────────────

function SocialFeaturesForm() {
    const [disableGuestlist, setDisableGuestlist] = useState(false);
    const [hideCount, setHideCount]               = useState(false);
    const [publicGuestlist, setPublicGuestlist]   = useState(true);
    const [threshold, setThreshold]               = useState("10");

    return (
        <div className="flex flex-col gap-5">
            <ToggleRow
                label="Disable Guestlist"
                hint="Hides the guestlist feature entirely from the event page."
                checked={disableGuestlist}
                onChange={setDisableGuestlist}
            />
            <ToggleRow
                label="Hide Number Attending"
                hint="Hides the attendee count from public view."
                checked={hideCount}
                onChange={setHideCount}
            />
            <ToggleRow
                label="Public Guestlist"
                hint="Allow anyone to see who's attending this event."
                checked={publicGuestlist}
                onChange={setPublicGuestlist}
            />

            <SectionDivider label="Display Threshold" />
            <div>
                <FieldLabel>Minimum attendees before guestlist is shown</FieldLabel>
                <Input
                    type="number"
                    placeholder="10"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    inputSize="sm"
                    min="0"
                />
                <p className="mt-1.5 text-[12px]" style={{ color: "var(--v-text-tertiary)" }}>
                    Guestlist will only display once this many people have joined.
                </p>
            </div>
        </div>
    );
}

// ─── Form: Privacy ────────────────────────────────────────────────────────────

function PrivacyForm() {
    const [passwordProtected, setPasswordProtected] = useState(false);
    const [password, setPassword]                   = useState("");

    return (
        <div className="flex flex-col gap-5">
            <ToggleRow
                label="Password Protected"
                hint="Visitors must enter a password before viewing this event page."
                checked={passwordProtected}
                onChange={setPasswordProtected}
            />

            {passwordProtected && (
                <div
                    className="rounded-xl p-4 flex flex-col gap-3"
                    style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
                >
                    <StyledInput
                        label="Event Password"
                        placeholder="Enter a password…"
                        value={password}
                        onChange={setPassword}
                        type="password"
                    />
                    <p className="text-[12px]" style={{ color: "var(--v-text-tertiary)" }}>
                        Share this password only with invited guests.
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Form: Policies ───────────────────────────────────────────────────────────

function PoliciesForm() {
    const [tos, setTos]       = useState("");
    const [refund, setRefund] = useState("");

    return (
        <div className="flex flex-col gap-5">
            <StyledTextArea
                label="Terms of Service"
                placeholder="Enter your event Terms of Service…"
                value={tos}
                onChange={setTos}
                rows={6}
            />
            <StyledTextArea
                label="Refund Policy"
                placeholder="Describe your refund or cancellation policy…"
                value={refund}
                onChange={setRefund}
                rows={5}
            />
        </div>
    );
}

// ─── Form: Health & Safety ────────────────────────────────────────────────────

function HealthSafetyForm() {
    const [vaccinationReq, setVaccinationReq]   = useState(false);
    const [maskReq, setMaskReq]                 = useState(false);
    const [covidTest, setCovidTest]             = useState(false);
    const [ageVerification, setAgeVerification] = useState(false);
    const [protocols, setProtocols]             = useState("");

    return (
        <div className="flex flex-col gap-5">
            <SectionDivider label="Entry Requirements" />
            <ToggleRow label="Vaccination Required" hint="Guests must show proof of vaccination." checked={vaccinationReq} onChange={setVaccinationReq} />
            <ToggleRow label="Mask Required" hint="Guests must wear a mask at this event." checked={maskReq} onChange={setMaskReq} />
            <ToggleRow label="Negative COVID Test" hint="Guests must present a recent negative test." checked={covidTest} onChange={setCovidTest} />
            <ToggleRow label="Age Verification Required" hint="Guests must present valid ID at the door." checked={ageVerification} onChange={setAgeVerification} />

            <SectionDivider label="Safety Protocols" />
            <StyledTextArea
                label="Additional Safety Notes"
                placeholder="Describe any additional health or safety protocols for this event…"
                value={protocols}
                onChange={setProtocols}
                rows={4}
            />
        </div>
    );
}

// ─── Form: Branding ───────────────────────────────────────────────────────────

function BrandingForm() {
    const [orgName, setOrgName]     = useState("Epitome");
    const [logoFile, setLogoFile]   = useState<File | null>(null);

    return (
        <div className="flex flex-col gap-5">
            <StyledInput
                label="Organisation Display Name"
                placeholder="e.g. Epitome Lounge"
                value={orgName}
                onChange={setOrgName}
            />

            <SectionDivider label="Logo" />
            <div
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
                style={{ borderColor: "var(--v-border)", background: "var(--v-elevated)" }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) setLogoFile(file);
                }}
            >
                {logoFile ? (
                    <>
                        <img
                            src={URL.createObjectURL(logoFile)}
                            alt="Logo preview"
                            className="w-24 h-24 object-contain rounded-xl"
                            style={{ background: "var(--v-card)" }}
                        />
                        <p className="text-[13px] font-medium" style={{ color: "var(--v-text-primary)" }}>
                            {logoFile.name}
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => setLogoFile(null)}>
                            Remove
                        </Button>
                    </>
                ) : (
                    <>
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ background: "var(--v-card)" }}
                        >
                            <Upload size={20} style={{ color: "var(--v-text-tertiary)" }} />
                        </div>
                        <div className="text-center">
                            <p className="text-[13px] font-medium" style={{ color: "var(--v-text-primary)" }}>
                                Drop your logo here
                            </p>
                            <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                                PNG, JPG or SVG — max 2 MB
                            </p>
                        </div>
                        <label
                            className="cursor-pointer inline-flex items-center justify-center px-3.5 py-2 rounded-lg text-[13px] font-semibold border transition-all duration-150"
                            style={{
                                background: "transparent",
                                border: "1px solid var(--v-border)",
                                color: "var(--v-text-primary)",
                            }}
                        >
                            Browse File
                            <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) setLogoFile(file);
                                }}
                            />
                        </label>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Form: Embed ──────────────────────────────────────────────────────────────

function EmbedForm() {
    const [copied, setCopied] = useState(false);
    const snippet = `<iframe
  src="https://thec1rcle.com/embed/the-circle-launch"
  width="100%"
  height="700"
  frameborder="0"
  allow="payment"
  title="The Circle Launch — Checkout"
></iframe>`;

    function copySnippet() {
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="flex flex-col gap-5">
            <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                Embed the checkout for this event on any external website by pasting the snippet below.
            </p>

            <div>
                <FieldLabel>Embed Code</FieldLabel>
                <div className="relative">
                    <pre
                        className="w-full rounded-xl p-4 text-[12px] leading-relaxed overflow-x-auto"
                        style={{
                            background: "var(--v-elevated)",
                            border: "1px solid var(--v-border)",
                            color: "#A5F3FC",
                            fontFamily: "var(--font-mono, 'SF Mono', 'Fira Code', monospace)",
                        }}
                    >
                        {snippet}
                    </pre>
                    <button
                        onClick={copySnippet}
                        className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                            background: copied ? "rgba(52,211,153,0.15)" : "var(--v-card)",
                            color: copied ? "#34D399" : "var(--v-text-secondary)",
                            border: "1px solid var(--v-border)",
                        }}
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? "Copied!" : "Copy"}
                    </button>
                </div>
            </div>

            <SectionDivider label="Preview" />
            <div
                className="rounded-xl p-6 text-center"
                style={{ background: "var(--v-elevated)", border: "1px dashed var(--v-border)" }}
            >
                <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                    Embed preview will render here in a live environment.
                </p>
            </div>
        </div>
    );
}

// ─── Form dispatcher ──────────────────────────────────────────────────────────

const FORM_MAP: Record<SettingsKey, React.ReactNode> = {
    "event-info":    <EventInfoDisplay />,
    "checkout":      <CheckoutForm />,
    "marketing":     <MarketingForm />,
    "social":        <SocialFeaturesForm />,
    "privacy":       <PrivacyForm />,
    "policies":      <PoliciesForm />,
    "health-safety": <HealthSafetyForm />,
    "branding":      <BrandingForm />,
    "embed":         <EmbedForm />,
};

// ─── Slide-over Panel ─────────────────────────────────────────────────────────

export default function SettingsPanel({ open, settingsKey, title, onClose }: SettingsPanelProps) {
    if (!open || !settingsKey) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-[480px]"
                style={{
                    background: "var(--v-card)",
                    borderLeft: "1px solid var(--v-border)",
                    boxShadow: "-24px 0 64px rgba(0,0,0,0.5)",
                }}
            >
                {/* Panel header */}
                <div
                    className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: "1px solid var(--v-border)" }}
                >
                    <div>
                        <p className="text-[16px] font-bold" style={{ color: "var(--v-text-primary)" }}>
                            {title}
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                            The Circle Launch
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                        style={{ color: "var(--v-text-tertiary)" }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = "var(--v-elevated)";
                            (e.currentTarget as HTMLElement).style.color = "var(--v-text-primary)";
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "var(--v-text-tertiary)";
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Scrollable form body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {FORM_MAP[settingsKey]}
                </div>

                {/* Sticky footer */}
                <div
                    className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
                    style={{ borderTop: "1px solid var(--v-border)", background: "var(--v-card)" }}
                >
                    {settingsKey === "event-info" ? (
                        <Button variant="secondary" size="sm" onClick={onClose}>
                            Close
                        </Button>
                    ) : (
                        <>
                            <Button variant="ghost" size="sm" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button variant="primary" size="sm" onClick={onClose}>
                                Save Changes
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
