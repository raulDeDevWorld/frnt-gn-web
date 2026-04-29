// ------------------------------------------------------------------
// --- 1. Funciones Auxiliares ---
// ------------------------------------------------------------------



export const formatTime = (time) => {
  if (!isFinite(time) || isNaN(time)) return "00:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const getMediaURLFromBase64 = (base64Data, fileType) => {
  if (!base64Data || typeof base64Data !== 'string') return "";
  const type = fileType || "application/octet-stream";
  try {
    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return URL.createObjectURL(new Blob([ab], { type }));
  } catch (e) {
    console.error(e);
    return "";
  }
};

// ID constante
export const generateUserId = () => "user-" + Math.floor(Math.random() * 9999);
