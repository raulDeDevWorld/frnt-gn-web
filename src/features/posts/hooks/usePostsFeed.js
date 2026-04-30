"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeRooms, normalizeRoomKey } from "@/features/chat/domain/chat-thread.utils.js";
import {
  buildPostPreview,
  mergePostsDesc,
  normalizeIncomingPost as normalizeIncomingPostDomain,
} from "@/features/posts/domain/post-feed.utils.js";

export function usePostsFeed({
  authToken,
  backendUrl,
  socketRef,
  selectedRoomKey,
  defaultRoomKey,
  roomPostPageSize,
  setPublicRooms,
}) {
  const [roomPosts, setRoomPosts] = useState({});
  const [roomPostPaging, setRoomPostPaging] = useState({});
  const [postCommentsById, setPostCommentsById] = useState({});
  const roomPostPagingRef = useRef({});

  useEffect(() => {
    roomPostPagingRef.current = roomPostPaging;
  }, [roomPostPaging]);

  const touchRoomWithPost = useCallback(
    (roomKey, post) => {
      const normalized = normalizeRoomKey(roomKey);
      setPublicRooms((prev) =>
        mergeRooms(prev, [
          {
            roomKey: normalized,
            title: normalized,
            lastMessageAt: post.createdAt || Date.now(),
            lastMessagePreview: buildPostPreview(post),
          },
        ])
      );
    },
    [setPublicRooms]
  );

  const appendIncomingPost = useCallback(
    (incomingPost) => {
      const normalized = normalizeIncomingPostDomain(incomingPost, {
        fallbackRoomKey: selectedRoomKey,
        normalizeRoomKey: (value) => normalizeRoomKey(value, defaultRoomKey),
      });
      if (!normalized._id) return;

      setRoomPosts((prev) => {
        const list = prev[normalized.roomKey] || [];
        return {
          ...prev,
          [normalized.roomKey]: mergePostsDesc(list, [normalized]),
        };
      });
      touchRoomWithPost(normalized.roomKey, normalized);
    },
    [defaultRoomKey, selectedRoomKey, touchRoomWithPost]
  );

  const patchPostById = useCallback((postId, updater) => {
    const id = String(postId || "").trim();
    if (!id) return;

    setRoomPosts((prev) => {
      let changed = false;
      const next = {};

      for (const [roomKey, posts] of Object.entries(prev || {})) {
        let roomChanged = false;
        const updated = (posts || []).map((post) => {
          if (String(post?._id || "") !== id) return post;
          const nextPost = updater(post);
          if (nextPost !== post) {
            roomChanged = true;
          }
          return nextPost;
        });

        if (roomChanged) {
          changed = true;
          next[roomKey] = updated;
        } else {
          next[roomKey] = posts;
        }
      }

      return changed ? next : prev;
    });
  }, []);

  const handleTogglePostLike = useCallback(
    async (postId) => {
      if (!authToken) return;
      const id = String(postId || "").trim();
      if (!id) return;

      let rollback = null;
      patchPostById(id, (post) => {
        rollback = post;
        const wasLiked = Boolean(post.likedByMe);
        const baseCount = Number(post.likesCount) || 0;
        const likesCount = wasLiked ? Math.max(0, baseCount - 1) : baseCount + 1;
        return { ...post, likedByMe: !wasLiked, likesCount };
      });

      try {
        const response = await fetch(`${backendUrl}/api/posts/${id}/like`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !payload?.post) {
          throw new Error(payload?.error || "No se pudo actualizar like");
        }
        patchPostById(id, () =>
          normalizeIncomingPostDomain(payload.post, {
            fallbackRoomKey: selectedRoomKey,
            normalizeRoomKey: (value) => normalizeRoomKey(value, defaultRoomKey),
          })
        );
      } catch (error) {
        if (rollback) {
          patchPostById(id, () => rollback);
        }
        alert(error?.message || "No se pudo actualizar like");
      }
    },
    [authToken, backendUrl, defaultRoomKey, patchPostById, selectedRoomKey]
  );

  const handleLoadPostComments = useCallback(
    async (postId) => {
      if (!authToken) return;
      const id = String(postId || "").trim();
      if (!id) return;

      setPostCommentsById((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          loading: true,
          error: "",
        },
      }));

      try {
        const response = await fetch(`${backendUrl}/api/posts/${id}/comments?limit=40`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "No se pudieron cargar comentarios");
        }

        const comments = Array.isArray(payload.comments) ? payload.comments : [];
        setPostCommentsById((prev) => ({
          ...prev,
          [id]: {
            ...(prev[id] || {}),
            items: comments.sort((a, b) => (Number(a?.createdAt) || 0) - (Number(b?.createdAt) || 0)),
            loading: false,
            loaded: true,
            error: "",
            hasMore: Boolean(payload.hasMore),
            nextCursor: payload.nextCursor || null,
          },
        }));
      } catch (error) {
        setPostCommentsById((prev) => ({
          ...prev,
          [id]: {
            ...(prev[id] || {}),
            loading: false,
            loaded: true,
            error: error?.message || "No se pudieron cargar comentarios",
          },
        }));
      }
    },
    [authToken, backendUrl]
  );

  const handleCreatePostComment = useCallback(
    async (postId, content) => {
      if (!authToken) return false;
      const id = String(postId || "").trim();
      const text = String(content || "").trim();
      if (!id || !text) return false;

      setPostCommentsById((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          submitting: true,
          error: "",
        },
      }));

      try {
        const response = await fetch(`${backendUrl}/api/posts/${id}/comments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ content: text }),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !payload?.comment) {
          throw new Error(payload?.error || "No se pudo crear comentario");
        }

        setPostCommentsById((prev) => {
          const existing = Array.isArray(prev[id]?.items) ? prev[id].items : [];
          return {
            ...prev,
            [id]: {
              ...(prev[id] || {}),
              items: [...existing, payload.comment],
              loading: false,
              loaded: true,
              submitting: false,
              error: "",
            },
          };
        });

        if (payload?.post) {
          patchPostById(id, () =>
            normalizeIncomingPostDomain(payload.post, {
              fallbackRoomKey: selectedRoomKey,
              normalizeRoomKey: (value) => normalizeRoomKey(value, defaultRoomKey),
            })
          );
        } else {
          patchPostById(id, (post) => ({
            ...post,
            commentsCount: Math.max((Number(post.commentsCount) || 0) + 1, 0),
          }));
        }

        return true;
      } catch (error) {
        setPostCommentsById((prev) => ({
          ...prev,
          [id]: {
            ...(prev[id] || {}),
            submitting: false,
            error: error?.message || "No se pudo crear comentario",
          },
        }));
        return false;
      }
    },
    [authToken, backendUrl, defaultRoomKey, patchPostById, selectedRoomKey]
  );

  const requestRoomPosts = useCallback(
    (roomKey, options = {}) => {
      if (!socketRef.current) return;

      const key = normalizeRoomKey(roomKey);
      const cursor = options?.cursor || null;
      const appendOlder = Boolean(options?.appendOlder);
      const current = roomPostPagingRef.current[key] || {};

      if (current.loading || current.loadingMore) return;
      if (appendOlder && current.hasMore === false) return;

      setRoomPostPaging((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          loading: appendOlder ? false : true,
          loadingMore: appendOlder ? true : false,
        },
      }));

      socketRef.current.emit(
        "post:list",
        {
          roomKey: key,
          limit: roomPostPageSize,
          ...(cursor ? { cursor } : {}),
        },
        (payload) => {
          if (!payload?.ok) {
            setRoomPostPaging((prev) => ({
              ...prev,
              [key]: {
                ...(prev[key] || {}),
                loading: false,
                loadingMore: false,
              },
            }));
            return;
          }

          const room = payload.room || { roomKey: key };
          const normalizedKey = normalizeRoomKey(room.roomKey || key);
          const incomingPosts = (payload.posts || []).map((post) =>
            normalizeIncomingPostDomain(post, {
              fallbackRoomKey: normalizedKey,
              normalizeRoomKey: (value) => normalizeRoomKey(value, defaultRoomKey),
            })
          );

          setPublicRooms((prev) =>
            mergeRooms(prev, [
              {
                ...room,
                roomKey: normalizedKey,
              },
            ])
          );

          setRoomPosts((prev) => {
            const existing = prev[normalizedKey] || [];
            const merged = mergePostsDesc(existing, incomingPosts);
            return { ...prev, [normalizedKey]: merged };
          });

          setRoomPostPaging((prev) => ({
            ...prev,
            [normalizedKey]: {
              ...(prev[normalizedKey] || {}),
              initialized: true,
              loading: false,
              loadingMore: false,
              hasMore: Boolean(payload.hasMore),
              nextCursor: payload.nextCursor || null,
            },
          }));
        }
      );
    },
    [defaultRoomKey, roomPostPageSize, setPublicRooms, socketRef]
  );

  const resetPostsState = useCallback(() => {
    setRoomPosts({});
    setRoomPostPaging({});
    setPostCommentsById({});
  }, []);

  return {
    roomPosts,
    roomPostPaging,
    roomPostPagingRef,
    postCommentsById,
    requestRoomPosts,
    appendIncomingPost,
    handleTogglePostLike,
    handleLoadPostComments,
    handleCreatePostComment,
    resetPostsState,
  };
}
