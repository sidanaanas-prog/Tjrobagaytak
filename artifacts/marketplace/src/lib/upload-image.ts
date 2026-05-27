import { getApiUrl } from "./api-url";

const BASE = getApiUrl("");

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadViaServer(file: File, path: string): Promise<string> {
  const base64 = await fileToBase64(file);
  const token = localStorage.getItem("glow_token") || "";
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ base64, path, contentType: file.type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "فشل الرفع" }));
    throw new Error(err.error || "فشل الرفع");
  }
  const { url } = await res.json();
  return url;
}

function compressToBlob(file: File, maxSize = 900, quality = 0.8): Promise<Blob> {
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
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("تعذر ضغط الصورة"));
        }, "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadImageToFirebase(
  file: File,
  path: string,
  maxSize = 900,
  quality = 0.8
): Promise<string> {
  const blob = await compressToBlob(file, maxSize, quality);
  const uploadFile = new File([blob], file.name, { type: "image/jpeg" });
  return uploadViaServer(uploadFile, path);
}

export async function uploadProductImages(
  files: File[],
  userId: string
): Promise<string[]> {
  const uploads = files.map((file, i) => {
    const path = `products/${userId}/${Date.now()}-${i}.jpg`;
    return uploadImageToFirebase(file, path);
  });
  return Promise.all(uploads);
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const path = `avatars/${userId}.jpg`;
  return uploadImageToFirebase(file, path, 400, 0.85);
}

export async function uploadStoryImage(file: File, userId: string): Promise<string> {
  const path = `stories/${userId}/${Date.now()}.jpg`;
  return uploadImageToFirebase(file, path);
}

export async function uploadStoryVideo(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "mp4";
  const path = `stories/${userId}/${Date.now()}.${ext}`;
  return uploadViaServer(file, path);
}

export async function uploadChatImage(
  file: File,
  conversationId: string
): Promise<string> {
  const path = `chat/${conversationId}/${Date.now()}.jpg`;
  return uploadImageToFirebase(file, path, 1200, 0.85);
}
