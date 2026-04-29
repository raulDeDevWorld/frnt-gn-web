export function normalizeRoomKey(roomKey, defaultRoomKey = "public") {
  const value = String(roomKey || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 60);
  return value || defaultRoomKey;
}

export function mergeRooms(prev, incoming) {
  const map = new Map((prev || []).map((room) => [room.roomKey, room]));
  for (const room of incoming || []) {
    if (!room?.roomKey) continue;
    const current = map.get(room.roomKey) || {};
    map.set(room.roomKey, { ...current, ...room });
  }
  return [...map.values()].sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
}

export function upsertMessage(history, msg) {
  const list = history || [];

  if (msg.tempIdPlaceholder) {
    const idx = list.findIndex((m) => m.tempId === msg.tempIdPlaceholder);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = { ...next[idx], ...msg, tempId: undefined };
      return next;
    }
  }

  if (msg._id) {
    const idx = list.findIndex((m) => m._id === msg._id);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = { ...next[idx], ...msg };
      return next;
    }
  }

  return [...list, msg];
}

function compareMessageOrderAsc(a, b) {
  const seqA = Number(a?.seq);
  const seqB = Number(b?.seq);
  if (Number.isFinite(seqA) && Number.isFinite(seqB) && seqA !== seqB) {
    return seqA - seqB;
  }

  const timestampA = Number(a?.timestamp) || 0;
  const timestampB = Number(b?.timestamp) || 0;
  if (timestampA !== timestampB) {
    return timestampA - timestampB;
  }

  const idA = String(a?._id || "");
  const idB = String(b?._id || "");
  return idA.localeCompare(idB);
}

export function mergePrivateThread(existing, incoming) {
  const merged = [];
  const byId = new Map();
  const byTempId = new Map();

  for (const msg of [...(existing || []), ...(incoming || [])]) {
    if (!msg) continue;

    const persistedId = String(msg._id || "").trim();
    if (persistedId) {
      const correlationId = String(msg.tempIdPlaceholder || msg.clientMessageId || "").trim();
      if (correlationId) {
        const correlatedIdx = byTempId.get(correlationId);
        if (correlatedIdx !== undefined) {
          merged[correlatedIdx] = {
            ...merged[correlatedIdx],
            ...msg,
            tempId: undefined,
            tempIdPlaceholder: undefined,
          };
          byId.set(persistedId, correlatedIdx);
          continue;
        }
      }

      const idx = byId.get(persistedId);
      if (idx === undefined) {
        byId.set(persistedId, merged.length);
        merged.push(msg);
      } else {
        merged[idx] = { ...merged[idx], ...msg };
      }
      continue;
    }

    const tempId = String(msg.tempId || msg.tempIdPlaceholder || "").trim();
    if (tempId) {
      const idx = byTempId.get(tempId);
      if (idx === undefined) {
        byTempId.set(tempId, merged.length);
        merged.push(msg);
      } else {
        merged[idx] = { ...merged[idx], ...msg };
      }
      continue;
    }

    merged.push(msg);
  }

  return merged.sort(compareMessageOrderAsc);
}

export function buildDirectMessagePreview(message) {
  if (!message) return "";
  if (message.type === "text") return String(message.content || "").trim();
  if (message.type === "audio") return "Audio";
  if (message.type === "image") return "Imagen";
  if (message.type === "video") return "Video";
  return "Archivo";
}

export function mergeDirectThreads(prev, incoming) {
  const map = new Map((prev || []).map((thread) => [String(thread?.peerUserId || ""), thread]));

  for (const thread of incoming || []) {
    const peerUserId = String(thread?.peerUserId || "").trim();
    if (!peerUserId) continue;
    const current = map.get(peerUserId) || {};
    map.set(peerUserId, {
      ...current,
      ...thread,
      peerUserId,
      peerDisplayName: String(thread?.peerDisplayName || current?.peerDisplayName || peerUserId),
      lastMessagePreview: String(thread?.lastMessagePreview || current?.lastMessagePreview || ""),
      lastMessageAt: Number(thread?.lastMessageAt) || Number(current?.lastMessageAt) || 0,
    });
  }

  return [...map.values()].sort((a, b) => (Number(b?.lastMessageAt) || 0) - (Number(a?.lastMessageAt) || 0));
}
