import { getApiUrl } from "./api-url";

const BASE = getApiUrl("");

// ─── helpers ────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize; }
          else                { width  = Math.round((width  * maxSize) / height); height = maxSize; }
        }
        canvas.width  = width;
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

// ─── صور: ترسل عبر السيرفر (base64) ─────────────────────────────────────────

async function uploadViaServer(file: File, path: string): Promise<string> {
  const base64 = await fileToBase64(file);
  const token  = localStorage.getItem("glow_token") || "";
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ base64, path, contentType: file.type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "فشل الرفع" }));
    throw new Error(err.error || "فشل الرفع");
  }
  return (await res.json()).url as string;
}


// ─── exports ─────────────────────────────────────────────────────────────────

export async function uploadImageToFirebase(
  file: File, path: string, maxSize = 900, quality = 0.8
): Promise<string> {
  const blob = await compressToBlob(file, maxSize, quality);
  return uploadViaServer(new File([blob], file.name, { type: "image/jpeg" }), path);
}

export async function uploadProductImages(files: File[], userId: string): Promise<string[]> {
  return Promise.all(
    files.map((file, i) => uploadImageToFirebase(file, `products/${userId}/${Date.now()}-${i}.jpg`))
  );
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  return uploadImageToFirebase(file, `avatars/${userId}.jpg`, 400, 0.85);
}

export async function uploadStoryImage(file: File, userId: string): Promise<string> {
  return uploadImageToFirebase(file, `stories/${userId}/${Date.now()}.jpg`);
}

export async function uploadChatImage(file: File, conversationId: string): Promise<string> {
  return uploadImageToFirebase(file, `chat/${conversationId}/${Date.now()}.jpg`, 1200, 0.85);
}

export async function uploadDriverDocument(file: File, userId: string, type: "license" | "id" | "vehicle"): Promise<string> {
  return uploadImageToFirebase(file, `drivers/${userId}/${type}_${Date.now()}.jpg`, 1200, 0.85);
}

export async function uploadChatVoice(file: File, conversationId: string): Promise<string> {
  const base64 = await fileToBase64(file);
  const token = localStorage.getItem("glow_token") || "";
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ base64, path: `chat/${conversationId}/${Date.now()}.webm`, contentType: file.type || "audio/webm" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "فشل رفع التسجيل الصوتي" }));
    throw new Error(err.error || "فشل رفع التسجيل الصوتي");
  }
  return (await res.json()).url as string;
}
