# Orphaned Invitations on Email Failure Fix

This document outlines the problem, solution, and files changed regarding the orphaned admin invitation clean-up fix.

## Problem

In the administrator invitation endpoint (`apps/admin-console/app/api/admins/team/route.js`), the invite process was non-transactional:
1. It created a Firebase Auth user account.
2. It wrote a pending invitation document to Firestore.
3. It attempted to send the invitation email.

If the email dispatch failed (e.g., due to an outage, network error, or invalid API key), the error was logged but swallowed. The API still returned a `200 OK` success response. 
Since the generated temporary password was never stored in the database for security reasons, the recipient never received the email and could never log in to accept the invite. This left the database in a broken "orphaned" state (with a pending invitation doc and a Firebase Auth user that could never be accessed).

## Solution

We introduced a transactional rollback cleanup flow in the invite handler:
1. We keep a reference to any newly created Firebase Auth account (`createdUser`).
2. We wrap the database write in a try/catch block. If the database write fails, we delete the newly created Firebase user.
3. We check the return value of the email dispatch call (`sendAdminInvitationEmail`). Since the email helper catches errors internally and returns `{ success, error }`, we check if `!emailResult.success`. If the email fails to send, we:
   - Delete the newly created Firestore invitation document.
   - Delete the newly created Firebase Auth user.
   - Throw the error so that the API returns a proper `500 Internal Server Error` instead of a silent, false `200 OK` success response.

## Files Changed

* [apps/admin-console/app/api/admins/team/route.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/app/api/admins/team/route.js)
