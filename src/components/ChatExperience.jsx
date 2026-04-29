"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { io } from "socket.io-client";
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
import { MessageBubble } from "@/components/MessageBubble.jsx";
import { ChatSidebar } from "@/components/ChatSidebar.jsx";
import { RoomPostCard } from "@/components/RoomPostCard.jsx";
import { buildAliasSuggestion, iso2ToFlagEmoji } from "@/features/auth/profile.utils.js";
import {
  buildDirectMessagePreview,
  mergeDirectThreads,
  mergePrivateThread,
  mergeRooms,
  normalizeRoomKey,
  upsertMessage,
} from "@/features/chat/domain/chat-thread.utils.js";
import {
  buildPostPreview,
  mergePostsDesc,
  normalizeIncomingPost as normalizeIncomingPostDomain,
} from "@/features/posts/domain/post-feed.utils.js";
import { formatFileSize } from "@/features/shared/format.utils.js";
import { optimizeImageForUpload } from "@/features/uploads/image-optimizer.js";

const DEFAULT_ROOM_KEY = "public";
const ROOM_POST_PAGE_SIZE = 20;
const POST_SCROLL_BOTTOM_THRESHOLD = 180;
const CHAT_HISTORY_PAGE_SIZE = 30;
const CHAT_SCROLL_TOP_THRESHOLD = 120;
const CLIENT_UPLOAD_MAX_BYTES = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_BYTES || 1000000);
const CLIENT_IMAGE_TARGET_BYTES = Math.max(300000, Math.floor(CLIENT_UPLOAD_MAX_BYTES * 0.95));
const DEFAULT_POST_FILTERS = { mine: false, media: false, text: false };
const POST_FILTER_OPTIONS = [
  { key: "mine", label: "Mis posts" },
  { key: "media", label: "Con media" },
  { key: "text", label: "Solo texto" },
];
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const AUTH_STORAGE_KEY = "chat_auth_google_jwt";
const EMPTY_PROFILE_FORM = {
  language: "es",
  alias: "",
  displayName: "",
  birthDate: "",
  phoneNumber: "",
  country: "",
  gender: "",
};
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

export default function ChatExperience() {
  const pathname = usePathname();
  const router = useRouter();
  const routeSection = sectionFromPathname(pathname);
  const [isClient, setIsClient] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE_FORM);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState("");

  const [publicRooms, setPublicRooms] = useState([]);
  const [roomPosts, setRoomPosts] = useState({});
  const [roomPostPaging, setRoomPostPaging] = useState({});
  const [postCommentsById, setPostCommentsById] = useState({});
  const [roomMessages, setRoomMessages] = useState({});
  const [privateChats, setPrivateChats] = useState({});
  const [directChatThreads, setDirectChatThreads] = useState([]);
  const [privateChatPaging, setPrivateChatPaging] = useState({});
  const [activeUsers, setActiveUsers] = useState([]);

  const [activeSection, setActiveSection] = useState(routeSection);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoomKey, setSelectedRoomKey] = useState(DEFAULT_ROOM_KEY);
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [postFilters, setPostFilters] = useState(DEFAULT_POST_FILTERS);
  const [postFilterPanelOpen, setPostFilterPanelOpen] = useState(false);
  const [isPostComposerOpen, setIsPostComposerOpen] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postAttachment, setPostAttachment] = useState(null);
  const [postAttachmentPreviewUrl, setPostAttachmentPreviewUrl] = useState("");
  const [postPublishing, setPostPublishing] = useState(false);
  const [mobileView, setMobileView] = useState("chat");
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [mediaViewerData, setMediaViewerData] = useState(null);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);
  const fileInputRef = useRef(null);
  const postComposerFileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const roomPostPagingRef = useRef({});
  const privateChatPagingRef = useRef({});
  const skipNextPrivateAutoScrollRef = useRef(false);
  const googleButtonRef = useRef(null);
  const googleInitRef = useRef(false);
  const postFilterPanelRef = useRef(null);
  const userId = authUser?.userId || "";

  useEffect(() => {
    const next = sectionFromPathname(pathname);
    setActiveSection((prev) => (prev === next ? prev : next));
  }, [pathname]);

  useEffect(() => {
    roomPostPagingRef.current = roomPostPaging;
  }, [roomPostPaging]);

  useEffect(() => {
    privateChatPagingRef.current = privateChatPaging;
  }, [privateChatPaging]);

  const persistAuth = useCallback((token, user) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
  }, []);

  const clearAuth = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    googleInitRef.current = false;
    if (googleButtonRef.current) {
      googleButtonRef.current.innerHTML = "";
    }
    setAuthToken("");
    setAuthUser(null);
    setPublicRooms([]);
    setRoomPosts({});
    setRoomPostPaging({});
    setPostCommentsById({});
    setRoomMessages({});
    setPrivateChats({});
    setDirectChatThreads([]);
    setPrivateChatPaging({});
    setActiveUsers([]);
    setActiveSection("posts");
    router.replace("/posts");
    setSelectedUser(null);
    setSelectedRoomKey(DEFAULT_ROOM_KEY);
    setPostSearchQuery("");
    setPostFilters({ ...DEFAULT_POST_FILTERS });
    setPostFilterPanelOpen(false);
    setIsPostComposerOpen(false);
    setPostDraft("");
    setPostAttachment(null);
    setPostPublishing(false);
    setMobileView("chat");
    setProfileForm(EMPTY_PROFILE_FORM);
    setProfileSaving(false);
    setProfileError("");
    setCountries([]);
    setCountriesLoading(false);
    setCountriesError("");
  }, [router]);

  const handleGoogleCredential = useCallback(
    async (response) => {
      const idToken = String(response?.credential || "").trim();
      if (!idToken) {
        setAuthError("Google no devolvio credencial");
        return;
      }

      setAuthLoading(true);
      setAuthError("");

      try {
        const request = await fetch(`${BACKEND_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const payload = await request.json();
        if (!request.ok || !payload?.ok || !payload?.token || !payload?.user) {
          throw new Error(payload?.error || "No se pudo iniciar sesion con Google");
        }

        setAuthToken(payload.token);
        setAuthUser(payload.user);
        persistAuth(payload.token, payload.user);
      } catch (error) {
        clearAuth();
        setAuthError(error?.message || "Error autenticando con Google");
      } finally {
        setAuthLoading(false);
      }
    },
    [clearAuth, persistAuth]
  );

  useEffect(() => {
    if (!isClient) return;

    const restore = async () => {
      try {
        const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) {
          setAuthLoading(false);
          return;
        }

        const parsed = JSON.parse(raw);
        const storedToken = String(parsed?.token || "").trim();
        if (!storedToken) {
          setAuthLoading(false);
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !payload?.user) {
          throw new Error(payload?.error || "Sesion invalida");
        }

        setAuthToken(storedToken);
        setAuthUser(payload.user);
        persistAuth(storedToken, payload.user);
      } catch {
        clearAuth();
      } finally {
        setAuthLoading(false);
      }
    };

    restore();
  }, [clearAuth, isClient, persistAuth]);

  useEffect(() => {
    if (!isClient || authToken || authLoading) return;

    if (!GOOGLE_CLIENT_ID) {
      setAuthError("Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      return;
    }

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current || googleInitRef.current) return;
      googleInitRef.current = true;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 280,
      });
    };

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => setAuthError("No se pudo cargar Google Sign-In");
    document.head.appendChild(script);
  }, [authLoading, authToken, handleGoogleCredential, isClient]);

  useEffect(() => {
    if (!authUser) return;

    setProfileForm({
      language: authUser.language || "es",
      alias: authUser.alias || buildAliasSuggestion(authUser),
      displayName: authUser.displayName || "",
      birthDate: authUser.birthDate || "",
      phoneNumber: authUser.phoneNumber || "",
      country: authUser.country || "",
      gender: authUser.gender || "",
    });
    setProfileError("");
  }, [authUser]);

  useEffect(() => {
    if (!authToken) return;
    if (countries.length) return;

    let cancelled = false;

    const loadCountries = async () => {
      setCountriesLoading(true);
      setCountriesError("");
      try {
        const response = await fetch(`${BACKEND_URL}/api/meta/countries`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.countries)) {
          throw new Error(payload?.error || "No se pudo cargar paises");
        }

        if (!cancelled) {
          setCountries(payload.countries);
        }
      } catch (error) {
        if (!cancelled) {
          setCountries(FALLBACK_COUNTRIES);
          setCountriesError(error?.message || "No se pudo cargar paises");
        }
      } finally {
        if (!cancelled) {
          setCountriesLoading(false);
        }
      }
    };

    loadCountries();

    return () => {
      cancelled = true;
    };
  }, [authToken, countries.length]);

  const countryOptions = useMemo(() => {
    const base = countries.length ? countries : FALLBACK_COUNTRIES;
    const map = new Map();

    for (const item of base) {
      const code = String(item?.code || "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) continue;
      if (map.has(code)) continue;

      const providedFlag = String(item?.flag || "").trim();

      map.set(code, {
        code,
        name: String(item?.name || code).trim(),
        flag: providedFlag || iso2ToFlagEmoji(code),
      });
    }

    const current = String(profileForm.country || "")
      .trim()
      .toUpperCase();
    if (current && !map.has(current)) {
      map.set(current, { code: current, name: current, flag: iso2ToFlagEmoji(current) });
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [countries, profileForm.country]);

  const handleProfileChange = useCallback((field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmitProfile = useCallback(
    async (event) => {
      event.preventDefault();
      if (!authToken) return;

      setProfileSaving(true);
      setProfileError("");

      try {
        const payloadBody = {
          language: profileForm.language,
          alias: profileForm.alias,
          displayName: profileForm.displayName,
          birthDate: profileForm.birthDate,
          phoneNumber: profileForm.phoneNumber,
          country: profileForm.country,
          gender: profileForm.gender,
        };

        const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payloadBody),
        });

        const payload = await response.json();
        if (!response.ok || !payload?.ok || !payload?.user) {
          throw new Error(payload?.error || "No se pudo guardar el perfil");
        }

        setAuthUser(payload.user);
        persistAuth(authToken, payload.user);
      } catch (error) {
        setProfileError(error?.message || "No se pudo guardar el perfil");
      } finally {
        setProfileSaving(false);
      }
    },
    [authToken, persistAuth, profileForm]
  );

  const touchRoomWithPost = useCallback((roomKey, post) => {
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
  }, []);

  const appendIncomingPost = useCallback(
    (incomingPost) => {
      const normalized = normalizeIncomingPostDomain(incomingPost, {
        fallbackRoomKey: selectedRoomKey,
        normalizeRoomKey: (value) => normalizeRoomKey(value, DEFAULT_ROOM_KEY),
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
    [selectedRoomKey, touchRoomWithPost]
  );

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
        const response = await fetch(`${BACKEND_URL}/api/posts/${id}/like`, {
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
            normalizeRoomKey: (value) => normalizeRoomKey(value, DEFAULT_ROOM_KEY),
          })
        );
      } catch (error) {
        if (rollback) {
          patchPostById(id, () => rollback);
        }
        alert(error?.message || "No se pudo actualizar like");
      }
    },
    [authToken, patchPostById, selectedRoomKey]
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
        const response = await fetch(`${BACKEND_URL}/api/posts/${id}/comments?limit=40`, {
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
    [authToken]
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
        const response = await fetch(`${BACKEND_URL}/api/posts/${id}/comments`, {
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
              normalizeRoomKey: (value) => normalizeRoomKey(value, DEFAULT_ROOM_KEY),
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
    [authToken, patchPostById, selectedRoomKey]
  );

  const requestRoomPosts = useCallback((roomKey, options = {}) => {
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
        limit: ROOM_POST_PAGE_SIZE,
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
            normalizeRoomKey: (value) => normalizeRoomKey(value, DEFAULT_ROOM_KEY),
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
  }, []);

  const requestPrivateHistory = useCallback((peerUserId, options = {}) => {
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
        limit: CHAT_HISTORY_PAGE_SIZE,
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
  }, [upsertDirectThread]);

  const joinRoom = useCallback((roomKey) => {
    if (!socketRef.current) return;
    socketRef.current.emit("room:join", { roomKey });
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!userId || !authToken || !authUser?.profileCompleted) return;

    const socket = io(BACKEND_URL, {
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

      const roomKey = normalizeRoomKey(msg?.roomKey || msg?.to || DEFAULT_ROOM_KEY);
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
      joinRoom(DEFAULT_ROOM_KEY);
      requestRoomPosts(DEFAULT_ROOM_KEY);
    };

    socket.on("connect", bootstrapOnConnect);
    if (socket.connected) {
      bootstrapOnConnect();
    }

    return () => {
      socket.off("connect", bootstrapOnConnect);
      socket.disconnect();
    };
  }, [appendIncomingPost, authToken, authUser?.profileCompleted, clearAuth, joinRoom, requestRoomPosts, upsertDirectThread, userId]);

  const currentMessages = useMemo(
    () => (selectedUser ? privateChats[selectedUser] || [] : []),
    [privateChats, selectedUser]
  );

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

  const selectedRoom = useMemo(
    () => publicRooms.find((room) => room.roomKey === selectedRoomKey) || null,
    [publicRooms, selectedRoomKey]
  );
  const selectedRoomPaging = roomPostPaging[selectedRoomKey] || {};
  const selectedPrivatePaging = selectedUser ? privateChatPaging[selectedUser] || {} : {};
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

  const handleMessageScroll = useCallback(
    (event) => {
      const container = event.currentTarget;
      if (showPrivateChat) {
        const nearTop = container.scrollTop <= CHAT_SCROLL_TOP_THRESHOLD;
        if (nearTop) {
          loadOlderPrivateMessages();
        }
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
    [isPostsView, loadOlderPrivateMessages, loadOlderRoomPosts, showPrivateChat]
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
  }, [currentMessages.length, showPrivateChat]);

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
  }, [currentMessages, selectedUser, showPrivateChat]);

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

  const openPostComposer = useCallback(() => {
    if (!isPostsView || selectedUser) return;
    setShowEmoji(false);
    setPostFilterPanelOpen(false);
    setIsPostComposerOpen(true);
  }, [isPostsView, selectedUser]);

  const closePostComposer = useCallback(() => {
    setIsPostComposerOpen(false);
    setPostDraft("");
    setPostAttachment(null);
    setPostPublishing(false);
  }, []);

  const handlePostAttachmentChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const prepared = file.type.startsWith("image/")
        ? await optimizeImageForUpload(file, CLIENT_IMAGE_TARGET_BYTES)
        : {
            blob: file,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: Number(file.size) || 0,
            optimized: false,
          };

      if (prepared.fileSize > CLIENT_UPLOAD_MAX_BYTES) {
        throw new Error(
          `Archivo supera el limite de ${formatFileSize(CLIENT_UPLOAD_MAX_BYTES)} incluso tras optimizacion`
        );
      }

      setPostAttachment({
        file: prepared.blob,
        name: prepared.fileName,
        type: prepared.fileType || "application/octet-stream",
        size: prepared.fileSize || 0,
      });
    } catch (error) {
      alert(error?.message || "No se pudo preparar la imagen");
      setPostAttachment(null);
    } finally {
      event.target.value = "";
    }
  }, []);

  const removePostAttachment = useCallback(() => {
    setPostAttachment(null);
  }, []);

  useEffect(() => {
    if (!postAttachment?.file) {
      setPostAttachmentPreviewUrl("");
      return;
    }

    const mime = String(postAttachment.type || "");
    if (!mime.startsWith("image/") && !mime.startsWith("video/") && !mime.startsWith("audio/")) {
      setPostAttachmentPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(postAttachment.file);
    setPostAttachmentPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [postAttachment]);

  const handleSelectUser = (user) => {
    upsertDirectThread(user);
    router.push("/chats");
    setActiveSection("chats");
    setSelectedUser(user);
    setPostFilterPanelOpen(false);
    setIsPostComposerOpen(false);
    setPostDraft("");
    setPostAttachment(null);
    setMobileView("chat");
  };

  const handleSelectRoom = (roomKey) => {
    const key = normalizeRoomKey(roomKey, DEFAULT_ROOM_KEY);
    router.push("/posts");
    setActiveSection("posts");
    setSelectedUser(null);
    setSelectedRoomKey(key);
    setPostSearchQuery("");
    setPostFilters({ ...DEFAULT_POST_FILTERS });
    setPostFilterPanelOpen(false);
    setIsPostComposerOpen(false);
    setPostDraft("");
    setPostAttachment(null);
    setMobileView("chat");
    setShowEmoji(false);
    joinRoom(key);
    requestRoomPosts(key);
  };

  const handleSectionChange = useCallback(
    (section) => {
      const next = section === "chats" || section === "config" ? section : "posts";
      const nextPath = pathnameFromSection(next);
      if (pathname !== nextPath) {
        router.push(nextPath);
      }
      setActiveSection(next);
      setMobileView(next === "chats" && !selectedUser ? "list" : "chat");
      setPostFilterPanelOpen(false);
      setIsPostComposerOpen(false);
      if (next !== "posts") {
        setIsPostComposerOpen(false);
      }
      if (next === "posts") {
        setSelectedUser(null);
        requestRoomPosts(selectedRoomKey);
      }
      if (next === "config") {
        setSelectedUser(null);
      }
    },
    [pathname, requestRoomPosts, router, selectedRoomKey, selectedUser]
  );

  const handleStartDmFromPost = useCallback(
    (authorId) => {
      const targetUserId = String(authorId || "").trim();
      if (!targetUserId || targetUserId === userId) return;
      handleSelectUser(targetUserId);
    },
    [handleSelectUser, userId]
  );

  const sendMessage = (content, type = "text", fileData = {}) => {
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
  };

  const handleSendText = () => {
    if (!selectedUser) return;
    if (!text.trim()) return;
    sendMessage(text, "text");
    setText("");
    setShowEmoji(false);
  };

  const uploadFileAndGetUrl = useCallback(
    async (fileBlob, options = {}) => {
      if (!authToken) throw new Error("Sesion no disponible");

      const fileName = String(options?.fileName || fileBlob?.name || "file").trim() || "file";
      const fileType = String(options?.fileType || fileBlob?.type || "application/octet-stream").trim();
      const fileSize = Number(options?.fileSize ?? fileBlob?.size ?? 0);
      const scope = String(options?.scope || "chat-media").trim();
      const clientTraceId = `upl_client_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

      if (!fileBlob || typeof fileBlob !== "object") {
        throw new Error("Archivo invalido");
      }
      if (!fileType) {
        throw new Error("Tipo de archivo invalido");
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        throw new Error("Tamano de archivo invalido");
      }
      try {
        console.info("[upload] start", {
          clientTraceId,
          scope,
          fileName,
          fileType,
          fileSize,
        });

        const presignResponse = await fetch(`${BACKEND_URL}/api/uploads/presign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            scope,
            fileName,
            fileType,
            fileSize,
          }),
        });

        const presignPayload = await presignResponse.json();
        if (!presignResponse.ok || !presignPayload?.ok || !presignPayload?.uploadUrl || !presignPayload?.uploadToken) {
          console.error("[upload] presign_error", {
            clientTraceId,
            status: presignResponse.status,
            backendTraceId: presignPayload?.traceId || null,
            payload: presignPayload,
          });
          throw new Error(
            `${presignPayload?.error || "No se pudo preparar subida"}${presignPayload?.traceId ? ` (trace ${presignPayload.traceId})` : ""}`
          );
        }

        const uploadHeaders = {
          ...(presignPayload.headers || {}),
          "Content-Type": fileType,
        };

        let putResponse;
        try {
          putResponse = await fetch(presignPayload.uploadUrl, {
            method: "PUT",
            headers: uploadHeaders,
            body: fileBlob,
          });
        } catch (error) {
          console.error("[upload] s3_put_network_or_cors_error", {
            clientTraceId,
            message: error?.message || String(error),
            name: error?.name || null,
            uploadUrlHost: (() => {
              try {
                return new URL(presignPayload.uploadUrl).host;
              } catch {
                return null;
              }
            })(),
          });
          throw new Error(
            "Fallo subiendo a S3 (posible CORS/red). Revisa CORS del bucket y Content-Type del archivo."
          );
        }

        if (!putResponse.ok) {
          const errorBody = await putResponse.text().catch(() => "");
          console.error("[upload] s3_put_http_error", {
            clientTraceId,
            status: putResponse.status,
            statusText: putResponse.statusText,
            body: errorBody?.slice(0, 1000),
          });
          throw new Error(`S3 rechazo la subida (${putResponse.status})`);
        }

        const completeResponse = await fetch(`${BACKEND_URL}/api/uploads/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            key: presignPayload.key,
            uploadToken: presignPayload.uploadToken,
          }),
        });
        const completePayload = await completeResponse.json();
        if (!completeResponse.ok || !completePayload?.ok || !completePayload?.fileUrl) {
          console.error("[upload] complete_error", {
            clientTraceId,
            status: completeResponse.status,
            backendTraceId: completePayload?.traceId || null,
            payload: completePayload,
          });
          throw new Error(
            `${completePayload?.error || "No se pudo confirmar subida"}${completePayload?.traceId ? ` (trace ${completePayload.traceId})` : ""}`
          );
        }

        console.info("[upload] done", {
          clientTraceId,
          backendTraceId: completePayload?.traceId || presignPayload?.traceId || null,
          key: completePayload?.key || presignPayload?.key,
          fileType: completePayload?.fileType || fileType,
          fileSize: Number(completePayload?.fileSize) || fileSize,
        });

        return {
          mediaUrl: completePayload.fileUrl,
          fileType: completePayload.fileType || fileType,
          fileSize: Number(completePayload.fileSize) || fileSize,
          key: completePayload.key || presignPayload.key,
        };
      } catch (error) {
        throw new Error(error?.message || "No se pudo subir archivo");
      }
    },
    [authToken]
  );

  const handlePublishPost = useCallback(async () => {
    if (!socketRef.current || selectedUser || postPublishing) return;

    const content = String(postDraft || "").trim();
    if (!content && !postAttachment?.file) return;
    if (postAttachment?.size && Number(postAttachment.size) > CLIENT_UPLOAD_MAX_BYTES) {
      alert(`Archivo supera el limite de ${formatFileSize(CLIENT_UPLOAD_MAX_BYTES)}`);
      return;
    }

    setPostPublishing(true);

    try {
      const roomKey = normalizeRoomKey(selectedRoomKey);
      let media = [];

      if (postAttachment?.file) {
        const uploaded = await uploadFileAndGetUrl(
          postAttachment.file,
          {
            scope: "post-media",
            fileName: postAttachment.name,
            fileType: postAttachment.type,
            fileSize: postAttachment.size,
          }
        );
        media = [
          {
            url: uploaded.mediaUrl,
            mime: uploaded.fileType || postAttachment.type || "application/octet-stream",
            name: postAttachment.name || null,
            size: uploaded.fileSize || postAttachment.size || 0,
          },
        ];
      }

      const response = await new Promise((resolve) => {
        socketRef.current.emit(
          "post:create",
          {
            roomKey,
            content,
            ...(media.length ? { media } : {}),
            tempId: `post_${Date.now()}`,
          },
          resolve
        );
      });

      if (!response?.ok) {
        throw new Error("No se pudo publicar");
      }

      if (response.post) {
        appendIncomingPost(response.post);
      }

      setPostDraft("");
      setPostAttachment(null);
      setIsPostComposerOpen(false);
    } catch (error) {
      alert(error?.message || "No se pudo publicar");
    } finally {
      setPostPublishing(false);
    }
  }, [appendIncomingPost, postAttachment, postDraft, postPublishing, selectedRoomKey, selectedUser, uploadFileAndGetUrl]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioFile({ blob, name: "audio.webm", type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch {
      alert("Error Microfono");
    }
  };

  const stopRec = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setAudioDuration(5);
  };

  const sendAudio = async () => {
    if (!audioFile) return;
    try {
      const uploaded = await uploadFileAndGetUrl(audioFile.blob, {
        scope: "chat-media",
        fileName: audioFile.name,
        fileType: audioFile.type,
        fileSize: audioFile.blob?.size,
      });
      sendMessage("", "audio", {
        mediaUrl: uploaded.mediaUrl,
        fileType: uploaded.fileType || audioFile.type,
        fileName: audioFile.name,
        fileSize: uploaded.fileSize || audioFile.blob?.size || 0,
        duration: audioDuration,
      });
      setAudioFile(null);
    } catch (error) {
      alert(error?.message || "No se pudo subir el audio");
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const prepared = file.type.startsWith("image/")
        ? await optimizeImageForUpload(file, CLIENT_IMAGE_TARGET_BYTES)
        : {
            blob: file,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            optimized: false,
          };

      if (prepared.fileSize > CLIENT_UPLOAD_MAX_BYTES) {
        throw new Error(
          `Archivo supera el limite de ${formatFileSize(CLIENT_UPLOAD_MAX_BYTES)} incluso tras optimizacion`
        );
      }

      const uploaded = await uploadFileAndGetUrl(prepared.blob, {
        scope: "chat-media",
        fileName: prepared.fileName,
        fileType: prepared.fileType,
        fileSize: prepared.fileSize,
      });
      const fileKind = String(prepared.fileType || file.type).startsWith("image")
        ? "image"
        : String(prepared.fileType || file.type).startsWith("video")
          ? "video"
          : "file";

      sendMessage("", fileKind, {
        mediaUrl: uploaded.mediaUrl,
        fileName: prepared.fileName,
        fileType: uploaded.fileType || prepared.fileType || file.type,
        fileSize: uploaded.fileSize || prepared.fileSize || file.size,
      });
    } catch (error) {
      alert(error?.message || "No se pudo subir el archivo");
    } finally {
      e.target.value = "";
    }
  };

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
    return (
      <div className="flex items-center justify-center h-screen bg-[#f0f2f5] dark:bg-[#111b21] text-gray-500">
        Cargando...
      </div>
    );
  }

  if (!authToken || !authUser) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#202c33] rounded-2xl border border-black/5 dark:border-white/10 shadow-lg p-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Iniciar sesion</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Usa tu cuenta de Google para entrar al chat.
          </p>
          <div ref={googleButtonRef} className="min-h-[44px]" />
          {authError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{authError}</p>}
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
      className={`flex h-screen overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] ${darkMode ? "dark bg-[#0b141a]" : "bg-gray-100"}`}
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
                flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a] relative 
                ${isChatsView ? (mobileView === "chat" ? "flex absolute inset-0 z-50" : "hidden md:flex") : "flex"}
            `}
      >
        {showPrivateChat && (
          <div className="absolute inset-0 opacity-40 pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat" />
        )}

        <div
          className={`shadow-sm z-10 border-b ${
            showPrivateChat
              ? "h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between dark:border-gray-700"
              : "bg-[#121b22] border-white/10 px-3 sm:px-4 py-2.5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isChatsView && (
                <button
                  onClick={handleBack}
                  className={`md:hidden p-2 -ml-2 rounded-full ${
                    showPrivateChat ? "text-gray-600 dark:text-white hover:bg-black/5" : "text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <ArrowLeft />
                </button>
              )}
              <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white text-lg cursor-pointer">
                {sectionHeaderBadge}
              </div>
              <div className="flex flex-col justify-center ml-1 cursor-pointer">
                <p className={`font-medium leading-tight ${showPrivateChat ? "text-gray-900 dark:text-white" : "text-gray-100"}`}>
                  {sectionHeaderTitle}
                </p>
                <p className={`text-xs leading-tight ${showPrivateChat ? "text-gray-500 dark:text-gray-400" : "text-gray-400"}`}>
                  {sectionHeaderSubtitle}
                </p>
              </div>
            </div>

            {isPostsView && (
              <div className="flex items-center gap-2" ref={postFilterPanelRef}>
                <div className="relative">
                  <button
                    onClick={() => setPostFilterPanelOpen((prev) => !prev)}
                    className="h-8 px-2.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-gray-100 inline-flex items-center gap-1.5"
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
                            className="w-full h-8 px-2 rounded-md hover:bg-white/10 text-left inline-flex items-center justify-between text-[12px] text-gray-100"
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
                        className="w-full mt-1 h-7 rounded-md border border-white/15 text-[11px] text-gray-200 hover:bg-white/10"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCreateRoom}
                  className="h-8 w-8 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-gray-100 inline-flex items-center justify-center"
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
              ? "p-4 sm:px-8 md:px-12"
              : isPostsView
                ? "p-3 sm:px-4 md:px-6 bg-[#11181e] dark:bg-[#0f151a]"
                : "p-3 sm:px-4 md:px-6 bg-[#10171c] dark:bg-[#0f151a]"
          }`}
        >
          {isConfigView && (
            <div className="max-w-2xl mx-auto bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/10 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Config</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Gestiona tu perfil y preferencias.
              </p>

              <form onSubmit={handleSubmitProfile} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs text-gray-600 dark:text-gray-300">Display name</span>
                  <input
                    value={profileForm.displayName}
                    onChange={(e) => handleProfileChange("displayName", e.target.value)}
                    className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600 dark:text-gray-300">Alias</span>
                  <input
                    value={profileForm.alias}
                    onChange={(e) => handleProfileChange("alias", e.target.value)}
                    className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600 dark:text-gray-300">Idioma</span>
                  <select
                    value={profileForm.language}
                    onChange={(e) => handleProfileChange("language", e.target.value.toLowerCase())}
                    className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
                  >
                    <option value="es">Espanol</option>
                    <option value="en">Ingles</option>
                    <option value="pt">Portugues</option>
                  </select>
                </label>
                {profileError && <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{profileError}</p>}
                <div className="sm:col-span-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="h-10 px-4 rounded-md bg-[#00a884] text-white font-medium hover:bg-[#008f72] disabled:opacity-60"
                  >
                    {profileSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="h-10 px-4 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a3942]"
                  >
                    Cerrar sesion
                  </button>
                </div>
              </form>
            </div>
          )}

          {showPrivateChat && selectedPrivatePaging.loading && !selectedPrivatePaging.initialized && (
            <div className="text-center text-[12px] text-gray-500 dark:text-gray-300 py-6">
              Cargando mensajes...
            </div>
          )}

          {showPrivateChat &&
            selectedPrivatePaging.initialized &&
            !selectedPrivatePaging.loading &&
            !currentMessages.length && (
              <div className="text-center text-[12px] text-gray-500 dark:text-gray-300 py-6">
                Aun no hay mensajes en este chat.
              </div>
            )}

          {showPrivateChat &&
            selectedPrivatePaging.initialized &&
            selectedPrivatePaging.hasMore &&
            !selectedPrivatePaging.loadingMore &&
            currentMessages.length > 0 && (
              <div className="text-center text-[11px] text-gray-500 dark:text-gray-300 py-2">
                Desliza hacia arriba para cargar mas mensajes
              </div>
            )}

          {showPrivateChat && selectedPrivatePaging.loadingMore && (
            <div className="text-center text-[11px] text-gray-500 dark:text-gray-300 py-2">
              Cargando mensajes anteriores...
            </div>
          )}

          {showPrivateChat && currentMessages.map((msg, i) => (
            <MessageBubble
              key={msg._id || msg.tempId || i}
              msg={msg}
              USER_ID={userId}
              onMediaClick={(m) =>
                setMediaViewerData({
                  fileUrl: m.mediaUrl,
                  fileType: m.fileType,
                  fileName: m.fileName,
                })
              }
            />
          ))}

          {isChatsView && !showPrivateChat && (
            <div className="text-center text-[13px] text-gray-300 py-10">
              Selecciona un usuario en la barra lateral para abrir el chat.
            </div>
          )}

          {isPostsView && selectedRoomPaging.loading && !selectedRoomPaging.initialized && (
            <div className="text-center text-[12px] text-gray-300 py-6">
              Cargando posts...
            </div>
          )}

          {isPostsView && filteredRoomPosts.length > 0 && (
            <div className="max-w-xl mx-auto divide-y divide-white/10">
              {filteredRoomPosts.map((post) => (
                <RoomPostCard
                  key={post._id}
                  post={post}
                  currentUserId={userId}
                  commentState={postCommentsById[post._id] || null}
                  onToggleLike={handleTogglePostLike}
                  onLoadComments={handleLoadPostComments}
                  onCreateComment={handleCreatePostComment}
                  onStartDm={handleStartDmFromPost}
                  onMediaClick={(m) =>
                    setMediaViewerData({
                      fileUrl: m.mediaUrl,
                      fileType: m.fileType,
                      fileName: m.fileName,
                    })
                  }
                />
              ))}
            </div>
          )}

          {isPostsView && selectedRoomPaging.loadingMore && (
            <div className="text-center text-[11px] text-gray-300 py-2">
              Cargando posts anteriores...
            </div>
          )}

          {isPostsView &&
            selectedRoomPaging.initialized &&
            !selectedRoomPaging.loading &&
            !currentRoomPosts.length && (
              <div className="text-center text-[12px] text-gray-300 py-6">
                Aun no hay posts en esta sala.
              </div>
            )}

          {isPostsView &&
            selectedRoomPaging.initialized &&
            !selectedRoomPaging.loading &&
            currentRoomPosts.length > 0 &&
            !filteredRoomPosts.length && (
              <div className="text-center text-[12px] text-gray-300 py-6">
                Sin resultados para tu busqueda o filtro.
              </div>
            )}

          {isPostsView &&
            selectedRoomPaging.initialized &&
            selectedRoomPaging.hasMore &&
            !selectedRoomPaging.loadingMore &&
            filteredRoomPosts.length > 0 && (
              <div className="text-center text-[11px] text-gray-300 py-2">
                Desliza hacia abajo para cargar mas
              </div>
            )}

          {showPrivateChat && <div ref={bottomRef} />}
        </div>

        {isPostsView && !isPostComposerOpen && (
          <button
            onClick={openPostComposer}
            className="absolute bottom-[calc(4.9rem+env(safe-area-inset-bottom))] right-5 z-20 h-12 px-4 rounded-full bg-[#00a884] hover:bg-[#008f72] text-white shadow-xl inline-flex items-center gap-2"
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
                  className="h-8 px-2 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 text-xs"
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
                          {postAttachment.type || "application/octet-stream"} · {formatFileSize(postAttachment.size)}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 h-6 rounded-full border border-white/15 text-gray-300 inline-flex items-center">
                        Preview
                      </span>
                    </div>

                    <div className="px-3 pb-3">
                      <button
                        onClick={removePostAttachment}
                        className="h-8 px-3 rounded-md border border-white/15 text-[11px] text-gray-200 hover:bg-white/10"
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
                      className="h-8 px-2.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-gray-100 inline-flex items-center gap-1.5 text-xs"
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
                      className="h-8 px-3 rounded-md border border-white/15 text-gray-200 hover:bg-white/10 text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handlePublishPost}
                      disabled={postPublishing || (!postDraft.trim() && !postAttachment)}
                      className="h-8 px-3 rounded-md bg-[#00a884] hover:bg-[#008f72] disabled:opacity-60 text-white text-xs font-medium"
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
          <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2 flex items-end gap-2 z-10 select-none">
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
                    className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
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
                    className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full rotate-45"
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
                  className="p-3 rounded-full text-white shadow-md transition-transform active:scale-95 bg-[#008069] hover:bg-[#006c59]"
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
                  onClick={() => {
                    stopRec();
                    setIsRecording(false);
                    setAudioFile(null);
                  }}
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
                  onClick={() => setAudioFile(null)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Audio</span>
                  <div className="flex-1 h-1 bg-green-500/30 rounded overflow-hidden">
                    <div className="h-full bg-green-500 w-full" />
                  </div>
                </div>
                <button onClick={sendAudio} className="p-3 bg-[#008069] rounded-full text-white shadow-md hover:bg-[#006c59]">
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
