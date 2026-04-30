"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import {
  buildDirectMessagePreview,
  mergeDirectThreads,
  mergePrivateThread,
  mergeRooms,
  normalizeRoomKey,
  upsertMessage,
} from "@/features/chat/domain/chat-thread.utils.js";

export function useChatSocket({
  socketRef,
  backendUrl,
  authToken,
  userId,
  profileCompleted,
  clearAuth,
  appendIncomingPost,
  upsertDirectThread,
  requestRoomPosts,
  defaultRoomKey,
  setAuthError,
  setActiveUsers,
  setPublicRooms,
  setDirectChatThreads,
  setPrivateChats,
  setRoomMessages,
}) {
  useEffect(() => {
    if (!userId || !authToken || !profileCompleted) return;

    const socket = io(backendUrl, {
      auth: { token: authToken },
    });
    socketRef.current = socket;

    socket.on("auth:error", () => {
      setAuthError("Sesion expirada. Inicia sesion nuevamente.");
      clearAuth();
    });

    socket.on("active-users", (users) => {
      setActiveUsers((users || []).filter((u) => u !== userId));
    });

    socket.on("room:list:result", (payload) => {
      if (!payload?.ok) return;
      setPublicRooms((prev) => mergeRooms(prev, payload.rooms || []));
    });

    socket.on("dm:list:result", (payload) => {
      if (!payload?.ok) return;
      setDirectChatThreads((prev) => mergeDirectThreads(prev, payload.threads || []));
    });

    socket.on("receive-message", (msg) => {
      if (msg?.private) {
        const incoming = { ...msg, mediaUrl: msg.mediaUrl || null, private: true };
        const otherUser = incoming.from === userId && incoming.to ? incoming.to : incoming.from;
        upsertDirectThread(otherUser, {
          lastMessagePreview: buildDirectMessagePreview(incoming),
          lastMessageAt: incoming.timestamp || Date.now(),
        });

        setPrivateChats((prev) => {
          const history = prev[otherUser] || [];
          return { ...prev, [otherUser]: mergePrivateThread(history, [incoming]) };
        });
        return;
      }

      const roomKey = normalizeRoomKey(msg?.roomKey || msg?.to || defaultRoomKey);
      const incoming = {
        ...msg,
        roomKey,
        to: roomKey,
        private: false,
        seen: true,
      };
      setRoomMessages((prev) => {
        const history = prev[roomKey] || [];
        return { ...prev, [roomKey]: upsertMessage(history, incoming) };
      });
    });

    socket.on("post:created", (post) => {
      appendIncomingPost(post);
    });

    socket.on("messages-seen-confirmed", ({ byUser, messageIds }) => {
      setPrivateChats((prev) => {
        if (!prev[byUser]) return prev;
        const updated = prev[byUser].map((m) =>
          m.from === userId && messageIds?.includes(m._id) ? { ...m, seen: true } : m
        );
        return { ...prev, [byUser]: updated };
      });
    });

    socket.on("pending-messages", (messages) => {
      (messages || []).forEach((msg) => {
        if (!msg?.private) return;
        const incoming = { ...msg, mediaUrl: msg.mediaUrl || null, private: true };
        const otherUser = incoming.from === userId && incoming.to ? incoming.to : incoming.from;
        upsertDirectThread(otherUser, {
          lastMessagePreview: buildDirectMessagePreview(incoming),
          lastMessageAt: incoming.timestamp || Date.now(),
        });
        setPrivateChats((prev) => {
          const history = prev[otherUser] || [];
          return { ...prev, [otherUser]: mergePrivateThread(history, [incoming]) };
        });
      });
    });

    const bootstrapOnConnect = () => {
      socket.emit("room:list");
      socket.emit("dm:list");
      socket.emit("room:join", { roomKey: defaultRoomKey });
      requestRoomPosts(defaultRoomKey);
    };

    socket.on("connect", bootstrapOnConnect);
    if (socket.connected) {
      bootstrapOnConnect();
    }

    return () => {
      socket.off("connect", bootstrapOnConnect);
      socket.disconnect();
    };
  }, [
    appendIncomingPost,
    authToken,
    backendUrl,
    clearAuth,
    defaultRoomKey,
    profileCompleted,
    requestRoomPosts,
    setActiveUsers,
    setAuthError,
    setDirectChatThreads,
    setPrivateChats,
    setPublicRooms,
    setRoomMessages,
    socketRef,
    upsertDirectThread,
    userId,
  ]);
}
