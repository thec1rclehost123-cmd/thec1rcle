# Dual-Approval Security Policy Restore Fix

This document outlines the problem, solution, and files changed regarding the dual-approval governance policy restoration for venue status actions in the admin console.

## Problem

In the administrator console actions API (`apps/admin-console/app/api/actions/route.js`), the dual-approval (maker-checker) security policy configuration was downgraded for critical venue actions:
* `VENUE_SUSPEND` was set to `false`.
* `VENUE_REINSTATE` was set to `false`.

By turning these settings off, any single administrator could unilaterally suspend or reinstate partner venues on the platform without requiring a second administrator's review and sign-off. This bypassed a critical safety control and increased the vulnerability of the system to rogue or compromised administrator accounts.

## Solution

We restored the configuration values to `true` inside `GOVERNANCE_CONFIG.DUAL_APPROVAL`:
```javascript
const GOVERNANCE_CONFIG = {
  DUAL_APPROVAL: {
    EVENT_PAUSE: true,
    VENUE_SUSPEND: true,
    VENUE_REINSTATE: true,
  },
};
```
Now, when an administrator triggers `VENUE_SUSPEND` or `VENUE_REINSTATE`, the action goes to the dual-approval pipeline. The action is proposed and saved as a pending task that must be explicitly approved by another admin before executing.

## Files Changed

* [apps/admin-console/app/api/actions/route.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/app/api/actions/route.js)
