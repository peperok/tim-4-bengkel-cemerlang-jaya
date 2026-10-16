import imageCompression from "browser-image-compression";

/**
 * Kompresi foto PRD 11.4:
 * Sisi terpanjang maksimal 1600 px, format WebP, mutu 0.8, target < 400 KB.
 */
export async function kompresFotoUtama(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: 0.8,
  };
  try {
    return await imageCompression(file, options);
  } catch {
    return file;
  }
}

/**
 * Buat thumbnail foto PRD 11.4:
 * Lebar maksimal 320 px, format WebP, mutu 0.7.
 */
export async function kompresThumbnail(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.08,
    maxWidthOrHeight: 320,
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: 0.7,
  };
  try {
    return await imageCompression(file, options);
  } catch {
    return file;
  }
}
