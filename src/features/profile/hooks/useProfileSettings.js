"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAliasSuggestion, iso2ToFlagEmoji } from "@/features/auth/profile.utils.js";

export function useProfileSettings({
  authToken,
  authUser,
  backendUrl,
  fallbackCountries,
  persistAuth,
  setAuthUser,
}) {
  const [profileForm, setProfileForm] = useState({
    language: "es",
    alias: "",
    displayName: "",
    birthDate: "",
    phoneNumber: "",
    country: "",
    gender: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState("");

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
        const response = await fetch(`${backendUrl}/api/meta/countries`, {
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
          setCountries(fallbackCountries);
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
  }, [authToken, backendUrl, countries.length, fallbackCountries]);

  const countryOptions = useMemo(() => {
    const base = countries.length ? countries : fallbackCountries;
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
  }, [countries, fallbackCountries, profileForm.country]);

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

        const response = await fetch(`${backendUrl}/api/auth/profile`, {
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
    [authToken, backendUrl, persistAuth, profileForm, setAuthUser]
  );

  const resetProfileState = useCallback(() => {
    setProfileForm({
      language: "es",
      alias: "",
      displayName: "",
      birthDate: "",
      phoneNumber: "",
      country: "",
      gender: "",
    });
    setProfileSaving(false);
    setProfileError("");
    setCountries([]);
    setCountriesLoading(false);
    setCountriesError("");
  }, []);

  return {
    profileForm,
    profileSaving,
    profileError,
    countries,
    countriesLoading,
    countriesError,
    countryOptions,
    handleProfileChange,
    handleSubmitProfile,
    resetProfileState,
  };
}
