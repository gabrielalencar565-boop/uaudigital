// Re-frames an image to an exact Instagram size by cropping its center ("cover": the whole frame is filled, nothing is
// stretched and no bars are added). Used when several photos are added at once; each one can then be re-framed by hand
// with "Ajustar" in the publication panel.
export async function fitImageToFormat(file: File, format: { width: number; height: number }): Promise<File> {
  // honors the EXIF orientation, so phone photos are not rotated
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const targetRatio = format.width / format.height;
    const srcRatio = bitmap.width / bitmap.height;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (srcRatio > targetRatio) sw = Math.round(bitmap.height * targetRatio);
    else sh = Math.round(bitmap.width / targetRatio);
    const sx = Math.round((bitmap.width - sw) / 2);
    const sy = Math.round((bitmap.height - sh) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = format.width;
    canvas.height = format.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não consegui processar a imagem neste navegador.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, format.width, format.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!blob) throw new Error("Não consegui gerar a imagem ajustada.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
