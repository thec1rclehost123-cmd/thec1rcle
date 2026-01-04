# Firebase Security Rules Update

The "Permission denied" error occurs because your Firebase Security Rules are blocking the new Host features. You need to update them in the Firebase Console.

## 1. Firestore Rules
Go to **Firebase Console > Firestore Database > Rules** and replace your rules with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow users to read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow creating host applications
    match /host_applications/{applicationId} {
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow read: if request.auth != null && (request.auth.uid == resource.data.uid || request.auth.token.admin == true);
    }
    
    // Allow reading events (public)
    match /events/{eventId} {
      allow read: if true;
      allow write: if request.auth != null; // Ideally restrict this to hosts/admins
    }
    
    // Allow orders
    match /orders/{orderId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && (resource.data.userId == request.auth.uid || resource.data.eventHostId == request.auth.uid);
    }
  }
}
```

## 2. Storage Rules
Go to **Firebase Console > Storage > Rules** and replace your rules with this:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Allow hosts to upload verification documents
    match /hosts/{userId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow public access to event images (if you upload them)
    match /events/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```
