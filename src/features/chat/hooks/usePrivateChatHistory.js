"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDirectMessagePreview, mergePrivateThread } from "@/features/chat/domain/chat-thread.utils.js";

export function usePrivateChatHistory({
  socketRef,
  selectedUser,
  isChatsView,
  showPrivateChat,
  currentMessages,
  userId,
  bottomRef,
  chatHistoryPageSize,
  chatScrollTopThreshold,
  setPrivateChats,
  upsertDirectThread,
}) {
  const [privateChatPaging, setPrivateChatPaging] = useState({});
  const privateChatPagingRef = useRef({});
  const skipNextPrivateAutoScrollRef = useRef(false);

  useEffect(() => {
    privateChatPagingRef.current = privateChatPaging;
  }, [privateChatPaging]);

  const requestPrivateHistory = useCallback(
    (peerUserId, options = {}) => {
      if (!socketRef.current) return;

      const peerId = String(peerUserId || "").trim();
      if (!peerId) return;

      const appendOlder = Boolean(options?.appendOlder);
      const beforeSeqNumber = Number(options?.beforeSeq);
      const beforeSeq =
        Number.isFinite(beforeSeqNumber) && beforeSeqNumber > 0
          ? Math.floor(beforeSeqNumber)
          : null;
      const current = privateChatPagingRef.current[peerId] || {};

      if (current.loading || current.loadingMore) return;
      if (appendOlder && current.hasMore === false) return;

      setPrivateChatPaging((prev) => ({
        ...prev,
        [peerId]: {
          ...(prev[peerId] || {}),
          loading: appendOlder ? false : true,
          loadingMore: appendOlder ? true : false,
        },
      }));

      socketRef.current.emit(
        "dm:history",
        {
          peerUserId: peerId,
          limit: chatHistoryPageSize,
          ...(beforeSeq ? { beforeSeq } : {}),
        },
        (payload) => {
          if (!payload?.ok) {
            if (appendOlder) {
              skipNextPrivateAutoScrollRef.current = false;
            }
            setPrivateChatPaging((prev) => ({
              ...prev,
              [peerId]: {
                ...(prev[peerId] || {}),
                loading: false,
                loadingMore: false,
              },
            }));
            return;
          }

          const incomingMessages = (payload.messages || []).map((msg) => ({
            ...msg,
            mediaUrl: msg.mediaUrl || null,
            private: true,
          }));
          const newestMessage = incomingMessages.length ? incomingMessages[incomingMessages.length - 1] : null;
          if (newestMessage) {
            upsertDirectThread(peerId, {
              lastMessagePreview: buildDirectMessagePreview(newestMessage),
              lastMessageAt: newestMessage.timestamp || Date.now(),
            });
          }
          if (appendOlder && !incomingMessages.length) {
            skipNextPrivateAutoScrollRef.current = false;
          }

          setPrivateChats((prev) => {
            const existing = prev[peerId] || [];
            return { ...prev, [peerId]: mergePrivateThread(existing, incomingMessages) };
          });

          setPrivateChatPaging((prev) => ({
            ...prev,
            [peerId]: {
              ...(prev[peerId] || {}),
              initialized: true,
              loading: false,
              loadingMore: false,
              hasMore: Boolean(payload.hasMore),
              nextBeforeSeq: payload.nextBeforeSeq || null,
            },
          }));
        }
      );
    },
    [chatHistoryPageSize, setPrivateChats, socketRef, upsertDirectThread]
  );

  const loadOlderPrivateMessages = useCallback(() => {
    if (!isChatsView || !selectedUser) return;
    const peerId = String(selectedUser || "").trim();
    if (!peerId) return;

    const paging = privateChatPagingRef.current[peerId] || {};
    if (!paging.initialized || !paging.hasMore || !paging.nextBeforeSeq) return;
    if (paging.loading || paging.loadingMore) return;

    skipNextPrivateAutoScrollRef.current = true;
    requestPrivateHistory(peerId, { appendOlder: true, beforeSeq: paging.nextBeforeSeq });
  }, [isChatsView, requestPrivateHistory, selectedUser]);

  const handlePrivateHistoryScroll = useCallback(
    (container) => {
      if (!showPrivateChat) return;
      const nearTop = container.scrollTop <= chatScrollTopThreshold;
      if (nearTop) {
        loadOlderPrivateMessages();
      }
    },
    [chatScrollTopThreshold, loadOlderPrivateMessages, showPrivateChat]
  );

  useEffect(() => {
    if (!showPrivateChat) return;
    const paging = privateChatPagingRef.current[selectedUser] || {};
    if (paging.initialized || paging.loading) return;
    requestPrivateHistory(selectedUser);
  }, [requestPrivateHistory, selectedUser, showPrivateChat]);

  useEffect(() => {
    if (!showPrivateChat) return;
    if (skipNextPrivateAutoScrollRef.current) {
      skipNextPrivateAutoScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bottomRef, currentMessages.length, showPrivateChat]);

  useEffect(() => {
    if (!showPrivateChat) return;
    const unseenIds = currentMessages
      .filter((m) => m.from === selectedUser && !m.seen && m._id)
      .map((m) => m._id);
    if (!unseenIds.length) return;

    if (socketRef.current) {
      socketRef.current.emit("message-seen", { messageIds: unseenIds, senderId: selectedUser });
    }

    setPrivateChats((prev) => ({
      ...prev,
      [selectedUser]: (prev[selectedUser] || []).map((m) =>
        m.from === selectedUser && !m.seen ? { ...m, seen: true } : m
      ),
    }));
  }, [currentMessages, selectedUser, setPrivateChats, showPrivateChat, socketRef]);

  const selectedPrivatePaging = useMemo(
    () => (selectedUser ? privateChatPaging[selectedUser] || {} : {}),
    [privateChatPaging, selectedUser]
  );

  const resetPrivateHistoryState = useCallback(() => {
    setPrivateChatPaging({});
    skipNextPrivateAutoScrollRef.current = false;
  }, []);

  return {
    privateChatPaging,
    selectedPrivatePaging,
    requestPrivateHistory,
    handlePrivateHistoryScroll,
    resetPrivateHistoryState,
  };
}
