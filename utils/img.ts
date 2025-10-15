export async function resizeToWebp(file: File, maxW = 1000, quality = 0.76) {
  const bmp = await createImageBitmap(file);
  const ratio = bmp.width > maxW ? maxW / bmp.width : 1;
  const width = Math.round(bmp.width * ratio);
  const height = Math.round(bmp.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true })!;
  ctx.drawImage(bmp, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")), "image/webp", quality);
  });

  // Nombre .webp
  const base = (file.name.replace(/\.\w+$/, "") || "image") + ".webp";
  const webp = new File([blob], base, { type: "image/webp", lastModified: Date.now() });

  return { webp, width, height, bytes: webp.size, mime: webp.type };
}
