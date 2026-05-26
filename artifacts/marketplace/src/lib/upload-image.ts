import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

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
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
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

export async function uploadChatImage(
  file: File,
  conversationId: string
): Promise<string> {
  const path = `chat/${conversationId}/${Date.now()}.jpg`;
  return uploadImageToFirebase(file, path, 1200, 0.85);
}
