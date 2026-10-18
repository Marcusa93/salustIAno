/**
 * Achica la foto de la cámara antes de subirla: menos espera con datos
 * móviles y la polaroid aparece al instante. Si el navegador no puede
 * decodificarla (ej. HEIC fuera de Safari), se sube tal cual.
 */
export async function shrinkPhoto(
  file: Blob,
  maxSide = 1600,
  quality = 0.86,
): Promise<{ blob: Blob; width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Sin canvas.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) throw new Error('Sin blob.');
    return { blob, width, height };
  } catch {
    return { blob: file, width: null, height: null };
  }
}
