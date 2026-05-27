import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorage } from "firebase/storage";
import { initializeApp, getApps } from "firebase/app";

// Initialize Firebase if not already initialized
const app = getApps().length ? getApps()[0]! : initializeApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID || "",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "",
});

const storage = getStorage(app);

/** Upload a file directly to Firebase Storage (fallback for Render where Object Storage is unavailable) */
export async function uploadToFirebase(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const storageRef = ref(storage, path);

  // Use uploadBytes with metadata
  await uploadBytes(storageRef, file, { contentType: file.type });

  // Get public download URL
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/** Upload with progress simulation (Firebase doesn't support native progress) */
export async function uploadToFirebaseWithProgress(
  file: File,
  path: string,
  onProgress: (progress: number) => void
): Promise<string> {
  // Simulate progress since Firebase uploadBytes doesn't expose progress
  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 15, 90);
    onProgress(Math.round(progress));
  }, 300);

  try {
    const url = await uploadToFirebase(file, path);
    clearInterval(interval);
    onProgress(100);
    return url;
  } catch (err) {
    clearInterval(interval);
    throw err;
  }
}
