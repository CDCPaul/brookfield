/**
 * Shrinks a photo in the browser before uploading.
 *
 * A phone screenshot is far larger than it needs to be for someone to read a
 * GCash reference off it, and residents are often on mobile data. If anything
 * goes wrong — an image format the browser cannot decode, a missing canvas —
 * the original file is returned rather than failing the upload.
 */

const MAX_EDGE = 1400;
const QUALITY = 0.75;

export async function compressImage(file: File): Promise<File> {
  if (typeof document === 'undefined') return file;
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', QUALITY);
    });
    if (!blob) return file;

    // Keep the original if re-encoding did not actually help.
    if (blob.size >= file.size) return file;

    return new File([blob], 'payment-proof.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
