# DigiLocker API Integration - Use Case Document

## 1. Executive Summary

This document outlines the implementation of **DigiLocker as the PRIMARY authentication mechanism** for THE C1RCLE platform. 

**Key Implementation Highlights:**
- **DigiLocker is the main identity verification system** for ALL users (Venue Partners, Hosts, Promoters, Guests)
- **Age verification** for alcohol/liquor access at venues (21+ or 25+ age restrictions)
- **Mandatory KYC verification** for all partners and individuals on the platform
- Government-issued documents (Aadhaar, PAN) via DigiLocker API ensure authenticity and compliance

---

## 2. Why DigiLocker is the Primary Authentication

### 2.1 Security & Compliance Advantages

| Feature | Benefit |
|---------|---------|
| **Government-Verified Identity** | Eliminates fake identities and fraud |
| **Aadhaar-Based Age Verification** | Prevents underage access to alcohol/liquor venues |
| **Single Source of Truth** | UIDAI database as authoritative source |
| **Legal Compliance** | Meets RBI, UIDAI, and government regulatory requirements |
| **No Manual Verification** | Automated, instant identity validation |

### 2.2 Age Restriction Use Cases

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         AGE VERIFICATION FLOW                              │
└────────────────────────────────────────────────────────────────────────────┘

    VENUE CONFIGURATION                    USER ACCESS CHECK
    ─────────────────────                   ─────────────────

    ┌──────────────────┐                   ┌──────────────────┐
    │  Venue sets      │                   │  User attempts   │
    │  age restriction:│                   │  to enter venue  │
    │  • 21+           │                   │  or purchase     │
    │  • 25+           │                   │  alcohol tickets │
    │  • 18+           │                   └────────┬─────────┘
    │  • No restriction│                          │
    └────────┬─────────┘                          │
             │                                    ▼
             │                   ┌────────────────────────────┐
             └──────────────────▶│  CHECK:                    │
                                  │  • Is user 21+/25+?       │
                                  │  • DigiLocker DOB verified│
                                  └────────────┬───────────────┘
                                               │
                          ┌────────────────────┴────────────────────┐
                          │                                           │
                          ▼                                           ▼
                ┌──────────────────┐                     ┌──────────────────┐
                │    ✅ ACCESS      │                     │    ❌ DENIED      │
                │    ALLOWED       │                     │  Underage - Show  │
                │                  │                     │  age proof or    │
                │  - Full venue    │                     │  parent guardian  │
                │    access        │                     │                   │
                │  - Alcohol       │                     │  Ticket blocked  │
                │    purchase      │                     │  Entry rejected  │
                └──────────────────┘                     └──────────────────┘
```

---

## 3. User Types & Authentication Flow

### 3.1 User Categories (All Require DigiLocker Verification)

| User Type | Purpose | Verification Level | Documents Fetched |
|-----------|---------|-------------------|-------------------|
| **Venue Partner** | Business onboarding for venue hosting | **MANDATORY - Full KYC** | Aadhaar, PAN, Business Registration, Address Proof |
| **Host** | Event hosting on platform | **MANDATORY - Full KYC** | Aadhaar, PAN, Address Proof |
| **Promoter** | Event promotion and marketing | **MANDATORY - Full KYC** | Aadhaar, PAN |
| **Guest** | Event booking and attendance | **MANDATORY - Age Verification** | Aadhaar (DOB verified) |

### 3.2 Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│              DIGILOCKER AS PRIMARY AUTHENTICATION                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐
│  Landing  │───▶│  Select  │───▶│ DigiLocker   │───▶│  Consent │───▶│ Verify   │
│   Page    │    │   Role   │    │   Login      │    │   Screen │    │ Age/DOB  │
└──────────┘    └──────────┘    └──────────────┘    └──────────┘    └──────────┘
                        │               │               │               │
                        │               │               │               ▼
                        │               │               │       ┌──────────────┐
                        │               │               │       │  Platform    │
                        │               │               │       │    Access    │
                        │               │               │       │  Granted     │
                    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐       └──────────────┘
                    │ Venue   │    │  OAuth  │    │  Grant  │
                    │ Partner  │    │ 2.0    │    │  Access │
                    │ Host    │    │Redirect│    │         │
                    │Promoter │    │        │    │         │
                    │ Guest   │    └─────────┘    └──────────┘
                    └─────────┘

================================================================================
                    CRITICAL: ALL USERS MUST VERIFY VIA DIGILOCKER
================================================================================
```

---

## 4. Detailed Use Case Scenarios

### 4.1 Venue Partner Onboarding (MANDATORY VERIFICATION)

**Scenario:** A venue owner wants to list their venue on THE C1RCLE platform.

**CRITICAL:** This is a business/legal relationship requiring full identity verification as per government regulations.

**Step-by-Step Flow:**

1. **User visits** partner portal and clicks "Register Venue"
2. **Selects role:** Venue Partner
3. **MUST click** "Login with DigiLocker" (Primary authentication)
4. **Redirected** to DigiLocker OAuth consent screen
5. **User grants consent** to share Aadhaar, PAN, business documents
6. **DigiLocker returns** authorization code
7. **Our server exchanges** code for access token
8. **We fetch and verify:**
   - Aadhaar: Name, DOB, Address, Photo, Gender
   - PAN: Name, PAN Number, DOB
   - Business Registration documents
9. **Age verification:** Confirm 21+/25+ for venues serving alcohol
10. **Documents stored** securely with encryption
11. **Admin review** for business verification
12. **Account activated** with verified partner status

**Documents Fetched:**
- Aadhaar: Name, Date of Birth, Gender, Address, Photo
- PAN: Name, PAN Number, Date of Birth
- Business Registration (GST, Company/Firm registration)
- Address Proof

**Legal Compliance:** This verification satisfies:
- RBI KYC requirements for financial transactions
- Government API compliance for business onboarding
- Legal proof of authorized signatory for the business

### 4.2 Host Onboarding (MANDATORY VERIFICATION)

**Scenario:** An individual wants to host events on THE C1RCLE platform.

**CRITICAL:** Hosts handle bookings, payments, and attendee data - requires full identity verification.

**Step-by-Step Flow:**

1. **User visits** host portal and clicks "Become a Host"
2. **Clicks** "Login with DigiLocker" (Primary authentication)
3. **Completes** DigiLocker verification with Aadhaar + PAN
4. **Age verified:** DOB confirms 21+/25+ (required for events at alcohol-serving venues)
5. **Documents stored** securely
6. **Admin verification** of identity
7. **Host account activated**

**Documents Fetched:**
- Aadhaar: Identity verification, DOB for age confirmation
- PAN: Financial compliance (for payment settlements)

### 4.3 Promoter Onboarding (MANDATORY VERIFICATION)

**Scenario:** A promoter wants to market events on THE C1RCLE platform.

**Step-by-Step Flow:**

1. **User registers** as Promoter
2. **MUST verify** via DigiLocker (Primary authentication)
3. **Fetches** Aadhaar + PAN for identity
4. **Age verification** for venue access
5. **Account activated** after verification

### 4.4 Guest Authentication (MANDATORY FOR ALCOHOL VENUES)

**Scenario:** A user wants to book tickets for events.

**IMPORTANT:** Guests can use email/OTP for basic access, BUT:

- **For alcohol-serving venues:** MUST verify via DigiLocker for age proof
- **For premium features:** DigiLocker verification required
- **For age-restricted events:** Age verification mandatory

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUEST VERIFICATION LEVELS                    │
└─────────────────────────────────────────────────────────────────┘

Level 1: Basic Guest (Email/Phone OTP)
├── Limited platform access
├── Cannot purchase alcohol-inclusive tickets
└── Cannot enter 21+/25+ restricted venues

Level 2: Verified Guest (DigiLocker)
├── Full platform access
├── Can purchase all ticket types
├── Can enter age-restricted venues
├── Age verified via Aadhaar DOB
└── Loyalty program eligibility
```

---

## 5. Age Verification for Alcohol/Liquor Access

### 5.1 How It Works

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   AGE VERIFICATION FOR ALCOHOL ACCESS                      │
└────────────────────────────────────────────────────────────────────────────┘

    STEP 1: VENUE CONFIGURATION
    ───────────────────────────
    Venue owner sets age restriction at venue level:
    
    ┌────────────────────────────────────┐
    │ Venue Settings                     │
    ├────────────────────────────────────┤
    │ Age Restriction: [ 21+ ▼ ]         │
    │                                     │
    │ ○ No restriction                   │
    │ ● 21+ (Standard alcohol)          │
    │ ○ 25+ (Premium/High-end venues)   │
    │ ○ 18+ (Beer/light drinks only)    │
    └────────────────────────────────────┘

    STEP 2: USER TICKET PURCHASE
    ────────────────────────────
    When user selects alcohol-inclusive ticket:
    
    IF user.age >= venue.ageRequirement:
        ✅ ALLOW purchase
    ELSE:
        ❌ BLOCK - "Age verification required"
        └─ Prompt DigiLocker verification

    STEP 3: DOOR ENTRY CHECK
    ────────────────────────
    At venue entry:
    
    Scanner reads ticket → Checks age flag → 
    If age verified: GRANT entry
    If not verified: DENY with prompt to verify
```

### 5.2 Age Categories

| Age Limit | Venue Type | Access Level |
|-----------|------------|--------------|
| 18+ | Beer gardens, family venues | Beer, low-alcohol drinks only |
| 21+ | Standard bars, lounges | Full bar, most alcohol |
| 25+ | Premium clubs, exclusive venues | Premium alcohol, VIP access |

---

## 6. UI/UX Wireframes

### 6.1 Landing Page - PRIMARY AUTHENTICATION

```
┌─────────────────────────────────────────────────────────────────┐
│  THE C1RCLE                                        [Logo]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Welcome to THE C1RCLE                        │
│                                                                 │
│         The premier venue discovery and event platform          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     🔐 LOGIN WITH DIGILOCKER (PRIMARY)                 │   │
│  │                                                         │   │
│  │    ───────────────────────────────────────────────      │   │
│  │    MANDATORY for Partners & Alcohol Venue Access        │   │
│  │    ───────────────────────────────────────────────      │   │
│  │                                                         │   │
│  │         Secure • Verified • Compliant                   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ───────────────────────────────────────────────────────────   │
│                                                                 │
│  Why DigiLocker?                                                │
│  ✅ Government-verified identity                               │
│  ✅ Instant age verification for alcohol access                │
│  ✅ Legal compliance for partner verification                  │
│  ✅ KYC-ready for payment processing                           │
│                                                                 │
│  ───────────────────────────────────────────────────────────   │
│                                                                 │
│   By signing up, you agree to our Terms and Privacy Policy     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Role Selection - With Verification Labels

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELECT YOUR ROLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  All users must verify identity via DigiLocker                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🏢  VENUE PARTNER                              [VERIFIED] │ │
│  │      ─────────────────────────────────────────────────    │ │
│  │      List & manage venues • Full KYC required             │ │
│  │      ⚠️ Legal compliance - Business verification          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🎤  HOST                                    [VERIFIED]   │ │
│  │      ─────────────────────────────────────────────────    │ │
│  │      Host events • Age verified for alcohol venues       │ │
│  │      ⚠️ KYC required for payment settlements             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📢  PROMOTER                               [VERIFIED]   │ │
│  │      ─────────────────────────────────────────────────    │ │
│  │      Promote events • Identity verification required     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🎫  GUEST                                    [VERIFIED] │ │
│  │      ─────────────────────────────────────────────────    │ │
│  │      Discover events • Age verification for alcohol      │ │
│  │      (Required for 21+/25+ venue access)                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Age Verification Consent Screen

```
┌─────────────────────────────────────────────────────────────────┐
│                   AGE VERIFICATION CONSENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔐 DigiLocker Identity Verification                            │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  📄 Documents Required:                                         │
│                                                                 │
│     ☑ Aadhaar (Identity + DOB for age verification)            │
│     ☑ PAN (Financial compliance)                               │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  🎯 Purpose of Verification:                                    │
│                                                                 │
│     1. IDENTITY - Confirm real person identity                │
│                                                                 │
│     2. AGE - Verify 21+/25+ for:                               │
│        • Alcohol-inclusive ticket purchases                   │
│        • Entry to age-restricted venues                       │
│        • Premium venue access                                  │
│                                                                 │
│     3. LEGAL - KYC compliance for:                             │
│        • Partner/Host business onboarding                      │
│        • Payment processing                                   │
│        • Government API requirements                           │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ⚠️ IMPORTANT - Alcohol Access:                                │
│     You MUST be 21+/25+ (per venue requirements) to:           │
│     • Purchase tickets with alcohol packages                  │
│     • Enter venues serving alcohol                            │
│     • Access premium/lounge areas                             │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│        [Cancel]                    [Verify & Continue]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Technical Implementation

### 7.1 API Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SYSTEM ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
  │   Client    │         │   Gateway   │         │   DigiLocker│
  │  (Frontend) │────────▶│   (Fastify) │────────▶│     API     │
  └─────────────┘         └─────────────┘         └─────────────┘
                                │
                                ▼
                        ┌─────────────┐
                        │  Database   │
                        │ (Firestore) │
                        └─────────────┘
```

### 7.2 Age Verification Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AGE CHECK ALGORITHM                              │
└─────────────────────────────────────────────────────────────────────┘

FUNCTION verifyAgeForVenue(userId, venueId):
    
    // 1. Get user age from DigiLocker-verified Aadhaar DOB
    userAge = getUserAgeFromAadhaar(userId)  // Calculated from DOB
    
    // 2. Get venue age requirement
    venueAgeReq = getVenueAgeRestriction(venueId)  // 18, 21, or 25
    
    // 3. Check if user has verified DOB
    IF NOT user.hasVerifiedDOB:
        RETURN BLOCKED - "DigiLocker verification required for age-restricted venues"
    
    // 4. Compare ages
    IF userAge >= venueAgeReq:
        RETURN ALLOWED - "Age verified - Access granted"
    ELSE:
        RETURN BLOCKED - f"Minimum age required: {venueAgeReq}+"
    
END FUNCTION
```

### 7.3 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/digilocker/init` | GET | Initialize OAuth flow (Primary auth) |
| `/api/v1/auth/digilocker/callback` | GET | OAuth callback handler |
| `/api/v1/auth/digilocker/documents` | GET | Fetch user documents |
| `/api/v1/auth/digilocker/age-verify` | POST | Verify user age for venue |
| `/api/v1/user/kyc/status` | GET | Check KYC verification status |
| `/api/v1/user/age/status` | GET | Check age verification status |
| `/api/v1/venues/:id/age-requirement` | GET | Get venue age restriction |

### 7.4 Security Measures

| Measure | Implementation |
|---------|----------------|
| **TLS 1.3** | All API communication encrypted |
| **Token Storage** | Access tokens stored in secure vault |
| **Document Encryption** | AES-256 encryption at rest |
| **DOB Hash Protection** | DOB stored as hash for privacy |
| **Audit Logging** | All document access logged |
| **Consent Verification** | Each document access logged with consent |
| **Age Flag Integrity** | Age status cannot be spoofed |

---

## 8. Legal Compliance

### 8.1 Data Handling as per DPIA

- **Purpose:** Identity verification + Age verification for alcohol compliance
- **Legal Basis:** User consent + legitimate business interest + legal obligation
- **Data Minimization:** Only essential identity fields + DOB
- **Storage Duration:** Account lifetime + 7 years (legal requirement)
- **User Rights:** Export, delete, correction available

### 8.2 Aadhaar Data Usage (UIDAI Compliance)

- **Verification Only:** Aadhaar used solely for identity + age verification
- **No Storage of Aadhaar Number:** Stored as masked reference
- **No Uploading:** Documents fetched via official API, not uploaded
- **Consent Explicit:** User must explicitly grant each document access
- **DOB Usage:** Only for age calculation - not stored as plain text

### 8.3 Alcohol/Age Compliance

- **State Laws:** Comply with local state alcohol regulations
- **Age Gating:** Strict enforcement of 21+/25+ for restricted venues
- **Audit Trail:** Complete logging of age verification for legal defense
- **Liability Protection:** Age verification prevents legal liability for underage service

### 8.4 GDPR/Privacy Compliance

- User can request complete data export
- User can request data deletion
- 30-day response time for data requests
- Annual privacy audit scheduled

---

## 9. Approval Checklist for Government API

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Use case document | ✅ Complete | This document |
| UI/UX wireframes | ✅ Complete | Section 6 |
| User flow diagram | ✅ Complete | Section 3 |
| Technical architecture | ✅ Complete | Section 7 |
| Age verification logic | ✅ Complete | Section 5 |
| Security measures | ✅ Complete | Section 7.4 |
| Legal compliance | ✅ Complete | Section 8 |
| Privacy policy | ✅ Available | https://thec1rcle.com/privacy |
| Terms of service | ✅ Available | https://thec1rcle.com/terms |
| Data protection officer | ✅ Appointed | compliance@thec1rcle.com |

---

## 10. Conclusion

This document demonstrates THE C1RCLE's implementation of **DigiLocker as the PRIMARY authentication system** with specific focus on:

- ✅ **Mandatory identity verification** for all partners and hosts
- ✅ **Age verification** for alcohol/liquor access (21+/25+)
- ✅ **Government API compliance** for business onboarding
- ✅ **Legal compliance** for KYC and payment processing
- ✅ **UIDAI-compliant** Aadhaar usage
- ✅ **Robust security** for document storage

Our implementation ensures that:
1. **Every partner/host is verified** before business operations
2. **Every guest accessing alcohol venues** is age-verified
3. **Legal requirements** are met for government API usage
4. **Underage access is prevented** through automated age checks

We are ready for technical integration and await approval to proceed with the API setup.

---

**Submitted by:** THE C1RCLE Development Team  
**Date:** May 11, 2026  
**Contact:** thec1rcle.host123@gmail.com