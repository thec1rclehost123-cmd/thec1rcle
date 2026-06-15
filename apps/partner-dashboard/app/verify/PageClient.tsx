'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  RefreshCcw,
  ChevronLeft,
  ShieldCheck,
  Building2,
  User,
  Landmark,
  FileText,
  ArrowRight,
  Upload,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { getFirebaseAuth, getFirebaseStorage } from '@/lib/firebase/client';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_resubmission';

interface KycState {
  entityType: string;
  kycStatus: string;
  stepSequence: string[];
  kycStepStatus: Record<string, StepStatus>;
  kycStepData: Record<string, Record<string, unknown>>;
  kycAdminNotes: Record<string, string>;
  resubmissionReasons: Record<string, string>;
}

// ── Step meta ─────────────────────────────────────────────────────────────────

const STEP_META: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  kyc_identity: {
    label: 'Identity Verification',
    icon: User,
    description: 'Government-issued ID and a selfie to confirm your identity.',
  },
  kyc_business: {
    label: 'Business Documents',
    icon: Building2,
    description: 'PAN, CIN/GST, and registration certificate for your business.',
  },
  kyc_signatory: {
    label: 'Authorized Representative',
    icon: ShieldCheck,
    description: 'Identity verification for the person representing the business.',
  },
  bank_setup: {
    label: 'Bank Account',
    icon: Landmark,
    description: 'Bank account details for receiving payouts.',
  },
};

// ── Status display ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StepStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_resubmission: 'Action required',
};

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'approved') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === 'needs_resubmission' || status === 'rejected')
    return <AlertCircle className="h-5 w-5 text-red-400" />;
  if (status === 'submitted' || status === 'under_review')
    return <Clock className="h-5 w-5 text-indigo-400" />;
  if (status === 'in_progress')
    return <RefreshCcw className="h-5 w-5 text-blue-400 animate-spin" />;
  return <Circle className="h-5 w-5 text-text-tertiary" />;
}

function stepStatusColor(status: StepStatus): string {
  if (status === 'approved') return 'text-emerald-500';
  if (status === 'needs_resubmission') return 'text-red-400';
  if (status === 'submitted' || status === 'under_review') return 'text-indigo-400';
  if (status === 'in_progress') return 'text-blue-400';
  return 'text-text-tertiary';
}

// ── File upload helper ────────────────────────────────────────────────────────

async function uploadFile(
  uid: string,
  stepId: string,
  fieldName: string,
  file: File,
): Promise<string> {
  const storage = getFirebaseStorage();
  const ext = file.name.split('.').pop();
  const path = `kyc-documents/${uid}/${stepId}/${fieldName}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed', undefined, reject, resolve);
  });

  return getDownloadURL(storageRef);
}

// ── File drop zone ────────────────────────────────────────────────────────────

function FileZone({
  label,
  fieldName,
  value,
  onChange,
  uid,
  stepId,
}: {
  label: string;
  fieldName: string;
  value: string | null;
  onChange: (url: string | null) => void;
  uid: string;
  stepId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const storage = getFirebaseStorage();
      const ext = file.name.split('.').pop();
      const path = `kyc-documents/${uid}/${stepId}/${fieldName}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap: any) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        );
      });
      const url = await getDownloadURL(storageRef);
      onChange(url);
    } catch (e) {
      console.error('Upload error:', e);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
        {label}
      </label>
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          <span className="text-[12px] text-emerald-400 font-medium truncate flex-1">Uploaded</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 rounded-lg hover:bg-red-500/20 text-text-tertiary hover:text-red-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : uploading ? (
        <div className="p-4 rounded-xl border border-border-subtle bg-surface-secondary">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
            <span className="text-[12px] text-text-tertiary">Uploading... {progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-tertiary overflow-hidden">
            <div
              className="h-full bg-[#FF5A00] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full p-5 rounded-xl border-2 border-dashed border-border-subtle hover:border-[#FF5A00]/40 bg-surface-secondary hover:bg-surface-tertiary transition-all text-center group"
        >
          <Upload className="h-5 w-5 text-text-tertiary group-hover:text-[#FF5A00] mx-auto mb-1.5 transition-colors" />
          <p className="text-[11px] text-text-tertiary group-hover:text-text-secondary transition-colors">
            Click to upload · JPG, PNG or PDF · Max 5MB
          </p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}

// ── Form components ───────────────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full h-12 px-4 rounded-xl bg-surface-secondary border border-border-subtle text-text-primary text-[14px] placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30 focus:border-[#FF5A00]/50 transition-all disabled:opacity-50 read-only:opacity-60 read-only:cursor-not-allowed"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-4 rounded-xl bg-surface-secondary border border-border-subtle text-text-primary text-[14px] focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/30 focus:border-[#FF5A00]/50 transition-all appearance-none"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Step forms ────────────────────────────────────────────────────────────────

function KycIdentityForm({
  uid,
  initialData,
  onSubmit,
  submitting,
  resubmitReason,
}: {
  uid: string;
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  resubmitReason?: string;
}) {
  const [idType, setIdType] = useState((initialData.idType as string) || '');
  const [idNumber, setIdNumber] = useState((initialData.idNumber as string) || '');
  const [docFront, setDocFront] = useState<string | null>(
    (initialData.docFrontUrl as string) || null,
  );
  const [docBack, setDocBack] = useState<string | null>((initialData.docBackUrl as string) || null);
  const [selfie, setSelfie] = useState<string | null>((initialData.selfieUrl as string) || null);

  const needsBack = ['aadhaar', 'driving_licence', 'voter_id'].includes(idType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idType || !idNumber || !docFront || !selfie) return;
    if (needsBack && !docBack) return;
    onSubmit({ idType, idNumber, docFrontUrl: docFront, docBackUrl: docBack, selfieUrl: selfie });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {resubmitReason && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-[11px] font-black uppercase tracking-widest text-red-400 mb-1">
            Resubmission required
          </p>
          <p className="text-[13px] text-text-secondary">{resubmitReason}</p>
        </div>
      )}

      <SelectField
        label="ID Type"
        value={idType}
        onChange={setIdType}
        options={[
          { value: 'aadhaar', label: 'Aadhaar Card' },
          { value: 'passport', label: 'Passport' },
          { value: 'driving_licence', label: 'Driving Licence' },
          { value: 'voter_id', label: 'Voter ID' },
        ]}
      />

      <InputField
        label="ID Number"
        value={idNumber}
        onChange={setIdNumber}
        placeholder="Enter your ID number"
      />

      <div className={`grid gap-4 ${needsBack ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        <FileZone
          label="Document Front"
          fieldName="doc_front"
          value={docFront}
          onChange={setDocFront}
          uid={uid}
          stepId="kyc_identity"
        />
        {needsBack && (
          <FileZone
            label="Document Back"
            fieldName="doc_back"
            value={docBack}
            onChange={setDocBack}
            uid={uid}
            stepId="kyc_identity"
          />
        )}
      </div>

      <FileZone
        label="Selfie Photo"
        fieldName="selfie"
        value={selfie}
        onChange={setSelfie}
        uid={uid}
        stepId="kyc_identity"
      />

      <button
        type="submit"
        disabled={
          submitting || !idType || !idNumber || !docFront || !selfie || (needsBack && !docBack)
        }
        className="w-full h-12 rounded-xl bg-[#FF5A00] text-white font-black uppercase tracking-widest text-[11px] hover:bg-[#e04e00] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {submitting ? 'Submitting…' : 'Submit for Review'}
      </button>
    </form>
  );
}

function KycBusinessForm({
  uid,
  initialData,
  onSubmit,
  submitting,
  resubmitReason,
}: {
  uid: string;
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  resubmitReason?: string;
}) {
  const [legalName, setLegalName] = useState((initialData.legalName as string) || '');
  const [businessType, setBusinessType] = useState((initialData.businessType as string) || '');
  const [pan, setPan] = useState((initialData.pan as string) || '');
  const [cin, setCin] = useState((initialData.cin as string) || '');
  const [gst, setGst] = useState((initialData.gst as string) || '');
  const [address, setAddress] = useState((initialData.address as string) || '');
  const [regDoc, setRegDoc] = useState<string | null>((initialData.regDocUrl as string) || null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName || !businessType || !pan || !cin || !address || !regDoc) return;
    onSubmit({ legalName, businessType, pan, cin, gst, address, regDocUrl: regDoc });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {resubmitReason && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-[11px] font-black uppercase tracking-widest text-red-400 mb-1">
            Resubmission required
          </p>
          <p className="text-[13px] text-text-secondary">{resubmitReason}</p>
        </div>
      )}

      <InputField
        label="Legal Business Name"
        value={legalName}
        onChange={setLegalName}
        placeholder="As on registration certificate"
      />

      <SelectField
        label="Business Type"
        value={businessType}
        onChange={setBusinessType}
        options={[
          { value: 'private_limited', label: 'Private Limited Company' },
          { value: 'llp', label: 'Limited Liability Partnership' },
          { value: 'partnership', label: 'Partnership Firm' },
          { value: 'proprietorship', label: 'Sole Proprietorship' },
          { value: 'trust', label: 'Trust / Society' },
        ]}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <InputField label="Business PAN" value={pan} onChange={setPan} placeholder="AAACB1234C" />
        <InputField
          label="CIN / Registration Number"
          value={cin}
          onChange={setCin}
          placeholder="U74999MH2021PTC..."
        />
      </div>

      <InputField
        label="GST Number (optional)"
        value={gst}
        onChange={setGst}
        placeholder="27AAACB1234C1Z5"
      />
      <InputField
        label="Registered Address"
        value={address}
        onChange={setAddress}
        placeholder="Full address as on documents"
      />

      <FileZone
        label="Registration Certificate"
        fieldName="reg_doc"
        value={regDoc}
        onChange={setRegDoc}
        uid={uid}
        stepId="kyc_business"
      />

      <button
        type="submit"
        disabled={submitting || !legalName || !businessType || !pan || !cin || !address || !regDoc}
        className="w-full h-12 rounded-xl bg-[#FF5A00] text-white font-black uppercase tracking-widest text-[11px] hover:bg-[#e04e00] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {submitting ? 'Submitting…' : 'Submit for Review'}
      </button>
    </form>
  );
}

function KycSignatoryForm({
  uid,
  initialData,
  onSubmit,
  submitting,
  resubmitReason,
}: {
  uid: string;
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  resubmitReason?: string;
}) {
  const [fullName, setFullName] = useState((initialData.fullName as string) || '');
  const [designation, setDesignation] = useState((initialData.designation as string) || '');
  const [email, setEmail] = useState((initialData.email as string) || '');
  const [phone, setPhone] = useState((initialData.phone as string) || '');
  const [idType, setIdType] = useState((initialData.idType as string) || '');
  const [idNumber, setIdNumber] = useState((initialData.idNumber as string) || '');
  const [docFront, setDocFront] = useState<string | null>(
    (initialData.docFrontUrl as string) || null,
  );
  const [docBack, setDocBack] = useState<string | null>((initialData.docBackUrl as string) || null);
  const [selfie, setSelfie] = useState<string | null>((initialData.selfieUrl as string) || null);
  const [declared, setDeclared] = useState(false);

  const needsBack = ['aadhaar', 'driving_licence', 'voter_id'].includes(idType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !fullName ||
      !designation ||
      !email ||
      !idType ||
      !idNumber ||
      !docFront ||
      !selfie ||
      !declared
    )
      return;
    if (needsBack && !docBack) return;
    onSubmit({
      fullName,
      designation,
      email,
      phone,
      idType,
      idNumber,
      docFrontUrl: docFront,
      docBackUrl: docBack,
      selfieUrl: selfie,
      declared,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {resubmitReason && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-[11px] font-black uppercase tracking-widest text-red-400 mb-1">
            Resubmission required
          </p>
          <p className="text-[13px] text-text-secondary">{resubmitReason}</p>
        </div>
      )}

      <div className="p-4 rounded-xl bg-surface-secondary border border-border-subtle">
        <p className="text-[12px] text-text-tertiary leading-relaxed">
          Provide identity details for the person who is authorized to represent this business on
          C1RCLE.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <InputField
          label="Full Legal Name"
          value={fullName}
          onChange={setFullName}
          placeholder="As on government ID"
        />
        <SelectField
          label="Designation"
          value={designation}
          onChange={setDesignation}
          options={[
            { value: 'director', label: 'Director' },
            { value: 'partner', label: 'Partner' },
            { value: 'proprietor', label: 'Proprietor' },
            { value: 'authorized_signatory', label: 'Authorized Signatory' },
          ]}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <InputField
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="representative@company.com"
        />
        <InputField label="Phone" value={phone} onChange={setPhone} placeholder="+91 9876543210" />
      </div>

      <SelectField
        label="ID Type"
        value={idType}
        onChange={setIdType}
        options={[
          { value: 'aadhaar', label: 'Aadhaar Card' },
          { value: 'passport', label: 'Passport' },
          { value: 'driving_licence', label: 'Driving Licence' },
          { value: 'voter_id', label: 'Voter ID' },
        ]}
      />

      <InputField
        label="ID Number"
        value={idNumber}
        onChange={setIdNumber}
        placeholder="Enter ID number"
      />

      <div className={`grid gap-4 ${needsBack ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        <FileZone
          label="Document Front"
          fieldName="sig_doc_front"
          value={docFront}
          onChange={setDocFront}
          uid={uid}
          stepId="kyc_signatory"
        />
        {needsBack && (
          <FileZone
            label="Document Back"
            fieldName="sig_doc_back"
            value={docBack}
            onChange={setDocBack}
            uid={uid}
            stepId="kyc_signatory"
          />
        )}
      </div>

      <FileZone
        label="Selfie Photo"
        fieldName="sig_selfie"
        value={selfie}
        onChange={setSelfie}
        uid={uid}
        stepId="kyc_signatory"
      />

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={declared}
          onChange={(e) => setDeclared(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border-subtle accent-[#FF5A00]"
        />
        <span className="text-[12px] text-text-secondary leading-relaxed">
          I confirm that I am authorized to represent this business and the information provided is
          accurate.
        </span>
      </label>

      <button
        type="submit"
        disabled={
          submitting ||
          !fullName ||
          !designation ||
          !email ||
          !idType ||
          !idNumber ||
          !docFront ||
          !selfie ||
          !declared ||
          (needsBack && !docBack)
        }
        className="w-full h-12 rounded-xl bg-[#FF5A00] text-white font-black uppercase tracking-widest text-[11px] hover:bg-[#e04e00] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {submitting ? 'Submitting…' : 'Submit for Review'}
      </button>
    </form>
  );
}

function BankSetupForm({
  uid,
  initialData,
  onSubmit,
  submitting,
  resubmitReason,
}: {
  uid: string;
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  resubmitReason?: string;
}) {
  const [accountHolder, setAccountHolder] = useState((initialData.accountHolder as string) || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmNumber, setConfirmNumber] = useState('');
  const [ifsc, setIfsc] = useState((initialData.ifsc as string) || '');
  const [bankName, setBankName] = useState((initialData.bankName as string) || '');
  const [branch, setBranch] = useState((initialData.branch as string) || '');
  const [accountType, setAccountType] = useState((initialData.accountType as string) || '');
  const [chequeDoc, setChequeDoc] = useState<string | null>(
    (initialData.chequeDocUrl as string) || null,
  );

  // IFSC auto-lookup
  const lookupIfsc = useCallback(async () => {
    if (ifsc.length !== 11) return;
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setBankName(data.BANK || '');
        setBranch(data.BRANCH || '');
      }
    } catch {
      // silent fail — user can type manually
    }
  }, [ifsc]);

  useEffect(() => {
    if (ifsc.length === 11) lookupIfsc();
  }, [ifsc, lookupIfsc]);

  const numbersMismatch = confirmNumber.length > 0 && accountNumber !== confirmNumber;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !accountHolder ||
      !accountNumber ||
      accountNumber !== confirmNumber ||
      !ifsc ||
      !accountType ||
      !chequeDoc
    )
      return;
    // Only last-4 sent in plaintext; full number should be encrypted server-side
    onSubmit({
      accountHolder,
      accountNumberLast4: accountNumber.slice(-4),
      accountNumberMasked: '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4),
      ifsc: ifsc.toUpperCase(),
      bankName,
      branch,
      accountType,
      chequeDocUrl: chequeDoc,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {resubmitReason && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-[11px] font-black uppercase tracking-widest text-red-400 mb-1">
            Resubmission required
          </p>
          <p className="text-[13px] text-text-secondary">{resubmitReason}</p>
        </div>
      )}

      <InputField
        label="Account Holder Name"
        value={accountHolder}
        onChange={setAccountHolder}
        placeholder="Exactly as on passbook"
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <InputField
          label="Account Number"
          value={accountNumber}
          onChange={setAccountNumber}
          type="password"
          placeholder="Enter account number"
        />
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
            Confirm Account Number
          </label>
          <input
            type="text"
            value={confirmNumber}
            onChange={(e) => setConfirmNumber(e.target.value)}
            placeholder="Re-enter account number"
            className={`w-full h-12 px-4 rounded-xl bg-surface-secondary border text-text-primary text-[14px] placeholder:text-text-tertiary focus:outline-none focus:ring-2 transition-all ${numbersMismatch ? 'border-red-500/50 focus:ring-red-500/20' : 'border-border-subtle focus:ring-[#FF5A00]/30 focus:border-[#FF5A00]/50'}`}
          />
          {numbersMismatch && (
            <p className="text-[11px] text-red-400">Account numbers don't match</p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <InputField label="IFSC Code" value={ifsc} onChange={setIfsc} placeholder="SBIN0001234" />
        <SelectField
          label="Account Type"
          value={accountType}
          onChange={setAccountType}
          options={[
            { value: 'savings', label: 'Savings' },
            { value: 'current', label: 'Current' },
          ]}
        />
      </div>

      {bankName && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-[12px] text-emerald-400 font-medium">
            {bankName} — {branch}
          </span>
        </div>
      )}

      <FileZone
        label="Cancelled Cheque or Passbook Front"
        fieldName="cheque_doc"
        value={chequeDoc}
        onChange={setChequeDoc}
        uid={uid}
        stepId="bank_setup"
      />

      <button
        type="submit"
        disabled={
          submitting ||
          !accountHolder ||
          !accountNumber ||
          accountNumber !== confirmNumber ||
          !ifsc ||
          !accountType ||
          !chequeDoc
        }
        className="w-full h-12 rounded-xl bg-[#FF5A00] text-white font-black uppercase tracking-widest text-[11px] hover:bg-[#e04e00] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {submitting ? 'Submitting…' : 'Submit Bank Details'}
      </button>
    </form>
  );
}

// ── Celebration screen ────────────────────────────────────────────────────────

function CelebrationScreen({ entityType }: { entityType: string }) {
  const router = useRouter();
  const dashPath =
    entityType === 'venue' ? '/venue' : entityType === 'promoter' ? '/promoter' : '/host';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
        className="w-24 h-24 rounded-[2rem] bg-emerald-500/15 flex items-center justify-center mb-8"
      >
        <Sparkles className="h-12 w-12 text-emerald-400" />
      </motion.div>
      <h1 className="text-4xl font-black text-text-primary tracking-tight mb-4">
        You're fully verified
      </h1>
      <p className="text-text-tertiary text-base leading-relaxed max-w-sm mb-10">
        Welcome to C1RCLE. All features are now unlocked — start creating events, managing your
        audience, and tracking your finances.
      </p>
      <button
        onClick={() => router.push(dashPath)}
        className="h-14 px-10 rounded-2xl bg-[#FF5A00] text-white font-black uppercase tracking-widest text-[11px] hover:bg-[#e04e00] transition-all"
      >
        Go to Dashboard
      </button>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function VerifyPageClient() {
  const {
    user,
    isApproved,
    loading: authLoading,
    entityType: ctxEntityType,
    kycStatus: ctxKycStatus,
  } = useDashboardAuth();
  const router = useRouter();

  const [kycState, setKycState] = useState<KycState | null>(null);
  const [loadingKyc, setLoadingKyc] = useState(true);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || !isApproved)) {
      router.replace('/login');
    }
  }, [authLoading, user, isApproved, router]);

  // ── Fetch KYC state ─────────────────────────────────────────────────────
  const fetchKycState = useCallback(async () => {
    if (!user) return;
    setLoadingKyc(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/kyc', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load verification state.');
      const data = await res.json();
      setKycState(data);
      // Auto-select first actionable step
      if (!activeStep && data.stepSequence) {
        const firstActionable = data.stepSequence.find((s: string) => {
          const st = data.kycStepStatus[s] || 'not_started';
          return st !== 'approved' && st !== 'submitted' && st !== 'under_review';
        });
        setActiveStep(firstActionable ?? data.stepSequence[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingKyc(false);
    }
  }, [user, activeStep]);

  useEffect(() => {
    if (user && isApproved) fetchKycState();
  }, [user, isApproved]);

  // ── Submit a KYC step ───────────────────────────────────────────────────
  const handleStepSubmit = async (stepId: string, data: Record<string, unknown>) => {
    if (!user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/kyc', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed.');
      // Refresh state
      await fetchKycState();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading states ──────────────────────────────────────────────────────
  if (authLoading || loadingKyc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-elevated">
        <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!kycState) return null;

  const { stepSequence, kycStepStatus, kycStepData, resubmissionReasons } = kycState;
  const approvedCount = stepSequence.filter((s) => kycStepStatus[s] === 'approved').length;
  const progressPct = Math.round((approvedCount / stepSequence.length) * 100);

  // Celebration
  if (kycState.kycStatus === 'fully_verified') {
    return (
      <div className="min-h-screen bg-[var(--v-canvas)]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <CelebrationScreen entityType={kycState.entityType} />
        </div>
      </div>
    );
  }

  const entityTypeName = kycState.entityType === 'business' ? 'Business' : 'Individual';

  return (
    <div className="min-h-screen bg-[var(--v-canvas)]">
      {/* Top nav */}
      <div className="sticky top-0 z-30 bg-surface-base/90 backdrop-blur-xl border-b border-border-subtle">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[12px] font-bold text-text-tertiary hover:text-text-primary transition-colors uppercase tracking-widest"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#FF5A00] flex items-center justify-center text-white text-[11px] font-black">
              C
            </span>
            <span className="text-[13px] font-black text-text-primary tracking-wide">
              Verification Hub
            </span>
          </div>
          <div className="w-16 text-right">
            <span className="text-[11px] font-black text-text-tertiary uppercase tracking-widest">
              {entityTypeName}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-text-primary tracking-tight">
            Complete your verification
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            {approvedCount} of {stepSequence.length} steps approved
          </p>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
            <motion.div
              className="h-full bg-[#FF5A00] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {submitError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-red-400">{submitError}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Step list */}
          <div className="space-y-2">
            {stepSequence.map((stepId, idx) => {
              const status = kycStepStatus[stepId] || 'not_started';
              const meta = STEP_META[stepId];
              const Icon = meta?.icon ?? FileText;
              const isActive = activeStep === stepId;
              const isLocked = false; // All steps always navigable

              return (
                <button
                  key={stepId}
                  onClick={() => setActiveStep(stepId)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all ${
                    isActive
                      ? 'bg-surface-secondary border border-border-subtle shadow-sm'
                      : 'hover:bg-surface-secondary/60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#FF5A00]/15' : 'bg-surface-tertiary'}`}
                  >
                    <Icon
                      className={`h-4 w-4 ${isActive ? 'text-[#FF5A00]' : 'text-text-tertiary'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[13px] font-bold truncate ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}
                    >
                      {meta?.label ?? stepId}
                    </p>
                    <p className={`text-[11px] truncate ${stepStatusColor(status)}`}>
                      {STATUS_LABEL[status]}
                    </p>
                  </div>
                  <StepStatusIcon status={status} />
                </button>
              );
            })}
          </div>

          {/* Active step form */}
          <AnimatePresence mode="wait">
            {activeStep && (
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-surface-secondary rounded-2xl border border-border-subtle p-6"
              >
                {/* Step header */}
                {(() => {
                  const meta = STEP_META[activeStep];
                  const Icon = meta?.icon ?? FileText;
                  const status = kycStepStatus[activeStep] || 'not_started';
                  return (
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-[#FF5A00]/15 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-[#FF5A00]" />
                        </div>
                        <div>
                          <h2 className="text-[16px] font-black text-text-primary">
                            {meta?.label}
                          </h2>
                          <p className={`text-[11px] font-bold ${stepStatusColor(status)}`}>
                            {STATUS_LABEL[status]}
                          </p>
                        </div>
                      </div>
                      <p className="text-[13px] text-text-tertiary leading-relaxed">
                        {meta?.description}
                      </p>
                    </div>
                  );
                })()}

                {/* Approved state */}
                {kycStepStatus[activeStep] === 'approved' && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
                    <p className="text-[16px] font-black text-text-primary mb-1">Step approved</p>
                    <p className="text-[13px] text-text-tertiary">
                      This step has been reviewed and approved.
                    </p>
                  </div>
                )}

                {/* Under review state */}
                {(kycStepStatus[activeStep] === 'submitted' ||
                  kycStepStatus[activeStep] === 'under_review') && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-12 w-12 text-indigo-400 mb-4" />
                    <p className="text-[16px] font-black text-text-primary mb-1">Under review</p>
                    <p className="text-[13px] text-text-tertiary">
                      We're reviewing your submission. You'll be notified of any updates.
                    </p>
                  </div>
                )}

                {/* Actionable states: not_started, in_progress, needs_resubmission */}
                {(!kycStepStatus[activeStep] ||
                  ['not_started', 'in_progress', 'needs_resubmission'].includes(
                    kycStepStatus[activeStep],
                  )) && (
                  <>
                    {activeStep === 'kyc_identity' && (
                      <KycIdentityForm
                        uid={user?.uid ?? ''}
                        initialData={(kycStepData[activeStep] as Record<string, unknown>) || {}}
                        onSubmit={(data) => handleStepSubmit(activeStep, data)}
                        submitting={submitting}
                        resubmitReason={resubmissionReasons[activeStep]}
                      />
                    )}
                    {activeStep === 'kyc_business' && (
                      <KycBusinessForm
                        uid={user?.uid ?? ''}
                        initialData={(kycStepData[activeStep] as Record<string, unknown>) || {}}
                        onSubmit={(data) => handleStepSubmit(activeStep, data)}
                        submitting={submitting}
                        resubmitReason={resubmissionReasons[activeStep]}
                      />
                    )}
                    {activeStep === 'kyc_signatory' && (
                      <KycSignatoryForm
                        uid={user?.uid ?? ''}
                        initialData={(kycStepData[activeStep] as Record<string, unknown>) || {}}
                        onSubmit={(data) => handleStepSubmit(activeStep, data)}
                        submitting={submitting}
                        resubmitReason={resubmissionReasons[activeStep]}
                      />
                    )}
                    {activeStep === 'bank_setup' && (
                      <BankSetupForm
                        uid={user?.uid ?? ''}
                        initialData={(kycStepData[activeStep] as Record<string, unknown>) || {}}
                        onSubmit={(data) => handleStepSubmit(activeStep, data)}
                        submitting={submitting}
                        resubmitReason={resubmissionReasons[activeStep]}
                      />
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
