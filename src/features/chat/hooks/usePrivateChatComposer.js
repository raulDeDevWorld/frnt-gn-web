"use client";

import { useCallback, useRef, useState } from "react";
import { formatFileSize } from "@/features/shared/format.utils.js";
import { optimizeImageForUpload } from "@/features/uploads/image-optimizer.js";

export function usePrivateChatComposer({
  selectedUser,
  sendMessage,
  uploadFileAndGetUrl,
  clientUploadMaxBytes,
  clientImageTargetBytes,
}) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const resetPrivateComposer = useCallback(() => {
    setText("");
    setShowEmoji(false);
    setIsRecording(false);
    setAudioFile(null);
    setAudioDuration(0);
  }, []);

  const handleSendText = useCallback(() => {
    if (!selectedUser) return;
    if (!text.trim()) return;
    sendMessage(text, "text");
    setText("");
    setShowEmoji(false);
  }, [selectedUser, sendMessage, text]);

  const startRec = useCallback(async () => {
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
  }, []);

  const stopRec = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setAudioDuration(5);
  }, [isRecording]);

  const cancelRec = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      const recorder = mediaRecorderRef.current;
      const stream = recorder.stream;
      recorder.onstop = () => {
        stream?.getTracks?.().forEach((track) => track.stop());
      };
      recorder.stop();
    }
    setIsRecording(false);
    setAudioFile(null);
    setAudioDuration(0);
  }, [isRecording]);

  const clearAudio = useCallback(() => {
    setAudioFile(null);
    setAudioDuration(0);
  }, []);

  const sendAudio = useCallback(async () => {
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
      clearAudio();
    } catch (error) {
      alert(error?.message || "No se pudo subir el audio");
    }
  }, [audioDuration, audioFile, clearAudio, sendMessage, uploadFileAndGetUrl]);

  const handleFileSelect = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const prepared = file.type.startsWith("image/")
          ? await optimizeImageForUpload(file, clientImageTargetBytes)
          : {
              blob: file,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              optimized: false,
            };

        if (prepared.fileSize > clientUploadMaxBytes) {
          throw new Error(
            `Archivo supera el limite de ${formatFileSize(clientUploadMaxBytes)} incluso tras optimizacion`
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
        event.target.value = "";
      }
    },
    [clientImageTargetBytes, clientUploadMaxBytes, sendMessage, uploadFileAndGetUrl]
  );

  return {
    text,
    setText,
    showEmoji,
    setShowEmoji,
    isRecording,
    audioFile,
    audioDuration,
    handleSendText,
    startRec,
    stopRec,
    cancelRec,
    clearAudio,
    sendAudio,
    handleFileSelect,
    resetPrivateComposer,
  };
}
