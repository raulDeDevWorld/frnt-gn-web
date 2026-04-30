"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAuthSession({
  backendUrl,
  googleClientId,
  authStorageKey,
}) {
  const [isClient, setIsClient] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const googleButtonRef = useRef(null);
  const googleInitRef = useRef(false);

  const persistAuth = useCallback(
    (token, user) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(authStorageKey, JSON.stringify({ token, user }));
    },
    [authStorageKey]
  );

  const clearAuthCore = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(authStorageKey);
    }
    googleInitRef.current = false;
    if (googleButtonRef.current) {
      googleButtonRef.current.innerHTML = "";
    }
    setAuthToken("");
    setAuthUser(null);
  }, [authStorageKey]);

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
        const request = await fetch(`${backendUrl}/api/auth/google`, {
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
        clearAuthCore();
        setAuthError(error?.message || "Error autenticando con Google");
      } finally {
        setAuthLoading(false);
      }
    },
    [backendUrl, clearAuthCore, persistAuth]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const restore = async () => {
      try {
        const raw = window.localStorage.getItem(authStorageKey);
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

        const response = await fetch(`${backendUrl}/api/auth/me`, {
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
        clearAuthCore();
      } finally {
        setAuthLoading(false);
      }
    };

    restore();
  }, [authStorageKey, backendUrl, clearAuthCore, isClient, persistAuth]);

  useEffect(() => {
    if (!isClient || authToken || authLoading) return;

    if (!googleClientId) {
      setAuthError("Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      return;
    }

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current || googleInitRef.current) return;
      googleInitRef.current = true;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
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
  }, [authLoading, authToken, googleClientId, handleGoogleCredential, isClient]);

  return {
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
  };
}
