import { getApiUrl } from "./api-url";

const BASE = getApiUrl("");

/** Compress image to base64 (max 900px, 0.8 JPEG quality) */
function compressImage(file: File, maxSize = 900, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Upload to API server (Replit Object Storage) */
async function uploadToServer(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (onProgress) onProgress(10);
  const base64 = await compressImage(file, 1200, 0.85);
  if (onProgress) onProgress(60);

  const token = localStorage.getItem("glow_admin_token") ?? "";
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      base64,
      path,
      contentType: file.type,
    }),
  });

  if (onProgress) onProgress(90);
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  if (onProgress) onProgress(100);
  return data.url;
}

/** Upload with progress tracking */
export async function uploadToFirebaseWithProgress(
  file: File,
  path: string,
  onProgress: (progress: number) => void
): Promise<string> {
  return uploadToServer(file, path, onProgress);
}

/** Simple upload (no progress) */
export async function uploadToFirebase(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  return uploadToServer(file, path, onProgress);
}
