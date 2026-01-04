# 🏛️ Club Manager Dashboard - Technical Specification

## 1. Architecture Overview
**Root Path:** `/club`
**Role:** Club Operating System (POS, CRM, Ops)
**Target Users:** Club Owners, Managers, Security, Staff

## 2. Directory Structure (`apps/dashboards/app/club`)
```text
/club
  /layout.tsx       -> Main Shell (Sidebar, Auth Guard, Role Check)
  /page.tsx         -> Dashboard Home (Stats, Widgets)
  /calendar         -> The "Single Source of Truth"
  /events           -> Event Lifecycle Management
  /tables           -> Inventory & Reservations
  /staff            -> Role Management & Access
  /registers        -> Digital Ops Logs
  /settings         -> Club Configuration
  /security         -> Entry Logs & Gate Control
```

## 3. Database Schema (Firestore)

### Core Club Data
`venues/{venueId}` (Existing)
- Added Fields:
  - `metrics`: { `rating`, `crowdScore`, `capacityUtilization` }
  - `settings`: { `defaultEntryRules`, `autoLockTime` }

### Staff & Access Control
`venues/{venueId}/staff/{staffId}`
```typescript
interface StaffMember {
  uid: string;
  role: 'OWNER' | 'MANAGER' | 'FLOOR' | 'SECURITY' | 'OPS';
  permissions: Permission[];
  isActive: boolean;
  name: string;
  phone: string;
  passcode?: string; // High-security operations
}
```

### Digital Registers
`venues/{venueId}/daily_logs/{dateStr}`
```typescript
interface DailyLog {
  date: string;
  status: 'OPEN' | 'CLOSED';
  openingNotes: string;
  closingNotes: string;
  incidents: Incident[];
  vipVisits: Visit[];
  authorityVisits: Visit[];
  staffOnDuty: string[]; // staffIds
}
```

### Table Inventory
`venues/{venueId}/tables/{tableId}`
```typescript
interface Table {
  label: string; // "VIP-1"
  zone: string; // "Dance Floor"
  capacity: number;
  minSpend: number;
  isBookableOnline: boolean;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED';
  currentSessionId?: string;
}
```

## 4. Role-Based Access Control (RBAC)
| Feature | Owner | Manager | Floor | Security | Ops |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Financials** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Staff Mgmt** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Events** | ✅ | ✅ | 👀 | ❌ | 👀 |
| **Tables** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Security** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Registers** | ✅ | ✅ | ❌ | ❌ | ✅ |

*Legend: ✅ = Full Access, 👀 = View Only, ❌ = No Access*

## 5. Implementation Phases
1.  **Core Shell**: Layout, Sidebar, Authentication, Role Guard.
2.  **Home Dashboard**: Live Widget Components.
3.  **Calendar Module**: Scheduling System.
4.  **Staff Module**: User Management.
5.  **Ops Registers**: Logging System.
