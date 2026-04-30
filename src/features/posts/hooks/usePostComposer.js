"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeRoomKey } from "@/features/chat/domain/chat-thread.utils.js";
import { formatFileSize } from "@/features/shared/format.utils.js";
import { optimizeImageForUpload } from "@/features/uploads/image-optimizer.js";

export function usePostComposer({
  socketRef,
  isPostsView,
  selectedUser,
  selectedRoomKey,
  defaultRoomKey,
  clientUploadMaxBytes,
  clientImageTargetBytes,
  uploadFileAndGetUrl,
  appendIncomingPost,
  onNotify,
}) {
  const [isPostComposerOpen, setIsPostComposerOpen] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postAttachment, setPostAttachment] = useState(null);
  const [postAttachmentPreviewUrl, setPostAttachmentPreviewUrl] = useState("");
  const [postPublishing, setPostPublishing] = useState(false);

  const resetPostComposer = useCallback(() => {
    setIsPostComposerOpen(false);
    setPostDraft("");
    setPostAttachment(null);
    setPostPublishing(false);
  }, []);

  const openPostComposer = useCallback(() => {
    if (!isPostsView || selectedUser) return;
    setIsPostComposerOpen(true);
  }, [isPostsView, selectedUser]);

  const closePostComposer = useCallback(() => {
    resetPostComposer();
  }, [resetPostComposer]);

  const handlePostAttachmentChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const prepared = file.type.startsWith("image/")
          ? await optimizeImageForUpload(file, clientImageTargetBytes)
          : {
              blob: file,
              fileName: file.name,
              fileType: file.type || "application/octet-stream",
              fileSize: Number(file.size) || 0,
              optimized: false,
            };

        if (prepared.fileSize > clientUploadMaxBytes) {
          throw new Error(`Archivo supera el limite de ${formatFileSize(clientUploadMaxBytes)} incluso tras optimizacion`);
        }

        setPostAttachment({
          file: prepared.blob,
          name: prepared.fileName,
          type: prepared.fileType || "application/octet-stream",
          size: prepared.fileSize || 0,
        });
      } catch (error) {
        const message = error?.message || "No se pudo preparar la imagen";
        if (typeof onNotify === "function") {
          onNotify({ type: "error", message });
        } else {
          console.error(message);
        }
        setPostAttachment(null);
      } finally {
        event.target.value = "";
      }
    },
    [clientImageTargetBytes, clientUploadMaxBytes, onNotify]
  );

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

  const handlePublishPost = useCallback(async () => {
    if (!socketRef.current || selectedUser || postPublishing) return;

    const content = String(postDraft || "").trim();
    if (!content && !postAttachment?.file) return;
    if (postAttachment?.size && Number(postAttachment.size) > clientUploadMaxBytes) {
      const message = `Archivo supera el limite de ${formatFileSize(clientUploadMaxBytes)}`;
      if (typeof onNotify === "function") {
        onNotify({ type: "error", message });
      } else {
        console.error(message);
      }
      return;
    }

    setPostPublishing(true);

    try {
      const roomKey = normalizeRoomKey(selectedRoomKey, defaultRoomKey);
      let media = [];

      if (postAttachment?.file) {
        const uploaded = await uploadFileAndGetUrl(postAttachment.file, {
          scope: "post-media",
          fileName: postAttachment.name,
          fileType: postAttachment.type,
          fileSize: postAttachment.size,
        });
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
      const message = error?.message || "No se pudo publicar";
      if (typeof onNotify === "function") {
        onNotify({ type: "error", message });
      } else {
        console.error(message);
      }
    } finally {
      setPostPublishing(false);
    }
  }, [
    appendIncomingPost,
    clientUploadMaxBytes,
    defaultRoomKey,
    postAttachment,
    postDraft,
    postPublishing,
    selectedRoomKey,
    selectedUser,
    socketRef,
    onNotify,
    uploadFileAndGetUrl,
  ]);

  return {
    isPostComposerOpen,
    postDraft,
    setPostDraft,
    postAttachment,
    postAttachmentPreviewUrl,
    postPublishing,
    openPostComposer,
    closePostComposer,
    resetPostComposer,
    handlePostAttachmentChange,
    removePostAttachment,
    handlePublishPost,
  };
}
