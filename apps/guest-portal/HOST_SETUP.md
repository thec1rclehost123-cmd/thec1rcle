# Host System Setup

## Overview
We have implemented a Host Application and Verification system.
- **Host Application**: Users can apply to become a host from the About page.
- **Verification**: They must provide their Legal Name, ID Document, and Instagram Page Screenshot.
- **Storage**: Documents are uploaded to Firebase Storage under `hosts/{uid}/`.
- **Database**: Applications are saved in `host_applications` collection. User profile is updated with `hostStatus: 'pending'`.
- **Profile**: The profile page now displays a "Host" badge if `hostStatus` is 'approved', and "Host Pending" if 'pending'.

## Firebase Security Rules
You need to update your Firestore and Storage rules to allow these operations.

### Firestore Rules
```
match /host_applications/{applicationId} {
  allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
  allow read: if request.auth != null && (request.auth.uid == resource.data.uid || request.auth.token.admin == true);
}
match /users/{userId} {
  allow update: if request.auth != null && request.auth.uid == userId;
}
```

### Storage Rules
```
match /hosts/{userId}/{fileName} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## Approving Hosts
Currently, there is no Admin Dashboard. To approve a host:
1. Go to Firebase Console > Firestore.
2. Find the user in `users` collection.
3. Change `hostStatus` from `'pending'` to `'approved'`.
