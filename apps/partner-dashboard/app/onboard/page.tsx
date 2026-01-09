"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Building2,
    Users,
    Zap,
    ChevronRight,
    CheckCircle2,
    ArrowLeft,
    Upload,
    Mail,
    Lock,
    User,
    MapPin,
    Phone,
    Briefcase,
    ShieldCheck,
    AlertCircle
} from "lucide-react";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

type OnboardingStep = "role" | "details" | "success";
type PartnerType = "venue" | "host" | "promoter";

function OnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user: authUser } = useDashboardAuth();
    const [step, setStep] = useState<OnboardingStep>("role");
    const [partnerType, setPartnerType] = useState<PartnerType>("venue");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    // Standard procedure: strictly use form data

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        name: "",
        contactPerson: "",
        phone: "",
        city: "",
        area: "",
        capacity: "",
        plan: "silver", // Default for venues
        role: "organizer", // Default for hosts
        association: "", // For promoters
        associatedHostId: "", // For invited promoters
        instagram: "", // Social handles
        bio: "" // Short background
    });

    useEffect(() => {
        const type = searchParams.get("type") as PartnerType;
        const email = searchParams.get("email");
        const hostId = searchParams.get("hostId");
        const inviteId = searchParams.get("inviteId");

        if (type) {
            setPartnerType(type);
            setStep("details");
        }
        if (email) {
            setFormData(prev => ({ ...prev, email }));
        }
        if (hostId) {
            setFormData(prev => ({ ...prev, associatedHostId: hostId }));
        }
    }, [searchParams]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOnboard = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const auth = getFirebaseAuth();
            const db = getFirebaseDb();

            let uid;
            const effectiveEmail = authUser?.email || formData.email;

            // 1. Resolve Identity: Use current session if available
            if (authUser && authUser.email === effectiveEmail) {
                uid = authUser.uid;
            } else {
                if (!formData.email || !formData.password) {
                    setError("Please provide both email and password for your new account.");
                    setLoading(false);
                    return;
                }
                try {
                    const credential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
                    uid = credential.user.uid;
                } catch (err: any) {
                    if (err.code === 'auth/email-already-in-use') {
                        setError("This email is already registered. If this is you, please Log In first, then return to this form to complete your registry.");
                        setLoading(false);
                        return;
                    }
                    throw err;
                }
            }

            // 2. Create/Update User Profile
            await setDoc(doc(db, "users", uid), {
                uid,
                email: effectiveEmail,
                displayName: formData.name,
                role: 'onboarding', // Temporary role
                isApproved: false,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // 3. Create Onboarding Request
            const requestId = `req_${Date.now()}_${uid.substring(0, 5)}`;
            await setDoc(doc(db, "onboarding_requests", requestId), {
                id: requestId,
                uid,
                type: partnerType,
                status: "pending",
                data: {
                    ...formData,
                    email: effectiveEmail,
                    password: "[REDACTED]"
                },
                submittedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setStep("success");
        } catch (err: any) {
            console.error("Onboarding error:", err);
            setError(err.message || "Failed to submit request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans">
            {/* Header */}
            <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
                <button
                    onClick={() => step === "role" ? router.back() : setStep("role")}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors font-bold uppercase tracking-widest text-[10px]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {step === "role" ? "Back to Login" : "Back to Registry"}
                </button>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
                        <div className="h-3 w-3 rounded-full bg-white" />
                    </div>
                    <span className="font-black tracking-tighter text-lg italic">THE C1RCLE</span>
                </div>
            </div>

            <main className="max-w-xl mx-auto px-6 pt-12 pb-24">
                {step === "role" && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="mb-12">
                            <h1 className="text-4xl font-black tracking-tight mb-4">Request Workspace Access</h1>
                            <p className="text-slate-500 font-medium">Select your operational role to begin the onboarding process.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <RoleCard
                                icon={Building2}
                                title="Venue"
                                description="Direct management for nightlife venues and lounge spaces."
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

                        <button
                            onClick={() => setStep("details")}
                            className="w-full mt-10 bg-slate-900 text-white h-16 rounded-2xl font-bold uppercase tracking-widest text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
                        >
                            Continue to Details
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {step === "details" && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="mb-12">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Step 02 — Data Collection</span>
                            </div>
                            <h1 className="text-4xl font-black tracking-tight mb-4">
                                {partnerType === 'venue' ? 'Venue Registry' :
                                    partnerType === 'host' ? 'Host Identity' : 'Promoter Enrollment'}
                            </h1>
                            <p className="text-slate-500 font-medium italic text-sm">Submit your information for verification and approval.</p>
                        </div>

                        {error && (
                            <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex flex-col gap-4 shadow-sm">
                                <div className="flex items-start gap-4">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                                    <p className="text-sm text-red-700 font-bold leading-tight">{error}</p>
                                </div>
                                {error.includes("sign in") && (
                                    <button
                                        onClick={() => router.push('/login')}
                                        className="h-10 px-6 bg-white border border-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all w-fit self-end"
                                    >
                                        Log In Now
                                    </button>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleOnboard} className="space-y-10">
                            {/* Conditional Credentials Section */}
                            {!authUser ? (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <SectionTitle title="Account Credentials" />
                                    <div className="grid grid-cols-1 gap-6">
                                        <FormInput label="Email Address" icon={Mail} type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                                        <FormInput label="Account Password" icon={Lock} type="password" name="password" value={formData.password} onChange={handleInputChange} required />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center border border-indigo-100 shadow-sm font-black text-indigo-600">
                                            {authUser.email?.[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-0.5">Authorized Identity</p>
                                            <p className="text-sm font-bold text-slate-900">{authUser.email}</p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-white rounded-lg border border-indigo-100 text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                        Session Active
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                <SectionTitle title="Entity Information" />
                                <div className="grid grid-cols-1 gap-6">
                                    <FormInput label={partnerType === 'venue' ? 'Venue Name' : 'Profile Name / Brand'} icon={User} name="name" value={formData.name} onChange={handleInputChange} required />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormInput label="Point of Contact" icon={Briefcase} name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required />
                                        <FormInput label="Contact Number" icon={Phone} name="phone" value={formData.phone} onChange={handleInputChange} required />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormInput label="Primary City" icon={MapPin} name="city" value={formData.city} onChange={handleInputChange} required />
                                        <FormInput label="Operating Area" icon={MapPin} name="area" value={formData.area} onChange={handleInputChange} required />
                                    </div>

                                    {partnerType === 'venue' && (
                                        <>
                                            <FormInput label="Approximate Capacity" icon={Users} name="capacity" value={formData.capacity} onChange={handleInputChange} required />
                                            <div className="space-y-3">
                                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Subscription Intent</label>
                                                <select
                                                    name="plan"
                                                    value={formData.plan}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold appearance-none focus:bg-white transition-all outline-none"
                                                >
                                                    <option value="basic">Basic Access</option>
                                                    <option value="silver">Silver Tier</option>
                                                    <option value="gold">Gold Premium</option>
                                                    <option value="diamond">Diamond Private</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {partnerType === 'host' && (
                                        <div className="space-y-3">
                                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Host Category</label>
                                            <select
                                                name="role"
                                                value={formData.role}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold appearance-none focus:bg-white transition-all outline-none"
                                            >
                                                <option value="dj">Individual DJ / Artist</option>
                                                <option value="organizer">Event Organizer</option>
                                                <option value="collective">Collective / Label</option>
                                            </select>
                                        </div>
                                    )}
                                    {partnerType === 'promoter' && (
                                        <>
                                            <FormInput label="Instagram Handle" icon={Users} name="instagram" placeholder="@username" value={formData.instagram} onChange={handleInputChange} required />
                                            <div className="space-y-3">
                                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Bio</label>
                                                <textarea
                                                    name="bio"
                                                    value={formData.bio}
                                                    onChange={(e: any) => handleInputChange(e)}
                                                    placeholder="Tell us about your reach and experience..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold appearance-none focus:bg-white transition-all outline-none min-h-[100px]"
                                                    required
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 text-white h-16 rounded-2xl font-bold uppercase tracking-widest text-sm hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                            >
                                {loading ? "Processing Submission..." : "Submit Registry Request"}
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                )}

                {step === "success" && (
                    <div className="text-center animate-in zoom-in-95 duration-700 pt-12">
                        <div className="h-24 w-24 rounded-[2.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-10 shadow-inner">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight mb-6">Request Submitted</h1>
                        <p className="text-slate-500 font-medium leading-relaxed mb-12">
                            Your application for <span className="text-slate-900 font-bold">{formData.name}</span> has been successfully logged in our registry. <br /><br />
                            The administration will review your details and issue access credentials via email once approved.
                        </p>

                        <div className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 mb-12 flex items-start gap-4 text-left">
                            <ShieldCheck className="h-6 w-6 text-indigo-600 flex-shrink-0" />
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-900 mb-1">Review Protocol 23-A</p>
                                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                    Our typical review window is 24-48 hours. If you haven't heard from us, please contact your account manager if pre-assigned.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push('/login')}
                            className="text-slate-900 font-black uppercase tracking-[0.2em] text-[10px] hover:underline"
                        >
                            Return to Login Portal
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white">Loading...</div>}>
            <OnboardingContent />
        </Suspense>
    );
}

function RoleCard({ icon: Icon, title, description, active, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`p-8 rounded-[2rem] border-2 text-left transition-all duration-500 group ${active ? 'bg-slate-900 border-slate-900 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
        >
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 ${active ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-400'
                }`}>
                <Icon className="h-6 w-6" />
            </div>
            <h3 className={`text-xl font-black mb-2 tracking-tight ${active ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <p className={`text-sm font-medium leading-relaxed ${active ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>
        </button>
    );
}

function FormInput({ label, icon: Icon, ...props }: any) {
    return (
        <div className="space-y-3">
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div className="relative group">
                {Icon && <Icon className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />}
                <input
                    className={`w-full bg-slate-50 border border-slate-200 rounded-2xl ${Icon ? 'pl-14' : 'px-6'} pr-6 py-4 text-sm font-bold focus:outline-none focus:border-slate-400 focus:bg-white transition-all placeholder:text-slate-300`}
                    {...props}
                />
            </div>
        </div>
    );
}

function SectionTitle({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{title}</span>
            <div className="h-px bg-slate-100 w-full" />
        </div>
    );
}
