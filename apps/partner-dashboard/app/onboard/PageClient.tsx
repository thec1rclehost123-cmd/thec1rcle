'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Users,
  Zap,
  ChevronRight,
  CheckCircle2,
  ArrowLeft,
  Mail,
  Lock,
  User,
  MapPin,
  Phone,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Instagram,
  Sparkles,
  RefreshCw,
  Building,
  Globe,
  Loader2,
  Upload,
  X,
  ArrowRight,
} from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

// ── Step type ─────────────────────────────────────────────────────────────────
type OnboardingStep =
  | 'email_verify'
  | 'phone_verify'
  | 'entity_type'
  | 'role'
  | 'details'
  | 'kyc_identity'
  | 'kyc_business'
  | 'kyc_signatory'
  | 'success';

type PartnerType = 'venue' | 'host' | 'promoter';
type EntityType = 'individual' | 'business';

// Dynamic sequence based on entity type (KYC steps vary)
function getStepSequence(et: EntityType): OnboardingStep[] {
  const kycSteps: OnboardingStep[] =
    et === 'business' ? ['kyc_business', 'kyc_signatory'] : ['kyc_identity'];
  return ['role', 'email_verify', 'phone_verify', 'entity_type', 'details', ...kycSteps, 'success'];
}

const STEP_LABELS: Record<OnboardingStep, string> = {
  email_verify: 'Email',
  phone_verify: 'Phone',
  entity_type: 'Entity',
  role: 'Role',
  details: 'Details',
  kyc_identity: 'Identity',
  kyc_business: 'Business',
  kyc_signatory: 'Signatory',
  success: 'Done',
};

// ── Error extractor — gateway returns { success: false, error: { message } } ──
function extractError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  if (
    typeof obj.error === 'object' &&
    obj.error &&
    typeof (obj.error as Record<string, unknown>).message === 'string'
  )
    return (obj.error as Record<string, unknown>).message as string;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  return fallback;
}

// ── OTP API helpers ───────────────────────────────────────────────────────────
async function apiSendOtp(type: 'email' | 'phone', recipient: string) {
  const res = await fetch('/api/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, recipient }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(extractError(data, 'Failed to send code.'));
  }
}

async function apiVerifyOtp(type: 'email' | 'phone', recipient: string, code: string) {
  const res = await fetch('/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, recipient, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(extractError(data, 'Incorrect code.'));
  }
  return true;
}

// ── Main component ────────────────────────────────────────────────────────────
function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user: authUser,
    profile: authProfile,
    signOut,
    loading: authLoading,
  } = useDashboardAuth();

  const [step, setStep] = useState<OnboardingStep>('role');
  const [partnerType, setPartnerType] = useState<PartnerType>('venue');
  const [entityType, setEntityType] = useState<EntityType>('individual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'verified'>('pending');
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  // KYC state — collected during onboarding, submitted with the application
  const [createdUid, setCreatedUid] = useState<string | null>(null);
  const [kycStepData, setKycStepData] = useState<Record<string, Record<string, unknown>>>({});
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycError, setKycError] = useState('');

  // Existing user detection state
  const [emailExists, setEmailExists] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);

  // OTP state — provider-agnostic; only verification.js changes per provider
  const [otpEmail, setOtpEmail] = useState('');
  const [otpEmailCode, setOtpEmailCode] = useState('');
  const [otpEmailSent, setOtpEmailSent] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  const [otpPhone, setOtpPhone] = useState('+91 ');
  const [otpPhoneCode, setOtpPhoneCode] = useState('');
  const [otpPhoneSent, setOtpPhoneSent] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  const emailCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phoneCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form data — all existing fields preserved exactly
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    contactPerson: '',
    phone: '',
    city: '',
    area: '',
    website: '',
    capacity: '',
    plan: 'silver',
    role: 'organizer',
    association: '',
    associatedHostId: '',
    instagram: '',
    bio: '',
    upcomingEventsText: '',
    pastEventsText: '',
    businessType: 'pvt_ltd',
    registrationNumber: '',
  });

  // ── Save onboarding progress so the user can resume mid-form ─────────
  const saveProgress = useCallback(
    async (currentStep: OnboardingStep) => {
      const auth = getFirebaseAuth();
      if (!auth.currentUser) return;
      try {
        const token = await auth.currentUser.getIdToken();
        await fetch('/api/auth/onboarding-progress', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            onboardingStep: currentStep,
            entityType: entityType || undefined,
            name: formData.name || undefined,
            contactPerson: formData.contactPerson || undefined,
            city: formData.city || undefined,
            area: formData.area || undefined,
            website: formData.website || undefined,
            capacity: formData.capacity || undefined,
            plan: formData.plan || undefined,
            role: formData.role || undefined,
            association: formData.association || undefined,
            associatedHostId: formData.associatedHostId || undefined,
            instagram: formData.instagram || undefined,
            bio: formData.bio || undefined,
            upcomingEventsText: formData.upcomingEventsText || undefined,
            pastEventsText: formData.pastEventsText || undefined,
            businessType: formData.businessType || undefined,
            registrationNumber: formData.registrationNumber || undefined,
          }),
        });
      } catch {
        /* silent — non-critical */
      }
    },
    [entityType, formData],
  );

  // Dynamic sequence depends on entity type chosen at step 4
  const stepSequence = getStepSequence(entityType);

  // ── Resume from saved onboarding step if user is returning ───────────
  const initialised = useRef(false);
  useEffect(() => {
    if (!authUser || !authProfile) return;
    const savedStep = (authProfile as any)?.onboardingStep;
    const savedEntity = (authProfile as any)?.entityType;
    const ALL_ONBOARDING_STEPS: OnboardingStep[] = [
      'role',
      'email_verify',
      'phone_verify',
      'entity_type',
      'details',
      'kyc_identity',
      'kyc_business',
      'kyc_signatory',
      'success',
    ];
    if (savedStep && !initialised.current && ALL_ONBOARDING_STEPS.includes(savedStep)) {
      initialised.current = true;
      if (savedEntity === 'business' || savedEntity === 'individual') {
        setEntityType(savedEntity);
      }
      setCreatedUid(authUser.uid);

      const p = authProfile as any;
      setFormData((prev) => ({
        ...prev,
        email: authUser.email || prev.email,
        name: p.name || prev.name,
        contactPerson: p.contactPerson || prev.contactPerson,
        phone: p.phone || prev.phone,
        city: p.city || prev.city,
        area: p.area || prev.area,
        website: p.website || prev.website,
        capacity: p.capacity || prev.capacity,
        plan: p.plan || prev.plan,
        role: p.role || prev.role,
        association: p.association || prev.association,
        associatedHostId: p.associatedHostId || prev.associatedHostId,
        instagram: p.instagram || prev.instagram,
        bio: p.bio || prev.bio,
        upcomingEventsText: p.upcomingEventsText || prev.upcomingEventsText,
        pastEventsText: p.pastEventsText || prev.pastEventsText,
        businessType: p.businessType || prev.businessType,
        registrationNumber: p.registrationNumber || prev.registrationNumber,
      }));
      if (p.phone) {
        setOtpPhone(p.phone);
      }

      // Jump ahead if the saved step is past the early steps
      if (['kyc_identity', 'kyc_business', 'kyc_signatory'].includes(savedStep)) {
        setStep(savedStep);
      } else if (savedStep === 'details') {
        setStep(savedStep);
      }
    }
  }, [authUser, authProfile, stepSequence]);

  // Pre-fill from URL params (existing behaviour kept)
  useEffect(() => {
    const type = searchParams.get('type') as PartnerType;
    const email = searchParams.get('email');
    const hostId = searchParams.get('hostId');
    if (type) setPartnerType(type);
    if (email) {
      setOtpEmail(email);
      setFormData((prev) => ({ ...prev, email }));
    }
    if (hostId) setFormData((prev) => ({ ...prev, associatedHostId: hostId }));
  }, [searchParams]);

  // ── Clean up session and enforce Step 1 on fresh load/reload ──────────
  const initialChecked = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (initialChecked.current) return;

    const checkInitialState = async () => {
      initialChecked.current = true;
      if (authUser) {
        try {
          const token = await authUser.getIdToken();
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const meData = await res.json();
            const onboardingRequest = meData.onboarding?.onboardingRequest || null;
            const onboardingComplete = meData.onboarding?.onboardingComplete === true;
            const profileObj = meData.profile || {};
            const userObj = meData.user || {};
            const savedStep = profileObj.onboardingStep || userObj.onboardingStep;

            if (onboardingRequest || onboardingComplete) {
              if (onboardingRequest) {
                setSubmittedRequestId(onboardingRequest.id);
                const reqStatus = onboardingRequest.status?.toLowerCase();
                if (
                  reqStatus === 'approved' ||
                  reqStatus === 'verified' ||
                  meData.user?.isApproved === true ||
                  meData.profile?.isApproved === true
                ) {
                  setApprovalStatus('verified');
                } else {
                  setApprovalStatus('pending');
                }
              } else if (onboardingComplete) {
                const isApproved =
                  meData.user?.isApproved === true || meData.profile?.isApproved === true;
                setApprovalStatus(isApproved ? 'verified' : 'pending');
              }
              setStep('success');
              initialised.current = true;
              return;
            } else if (savedStep) {
              const savedEntity = profileObj.entityType || userObj.entityType;
              if (savedEntity === 'business' || savedEntity === 'individual') {
                setEntityType(savedEntity);
              }
              setCreatedUid(authUser.uid);

              setFormData((prev) => ({
                ...prev,
                email: authUser.email || prev.email,
                name: profileObj.name || prev.name,
                contactPerson: profileObj.contactPerson || prev.contactPerson,
                phone: profileObj.phone || prev.phone,
                city: profileObj.city || prev.city,
                area: profileObj.area || prev.area,
                website: profileObj.website || prev.website,
                capacity: profileObj.capacity || prev.capacity,
                plan: profileObj.plan || prev.plan,
                role: profileObj.role || prev.role,
                association: profileObj.association || prev.association,
                associatedHostId: profileObj.associatedHostId || prev.associatedHostId,
                instagram: profileObj.instagram || prev.instagram,
                bio: profileObj.bio || prev.bio,
                upcomingEventsText: profileObj.upcomingEventsText || prev.upcomingEventsText,
                pastEventsText: profileObj.pastEventsText || prev.pastEventsText,
                businessType: profileObj.businessType || prev.businessType,
                registrationNumber: profileObj.registrationNumber || prev.registrationNumber,
              }));
              if (profileObj.phone) {
                setOtpPhone(profileObj.phone);
              }

              setStep(savedStep);
              initialised.current = true;
              return;
            }
          }
        } catch (err) {
          console.error('Error checking initial onboarding state:', err);
        }
        // If onboarding is not complete and no saved step or request has been found,
        // sign the user out to start fresh from Step 1.
        try {
          await signOut();
        } catch (e) {
          console.error('Error signing out on reload:', e);
        }
      }
      setStep('role');
    };

    checkInitialState();
  }, [authLoading, authUser, signOut]);

  // Approval polling (fixed to read request.status)
  useEffect(() => {
    if (step !== 'success' || !submittedRequestId) return;
    const auth = getFirebaseAuth();
    const checkApproval = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(
          `/api/auth/onboard-status?requestId=${encodeURIComponent(submittedRequestId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const reqObj = data.request || data;
        const status = (reqObj.status as string | undefined)?.toLowerCase();
        if (status === 'verified' || status === 'approved') {
          setApprovalStatus('verified');
        } else {
          setApprovalStatus('pending');
        }
      } catch {
        /* silent */
      }
    };
    checkApproval();
    const interval = setInterval(checkApproval, 10_000);
    return () => clearInterval(interval);
  }, [step, submittedRequestId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  function startCooldown(
    setter: React.Dispatch<React.SetStateAction<number>>,
    ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  ) {
    setter(60);
    ref.current = setInterval(() => {
      setter((prev) => {
        if (prev <= 1) {
          clearInterval(ref.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Email OTP ─────────────────────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    setError('');
    if (!otpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      // Check if email exists
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail }),
      });
      if (!checkRes.ok) {
        throw new Error('Failed to verify email existence. Please try again.');
      }
      const checkData = await checkRes.json();
      if (checkData.exists) {
        setEmailExists(true);
      } else {
        // Normal flow: send OTP
        await apiSendOtp('email', otpEmail);
        setOtpEmailSent(true);
        setFormData((prev) => ({ ...prev, email: otpEmail }));
        startCooldown(setEmailCooldown, emailCooldownRef);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExistingUserLogin = async () => {
    setError('');
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const userCredential = await signInWithEmailAndPassword(auth, otpEmail, loginPassword);
      const token = await userCredential.user.getIdToken();

      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) {
        throw new Error('Failed to fetch account details. Please try logging in again.');
      }
      const meData = await meRes.json();
      console.log('Fetched existing user registration data:', meData);

      // Check if onboarding is already completed / submitted (KYC is completed/pending review)
      const onboardingRequest = meData.onboarding?.onboardingRequest || null;
      const onboardingComplete = meData.onboarding?.onboardingComplete === true;

      if (onboardingRequest || onboardingComplete) {
        if (onboardingRequest) {
          setSubmittedRequestId(onboardingRequest.id);
          const reqStatus = onboardingRequest.status?.toLowerCase();
          if (
            reqStatus === 'approved' ||
            reqStatus === 'verified' ||
            meData.user?.isApproved === true ||
            meData.profile?.isApproved === true
          ) {
            setApprovalStatus('verified');
          } else {
            setApprovalStatus('pending');
          }
        } else if (onboardingComplete) {
          const isApproved =
            meData.user?.isApproved === true || meData.profile?.isApproved === true;
          setApprovalStatus(isApproved ? 'verified' : 'pending');
        }
        initialised.current = true;
        setStep('success');
        setLoading(false);
        return;
      }

      const userObj = meData.user || {};
      const profileObj = meData.profile || {};

      // Determine entityType
      const savedEntity = userObj.entityType || profileObj.entityType || 'individual';
      const isBusiness = savedEntity === 'business';
      setEntityType(isBusiness ? 'business' : 'individual');

      // Pre-populate formData from the database profile
      setFormData((prev) => ({
        ...prev,
        email: userObj.email || otpEmail,
        name: profileObj.name || userObj.displayName || prev.name,
        contactPerson: profileObj.contactPerson || prev.contactPerson,
        phone: profileObj.phone || userObj.phone || prev.phone,
        city: profileObj.city || prev.city,
        area: profileObj.area || prev.area,
        website: profileObj.website || prev.website,
        capacity: profileObj.capacity || prev.capacity,
        plan: profileObj.plan || prev.plan,
        role: profileObj.role || prev.role,
        association: profileObj.association || prev.association,
        associatedHostId: profileObj.associatedHostId || prev.associatedHostId,
        instagram: profileObj.instagram || prev.instagram,
        bio: profileObj.bio || prev.bio,
        upcomingEventsText: profileObj.upcomingEventsText || prev.upcomingEventsText,
        pastEventsText: profileObj.pastEventsText || prev.pastEventsText,
        businessType: profileObj.businessType || prev.businessType,
        registrationNumber: profileObj.registrationNumber || prev.registrationNumber,
      }));

      if (profileObj.phone || userObj.phone) {
        setOtpPhone(profileObj.phone || userObj.phone);
      }
      setCreatedUid(userObj.uid);

      // Determine Step 6 based on entity type: kyc_business for business, kyc_identity for individual
      const nextStep = isBusiness ? 'kyc_business' : 'kyc_identity';

      // Navigate to Step 6
      initialised.current = true;
      setStep(nextStep);

      // Save progress so database records this step transition
      await fetch('/api/auth/onboarding-progress', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          onboardingStep: nextStep,
          entityType: isBusiness ? 'business' : 'individual',
          name: profileObj.name || userObj.displayName || undefined,
          contactPerson: profileObj.contactPerson || undefined,
          city: profileObj.city || undefined,
          area: profileObj.area || undefined,
          website: profileObj.website || undefined,
          capacity: profileObj.capacity || undefined,
          plan: profileObj.plan || undefined,
          role: profileObj.role || undefined,
          association: profileObj.association || undefined,
          associatedHostId: profileObj.associatedHostId || undefined,
          instagram: profileObj.instagram || undefined,
          bio: profileObj.bio || undefined,
          upcomingEventsText: profileObj.upcomingEventsText || undefined,
          pastEventsText: profileObj.pastEventsText || undefined,
          businessType: profileObj.businessType || undefined,
          registrationNumber: profileObj.registrationNumber || undefined,
        }),
      });
    } catch (err: any) {
      console.error('Existing user login error:', err);
      let msg = err.message || 'Verification failed. Please try again.';
      if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/wrong-password') ||
        msg.includes('INVALID_LOGIN_CREDENTIALS')
      ) {
        msg = 'Incorrect password. Please try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    setError('');
    if (!otpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await apiSendOtp('email', otpEmail);
      setOtpEmailSent(true);
      setFormData((prev) => ({ ...prev, email: otpEmail }));
      startCooldown(setEmailCooldown, emailCooldownRef);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    setError('');
    if (otpEmailCode.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await apiVerifyOtp('email', otpEmail, otpEmailCode);
      setStep('phone_verify');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  const handleSendPhoneOtp = async () => {
    setError('');
    const cleanPhone = otpPhone.replace(/\s/g, '');
    if (!cleanPhone) {
      setError('Please enter a phone number.');
      return;
    }

    // Check for only numbers (with optional leading +)
    if (!/^\+?[0-9]+$/.test(cleanPhone)) {
      setError('Phone number must contain only numbers (no letters or special characters).');
      return;
    }

    const digitsOnly = cleanPhone.replace(/[^\d]/g, '');
    if (cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('+91')) {
        const localNumber = cleanPhone.slice(3);
        if (localNumber.length !== 10) {
          setError('Please enter a valid 10-digit Indian mobile number after +91.');
          return;
        }
      } else {
        if (digitsOnly.length < 8) {
          setError('Phone number too short. Include your country code (e.g., +919876543210).');
          return;
        }
      }
    } else {
      if (digitsOnly.length !== 10) {
        setError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
    }

    setLoading(true);
    try {
      // Check if phone number is already registered
      const checkRes = await fetch('/api/auth/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
        }),
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.available && checkData.taken?.includes('phone')) {
          setError('This phone number is already registered.');
          setLoading(false);
          return;
        }
      } else {
        const data = await checkRes.json().catch(() => ({}));
        throw new Error(extractError(data, 'Failed to check phone number availability.'));
      }

      await apiSendOtp('phone', cleanPhone);
      setOtpPhoneSent(true);
      setFormData((prev) => ({ ...prev, phone: cleanPhone }));
      startCooldown(setPhoneCooldown, phoneCooldownRef);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setError('');
    if (otpPhoneCode.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const cleanPhone = otpPhone.replace(/\s/g, '');
      await apiVerifyOtp('phone', cleanPhone, otpPhoneCode);
      setStep('entity_type');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 5: Create Firebase account, then advance to first KYC step ────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      let uid: string;
      const effectiveEmail = authUser?.email || formData.email;

      if (authUser && authUser.email === effectiveEmail) {
        uid = authUser.uid;
      } else {
        if (!formData.email || !formData.password) {
          setError('Please provide both email and password.');
          setLoading(false);
          return;
        }
        const createPhone = formData.phone || otpPhone.replace(/\s/g, '');
        if (createPhone) {
          // Check for only numbers (with optional leading +)
          if (!/^\+?[0-9]+$/.test(createPhone)) {
            setError('Phone number must contain only numbers (no letters or special characters).');
            setLoading(false);
            return;
          }

          const digitsOnly = createPhone.replace(/[^\d]/g, '');
          if (createPhone.startsWith('+')) {
            if (createPhone.startsWith('+91')) {
              const localNumber = createPhone.slice(3);
              if (localNumber.length !== 10) {
                setError('Please enter a valid 10-digit Indian mobile number after +91.');
                setLoading(false);
                return;
              }
            } else {
              if (digitsOnly.length < 8) {
                setError(
                  'Phone number too short. Include your country code (e.g., +919876543210).',
                );
                setLoading(false);
                return;
              }
            }
          } else {
            if (digitsOnly.length !== 10) {
              setError('Please enter a valid 10-digit Indian mobile number.');
              setLoading(false);
              return;
            }
          }
        }
        // Check if email or phone is already registered before creating
        const checkRes = await fetch('/api/auth/check-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            phone: createPhone || undefined,
          }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (!checkData.available && checkData.taken?.length > 0) {
            const msgs: string[] = [];
            if (checkData.taken.includes('email')) msgs.push('This email is already registered.');
            if (checkData.taken.includes('phone'))
              msgs.push('This phone number is already registered.');
            setError(msgs.join('\n'));
            setLoading(false);
            return;
          }
        }
        // Log the details being saved during account creation
        // console.log('Data going to be saved in database during account creation:', {
        // email: formData.email,
        // phone: createPhone || undefined,
        // name: formData.name,
        // contactPerson: formData.contactPerson,
        // city: formData.city,
        // area: formData.area,
        // website: formData.website,
        // capacity: formData.capacity,
        // plan: formData.plan,
        // role: formData.role,
        // association: formData.association,
        // associatedHostId: formData.associatedHostId,
        // instagram: formData.instagram,
        // bio: formData.bio,
        // upcomingEventsText: formData.upcomingEventsText,
        // pastEventsText: formData.pastEventsText,
        // businessType: formData.businessType,
        // registrationNumber: formData.registrationNumber,
        // entityType: entityType,
        // });
        // Create account server-side (Admin SDK) — avoids client Firebase Auth connectivity issues
        const res = await fetch('/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            phone: createPhone || undefined,
            name: formData.name,
            contactPerson: formData.contactPerson,
            city: formData.city,
            area: formData.area,
            website: formData.website,
            capacity: formData.capacity,
            plan: formData.plan,
            role: formData.role,
            association: formData.association,
            associatedHostId: formData.associatedHostId,
            instagram: formData.instagram,
            bio: formData.bio,
            upcomingEventsText: formData.upcomingEventsText,
            pastEventsText: formData.pastEventsText,
            businessType: formData.businessType,
            registrationNumber: formData.registrationNumber,
            entityType: entityType,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            const loginUrl = `/login?email=${encodeURIComponent(formData.email)}&type=${encodeURIComponent(partnerType)}`;
            setError('This email is already registered.');
            setLoading(false);
            router.push(loginUrl);
            return;
          }
          throw new Error(data.error?.message || data.error || 'Failed to create account.');
        }
        // Sign the client in using the custom token returned by the server
        const { customToken, uid: newUid } = data;
        try {
          await signInWithCustomToken(auth, customToken);
        } catch {
          // Custom token sign-in failed — fall back to email/password so
          // subsequent API calls (KYC upload, onboard submission) have auth.
          try {
            await signInWithEmailAndPassword(auth, formData.email, formData.password);
          } catch (e2: any) {
            console.error('Fallback sign-in also failed:', e2?.message);
          }
        }
        uid = newUid;
      }

      setCreatedUid(uid);
      // Advance to the first KYC step in the sequence
      const seq = getStepSequence(entityType);
      const detailsIdx = seq.indexOf('details');
      const nextStep = seq[detailsIdx + 1];
      setStep(nextStep);
      saveProgress(nextStep);
    } catch (err: any) {
      console.error('Account creation error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── KYC step: save data and submit when it's the last step ─────────────
  const submitApplication = useCallback(
    async (stepId: string, data: Record<string, unknown>) => {
      const updatedKycData = { ...kycStepData, [stepId]: data };
      setKycStepData(updatedKycData);
      setKycSubmitting(true);
      setKycError('');
      try {
        const auth = getFirebaseAuth();
        let token = await auth.currentUser?.getIdToken();
        if (!token) {
          // Session may have been lost — try re-signing in
          try {
            await signInWithEmailAndPassword(
              auth,
              authUser?.email || formData.email,
              formData.password,
            );
            token = await auth.currentUser?.getIdToken();
          } catch {
            /* silent — will fail with 401 below */
          }
        }
        const effectiveEmail = authUser?.email || formData.email;
        const res = await fetch('/api/auth/onboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            type: partnerType,
            entityType,
            name: formData.name,
            email: effectiveEmail,
            phone: formData.phone || otpPhone.replace(/\s/g, ''),
            contactPerson: formData.contactPerson,
            city: formData.city,
            area: formData.area,
            website: formData.website,
            capacity: formData.capacity,
            plan: formData.plan,
            role: formData.role,
            association: formData.association,
            associatedHostId: formData.associatedHostId,
            instagram: formData.instagram,
            bio: formData.bio,
            upcomingEventsText: formData.upcomingEventsText,
            pastEventsText: formData.pastEventsText,
            businessType: formData.businessType,
            registrationNumber: formData.registrationNumber,
            kycStepData: updatedKycData,
          }),
        });
        if (!res.ok) {
          let errMsg = 'Failed to submit application.';
          try {
            const data = await res.clone().json();
            errMsg =
              typeof data.error === 'string'
                ? data.error
                : data.error?.message || data.message || errMsg;
          } catch {
            /* non-JSON response */
          }
          throw new Error(errMsg);
        }
        const responseData = await res.json();
        if (responseData.requestId) setSubmittedRequestId(responseData.requestId);
        setStep('success');
      } catch (err: any) {
        console.error('Final submit error:', err);
        const msg = err?.message || '';
        // Zod internal errors — show a clean message instead of raw "_zod"
        if (msg.includes('_zod') || msg.includes('undefined')) {
          setKycError('Validation failed. Please check your details and try again.');
        } else {
          setKycError(msg || 'Failed to submit. Please try again.');
        }
      } finally {
        setKycSubmitting(false);
      }
    },
    [kycStepData, authUser, formData, partnerType, entityType, otpPhone],
  );

  // ── Intermediate KYC step: save data locally and advance or submit ─────
  const handleKycStep = useCallback(
    (stepId: string, data: Record<string, unknown>) => {
      const seq = getStepSequence(entityType);
      const idx = seq.indexOf(stepId as OnboardingStep);
      const isLastStep = idx === seq.length - 2; // second-to-last (before "success")
      if (isLastStep) {
        submitApplication(stepId, data);
      } else {
        setKycStepData((prev) => ({ ...prev, [stepId]: data }));
        if (idx !== -1 && idx < seq.length - 1) {
          const next = seq[idx + 1];
          setStep(next);
          saveProgress(next);
        }
      }
    },
    [entityType, submitApplication, saveProgress],
  );

  const currentStepIndex = stepSequence.indexOf(step);
  // Effective UID for Firebase Storage uploads during KYC
  const effectiveUid = createdUid || authUser?.uid || '';

  return (
    <div className="min-h-screen bg-[var(--surface-base)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--surface-base)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={async () => {
              if (currentStepIndex === 0) {
                if (authUser) await signOut();
                router.push('/login');
              } else {
                setError('');
                setKycError('');
                setStep(stepSequence[currentStepIndex - 1]);
              }
            }}
            className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-[11px] font-semibold uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStepIndex === 0 ? 'Back to Login' : 'Back'}
          </button>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[var(--text-primary)] flex items-center justify-center">
              <span className="text-[var(--text-inverse)] font-bold text-sm">C</span>
            </div>
            <span className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">
              THE C1RCLE
            </span>
          </div>
        </div>
      </header>

      {/* Progress bar — auto-driven by stepSequence */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center">
          {stepSequence
            .filter((s) => s !== 'success')
            .map((s, i) => {
              const isDone = currentStepIndex > i;
              const isCurrent = currentStepIndex === i;
              const isLast = i === stepSequence.filter((s) => s !== 'success').length - 1;
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={!isDone}
                      onClick={() => isDone && setStep(s)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${isCurrent ? 'bg-[var(--accent-primary)] text-white' : isDone ? 'bg-[var(--state-success)] text-white cursor-pointer hover:opacity-80' : 'bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'}`}
                    >
                      {isDone ? '✓' : i + 1}
                    </button>
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wider ${isCurrent ? 'text-[var(--accent-primary)]' : isDone ? 'text-[var(--state-success)]' : 'text-[var(--text-tertiary)]'}`}
                    >
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`flex-1 h-0.5 rounded-full mx-2 mb-4 transition-all ${isDone ? 'bg-[var(--state-success)]' : 'bg-[var(--surface-tertiary)]'}`}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <main className="max-w-xl mx-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {/* ── Email Verification ── */}
          {step === 'email_verify' && (
            <motion.div
              key="email_verify"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step="02"
                label="Verify Email"
                title={emailExists ? 'Welcome Back' : 'Confirm Your Email'}
                description={
                  emailExists
                    ? 'Your email is already registered. Enter your password to resume onboarding.'
                    : "Enter the email address you want to register with. We'll send a 6-digit verification code."
                }
              />
              <ErrorBanner error={error} />
              <div className="space-y-5">
                <FormInput
                  label="Email Address"
                  icon={Mail}
                  type="email"
                  value={otpEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtpEmail(e.target.value)}
                  placeholder="you@company.com"
                  disabled={otpEmailSent || emailExists}
                />
                {emailExists ? (
                  <>
                    <div className="relative">
                      <FormInput
                        label="Password"
                        icon={Lock}
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setLoginPassword(e.target.value)
                        }
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-[42px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <ActionButton
                      onClick={handleExistingUserLogin}
                      loading={loading}
                      loadingText="AUTHORIZING ACCESS..."
                    >
                      Verify & Login <ChevronRight className="h-5 w-5" />
                    </ActionButton>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailExists(false);
                        setLoginPassword('');
                        setError('');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                      Use a different email
                    </button>
                  </>
                ) : !otpEmailSent ? (
                  <ActionButton onClick={handleEmailSubmit} loading={loading}>
                    Continue <ChevronRight className="h-5 w-5" />
                  </ActionButton>
                ) : (
                  <>
                    <OtpInput
                      label="Enter the 6-digit code sent to your email"
                      value={otpEmailCode}
                      onChange={setOtpEmailCode}
                    />
                    <ActionButton onClick={handleVerifyEmailOtp} loading={loading}>
                      Verify Email <ChevronRight className="h-5 w-5" />
                    </ActionButton>
                    <ResendButton
                      cooldown={emailCooldown}
                      onClick={handleSendEmailOtp}
                      loading={loading}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOtpEmailSent(false);
                        setError('');
                        setOtpEmailCode('');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                      Use a different email
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Phone Verification ── */}
          {step === 'phone_verify' && (
            <motion.div
              key="phone_verify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step="03"
                label="Verify Phone"
                title="Confirm Your Number"
                description="We'll send an SMS code to confirm your mobile number. This becomes your verified contact on the platform."
              />
              <ErrorBanner error={error} />
              <div className="space-y-5">
                <FormInput
                  label="Mobile Number (with country code)"
                  icon={Phone}
                  type="tel"
                  value={otpPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = e.target.value;
                    let sanitized = val.replace(/[^0-9+\s]/g, '');
                    if (sanitized.indexOf('+') > 0) {
                      sanitized = sanitized[0] + sanitized.slice(1).replace(/\+/g, '');
                    }
                    setOtpPhone(sanitized);
                  }}
                  placeholder="+91 98765 43210"
                  disabled={otpPhoneSent}
                />
                {!otpPhoneSent ? (
                  <ActionButton onClick={handleSendPhoneOtp} loading={loading}>
                    Send SMS Code <ChevronRight className="h-5 w-5" />
                  </ActionButton>
                ) : (
                  <>
                    <OtpInput
                      label="Enter the 6-digit SMS code"
                      value={otpPhoneCode}
                      onChange={setOtpPhoneCode}
                    />
                    <ActionButton onClick={handleVerifyPhoneOtp} loading={loading}>
                      Verify Phone <ChevronRight className="h-5 w-5" />
                    </ActionButton>
                    <ResendButton
                      cooldown={phoneCooldown}
                      onClick={handleSendPhoneOtp}
                      loading={loading}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOtpPhoneSent(false);
                        setError('');
                        setOtpPhoneCode('');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                      Use a different number
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Entity Type ── */}
          {step === 'entity_type' && (
            <motion.div
              key="entity_type"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step="04"
                label="Entity Type"
                title="Individual or Business?"
                description="This determines which verification documents you'll provide after approval."
              />
              <div className="grid grid-cols-1 gap-4 mb-10">
                <RoleCard
                  icon={User}
                  title="Individual"
                  description="Freelancer, independent promoter, solo DJ, or individual host."
                  active={entityType === 'individual'}
                  onClick={() => setEntityType('individual')}
                />
                <RoleCard
                  icon={Building}
                  title="Business"
                  description="Registered company, club, LLP, partnership firm, or trust."
                  active={entityType === 'business'}
                  onClick={() => setEntityType('business')}
                />
              </div>
              <ActionButton
                onClick={() => {
                  setError('');
                  setStep('details');
                }}
              >
                Continue <ChevronRight className="h-5 w-5" />
              </ActionButton>
            </motion.div>
          )}

          {/* ── Role Selection ── */}
          {step === 'role' && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step="01"
                label="Select Role"
                title="Join the Network"
                description="Select your operational role to begin the onboarding process."
              />
              <div className="grid grid-cols-1 gap-4 mb-10">
                <RoleCard
                  icon={Building2}
                  title="Venue Partner"
                  description="Direct management for nightlife venues, clubs, and lounge spaces."
                  active={partnerType === 'venue'}
                  onClick={() => setPartnerType('venue')}
                />
                <RoleCard
                  icon={Users}
                  title="Event Host"
                  description="For organizers, DJs, and collectives hosting independent events."
                  active={partnerType === 'host'}
                  onClick={() => setPartnerType('host')}
                />
                <RoleCard
                  icon={Zap}
                  title="Promoter"
                  description="Access tools for ticket distribution and guestlist management."
                  active={partnerType === 'promoter'}
                  onClick={() => setPartnerType('promoter')}
                />
              </div>
              <ActionButton
                onClick={() => {
                  setError('');
                  setStep('email_verify');
                }}
              >
                Continue <ChevronRight className="h-5 w-5" />
              </ActionButton>
            </motion.div>
          )}

          {/* ── Details Form ── */}
          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step={String(stepSequence.indexOf('details') + 1).padStart(2, '0')}
                label="Your Details"
                title={
                  partnerType === 'venue'
                    ? 'Venue Registration'
                    : partnerType === 'host'
                      ? 'Host Profile'
                      : 'Promoter Enrollment'
                }
                description="Tell us about your business. You'll upload verification documents in the next steps."
              />

              <ErrorBanner error={error} onLoginClick={() => router.push('/login')} />

              <form onSubmit={handleCreateAccount} className="space-y-8">
                {/* Credentials section */}
                {!authUser ? (
                  <div className="space-y-5">
                    <SectionTitle title="Account Credentials" />
                    <div className="p-4 rounded-2xl bg-[var(--state-success-bg)] border border-[var(--state-success)]/20 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-[var(--state-success)] flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--state-success)] uppercase tracking-wider">
                          Verified Email
                        </p>
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">
                          {otpEmail}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <FormInput
                        label="Create Password"
                        icon={Lock}
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        placeholder="Minimum 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-[42px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-[var(--state-success-bg)] border border-[var(--state-success)]/20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-xl bg-[var(--state-success)] flex items-center justify-center font-bold text-white text-lg">
                        {authUser.email?.[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--state-success)] uppercase tracking-wider mb-0.5">
                          Signed In As
                        </p>
                        <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                          {authUser.email}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-[var(--state-success)]" />
                  </div>
                )}

                {/* Entity Information */}
                <div className="space-y-5">
                  <SectionTitle
                    title={partnerType === 'promoter' ? 'Your Profile' : 'Entity Information'}
                  />

                  {entityType === 'business' ? (
                    <>
                      <FormInput
                        label="Legal Business Name"
                        icon={Building}
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. Eclipse Nightlife Pvt. Ltd."
                      />
                      <FormSelect
                        label="Business Type"
                        name="businessType"
                        value={formData.businessType}
                        onChange={handleInputChange}
                        options={[
                          { value: 'pvt_ltd', label: 'Private Limited' },
                          { value: 'llp', label: 'LLP' },
                          { value: 'partnership', label: 'Partnership Firm' },
                          { value: 'sole_prop', label: 'Sole Proprietorship' },
                          { value: 'trust', label: 'Trust / Society' },
                        ]}
                      />
                      <FormInput
                        label="Registration / CIN Number (optional)"
                        icon={Briefcase}
                        name="registrationNumber"
                        value={formData.registrationNumber}
                        onChange={handleInputChange}
                        placeholder="e.g. U74999MH2020PTC123456"
                      />
                    </>
                  ) : (
                    <FormInput
                      label={
                        partnerType === 'venue'
                          ? 'Venue Name'
                          : partnerType === 'host'
                            ? 'Brand / Collective Name'
                            : 'Your Full Name'
                      }
                      icon={partnerType === 'venue' ? Building2 : User}
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder={
                        partnerType === 'venue'
                          ? 'e.g. Club Eclipse'
                          : partnerType === 'host'
                            ? 'e.g. Midnight Collective'
                            : 'Your name'
                      }
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormInput
                      label={entityType === 'business' ? 'Authorized Contact' : 'Contact Person'}
                      icon={Briefcase}
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleInputChange}
                      required
                      placeholder="Primary contact"
                    />
                    {/* Phone read-only — verified in step 2 */}
                    <div className="space-y-2">
                      <label className="input-label">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--state-success)]" />
                        <input
                          type="tel"
                          value={formData.phone || otpPhone}
                          readOnly
                          className="w-full bg-[var(--state-success-bg)] border border-[var(--state-success)]/30 rounded-xl pl-12 pr-10 py-3.5 text-[14px] text-[var(--text-primary)] cursor-not-allowed"
                        />
                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--state-success)]" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormSelect
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      options={[
                        { value: '', label: 'Select a city' },
                        { value: 'Pune', label: 'Pune' },
                        { value: 'Mumbai', label: 'Mumbai' },
                        { value: 'Goa', label: 'Goa' },
                        { value: 'Bengaluru', label: 'Bengaluru' },
                        { value: 'Delhi', label: 'Delhi' },
                        { value: 'Hyderabad', label: 'Hyderabad' },
                        { value: 'Chennai', label: 'Chennai' },
                        { value: 'Kolkata', label: 'Kolkata' },
                        { value: 'Jaipur', label: 'Jaipur' },
                        { value: 'Ahmedabad', label: 'Ahmedabad' },
                      ]}
                    />
                    <FormInput
                      label="Area / Locality"
                      icon={MapPin}
                      name="area"
                      value={formData.area}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g. Bandra"
                    />
                  </div>

                  <FormInput
                    label="Website (optional)"
                    icon={Globe}
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://yourbrand.com"
                  />

                  {/* Role-specific fields — unchanged */}
                  {partnerType === 'venue' && (
                    <>
                      <FormInput
                        label="Approximate Capacity"
                        icon={Users}
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. 500"
                      />
                      <FormSelect
                        label="Subscription Tier"
                        name="plan"
                        value={formData.plan}
                        onChange={handleInputChange}
                        options={[
                          { value: 'basic', label: 'Basic Access' },
                          { value: 'silver', label: 'Silver Tier' },
                          { value: 'gold', label: 'Gold Premium' },
                          { value: 'diamond', label: 'Diamond Private' },
                        ]}
                      />
                    </>
                  )}
                  {partnerType === 'host' && (
                    <FormSelect
                      label="Host Category"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      options={[
                        { value: 'dj', label: 'Individual DJ / Artist' },
                        { value: 'organizer', label: 'Event Organizer' },
                        { value: 'collective', label: 'Collective / Label' },
                      ]}
                    />
                  )}
                  {partnerType === 'promoter' && (
                    <>
                      <FormInput
                        label="Instagram Handle"
                        icon={Instagram}
                        name="instagram"
                        value={formData.instagram}
                        onChange={handleInputChange}
                        required
                        placeholder="@yourusername"
                      />
                      <div className="space-y-2">
                        <label className="input-label">Short Bio</label>
                        <textarea
                          name="bio"
                          value={formData.bio}
                          onChange={handleInputChange}
                          placeholder="Tell us about your reach, experience, and what you're looking for..."
                          className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] transition-all outline-none min-h-[120px] resize-none"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="input-label">Upcoming Events (optional)</label>
                        <textarea
                          name="upcomingEventsText"
                          value={formData.upcomingEventsText}
                          onChange={handleInputChange}
                          placeholder={
                            'One event per line\nSummer Fridays | Jun 14 2026 | Toy Room | Mumbai\nCampus Heatwave | Jul 05 2026 | Kitty Su | Delhi'
                          }
                          className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] transition-all outline-none min-h-[120px] resize-none"
                        />
                        <p className="text-[12px] leading-5 text-[var(--text-tertiary)]">
                          Format each line as: event name | date | venue | city
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="input-label">Past Event Highlights (optional)</label>
                        <textarea
                          name="pastEventsText"
                          value={formData.pastEventsText}
                          onChange={handleInputChange}
                          placeholder={
                            'One event per line\nNeon Saturdays | Jan 20 2026 | Soho House | Mumbai\nWarehouse Takeover | Dec 28 2025 | AntiSocial | Pune'
                          }
                          className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] transition-all outline-none min-h-[120px] resize-none"
                        />
                        <p className="text-[12px] leading-5 text-[var(--text-tertiary)]">
                          These appear on your partner profile until real event history is linked.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--accent-primary)] text-white h-14 rounded-2xl font-semibold text-[14px] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Setting up account…
                    </>
                  ) : (
                    <>
                      Continue to Verification <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── KYC: Identity Verification (Individual) ── */}
          {step === 'kyc_identity' && (
            <motion.div
              key="kyc_identity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step={String(stepSequence.indexOf('kyc_identity') + 1).padStart(2, '0')}
                label="Identity Check"
                title="Verify Your Identity"
                description="Upload a government-issued ID and a selfie to confirm your identity."
              />
              {kycError && <ErrorBanner error={kycError} />}
              <KycIdentityForm
                uid={effectiveUid}
                initialData={{}}
                onSubmit={(data) => handleKycStep('kyc_identity', data)}
                submitting={false}
                submitLabel="Continue"
              />
            </motion.div>
          )}

          {/* ── KYC: Business Documents (Business) ── */}
          {step === 'kyc_business' && (
            <motion.div
              key="kyc_business"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step={String(stepSequence.indexOf('kyc_business') + 1).padStart(2, '0')}
                label="Business Documents"
                title="Business Documents"
                description="PAN, CIN/GST, and registration certificate for your business."
              />
              {kycError && <ErrorBanner error={kycError} />}
              <KycBusinessForm
                uid={effectiveUid}
                initialData={{
                  legalName: formData.name,
                  businessType: formData.businessType,
                  cin: formData.registrationNumber,
                }}
                onSubmit={(data) => handleKycStep('kyc_business', data)}
                submitting={false}
                submitLabel="Continue"
              />
            </motion.div>
          )}

          {/* ── KYC: Authorized Representative (Business) ── */}
          {step === 'kyc_signatory' && (
            <motion.div
              key="kyc_signatory"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StepHeader
                step={String(stepSequence.indexOf('kyc_signatory') + 1).padStart(2, '0')}
                label="Authorized Representative"
                title="Authorized Representative"
                description="Identity verification for the person representing the business."
              />
              {kycError && <ErrorBanner error={kycError} />}
              <KycSignatoryForm
                uid={effectiveUid}
                initialData={{}}
                onSubmit={(data) => handleKycStep('kyc_signatory', data)}
                submitting={false}
                submitLabel="Continue"
              />
            </motion.div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center pt-8"
            >
              {approvalStatus === 'verified' ? (
                <>
                  <motion.div
                    key="approved"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="h-24 w-24 rounded-3xl bg-[var(--accent-glow)] text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-8"
                  >
                    <Sparkles className="h-12 w-12" />
                  </motion.div>
                  <h1 className="text-display-sm text-[var(--text-primary)] mb-4">
                    You're Approved
                  </h1>
                  <p className="text-body text-[var(--text-secondary)] mb-10 max-w-md mx-auto">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formData.name}
                    </span>{' '}
                    has been approved. Log in to access your dashboard.
                  </p>
                  <button
                    onClick={async () => {
                      if (authUser) await signOut();
                      router.push('/login');
                    }}
                    className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-[var(--accent-primary)] text-white font-semibold text-[14px] hover:brightness-110 transition-all shadow-lg shadow-[var(--accent-primary)]/20"
                  >
                    Go to Login <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <motion.div
                    key="pending"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="h-24 w-24 rounded-3xl bg-[var(--state-success-bg)] text-[var(--state-success)] flex items-center justify-center mx-auto mb-8"
                  >
                    <CheckCircle2 className="h-12 w-12" />
                  </motion.div>
                  <h1 className="text-display-sm text-[var(--text-primary)] mb-4">
                    Application Submitted
                  </h1>
                  <p className="text-body text-[var(--text-secondary)] mb-10 max-w-md mx-auto">
                    Your application and verification documents for{' '}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formData.name}
                    </span>{' '}
                    are under review. We'll email you once approved.
                  </p>
                  <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] mb-10 flex items-start gap-4 text-left">
                    <ShieldCheck className="h-6 w-6 text-[var(--accent-primary)] flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">
                        What Happens Next?
                      </p>
                      <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                        Our team reviews applications and documents within 24–48 hours. Once
                        approved, you'll receive an email to log in and access your full dashboard.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (authUser) await signOut();
                      router.push('/login');
                    }}
                    className="inline-flex items-center gap-2 text-[var(--accent-primary)] font-semibold text-[14px] hover:underline"
                  >
                    Return to Login <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--surface-base)]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 border-3 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] rounded-full animate-spin" />
            <p className="text-[14px] font-medium text-[var(--text-tertiary)]">Loading...</p>
          </div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

// ── UI primitives (unchanged from original + new OTP/helper components) ───────

function StepHeader({
  step,
  label,
  title,
  description,
}: {
  step: string;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-10">
      <p className="text-label text-[var(--accent-primary)] mb-2">
        STEP {step} — {label.toUpperCase()}
      </p>
      <h1 className="text-display-sm text-[var(--text-primary)] mb-3">{title}</h1>
      <p className="text-body text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: any;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${active ? 'bg-[var(--surface-tertiary)] border-[var(--accent-primary)] shadow-lg' : 'bg-[var(--surface-elevated)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className={`text-[16px] font-semibold mb-1 text-[var(--text-primary)]`}>{title}</h3>
          <p
            className={`text-[13px] leading-relaxed ${active ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`}
          >
            {description}
          </p>
        </div>
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]' : 'border-[var(--border-default)]'}`}
        >
          {active && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
      </div>
    </motion.button>
  );
}

function FormInput({ label, icon: Icon, ...props }: any) {
  return (
    <div className="space-y-2">
      <label className="input-label">{label}</label>
      <div className="relative group">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-placeholder)] group-focus-within:text-[var(--accent-primary)] transition-colors" />
        )}
        <input
          className={`w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] transition-all outline-none ${Icon ? 'pl-12 pr-4' : 'px-4'} py-3.5 hover:border-[var(--border-default)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] disabled:opacity-60 disabled:cursor-not-allowed`}
          {...props}
        />
      </div>
    </div>
  );
}

function FormSelect({ label, options, ...props }: any) {
  return (
    <div className="space-y-2">
      <label className="input-label">{label}</label>
      <div className="relative">
        <select
          className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3.5 text-[14px] text-[var(--text-primary)] appearance-none cursor-pointer transition-all outline-none hover:border-[var(--border-default)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)]"
          {...props}
        >
          {options.map((opt: { value: string; label: string }) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-tertiary)] rotate-90 pointer-events-none" />
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-label text-[var(--text-tertiary)] whitespace-nowrap">{title}</span>
      <div className="h-px bg-[var(--border-subtle)] flex-1" />
    </div>
  );
}

function OtpInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="input-label">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3.5 text-[24px] font-bold tracking-[0.5em] text-center text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] transition-all outline-none focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)]"
      />
    </div>
  );
}

function ActionButton({
  onClick,
  loading = false,
  loadingText = 'Processing...',
  children,
}: {
  onClick?: () => void;
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={loading}
      className="w-full bg-[var(--accent-primary)] text-white h-14 rounded-2xl font-semibold text-[14px] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function ResendButton({
  cooldown,
  onClick,
  loading,
}: {
  cooldown: number;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cooldown > 0 || loading}
      className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <RefreshCw className="h-4 w-4" />
      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
    </button>
  );
}

function ErrorBanner({ error, onLoginClick }: { error: string; onLoginClick?: () => void }) {
  if (!error) return null;
  const lines = error.split('\n').filter(Boolean);
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 p-5 bg-[var(--state-error-bg)] border border-[var(--state-error)]/20 rounded-2xl"
    >
      <div className="flex items-start gap-4">
        <AlertCircle className="h-5 w-5 text-[var(--state-error)] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {lines.length === 1 ? (
            <p className="text-[14px] font-semibold text-[var(--state-error)]">{error}</p>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {lines.map((line, i) => (
                <li key={i} className="text-[14px] font-semibold text-[var(--state-error)]">
                  {line}
                </li>
              ))}
            </ul>
          )}
          {onLoginClick && error.includes('log in') && (
            <button
              onClick={onLoginClick}
              className="text-[12px] font-semibold text-[var(--state-error)] underline hover:no-underline mt-2 inline-block"
            >
              Go to Login →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── KYC form utilities (used during onboarding) ───────────────────────────────

function KycFileZone({
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
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function getToken(): Promise<string> {
    const auth = getFirebaseAuth();
    let currentUser = auth.currentUser;
    if (currentUser) return currentUser.getIdToken();
    // Auth not ready yet — wait briefly for onAuthStateChanged to resolve
    await new Promise((r) => setTimeout(r, 500));
    currentUser = auth.currentUser;
    if (currentUser) return currentUser.getIdToken();
    // Try force-refresh a second later
    await new Promise((r) => setTimeout(r, 1500));
    currentUser = auth.currentUser;
    if (currentUser) return currentUser.getIdToken(true);
    throw new Error('Session not ready. Please refresh the page and try again.');
  }

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploadError('');
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File must be under 5MB.');
      return;
    }

    let token: string;
    try {
      token = await getToken();
    } catch (e: any) {
      setUploadError(e.message);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('stepId', stepId);
      form.append('fieldName', fieldName);

      const res = await fetch('/api/kyc/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      setProgress(100);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractError(data, 'Upload failed.'));
      }

      const { url } = await res.json();
      onChange(url);
    } catch (e: any) {
      console.error('Upload error:', e);
      setUploadError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
        {label}
      </label>
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          <span className="text-[12px] text-emerald-400 font-medium truncate flex-1">Uploaded</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 rounded-lg hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : uploading ? (
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
            <span className="text-[12px] text-[var(--text-tertiary)]">Uploading… {progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--surface-tertiary)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full p-5 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] transition-all text-center group"
          >
            <Upload className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] mx-auto mb-1.5 transition-colors" />
            <p className="text-[11px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">
              Click to upload · JPG, PNG or PDF · Max 5MB
            </p>
          </button>
          {uploadError && (
            <p className="text-[11px] font-medium text-red-400 flex items-center gap-1.5 mt-2">
              <AlertCircle className="h-3.5 w-3.5" />
              {uploadError}
            </p>
          )}
        </div>
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

function KycInputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[14px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all"
      />
    </div>
  );
}

function KycSelectField({
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
      <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all appearance-none"
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

// ── KYC Forms ─────────────────────────────────────────────────────────────────

function KycIdentityForm({
  uid,
  initialData,
  onSubmit,
  submitting,
  submitLabel = 'Continue',
}: {
  uid: string;
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  const [idType, setIdType] = useState((initialData.idType as string) || '');
  const [idNumber, setIdNumber] = useState((initialData.idNumber as string) || '');
  const [docFront, setDocFront] = useState<string | null>(
    (initialData.docFrontUrl as string) || null,
  );
  const [docBack, setDocBack] = useState<string | null>((initialData.docBackUrl as string) || null);
  const [selfie, setSelfie] = useState<string | null>((initialData.selfieUrl as string) || null);

  // New state for Aadhaar verification
  const [verifying, setVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(!!initialData.isVerified);
  const [verificationError, setVerificationError] = useState('');

  const needsBack = ['aadhaar', 'driving_licence', 'voter_id'].includes(idType);

  const handleVerifyAadhaar = async () => {
    if (!idNumber || idNumber.length !== 12) {
      setVerificationError('Aadhaar number must be 12 digits.');
      return;
    }
    setVerifying(true);
    setVerificationError('');
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/kyc/verify-aadhaar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ aadhaarId: idNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(extractError(data, 'Verification failed.'));
      }
      setIsVerified(true);
    } catch (err: any) {
      setVerificationError(err.message);
      setIsVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  // Reset verification when ID number or type changes
  useEffect(() => {
    setIsVerified(false);
    setVerificationError('');
  }, [idNumber, idType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idType || !idNumber || !docFront || !selfie) return;
    if (needsBack && !docBack) return;
    if (idType === 'aadhaar' && !isVerified) return;
    onSubmit({
      idType,
      idNumber,
      docFrontUrl: docFront,
      docBackUrl: docBack,
      selfieUrl: selfie,
      isVerified,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <KycSelectField
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

      <div className="space-y-2">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <KycInputField
              label="ID Number"
              value={idNumber}
              onChange={setIdNumber}
              placeholder="Enter your ID number"
            />
          </div>
          {idType === 'aadhaar' && (
            <button
              type="button"
              onClick={handleVerifyAadhaar}
              disabled={verifying || isVerified || idNumber.length !== 12}
              className={`h-12 px-6 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isVerified ? 'bg-emerald-500/20 text-emerald-500 cursor-default' : 'bg-[var(--accent-primary)] text-white hover:brightness-110 disabled:opacity-40'}`}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isVerified ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : null}
              {verifying ? 'Verifying...' : isVerified ? 'Verified' : 'Verify ID'}
            </button>
          )}
        </div>
        {verificationError && (
          <p className="text-[11px] font-medium text-red-400 flex items-center gap-1.5 ml-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {verificationError}
          </p>
        )}
        {isVerified && idType === 'aadhaar' && (
          <p className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5 ml-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aadhaar structurally verified.
          </p>
        )}
      </div>

      <div className={`grid gap-4 ${needsBack ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        <KycFileZone
          label="Document Front"
          fieldName="doc_front"
          value={docFront}
          onChange={setDocFront}
          uid={uid}
          stepId="kyc_identity"
        />
        {needsBack && (
          <KycFileZone
            label="Document Back"
            fieldName="doc_back"
            value={docBack}
            onChange={setDocBack}
            uid={uid}
            stepId="kyc_identity"
          />
        )}
      </div>
      <KycFileZone
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
          submitting ||
          !idType ||
          !idNumber ||
          !docFront ||
          !selfie ||
          (needsBack && !docBack) ||
          (idType === 'aadhaar' && !isVerified)
        }
        className="w-full h-12 rounded-xl bg-[var(--accent-primary)] text-white font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

function KycBusinessForm({
  uid,
  initialData,
  onSubmit,
  submitting,
  submitLabel = 'Continue',
}: {
  uid: string;
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  // legalName, businessType, cin come pre-filled from the Details step — not asked again
  const legalName = (initialData.legalName as string) || '';
  const businessType = (initialData.businessType as string) || '';
  const cin = (initialData.cin as string) || '';

  const [pan, setPan] = useState((initialData.pan as string) || '');
  const [gst, setGst] = useState((initialData.gst as string) || '');
  const [address, setAddress] = useState((initialData.address as string) || '');
  const [regDoc, setRegDoc] = useState<string | null>((initialData.regDocUrl as string) || null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pan || !address || !regDoc) return;
    onSubmit({ legalName, businessType, pan, cin, gst, address, regDocUrl: regDoc });
  };

  const BUSINESS_TYPE_LABELS: Record<string, string> = {
    pvt_ltd: 'Private Limited',
    llp: 'LLP',
    partnership: 'Partnership Firm',
    sole_prop: 'Sole Proprietorship',
    trust: 'Trust / Society',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Confirmed details from the previous step — no need to re-enter */}
      <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">
          Confirmed from your details
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--text-tertiary)]">Business Name</span>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            {legalName || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--text-tertiary)]">Business Type</span>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            {BUSINESS_TYPE_LABELS[businessType] || businessType || '—'}
          </span>
        </div>
        {cin && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-tertiary)]">CIN / Reg. No.</span>
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{cin}</span>
          </div>
        )}
      </div>
      <KycInputField label="Business PAN" value={pan} onChange={setPan} placeholder="AAACB1234C" />
      <KycInputField
        label="GST Number (optional)"
        value={gst}
        onChange={setGst}
        placeholder="27AAACB1234C1Z5"
      />
      <KycInputField
        label="Registered Address"
        value={address}
        onChange={setAddress}
        placeholder="Full address as on documents"
      />
      <KycFileZone
        label="Registration Certificate"
        fieldName="reg_doc"
        value={regDoc}
        onChange={setRegDoc}
        uid={uid}
        stepId="kyc_business"
      />
      <button
        type="submit"
        disabled={submitting || !pan || !address || !regDoc}
        className="w-full h-12 rounded-xl bg-[var(--accent-primary)] text-white font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

function KycSignatoryForm({
  uid,
  initialData,
  onSubmit,
  submitting,
  submitLabel = 'Continue',
}: {
  uid: string;
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  submitLabel?: string;
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
      <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
        <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
          Provide identity details for the person who is authorized to represent this business on
          C1RCLE.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <KycInputField
          label="Full Legal Name"
          value={fullName}
          onChange={setFullName}
          placeholder="As on government ID"
        />
        <KycSelectField
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
        <KycInputField
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="representative@company.com"
        />
        <KycInputField
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="+91 9876543210"
        />
      </div>
      <KycSelectField
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
      <KycInputField
        label="ID Number"
        value={idNumber}
        onChange={setIdNumber}
        placeholder="Enter ID number"
      />
      <div className={`grid gap-4 ${needsBack ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        <KycFileZone
          label="Document Front"
          fieldName="sig_doc_front"
          value={docFront}
          onChange={setDocFront}
          uid={uid}
          stepId="kyc_signatory"
        />
        {needsBack && (
          <KycFileZone
            label="Document Back"
            fieldName="sig_doc_back"
            value={docBack}
            onChange={setDocBack}
            uid={uid}
            stepId="kyc_signatory"
          />
        )}
      </div>
      <KycFileZone
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
          className="mt-0.5 h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]"
        />
        <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
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
        className="w-full h-12 rounded-xl bg-[var(--accent-primary)] text-white font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
