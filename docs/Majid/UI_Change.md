# Create Event Wizard UI Changes

This document details the user interface changes made to the **Create Event Wizard** to align the steps with the mockup designs.

---

## 1. Identity & Headline Step

### Navigation & Headers
- **Tab Label**: Updated the 5th step configuration label to `% Sales` in [CreateEventWizardV2.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx).
- **Global Validation Banner**: Hidden from [WizardNavigation.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/WizardNavigation.tsx) on the `identity` step.
- **Removed Duplicate Header**: Updated [WizardNavigation.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/WizardNavigation.tsx) to hide the outer step header on the `identity` step, preventing duplication.
- **Unified Card Layout**:
  - Configured the step wrapper `motion.div` in [CreateEventWizardV2.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx) with the dark card styling (`bg-[#111113]`, subtle border, and rounded corners).
  - Integrated the Step Header rendering directly at the top of the unified card box.
  - Placed the navigation footer (Back, Save Draft, Continue) at the bottom inside the card, separated by a top border line.
- **Step Component Refactor**: Removed the card wrapper and header section from [IdentityStep.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/steps/IdentityStep.tsx), keeping it focused on only rendering inputs and validation messages within the parent card panel.
- **Sub-Header**: Added the bullet sub-header `• EVENT IDENTITY` (in indigo text) above the input fields.
- **Full Screen Available Content Area Expansion**:
  - Updated the main layout shell wrappers [VenueClientWrapper.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/layout/VenueClientWrapper.tsx) and [HostClientWrapper.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/layout/HostClientWrapper.tsx) to check `pathname.endsWith('/create')`.
  - When loading the `/create` route, the layout padding is set to `p-0` to allow the content container to stretch edge-to-edge.
  - Set the outermost page container background to `bg-[#111113]` in [CreateEventWizardV2.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx) so the black card panel color covers the entire layout section.
  - Updated the wizard parent container inside [CreateEventWizardV2.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx) to use `w-full px-6 pt-6 pb-6` to provide spacing inside the full screen card.

### Field Borders & Label Colors
- **Orange Borders on All Field Boxes**:
  - Added `border-orange/30` (C1RCLE brand orange `#F44A22` at 30% opacity) to the container borders of all fields:
    - **Event Title**: Container border changed from `border-border-subtle` to `border-orange/30`, focus state updated to `focus-within:border-orange/50`.
    - **Subtitle / Tagline**: Container border changed from `border-border-subtle` to `border-orange/30`, focus state updated to `focus-within:border-orange/50`.
    - **Description**: Container border changed from `border-border-subtle` to `border-orange/30`, focus state updated to `focus-within:border-orange/50`.
    - **Category**: Dropdown container border changed from `border-border-subtle` to `border-orange/30`, focus state updated to `focus-within:border-orange/50`.
    - **City / Hub**: Dropdown container border changed from `border-border-subtle` to `border-orange/30`, focus state updated to `focus-within:border-orange/50`.
    - **Capacity**: Container border changed from `border-border-subtle` to `border-orange/30`.
    - **Host**: Container border changed from `border-border-subtle` to `border-orange/30`.
    - **Venue**: All three container variants (auto-linked venue, prefilled slot, partnership selection) border changed from `border-border-subtle` to `border-orange/30`.
- **Brightened Label Font Colors**:
  - Changed label text color from `text-text-tertiary` (dim muted gray) to `text-text-primary` (bright white) for:
    - **EVENT TITLE ***
    - **Subtitle / Tagline (optional)**
    - **DESCRIPTION (OPTIONAL)**
    - **CAPACITY (OPTIONAL)**
  - This ensures these key field names are more visible against the dark background.

### Left Column Inputs
- **EVENT TITLE * **:
  - Added a light-indigo background container for a prefix `CalendarCheck` icon.
  - Placed the character counter `0 / 100` on the right side of the input.
  - Added helper text: `"Choose a short, catchy title that grabs attention"`.
- **Subtitle / Tagline (optional)**:
  - Added a light-emerald background container for a prefix `Tag` icon.
  - Placed the character counter `0 / 120` on the right.
  - Added helper text: `"A brief tagline adds more context to your event"`.
- **DESCRIPTION (OPTIONAL)**:
  - Added a light-amber background container for a prefix `FileText` icon.
  - Placed the character counter `0 / 1000` at the bottom-right corner.
  - Added helper text: `"Add more details to help people understand your event better"`.
- **CATEGORY & CITY Selectors**:
  - Rendered clean select dropdowns with chevron down arrows, without prefixing icons inside the selector container.
  - **Fixed Double Arrow Bug**: Applied inline CSS styling `appearance: 'none'` (along with Webkit and Moz prefix overrides) and `backgroundImage: 'none'` (with `bg-none` class) to fully suppress both browser-native and Tailwind forms plugin default select arrows.

### Right Column Sidebar Cards
- **CAPACITY (OPTIONAL)**:
  - Simplified container. Removed the decrement/increment plus/minus buttons. Features a clean Users icon prefix and standard numerical field.
- **HOST & VENUE**:
  - Restored clean styled blocks matching the mockup.
