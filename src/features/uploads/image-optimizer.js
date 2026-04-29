function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo codificar imagen"));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function optimizeImageForUpload(file, maxBytes) {
  if (!file || !file.type?.startsWith("image/")) {
    return {
      blob: file,
      fileName: file?.name || "file",
      fileType: file?.type || "application/octet-stream",
      fileSize: Number(file?.size) || 0,
      optimized: false,
    };
  }

  if ((Number(file.size) || 0) <= maxBytes) {
    return {
      blob: file,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      optimized: false,
    };
  }

  const { width, height } = await readImageDimensions(file);
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("No se pudo cargar imagen para optimizar"));
    image.src = objectUrl;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Canvas no disponible para optimizacion");
  }

  const scales = [1, 0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.4];
  const qualities = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5];
  const preferredType = "image/webp";
  let bestBlob = null;

  try {
    for (const scale of scales) {
      const targetWidth = Math.max(320, Math.floor(width * scale));
      const targetHeight = Math.max(320, Math.floor(height * scale));

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.clearRect(0, 0, targetWidth, targetHeight);
      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, preferredType, quality);
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }
        if (blob.size <= maxBytes) {
          const safeBaseName = String(file.name || "image")
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(0, 70);
          return {
            blob,
            fileName: `${safeBaseName || "image"}.webp`,
            fileType: preferredType,
            fileSize: blob.size,
            optimized: true,
          };
        }
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  if (!bestBlob) {
    throw new Error("No se pudo optimizar imagen");
  }

  const safeBaseName = String(file.name || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 70);

  return {
    blob: bestBlob,
    fileName: `${safeBaseName || "image"}.webp`,
    fileType: preferredType,
    fileSize: bestBlob.size,
    optimized: true,
  };
}
