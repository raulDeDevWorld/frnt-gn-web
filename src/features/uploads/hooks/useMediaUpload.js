"use client";

import { useCallback } from "react";

export function useMediaUpload({ authToken, backendUrl }) {
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

        const presignResponse = await fetch(`${backendUrl}/api/uploads/presign`, {
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

        const completeResponse = await fetch(`${backendUrl}/api/uploads/complete`, {
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
    [authToken, backendUrl]
  );

  return { uploadFileAndGetUrl };
}
