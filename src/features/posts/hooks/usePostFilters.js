"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const POST_FILTER_OPTIONS = [
  { key: "mine", label: "Mis posts" },
  { key: "media", label: "Con media" },
  { key: "text", label: "Solo texto" },
];

const DEFAULT_POST_FILTERS = { mine: false, media: false, text: false };

export function usePostFilters({ roomPosts, selectedRoomKey, userId }) {
  const postFilterPanelRef = useRef(null);
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [postFilters, setPostFilters] = useState(DEFAULT_POST_FILTERS);
  const [postFilterPanelOpen, setPostFilterPanelOpen] = useState(false);

  const currentRoomPosts = useMemo(
    () => roomPosts[selectedRoomKey] || [],
    [roomPosts, selectedRoomKey]
  );

  const filteredRoomPosts = useMemo(() => {
    const search = String(postSearchQuery || "")
      .trim()
      .toLowerCase();

    return currentRoomPosts.filter((post) => {
      if (postFilters.mine && post.authorId !== userId) return false;
      if (postFilters.media && (!Array.isArray(post.media) || !post.media.length)) return false;
      if (postFilters.text && !String(post.content || "").trim()) return false;

      if (!search) return true;

      const mediaSearch = (post.media || [])
        .map((item) => `${item?.name || ""} ${item?.mime || ""}`)
        .join(" ")
        .toLowerCase();
      const content = String(post.content || "").toLowerCase();
      const authorId = String(post.authorId || "").toLowerCase();
      const authorName = String(post.authorName || "").toLowerCase();
      return (
        content.includes(search) ||
        authorId.includes(search) ||
        authorName.includes(search) ||
        mediaSearch.includes(search)
      );
    });
  }, [currentRoomPosts, postFilters, postSearchQuery, userId]);

  const activePostFilterCount = useMemo(
    () => Object.values(postFilters).filter(Boolean).length,
    [postFilters]
  );

  useEffect(() => {
    if (!postFilterPanelOpen) return;

    const handleOutsideClick = (event) => {
      if (!postFilterPanelRef.current?.contains(event.target)) {
        setPostFilterPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [postFilterPanelOpen]);

  const togglePostFilter = useCallback((filterKey) => {
    setPostFilters((prev) => ({ ...prev, [filterKey]: !prev[filterKey] }));
  }, []);

  const clearPostFilters = useCallback(() => {
    setPostFilters({ ...DEFAULT_POST_FILTERS });
  }, []);

  const resetPostFiltersState = useCallback(() => {
    setPostSearchQuery("");
    setPostFilters({ ...DEFAULT_POST_FILTERS });
    setPostFilterPanelOpen(false);
  }, []);

  const togglePostFilterPanel = useCallback(() => {
    setPostFilterPanelOpen((prev) => !prev);
  }, []);

  const closePostFilterPanel = useCallback(() => {
    setPostFilterPanelOpen(false);
  }, []);

  return {
    postFilterPanelRef,
    postSearchQuery,
    setPostSearchQuery,
    postFilters,
    postFilterPanelOpen,
    filteredRoomPosts,
    currentRoomPosts,
    activePostFilterCount,
    togglePostFilter,
    clearPostFilters,
    resetPostFiltersState,
    togglePostFilterPanel,
    closePostFilterPanel,
  };
}
