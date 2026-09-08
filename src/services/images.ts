/**
 * Image utilities. Images are always copied into managed data URLs stored in
 * the DB — never referenced by their original file path. Large images are
 * downscaled to keep the local database compact.
 */

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_DIM = 1400; // px, longest edge
const QUALITY = 0.82;

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.includes(file.type.toLowerCase());
}

/** Read a File into a managed, downscaled data URL (JPEG/PNG). */
export async function fileToManagedDataUrl(file: File): Promise<string> {
  if (!isAcceptedImage(file)) {
    throw new Error('סוג קובץ לא נתמך. יש להשתמש ב-JPG, JPEG, PNG או WEBP.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  try {
    return await downscaleDataUrl(dataUrl, file.type);
  } catch {
    // If canvas processing fails, keep the original data URL (still managed copy).
    return dataUrl;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
    reader.readAsDataURL(file);
  });
}

export function downscaleDataUrl(dataUrl: string, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas לא זמין'));
      ctx.drawImage(img, 0, 0, w, h);
      const outMime = mime === 'image/png' ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(outMime, QUALITY));
    };
    img.onerror = () => reject(new Error('טעינת התמונה נכשלה'));
    img.src = dataUrl;
  });
}
