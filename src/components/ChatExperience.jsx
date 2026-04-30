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
} from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav.jsx";
import { MediaViewer } from "@/components/MediaViewer.jsx";
import { ChatSidebar } from "@/components/ChatSidebar.jsx";
import { ChatsView } from "@/components/views/ChatsView.jsx";
import { ConfigView } from "@/components/views/ConfigView.jsx";
import { PostsView } from "@/components/views/PostsView.jsx";
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

function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-[color:var(--app-bg)]">
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden md:flex md:w-[340px] border-r border-[color:var(--border-soft)] bg-[color:var(--surface-1)]">
          <div className="w-full p-4 space-y-4">
            <div className="h-10 w-full skeleton-line" />
            {[0, 1, 2, 3, 4].map((id) => (
              <div key={id} className="h-14 w-full skeleton-line" />
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-[color:var(--surface-1)]">
          <div className="h-[60px] border-b border-[color:var(--border-soft)] px-4 flex items-center">
            <div className="h-8 w-40 skeleton-line" />
          </div>
          <div className="flex-1 p-3 sm:p-4 space-y-3 pb-[var(--bottom-nav-space)]">
            {[0, 1, 2].map((id) => (
              <div key={id} className="surface-card p-4 space-y-3">
                <div className="h-3 w-28 skeleton-line" />
                <div className="h-2.5 w-[90%] skeleton-line" />
                <div className="h-2.5 w-[70%] skeleton-line" />
                <div className="h-28 w-full rounded-xl skeleton-line" />
              </div>
            ))}
          </div>
        </main>
      </div>
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

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);
  const fileInputRef = useRef(null);
  const postComposerFileInputRef = useRef(null);
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
  const selectedRoomPaging = roomPostPaging[selectedRoomKey] || {};
  const isPostsView = activeSection === "posts";
  const isChatsView = activeSection === "chats";
  const isConfigView = activeSection === "config";
  const showPrivateChat = isChatsView && Boolean(selectedUser);
  const showSidebar = isChatsView;
  const sectionHeaderTitle = showPrivateChat
    ? selectedUser
    : isChatsView
      ? "Chats"
      : isConfigView
        ? "Configuracion"
        : "Posts";
  const sectionHeaderSubtitle = showPrivateChat
    ? "en linea"
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
          alert("No se pudo publicar");
          return;
        }
        if (response.post) {
          appendIncomingPost(response.post);
        }
      }
    );
  }, [appendIncomingPost, selectedRoomKey, selectedUser, socketRef, upsertDirectThread, userId]);

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

  const handleCreateRoom = () => {
    if (!socketRef.current) return;
    const input = window.prompt("Nombre de la nueva sala publica:");
    if (!input) return;

    socketRef.current.emit(
      "room:create",
      { roomKey: input, title: input, description: "" },
      (response) => {
        if (!response?.ok || !response?.room?.roomKey) {
          alert("No se pudo crear la sala");
          return;
        }
        setPublicRooms((prev) => mergeRooms(prev, [response.room]));
        handleSelectRoom(response.room.roomKey);
      }
    );
  };

  if (!isClient || authLoading) {
    return <AppShellSkeleton />;
  }

  if (!authToken || !authUser) {
    return (
      <div className="min-h-screen bg-[color:var(--app-bg)] flex items-center justify-center p-6">
        <div className="w-full max-w-md surface-card p-8">
          <h1 className="text-2xl font-semibold text-gray-100 mb-2">Iniciar sesion</h1>
          <p className="text-sm text-[color:var(--text-soft)] mb-6">
            Usa tu cuenta de Google para entrar al chat.
          </p>
          <div ref={googleButtonRef} className="min-h-[44px]" />
          {authError ? <p className="mt-4 text-sm text-red-400">{authError}</p> : null}
        </div>
      </div>
    );
  }

  if (!authUser.profileCompleted) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] flex items-center justify-center p-6">
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
      className={`flex h-screen overflow-hidden ${darkMode ? "dark bg-[color:var(--app-bg)]" : "bg-[color:var(--app-bg)]"}`}
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
                  onClick={handleBack}
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
                        onClick={clearPostFilters}
                        className="w-full mt-1 h-7 rounded-md border border-white/15 text-[11px] text-gray-200 hover:bg-white/10 active:scale-[0.99] transition-all"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCreateRoom}
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
            onClick={handleOpenPostComposer}
            className="absolute bottom-[calc(var(--bottom-nav-space)-0.65rem)] sm:bottom-[calc(var(--bottom-nav-space)-0.4rem)] right-4 sm:right-5 z-20 h-11 sm:h-12 px-4 rounded-full bg-[#00a884] hover:bg-[#008f72] active:scale-95 transition-all text-white shadow-xl inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">Nuevo post</span>
          </button>
        )}

        {isPostsView && isPostComposerOpen && (
          <div
            className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3"
            onClick={closePostComposer}
          >
            <div
              className="w-full max-w-xl rounded-xl border border-white/15 bg-[#0f151a] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-100">Nuevo post</p>
                  <p className="text-[11px] text-gray-400">Feed: {selectedRoom?.title || selectedRoomKey}</p>
                </div>
                <button
                  onClick={closePostComposer}
                  className="h-8 px-2 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 active:scale-95 transition-all text-xs"
                >
                  Cerrar
                </button>
              </div>

              <div className="p-4 space-y-3">
                <textarea
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
                      onClick={closePostComposer}
                      className="h-8 px-3 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 active:scale-95 transition-all text-xs"
                    >
                      Cancelar
                    </button>
                    <button
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

        {showPrivateChat && (
          <div className="bg-[#f0f2f5]/95 dark:bg-[#202c33]/95 backdrop-blur border-t border-black/5 dark:border-white/10 px-3 sm:px-4 py-2 flex items-end gap-2 z-10 select-none">
            {showEmoji && (
              <div className="absolute bottom-20 left-4 z-50 shadow-2xl">
                <Picker onEmojiClick={(e) => setText((prev) => prev + e.emoji)} theme={darkMode ? "dark" : "light"} />
              </div>
            )}

            {!audioFile && !isRecording && (
              <>
                <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center px-2 py-1.5 shadow-sm">
                  <button
                    onClick={() => setShowEmoji(!showEmoji)}
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
                    onClick={() => fileInputRef.current?.click()}
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
                  onClick={text.trim() ? handleSendText : startRec}
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
                  onClick={cancelRec}
                  className="text-red-500 text-sm font-medium hover:underline"
                >
                  Cancelar
                </button>
                <button onClick={stopRec} className="text-green-500">
                  <StopCircle className="w-6 h-6" />
                </button>
              </div>
            )}

            {audioFile && (
              <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center p-2 gap-3 shadow-sm">
                <button
                  onClick={clearAudio}
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
                  onClick={sendAudio}
                  className="p-3 bg-[#008069] rounded-full text-white shadow-md hover:bg-[#006c59] active:scale-95 transition-all"
                >
                  <SendHorizontal className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <AppBottomNav activeSection={activeSection} onSectionChange={handleSectionChange} />

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

