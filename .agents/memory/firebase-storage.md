---
name: Firebase Storage Not Set Up
description: Firebase Storage bucket gaytak-45ae1.firebasestorage.app returns 404; bucket was never created
---

The Firebase Storage bucket `gaytak-45ae1.firebasestorage.app` does not exist (returns 404 via REST API even with API key). Firebase Admin SDK, @google-cloud/storage SDK, and REST API all fail with 404 "Not Found".

**Why:** Firebase Storage bucket was never initialized in the Firebase Console for project gaytak-45ae1. All server-side and client-side attempts to use Firebase Storage will fail until the bucket is created.

**How to apply:** Do NOT attempt to use Firebase Storage for this project. Use Replit Object Storage instead (works via objectStorageClient sidecar at 127.0.0.1:1106). If Firebase Storage is needed on Render, the user must first go to Firebase Console → Storage → Get Started to create the bucket.
