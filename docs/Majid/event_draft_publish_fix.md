# event_draft_publish_fix.md — Event Draft Publishing Bug Fix

## 1. Problem Overview
When a venue partner attempted to edit and resume an existing event draft from their dashboard drafts list, clicking the **Publish Now** confirmation button failed silently (nothing happened, and the modal stayed open). 

---

## 2. Root Cause Analysis
1. **Time Strip on Save**: The core event builder `buildEvent` in `packages/core/event-engine.js` did not define or map `startTime` and `endTime` fields. Any time an event was saved or updated as a draft, these fields were completely stripped from the Firestore payload.
2. **Time Loss on Draft Load**: When `CreateEventWizardV2.tsx` loaded the draft from the database, it did:
   ```typescript
   setFormData(remote);
   ```
   Since `startTime` and `endTime` were missing from the database record, they became `undefined` in `formData` (overwriting the defaults of `'21:00'` and `'03:00'`).
3. **Silent Validation Failure**: The validation for the final `review` step requires these fields:
   ```typescript
   if (!formData.startDate || !formData.startTime || !formData.endTime) {
     validation.review.issues.push('Event date and time must be selected before publishing');
     validation.review.isValid = false;
   }
   ```
   Because `startTime`/`endTime` were `undefined`, validation failed. The wizard's navigation footer and confirmation modal do not render validation `issues` text, so `handleSubmit(false)` exited silently with no feedback.

---

## 3. Resolution
We resolved the issue in both the core domain engine and the wizard UI:

### A. Core Engine Updates (`packages/core`)
- **File**: `packages/core/event-engine.js` ([event-engine.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/packages/core/event-engine.js#L122-L126))
  - Updated `buildEvent` to preserve `startTime` and `endTime` from payloads during creation and updates:
    ```javascript
    startTime: payload.startTime || '',
    endTime: payload.endTime || '',
    ```
- **File**: `packages/core/event-engine.d.ts` ([event-engine.d.ts](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/packages/core/event-engine.d.ts#L42-L46))
  - Declared `startTime` and `endTime` in the return type of `buildEvent`.

### B. Wizard V2 Updates (`apps/partner-dashboard`)
- **File**: `apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx` ([CreateEventWizardV2.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx#L637-L641))
  - Added a fallback helper in remote draft parsing:
    ```typescript
    const remote = {
      ...data.event,
      startTime: data.event.startTime || '21:00',
      endTime: data.event.endTime || '03:00',
    };
    ```
  - This ensures that existing drafts without times still validate and publish successfully.

---

## 4. Verification & Testing Status
- Verified monorepo typescript compilation: `npm run type-check` succeeded with all tasks compiling perfectly.
