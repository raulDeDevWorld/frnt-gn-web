"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Picker from "emoji-picker-react";
import {
  SendHorizontal,
  Paperclip,
  Mic,
  StopCircle,
  Trash2,
  ArrowLeft,
  Filter,
  Search,
  Plus,
  Check,
  Smile,
  ShieldCheck,
  Zap,
  Globe2,
  X,
} from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav.jsx";
import { MediaViewer } from "@/components/MediaViewer.jsx";
import { ChatSidebar } from "@/components/ChatSidebar.jsx";
import { ChatsView } from "@/components/views/ChatsView.jsx";
import { ConfigView } from "@/components/views/ConfigView.jsx";
import { PostsView } from "@/components/views/PostsView.jsx";
import { ToastViewport } from "@/components/ToastViewport.jsx";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession.js";
import { useProfileSettings } from "@/features/profile/hooks/useProfileSettings.js";
import { usePostsFeed } from "@/features/posts/hooks/usePostsFeed.js";
import { POST_FILTER_OPTIONS, usePostFilters } from "@/features/posts/hooks/usePostFilters.js";
import { useChatSocket } from "@/features/chat/hooks/useChatSocket.js";
import { usePrivateChatComposer } from "@/features/chat/hooks/usePrivateChatComposer.js";
import { usePrivateChatHistory } from "@/features/chat/hooks/usePrivateChatHistory.js";
import { useMediaUpload } from "@/features/uploads/hooks/useMediaUpload.js";
import { usePostComposer } from "@/features/posts/hooks/usePostComposer.js";
import {
  buildDirectMessagePreview,
  mergeDirectThreads,
  mergePrivateThread,
  mergeRooms,
  normalizeRoomKey,
} from "@/features/chat/domain/chat-thread.utils.js";
import { formatFileSize } from "@/features/shared/format.utils.js";

const DEFAULT_ROOM_KEY = "public";
const ROOM_POST_PAGE_SIZE = 20;
const POST_SCROLL_BOTTOM_THRESHOLD = 180;
const CHAT_HISTORY_PAGE_SIZE = 30;
const CHAT_SCROLL_TOP_THRESHOLD = 120;
const CLIENT_UPLOAD_MAX_BYTES = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_BYTES || 1000000);
const CLIENT_IMAGE_TARGET_BYTES = Math.max(300000, Math.floor(CLIENT_UPLOAD_MAX_BYTES * 0.95));
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const AUTH_STORAGE_KEY = "chat_auth_google_jwt";
const FALLBACK_COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "EC", name: "Ecuador" },
  { code: "ES", name: "Espana" },
  { code: "MX", name: "Mexico" },
  { code: "PE", name: "Peru" },
  { code: "PY", name: "Paraguay" },
  { code: "US", name: "Estados Unidos" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
];

function sectionFromPathname(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/chats")) return "chats";
  if (path.startsWith("/config")) return "config";
  return "posts";
}

function pathnameFromSection(section) {
  if (section === "chats") return "/chats";
  if (section === "config") return "/config";
  return "/posts";
}

function SkeletonSidebar() {
  return (
    <aside className="hidden md:flex md:w-[340px] border-r border-[color:var(--border-soft)] bg-[color:var(--surface-1)]">
      <div className="w-full p-4 space-y-4">
        <div className="h-10 w-full skeleton-line" />
        {[0, 1, 2, 3, 4, 5].map((id) => (
          <div key={id} className="h-14 w-full skeleton-line" />
        ))}
      </div>
    </aside>
  );
}

function SkeletonBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 h-[var(--bottom-nav-space)] border-t border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/95 backdrop-blur px-2 pt-1.5 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-md grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((id) => (
          <div key={id} className="h-12 rounded-2xl skeleton-line" />
        ))}
      </div>
    </nav>
  );
}

function SkeletonTopHeader({ showPostControls = false, showPostSearch = false }) {
  return (
    <div className="shadow-sm z-10 border-b bg-[color:var(--surface-1)] border-[color:var(--border-soft)] px-3 sm:px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full skeleton-line" />
          <div className="space-y-2">
            <div className="h-3 w-24 skeleton-line" />
            <div className="h-2.5 w-36 skeleton-line" />
          </div>
        </div>

        {showPostControls ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-[86px] rounded-md skeleton-line" />
            <div className="h-8 w-8 rounded-md skeleton-line" />
          </div>
        ) : null}
      </div>

      {showPostSearch ? (
        <div className="mt-2">
          <div className="h-9 w-full rounded-md skeleton-line" />
        </div>
      ) : null}
    </div>
  );
}

function PostsSectionSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:px-4 md:px-6 pb-[calc(var(--bottom-nav-space)+0.2rem)] bg-[color:var(--surface-1)]">
      <div className="max-w-2xl mx-auto space-y-3">
        {[0, 1, 2].map((id) => (
          <div key={id} className="surface-card px-4 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full skeleton-line" />
              <div className="space-y-2">
                <div className="h-2.5 w-28 skeleton-line" />
                <div className="h-2 w-16 skeleton-line" />
              </div>
            </div>
            <div className="h-2.5 w-[92%] skeleton-line" />
            <div className="h-2.5 w-[74%] skeleton-line" />
            <div className="h-40 rounded-xl skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatsSectionSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-8 md:px-12 pb-[var(--bottom-nav-space)] bg-[color:var(--surface-1)]">
      <div className="max-w-xl mx-auto space-y-2 pt-2">
        {[0, 1, 2, 3, 4].map((id) => (
          <div key={id} className={`flex ${id % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div className="max-w-[78%] surface-card px-3 py-2.5 space-y-2">
              <div className="h-2.5 w-40 skeleton-line" />
              <div className="h-2.5 w-28 skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigSectionSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:px-4 md:px-6 pb-[var(--bottom-nav-space)] bg-[color:var(--surface-1)]">
      <div className="max-w-2xl mx-auto surface-card p-5 space-y-4">
        <div className="h-5 w-24 skeleton-line" />
        <div className="h-3 w-52 skeleton-line" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 h-10 rounded-md skeleton-line" />
          <div className="h-10 rounded-md skeleton-line" />
          <div className="h-10 rounded-md skeleton-line" />
          <div className="sm:col-span-2 flex gap-2">
            <div className="h-10 w-36 rounded-md skeleton-line" />
            <div className="h-10 w-32 rounded-md skeleton-line" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppShellSkeleton({ section = "posts" }) {
  const isChats = section === "chats";
  const isConfig = section === "config";

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)]">
      <div className="flex h-screen overflow-hidden">
        {isChats ? <SkeletonSidebar /> : null}

        <main className="flex-1 min-w-0 flex flex-col bg-[color:var(--app-bg)] relative">
          <SkeletonTopHeader showPostControls={!isChats && !isConfig} showPostSearch={!isChats && !isConfig} />
          {isChats ? <ChatsSectionSkeleton /> : isConfig ? <ConfigSectionSkeleton /> : <PostsSectionSkeleton />}
        </main>
      </div>
      <SkeletonBottomNav />
    </div>
  );
}

export default function ChatExperience() {
  const pathname = usePathname();
  const router = useRouter();
  const routeSection = sectionFromPathname(pathname);

  const [publicRooms, setPublicRooms] = useState([]);
  const [roomMessages, setRoomMessages] = useState({});
  const [privateChats, setPrivateChats] = useState({});
  const [directChatThreads, setDirectChatThreads] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);

  const [activeSection, setActiveSection] = useState(routeSection);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoomKey, setSelectedRoomKey] = useState(DEFAULT_ROOM_KEY);
  const [mobileView, setMobileView] = useState(routeSection === "chats" ? "list" : "chat");
  const [darkMode, setDarkMode] = useState(false);
  const [mediaViewerData, setMediaViewerData] = useState(null);
  const [contentVisible, setContentVisible] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);
  const fileInputRef = useRef(null);
  const postComposerFileInputRef = useRef(null);
  const postComposerDialogRef = useRef(null);
  const postComposerTextareaRef = useRef(null);
  const createRoomDialogRef = useRef(null);
  const createRoomInputRef = useRef(null);
  const toastTimersRef = useRef(new Map());
  const {
    isClient,
    authToken,
    authUser,
    setAuthUser,
    authLoading,
    authError,
    setAuthError,
    persistAuth,
    clearAuthCore,
    googleButtonRef,
  } = useAuthSession({
    backendUrl: BACKEND_URL,
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    authStorageKey: AUTH_STORAGE_KEY,
  });
  const userId = authUser?.userId || "";

  const dismissToast = useCallback((toastId) => {
    const id = String(toastId || "");
    if (!id) return;
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ type = "info", message }) => {
      const normalized = String(message || "").trim();
      if (!normalized) return;
      const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, type, message: normalized }]);
      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, 4200);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    return () => {
      for (const timer of toastTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isClient || authLoading) {
      setContentVisible(false);
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      setContentVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [authLoading, isClient, routeSection, authToken, authUser?.userId, authUser?.profileCompleted]);

  useEffect(() => {
    const next = sectionFromPathname(pathname);
    setActiveSection((prev) => (prev === next ? prev : next));
  }, [pathname]);

  useEffect(() => {
    if (routeSection !== "chats") {
      setMobileView("chat");
      return;
    }
    setMobileView(selectedUser ? "chat" : "list");
  }, [routeSection, selectedUser]);

  const {
    profileForm,
    profileSaving,
    profileError,
    countriesLoading,
    countriesError,
    countryOptions,
    handleProfileChange,
    handleSubmitProfile,
    resetProfileState,
  } = useProfileSettings({
    authToken,
    authUser,
    backendUrl: BACKEND_URL,
    fallbackCountries: FALLBACK_COUNTRIES,
    persistAuth,
    setAuthUser,
  });

  const {
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
  } = usePostsFeed({
    authToken,
    backendUrl: BACKEND_URL,
    socketRef,
    selectedRoomKey,
    defaultRoomKey: DEFAULT_ROOM_KEY,
    roomPostPageSize: ROOM_POST_PAGE_SIZE,
    setPublicRooms,
    onNotify: pushToast,
  });

  const {
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
  } = usePostFilters({
    roomPosts,
    selectedRoomKey,
    userId,
  });

  const { uploadFileAndGetUrl } = useMediaUpload({
    authToken,
    backendUrl: BACKEND_URL,
  });

  const clearAuth = useCallback(() => {
    for (const timer of toastTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    toastTimersRef.current.clear();
    setToasts([]);
    clearAuthCore();
    setPublicRooms([]);
    resetPostsState();
    setRoomMessages({});
    setPrivateChats({});
    setDirectChatThreads([]);
    setActiveUsers([]);
    setActiveSection("posts");
    router.replace("/posts");
    setSelectedUser(null);
    setSelectedRoomKey(DEFAULT_ROOM_KEY);
    resetPostFiltersState();
    setMobileView("chat");
    resetProfileState();
  }, [clearAuthCore, resetPostFiltersState, resetPostsState, resetProfileState, router]);

  const upsertDirectThread = useCallback((peerUserId, patch = {}) => {
    const peerId = String(peerUserId || "").trim();
    if (!peerId) return;

    const normalizedPatch = {
      peerUserId: peerId,
      ...(patch?.peerDisplayName ? { peerDisplayName: String(patch.peerDisplayName) } : {}),
      ...(patch?.lastMessagePreview !== undefined ? { lastMessagePreview: String(patch.lastMessagePreview || "") } : {}),
      ...(patch?.lastMessageAt !== undefined ? { lastMessageAt: Number(patch.lastMessageAt) || Date.now() } : {}),
    };

    setDirectChatThreads((prev) => mergeDirectThreads(prev, [normalizedPatch]));
  }, []);

  const joinRoom = useCallback((roomKey) => {
    if (!socketRef.current) return;
    socketRef.current.emit("room:join", { roomKey });
  }, []);

  useChatSocket({
    socketRef,
    backendUrl: BACKEND_URL,
    authToken,
    userId,
    profileCompleted: Boolean(authUser?.profileCompleted),
    clearAuth,
    appendIncomingPost,
    upsertDirectThread,
    requestRoomPosts,
    defaultRoomKey: DEFAULT_ROOM_KEY,
    setAuthError,
    setActiveUsers,
    setPublicRooms,
    setDirectChatThreads,
    setPrivateChats,
    setRoomMessages,
  });

  const currentMessages = useMemo(
    () => (selectedUser ? privateChats[selectedUser] || [] : []),
    [privateChats, selectedUser]
  );

  const selectedRoom = useMemo(
    () => publicRooms.find((room) => room.roomKey === selectedRoomKey) || null,
    [publicRooms, selectedRoomKey]
  );
  const selectedThread = useMemo(() => {
    if (!selectedUser) return null;
    const peerId = String(selectedUser || "").trim();
    if (!peerId) return null;
    return directChatThreads.find((thread) => String(thread?.peerUserId || "").trim() === peerId) || null;
  }, [directChatThreads, selectedUser]);
  const selectedPeerDisplayName = useMemo(() => {
    const fromThread = String(selectedThread?.peerDisplayName || "").trim();
    if (fromThread) return fromThread;
    return String(selectedUser || "").trim();
  }, [selectedThread?.peerDisplayName, selectedUser]);
  const selectedPeerOnline = Boolean(selectedUser && activeUsers.includes(String(selectedUser)));

  const selectedRoomPaging = roomPostPaging[selectedRoomKey] || {};
  const isPostsView = activeSection === "posts";
  const isChatsView = activeSection === "chats";
  const isConfigView = activeSection === "config";
  const showPrivateChat = isChatsView && Boolean(selectedUser);
  const showSidebar = isChatsView;
  const sectionHeaderTitle = showPrivateChat
    ? selectedPeerDisplayName
    : isChatsView
      ? "Chats"
      : isConfigView
        ? "Configuracion"
        : "Posts";
  const sectionHeaderSubtitle = showPrivateChat
    ? selectedPeerOnline
      ? "en linea"
      : "sin conexion"
    : isChatsView
      ? "Selecciona una conversacion"
      : isConfigView
        ? "Ajustes de tu cuenta"
        : "Feed general de publicaciones";
  const sectionHeaderBadge = showPrivateChat ? "U" : isChatsView ? "H" : isConfigView ? "C" : "R";

  const loadOlderRoomPosts = useCallback(() => {
    if (!isPostsView || selectedUser) return;
    const key = normalizeRoomKey(selectedRoomKey);
    const paging = roomPostPagingRef.current[key] || {};
    if (!paging.initialized || !paging.hasMore || !paging.nextCursor) return;
    if (paging.loading || paging.loadingMore) return;
    requestRoomPosts(key, { appendOlder: true, cursor: paging.nextCursor });
  }, [isPostsView, requestRoomPosts, selectedRoomKey, selectedUser]);

  const {
    selectedPrivatePaging,
    handlePrivateHistoryScroll,
  } = usePrivateChatHistory({
    socketRef,
    selectedUser,
    isChatsView,
    showPrivateChat,
    currentMessages,
    userId,
    bottomRef,
    chatHistoryPageSize: CHAT_HISTORY_PAGE_SIZE,
    chatScrollTopThreshold: CHAT_SCROLL_TOP_THRESHOLD,
    setPrivateChats,
    upsertDirectThread,
  });

  const handleMessageScroll = useCallback(
    (event) => {
      const container = event.currentTarget;
      if (showPrivateChat) {
        handlePrivateHistoryScroll(container);
        return;
      }

      if (!isPostsView) return;

      const nearBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - POST_SCROLL_BOTTOM_THRESHOLD;
      if (nearBottom) {
        loadOlderRoomPosts();
      }
    },
    [handlePrivateHistoryScroll, isPostsView, loadOlderRoomPosts, showPrivateChat]
  );

  const sendMessage = useCallback((content, type = "text", fileData = {}) => {
    if (!socketRef.current) return;

    if (selectedUser) {
      const tempId = `local_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      const basePayload = {
        content,
        from: userId,
        timestamp: Date.now(),
        type,
        ...fileData,
        tempIdPlaceholder: tempId,
        clientMessageId: tempId,
      };

      setPrivateChats((prev) => {
        const history = prev[selectedUser] || [];
        const localMsg = {
          ...basePayload,
          to: selectedUser,
          private: true,
          seen: false,
          _id: undefined,
          tempId,
        };
        return { ...prev, [selectedUser]: mergePrivateThread(history, [localMsg]) };
      });
      upsertDirectThread(selectedUser, {
        lastMessagePreview: buildDirectMessagePreview(basePayload),
        lastMessageAt: basePayload.timestamp || Date.now(),
      });

      const eventName = type === "text" ? "send-message" : "send-media";
      socketRef.current.emit(eventName, {
        ...basePayload,
        to: selectedUser,
        ...(type !== "text" ? { content: "" } : {}),
      });
      return;
    }

    const roomKey = normalizeRoomKey(selectedRoomKey);
    const media =
      type === "text"
        ? []
        : [
            {
              url: fileData.mediaUrl,
              mime: fileData.fileType || "application/octet-stream",
              name: fileData.fileName || null,
              size: fileData.fileSize || 0,
            },
          ];

    socketRef.current.emit(
      "post:create",
      {
        roomKey,
        content: String(content || "").trim(),
        ...(media.length ? { media } : {}),
        tempId: `post_${Date.now()}`,
      },
      (response) => {
        if (!response?.ok) {
          pushToast({ type: "error", message: "No se pudo publicar" });
          return;
        }
        if (response.post) {
          appendIncomingPost(response.post);
        }
      }
    );
  }, [appendIncomingPost, pushToast, selectedRoomKey, selectedUser, socketRef, upsertDirectThread, userId]);

  const {
    text,
    setText,
    showEmoji,
    setShowEmoji,
    isRecording,
    audioFile,
    handleSendText,
    startRec,
    stopRec,
    cancelRec,
    clearAudio,
    sendAudio,
    handleFileSelect,
    resetPrivateComposer,
  } = usePrivateChatComposer({
    selectedUser,
    sendMessage,
    uploadFileAndGetUrl,
    clientUploadMaxBytes: CLIENT_UPLOAD_MAX_BYTES,
    clientImageTargetBytes: CLIENT_IMAGE_TARGET_BYTES,
    onNotify: pushToast,
  });

  const {
    isPostComposerOpen,
    postDraft,
    setPostDraft,
    postAttachment,
    postAttachmentPreviewUrl,
    postPublishing,
    openPostComposer,
    closePostComposer,
    handlePostAttachmentChange,
    removePostAttachment,
    handlePublishPost,
  } = usePostComposer({
    socketRef,
    isPostsView,
    selectedUser,
    selectedRoomKey,
    defaultRoomKey: DEFAULT_ROOM_KEY,
    clientUploadMaxBytes: CLIENT_UPLOAD_MAX_BYTES,
    clientImageTargetBytes: CLIENT_IMAGE_TARGET_BYTES,
    uploadFileAndGetUrl,
    appendIncomingPost,
    onNotify: pushToast,
  });

  const handleOpenPostComposer = useCallback(() => {
    setShowEmoji(false);
    closePostFilterPanel();
    openPostComposer();
  }, [closePostFilterPanel, openPostComposer, setShowEmoji]);

  const handleSelectUser = useCallback(
    (user) => {
      upsertDirectThread(user);
      router.push("/chats");
      setActiveSection("chats");
      setSelectedUser(user);
      closePostFilterPanel();
      closePostComposer();
      setMobileView("chat");
    },
    [closePostComposer, closePostFilterPanel, router, upsertDirectThread]
  );

  const handleSelectRoom = useCallback(
    (roomKey) => {
      const key = normalizeRoomKey(roomKey, DEFAULT_ROOM_KEY);
      router.push("/posts");
      setActiveSection("posts");
      setSelectedUser(null);
      setSelectedRoomKey(key);
      resetPostFiltersState();
      closePostComposer();
      resetPrivateComposer();
      setMobileView("chat");
      setShowEmoji(false);
      joinRoom(key);
      requestRoomPosts(key);
    },
    [closePostComposer, joinRoom, requestRoomPosts, resetPostFiltersState, resetPrivateComposer, router, setShowEmoji]
  );

  const handleSectionChange = useCallback(
    (section) => {
      const next = section === "chats" || section === "config" ? section : "posts";
      const nextPath = pathnameFromSection(next);
      if (pathname !== nextPath) {
        router.push(nextPath);
      }
      setActiveSection(next);
      setMobileView(next === "chats" && !selectedUser ? "list" : "chat");
      closePostFilterPanel();
      closePostComposer();
      if (next === "posts") {
        setSelectedUser(null);
        requestRoomPosts(selectedRoomKey);
      }
      if (next === "config") {
        setSelectedUser(null);
        resetPrivateComposer();
      }
    },
    [closePostComposer, closePostFilterPanel, pathname, requestRoomPosts, resetPrivateComposer, router, selectedRoomKey, selectedUser]
  );

  const handleStartDmFromPost = useCallback(
    (authorId) => {
      const targetUserId = String(authorId || "").trim();
      if (!targetUserId || targetUserId === userId) return;
      handleSelectUser(targetUserId);
    },
    [handleSelectUser, userId]
  );

  const handleBack = () => {
    setMobileView("list");
  };

  const handleLogout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const openCreateRoomModal = useCallback(() => {
    setNewRoomName("");
    setIsCreateRoomModalOpen(true);
  }, []);

  const closeCreateRoomModal = useCallback(() => {
    if (isCreatingRoom) return;
    setIsCreateRoomModalOpen(false);
    setNewRoomName("");
  }, [isCreatingRoom]);

  const handleCreateRoom = useCallback(async () => {
    if (!socketRef.current || isCreatingRoom) return;
    const input = String(newRoomName || "").trim();
    if (!input) {
      pushToast({ type: "error", message: "Escribe un nombre para la sala" });
      return;
    }

    setIsCreatingRoom(true);
    try {
      const response = await new Promise((resolve) => {
        socketRef.current.emit(
          "room:create",
          { roomKey: input, title: input, description: "" },
          resolve
        );
      });

      if (!response?.ok || !response?.room?.roomKey) {
        throw new Error(response?.error || "No se pudo crear la sala");
      }

      setPublicRooms((prev) => mergeRooms(prev, [response.room]));
      handleSelectRoom(response.room.roomKey);
      setIsCreateRoomModalOpen(false);
      setNewRoomName("");
      pushToast({ type: "success", message: `Sala "${input}" creada` });
    } catch (error) {
      pushToast({ type: "error", message: error?.message || "No se pudo crear la sala" });
    } finally {
      setIsCreatingRoom(false);
    }
  }, [handleSelectRoom, isCreatingRoom, newRoomName, pushToast]);

  useEffect(() => {
    if (!isPostComposerOpen) return;

    const raf = window.requestAnimationFrame(() => {
      postComposerTextareaRef.current?.focus();
    });

    const onEscape = (event) => {
      if (event.key === "Escape") {
        closePostComposer();
      }
    };
    window.addEventListener("keydown", onEscape);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onEscape);
    };
  }, [closePostComposer, isPostComposerOpen]);

  useEffect(() => {
    if (!isCreateRoomModalOpen) return;

    const raf = window.requestAnimationFrame(() => {
      createRoomInputRef.current?.focus();
    });

    const onEscape = (event) => {
      if (event.key === "Escape") {
        closeCreateRoomModal();
      }
    };
    window.addEventListener("keydown", onEscape);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeCreateRoomModal, isCreateRoomModalOpen]);

  if (!isClient || authLoading) {
    return <AppShellSkeleton section={routeSection} />;
  }

  if (!authToken || !authUser) {
    return (
      <div
        className={`min-h-screen bg-[color:var(--app-bg)] relative overflow-hidden flex items-center justify-center p-4 sm:p-6 transition-opacity duration-150 md:duration-200 ${
          contentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-none absolute -top-16 -left-20 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <section className="surface-card p-6 sm:p-8 md:p-10">
            <span className="inline-flex h-8 items-center rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 text-[11px] font-medium tracking-wide text-cyan-200">
              Plataforma segura de chat y posts
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-100">
              Bienvenido a Swoou Chat
            </h1>
            <p className="mt-3 max-w-md text-sm sm:text-[15px] text-[color:var(--text-soft)]">
              Inicia sesion con Google para entrar a tus conversaciones, salas y publicaciones en tiempo real.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300 shrink-0" />
                <div>
                  <p className="text-sm text-gray-100 font-medium">Acceso protegido</p>
                  <p className="mt-0.5 text-xs text-[color:var(--text-soft)]">Sesion validada con Google y token seguro.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <Zap className="mt-0.5 h-4 w-4 text-amber-300 shrink-0" />
                <div>
                  <p className="text-sm text-gray-100 font-medium">Mensajeria instantanea</p>
                  <p className="mt-0.5 text-xs text-[color:var(--text-soft)]">Chats privados y posts sincronizados al instante.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <Globe2 className="mt-0.5 h-4 w-4 text-cyan-300 shrink-0" />
                <div>
                  <p className="text-sm text-gray-100 font-medium">Comunidad activa</p>
                  <p className="mt-0.5 text-xs text-[color:var(--text-soft)]">Crea salas publicas y conecta con usuarios online.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-card p-6 sm:p-8 md:p-10 flex flex-col justify-center">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-soft)]">Acceso</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-100">Iniciar sesion</h2>
            <p className="mt-2 text-sm text-[color:var(--text-soft)]">
              Usa tu cuenta de Google para continuar.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0e171d] p-4 sm:p-5">
              <div ref={googleButtonRef} className="min-h-[44px] flex justify-center" />
            </div>

            {authError ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-sm text-red-300">{authError}</p>
              </div>
            ) : null}

            <p className="mt-5 text-[11px] leading-relaxed text-[color:var(--text-soft)]">
              Al continuar, autorizas el acceso basico de perfil para identificar tu cuenta dentro de la app.
            </p>
          </section>
        </div>
      </div>
    );
  }

  if (!authUser.profileCompleted) {
    return (
      <div
        className={`min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] flex items-center justify-center p-6 transition-opacity duration-150 md:duration-200 ${
          contentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <form
          onSubmit={handleSubmitProfile}
          className="w-full max-w-lg bg-white dark:bg-[#202c33] rounded-2xl border border-black/5 dark:border-white/10 shadow-lg p-8"
        >
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Completa tu perfil</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Autocompletamos con datos de Google. Puedes editarlos antes de continuar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-gray-600 dark:text-gray-300">Email (Google)</span>
              <input
                value={authUser.email || ""}
                disabled
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#182229] text-gray-600 dark:text-gray-300"
              />
            </label>

            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-gray-600 dark:text-gray-300">Idioma</span>
              <select
                value={profileForm.language}
                onChange={(e) => handleProfileChange("language", e.target.value.toLowerCase())}
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                required
              >
                <option value="es">Espanol</option>
                <option value="en">Ingles</option>
                <option value="pt">Portugues</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Alias</span>
              <input
                value={profileForm.alias}
                onChange={(e) => handleProfileChange("alias", e.target.value)}
                placeholder="tu_alias"
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Nombre o Alias visible</span>
              <input
                value={profileForm.displayName}
                onChange={(e) => handleProfileChange("displayName", e.target.value)}
                placeholder="Tu nombre"
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Fecha de nacimiento</span>
              <input
                type="date"
                value={profileForm.birthDate}
                onChange={(e) => handleProfileChange("birthDate", e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Celular (+codigo pais)</span>
              <input
                value={profileForm.phoneNumber}
                onChange={(e) => handleProfileChange("phoneNumber", e.target.value)}
                placeholder="+59171234567"
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Pais</span>
              <select
                value={profileForm.country}
                onChange={(e) => handleProfileChange("country", e.target.value.toUpperCase())}
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                required
              >
                <option value="">
                  {countriesLoading ? "Cargando paises..." : "Selecciona un pais"}
                </option>
                {countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {`${country.flag ? `${country.flag} ` : ""}${country.name} (${country.code})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Genero</span>
              <select
                value={profileForm.gender}
                onChange={(e) => handleProfileChange("gender", e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                required
              >
                <option value="">Selecciona</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
              </select>
            </label>
          </div>

          {countriesError && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              No se pudo sincronizar el catalogo remoto de paises. Se usa lista local.
            </p>
          )}
          {profileError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{profileError}</p>}

          <button
            type="submit"
            disabled={profileSaving}
            className="mt-5 h-10 px-4 rounded-md bg-[#00a884] text-white font-medium hover:bg-[#008f72] disabled:opacity-60"
          >
            {profileSaving ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen overflow-hidden transition-opacity duration-150 md:duration-200 ${contentVisible ? "opacity-100" : "opacity-0"} ${darkMode ? "dark bg-[color:var(--app-bg)]" : "bg-[color:var(--app-bg)]"}`}
    >
      {showSidebar && (
        <ChatSidebar
          darkMode={darkMode}
          activeSection={activeSection}
          selectedUser={selectedUser}
          selectedRoomKey={selectedRoomKey}
          publicRooms={publicRooms}
          roomMessages={roomMessages}
          roomPosts={roomPosts}
          activeUsers={activeUsers}
          directChatThreads={directChatThreads}
          privateChats={privateChats}
          onSelectUser={handleSelectUser}
          onSelectRoom={handleSelectRoom}
          setDarkMode={setDarkMode}
          currentUser={authUser}
          onLogout={handleLogout}
          USER_ID={userId}
          mobileView={mobileView}
        />
      )}

      <div
        className={`
                min-w-0 flex-1 flex-col bg-[color:var(--app-bg)] relative
                ${isChatsView ? (mobileView === "chat" ? "flex" : "hidden md:flex") : "flex"}
            `}
      >
        <div
          className={`shadow-sm z-10 border-b ${
            showPrivateChat
              ? "h-[60px] bg-[color:var(--surface-1)] px-4 flex items-center justify-between border-[color:var(--border-soft)]"
              : "bg-[color:var(--surface-1)] border-[color:var(--border-soft)] px-3 sm:px-4 py-2.5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isChatsView && (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Volver a la lista de chats"
                  className={`md:hidden p-2 -ml-2 rounded-full transition-all active:scale-95 ${
                    showPrivateChat ? "text-gray-200 hover:bg-white/10" : "text-gray-200 hover:bg-white/10"
                  }`}
                >
                  <ArrowLeft />
                </button>
              )}
              <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white text-lg cursor-pointer">
                {sectionHeaderBadge}
              </div>
              <div className="flex flex-col justify-center ml-1 cursor-pointer">
                <p className="font-medium leading-tight text-gray-100">
                  {sectionHeaderTitle}
                </p>
                <p className="text-xs leading-tight text-[color:var(--text-soft)]">
                  {sectionHeaderSubtitle}
                </p>
              </div>
            </div>

            {isPostsView && (
              <div className="flex items-center gap-2" ref={postFilterPanelRef}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={togglePostFilterPanel}
                    className="h-8 px-2.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-100 inline-flex items-center gap-1.5"
                    title="Filtros de posts"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="text-[11px] hidden sm:inline">Filtros</span>
                    {activePostFilterCount > 0 ? (
                      <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#00a884] text-white text-[10px] leading-4 text-center">
                        {activePostFilterCount}
                      </span>
                    ) : null}
                  </button>

                  {postFilterPanelOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-md border border-white/15 bg-[#0f151a] shadow-xl p-2 z-20">
                      <p className="text-[11px] text-gray-300 px-1 pb-1">Filtrar posts</p>
                      {POST_FILTER_OPTIONS.map((option) => {
                        const checked = Boolean(postFilters[option.key]);
                        return (
                          <button
                            type="button"
                            key={option.key}
                            onClick={() => togglePostFilter(option.key)}
                            className="w-full h-8 px-2 rounded-md hover:bg-white/10 active:scale-[0.99] transition-all text-left inline-flex items-center justify-between text-[12px] text-gray-100"
                          >
                            <span>{option.label}</span>
                            <span
                              className={`w-4 h-4 rounded-sm border inline-flex items-center justify-center ${
                                checked ? "bg-[#00a884] border-[#00a884] text-white" : "border-white/25 text-transparent"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={clearPostFilters}
                        className="w-full mt-1 h-7 rounded-md border border-white/15 text-[11px] text-gray-200 hover:bg-white/10 active:scale-[0.99] transition-all"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openCreateRoomModal}
                  aria-label="Crear nueva sala"
                  className="h-8 w-8 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-100 inline-flex items-center justify-center"
                  title="Nueva sala"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {isPostsView && (
            <div className="mt-2 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={postSearchQuery}
                onChange={(e) => setPostSearchQuery(e.target.value)}
                placeholder="Buscar en posts por texto, autor o archivo..."
                className="w-full h-9 pl-9 pr-3 rounded-md bg-[#0d141a] border border-white/10 text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#00a884]"
              />
            </div>
          )}
        </div>

        <div
          ref={messageListRef}
          onScroll={handleMessageScroll}
          className={`flex-1 overflow-y-auto custom-scrollbar relative z-0 ${
            showPrivateChat
              ? "px-2 py-3 sm:px-8 md:px-12 pb-[var(--bottom-nav-space)]"
              : isPostsView
                ? "p-3 sm:px-4 md:px-6 pb-[calc(var(--bottom-nav-space)+0.2rem)] bg-[color:var(--surface-1)]"
                : "p-3 sm:px-4 md:px-6 pb-[var(--bottom-nav-space)] bg-[color:var(--surface-1)]"
          }`}
        >
          {isConfigView ? (
            <ConfigView
              profileForm={profileForm}
              profileError={profileError}
              profileSaving={profileSaving}
              countriesLoading={countriesLoading}
              countriesError={countriesError}
              countryOptions={countryOptions}
              onProfileChange={handleProfileChange}
              onSubmitProfile={handleSubmitProfile}
              onLogout={handleLogout}
            />
          ) : null}

          <ChatsView
            isChatsView={isChatsView}
            showPrivateChat={showPrivateChat}
            selectedPrivatePaging={selectedPrivatePaging}
            currentMessages={currentMessages}
            userId={userId}
            onMediaClick={setMediaViewerData}
            bottomRef={bottomRef}
          />

          <PostsView
            isPostsView={isPostsView}
            selectedRoomPaging={selectedRoomPaging}
            filteredRoomPosts={filteredRoomPosts}
            currentRoomPosts={currentRoomPosts}
            postCommentsById={postCommentsById}
            userId={userId}
            onToggleLike={handleTogglePostLike}
            onLoadComments={handleLoadPostComments}
            onCreateComment={handleCreatePostComment}
            onStartDm={handleStartDmFromPost}
            onMediaClick={setMediaViewerData}
          />
        </div>

        {isPostsView && !isPostComposerOpen && (
          <button
            type="button"
            onClick={handleOpenPostComposer}
            aria-label="Crear nuevo post"
            className="absolute bottom-[calc(var(--bottom-nav-space)-0.65rem)] sm:bottom-[calc(var(--bottom-nav-space)-0.4rem)] right-4 sm:right-5 z-50 h-11 sm:h-12 px-4 rounded-full bg-[#00a884] hover:bg-[#008f72] active:scale-95 transition-all text-white shadow-xl inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">Nuevo post</span>
          </button>
        )}

        {isPostsView && isPostComposerOpen && (
          <div
            className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3"
            onClick={closePostComposer}
            role="dialog"
            aria-modal="true"
            aria-label="Editor de nuevo post"
          >
            <div
              ref={postComposerDialogRef}
              className="w-full max-w-xl rounded-xl border border-white/15 bg-[#0f151a] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-100">Nuevo post</p>
                  <p className="text-[11px] text-gray-400">Feed: {selectedRoom?.title || selectedRoomKey}</p>
                </div>
                <button
                  type="button"
                  onClick={closePostComposer}
                  className="h-8 px-2 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 active:scale-95 transition-all text-xs"
                >
                  Cerrar
                </button>
              </div>

              <div className="p-4 space-y-3">
                <textarea
                  ref={postComposerTextareaRef}
                  value={postDraft}
                  onChange={(e) => setPostDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handlePublishPost();
                    }
                  }}
                  placeholder="Comparte una idea, anuncio o update para esta sala..."
                  className="w-full min-h-[120px] resize-y rounded-md bg-[#11181e] border border-white/10 p-3 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#00a884]"
                />

                {postAttachment && (
                  <div className="rounded-xl border border-white/15 bg-[#101920] overflow-hidden">
                    {String(postAttachment.type || "").startsWith("image/") && postAttachmentPreviewUrl ? (
                      <img
                        src={postAttachmentPreviewUrl}
                        alt={postAttachment.name || "preview"}
                        className="w-full max-h-72 object-cover border-b border-white/10"
                      />
                    ) : null}

                    {String(postAttachment.type || "").startsWith("video/") && postAttachmentPreviewUrl ? (
                      <video
                        src={postAttachmentPreviewUrl}
                        controls
                        className="w-full max-h-72 bg-black border-b border-white/10"
                      />
                    ) : null}

                    {String(postAttachment.type || "").startsWith("audio/") && postAttachmentPreviewUrl ? (
                      <div className="px-3 pt-3">
                        <audio src={postAttachmentPreviewUrl} controls className="w-full h-10" />
                      </div>
                    ) : null}

                    <div className="px-3 py-2 flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-gray-300 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-gray-100 truncate">{postAttachment.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {postAttachment.type || "application/octet-stream"} - {formatFileSize(postAttachment.size)}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 h-6 rounded-full border border-white/15 text-gray-300 inline-flex items-center">
                        Preview
                      </span>
                    </div>

                    <div className="px-3 pb-3">
                      <button
                        type="button"
                        onClick={removePostAttachment}
                        className="h-8 px-3 rounded-md border border-white/15 text-[11px] text-gray-200 hover:bg-white/10 active:scale-95 transition-all"
                      >
                        Quitar archivo
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => postComposerFileInputRef.current?.click()}
                      className="h-8 px-2.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-100 inline-flex items-center gap-1.5 text-xs"
                    >
                      <Paperclip className="w-4 h-4" />
                      Adjuntar
                    </button>
                    <input
                      type="file"
                      hidden
                      ref={postComposerFileInputRef}
                      onChange={handlePostAttachmentChange}
                      accept="image/*,video/*,audio/*,application/*"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closePostComposer}
                      className="h-8 px-3 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 active:scale-95 transition-all text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishPost}
                      disabled={postPublishing || (!postDraft.trim() && !postAttachment)}
                      className="h-8 px-3 rounded-md bg-[#00a884] hover:bg-[#008f72] active:scale-95 transition-all disabled:opacity-60 text-white text-xs font-medium"
                    >
                      {postPublishing ? "Publicando..." : "Publicar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isChatsView && (
          <div className="bg-[#f0f2f5]/95 dark:bg-[#202c33]/95 backdrop-blur border-t border-black/5 dark:border-white/10 px-3 sm:px-4 py-2 flex items-end gap-2 z-10 select-none">
            {showPrivateChat ? (
              <>
                {showEmoji && (
                  <div className="absolute bottom-20 left-4 z-50 shadow-2xl">
                    <Picker onEmojiClick={(e) => setText((prev) => prev + e.emoji)} theme={darkMode ? "dark" : "light"} />
                  </div>
                )}

                {!audioFile && !isRecording && (
                  <>
                    <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center px-2 py-1.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setShowEmoji(!showEmoji)}
                        aria-label="Abrir selector de emojis"
                        className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all rounded-full"
                      >
                        <Smile />
                      </button>
                      <input
                        className="flex-1 bg-transparent px-2 py-1 outline-none dark:text-white max-h-[100px] overflow-y-auto"
                        placeholder="Escribe un mensaje"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Adjuntar archivo"
                        className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all rounded-full rotate-45"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <input
                        type="file"
                        hidden
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*,video/*,audio/*,application/*"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={text.trim() ? handleSendText : startRec}
                      aria-label={text.trim() ? "Enviar mensaje" : "Grabar audio"}
                      className="p-3 rounded-full text-white shadow-md transition-all active:scale-95 bg-[#008069] hover:bg-[#006c59]"
                    >
                      {text.trim() ? <SendHorizontal className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  </>
                )}

                {isRecording && (
                  <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center p-3 gap-3 animate-pulse shadow-sm">
                    <Mic className="text-red-500 animate-bounce w-5 h-5" />
                    <span className="flex-1 text-gray-500 dark:text-gray-300 font-mono">Grabando audio...</span>
                    <button
                      type="button"
                      onClick={cancelRec}
                      className="text-red-500 text-sm font-medium hover:underline"
                    >
                      Cancelar
                    </button>
                    <button type="button" onClick={stopRec} aria-label="Detener grabacion" className="text-green-500">
                      <StopCircle className="w-6 h-6" />
                    </button>
                  </div>
                )}

                {audioFile && (
                  <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center p-2 gap-3 shadow-sm">
                    <button
                      type="button"
                      onClick={clearAudio}
                      aria-label="Descartar audio"
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all rounded-full"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Audio</span>
                      <div className="flex-1 h-1 bg-green-500/30 rounded overflow-hidden">
                        <div className="h-full bg-green-500 w-full" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={sendAudio}
                      aria-label="Enviar audio"
                      className="p-3 bg-[#008069] rounded-full text-white shadow-md hover:bg-[#006c59] active:scale-95 transition-all"
                    >
                      <SendHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg border border-black/5 dark:border-white/10 px-3 py-2.5 text-xs text-gray-500 dark:text-gray-300">
                Selecciona una conversacion para escribir.
              </div>
            )}
          </div>
        )}

        {isPostsView && isCreateRoomModalOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3"
            onClick={closeCreateRoomModal}
            role="dialog"
            aria-modal="true"
            aria-label="Crear nueva sala"
          >
            <div
              ref={createRoomDialogRef}
              className="w-full max-w-md rounded-xl border border-white/15 bg-[#0f151a] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-100">Nueva sala publica</p>
                <button
                  type="button"
                  onClick={closeCreateRoomModal}
                  className="h-8 w-8 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 active:scale-95 transition-all inline-flex items-center justify-center"
                  aria-label="Cerrar modal de crear sala"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Nombre de la sala</span>
                  <input
                    ref={createRoomInputRef}
                    value={newRoomName}
                    onChange={(event) => setNewRoomName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCreateRoom();
                      }
                    }}
                    placeholder="Ejemplo: anuncios"
                    className="h-10 px-3 rounded-md bg-[#11181e] border border-white/10 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#00a884]"
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCreateRoomModal}
                    className="h-8 px-3 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 active:scale-95 transition-all text-xs"
                    disabled={isCreatingRoom}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="h-8 px-3 rounded-md bg-[#00a884] hover:bg-[#008f72] active:scale-95 transition-all disabled:opacity-60 text-white text-xs font-medium"
                    disabled={isCreatingRoom || !String(newRoomName || "").trim()}
                  >
                    {isCreatingRoom ? "Creando..." : "Crear sala"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AppBottomNav activeSection={activeSection} onSectionChange={handleSectionChange} />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />

      {mediaViewerData && (
        <MediaViewer
          fileUrl={mediaViewerData.fileUrl}
          fileType={mediaViewerData.fileType}
          fileName={mediaViewerData.fileName}
          onClose={() => setMediaViewerData(null)}
        />
      )}
    </div>
  );
}

