"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Heart, Play, Paperclip, Send } from "lucide-react";

function buildInitials(authorLabel) {
  const value = String(authorLabel || "USR").trim();
  return value.slice(0, 2).toUpperCase();
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCommentDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RoomPostCard({
  post,
  currentUserId,
  onMediaClick,
  onToggleLike,
  onLoadComments,
  onCreateComment,
  commentState,
  onStartDm,
}) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const isMe = post.authorId === currentUserId;
  const authorLabel = String(post.authorName || "Usuario").trim();
  const firstMedia = Array.isArray(post.media) && post.media.length ? post.media[0] : null;
  const mediaCount = Array.isArray(post.media) ? post.media.length : 0;
  const isImage = firstMedia?.mime?.startsWith("image/");
  const isVideo = firstMedia?.mime?.startsWith("video/");
  const isAudio = firstMedia?.mime?.startsWith("audio/");
  const hasActiveComments = Number(post.commentsCount || 0) > 0;
  const canStartDm = !isMe && String(post.authorId || "").trim().length > 0;

  const comments = useMemo(() => (Array.isArray(commentState?.items) ? commentState.items : []), [commentState?.items]);
  const commentsLoading = Boolean(commentState?.loading);
  const commentsSubmitting = Boolean(commentState?.submitting);
  const commentsLoaded = Boolean(commentState?.loaded);
  const commentsError = String(commentState?.error || "");

  const handleToggleComments = () => {
    const next = !isCommentsOpen;
    setIsCommentsOpen(next);
    if (next) {
      onLoadComments?.(post._id);
    }
  };

  const submitComment = async () => {
    const content = String(commentDraft || "").trim();
    if (!content) return;
    const ok = await onCreateComment?.(post._id, content);
    if (ok) {
      setCommentDraft("");
    }
  };

  return (
    <article className="w-full surface-card px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_26px_rgba(0,0,0,0.24)] sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => canStartDm && onStartDm?.(post.authorId)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-all active:scale-95 ${
              isMe ? "bg-[#00a884] text-white" : "bg-white/12 text-gray-200"
            } ${canStartDm ? "cursor-pointer" : ""}`}
          >
            {buildInitials(authorLabel)}
          </button>

          <button
            type="button"
            onClick={() => canStartDm && onStartDm?.(post.authorId)}
            className="min-w-0 flex items-center gap-2 text-left hover:opacity-90 transition-all active:scale-[0.99]"
          >
            <p className="text-[13px] font-semibold text-gray-100 truncate">{authorLabel}</p>
            <span className="w-1 h-1 rounded-full bg-gray-500/90 shrink-0" />
            <p className="text-[11px] text-gray-400 shrink-0">{formatTime(post.createdAt)}</p>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canStartDm ? (
            <button
              type="button"
              onClick={() => onStartDm?.(post.authorId)}
              className="h-8 px-2.5 rounded-full border border-cyan-400/35 text-cyan-300 hover:bg-cyan-500/10 active:scale-95 transition-all inline-flex items-center gap-1 text-[11px] font-medium"
              title="Escribir por chat"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </button>
          ) : null}
          {mediaCount > 1 ? (
            <span className="text-[10px] text-gray-400">
              +{mediaCount - 1} archivo{mediaCount - 1 > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </div>

      {post.content ? (
        <p className="text-[14px] mt-2.5 leading-relaxed text-gray-100 whitespace-pre-wrap break-words">{post.content}</p>
      ) : null}

      {firstMedia ? (
        <div className="mt-2.5">
          {isImage ? (
            <img
              src={firstMedia.url}
              alt={firstMedia.name || "post media"}
              onClick={() =>
                onMediaClick?.({
                  mediaUrl: firstMedia.url,
                  fileType: firstMedia.mime,
                  fileName: firstMedia.name || "image",
                })
              }
              className="w-full max-h-64 object-cover rounded-xl cursor-pointer border border-white/15 transition-transform duration-300 hover:scale-[1.01]"
            />
          ) : null}

          {isVideo ? (
            <div className="relative rounded-xl overflow-hidden bg-black border border-white/15">
              <video
                src={firstMedia.url}
                controls
                className="w-full max-h-72 object-contain"
                onClick={() =>
                  onMediaClick?.({
                    mediaUrl: firstMedia.url,
                    fileType: firstMedia.mime,
                    fileName: firstMedia.name || "video",
                  })
                }
              />
              <div className="absolute top-2 right-2 p-1 rounded-full bg-black/45 text-white pointer-events-none">
                <Play className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : null}

          {isAudio ? <audio src={firstMedia.url} controls className="w-full h-9" /> : null}

          {!isImage && !isVideo && !isAudio ? (
            <a
              href={firstMedia.url}
              download={firstMedia.name || "archivo"}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-white/15 hover:bg-white/5 active:scale-[0.99] transition-all"
            >
              <Paperclip className="w-4 h-4 text-gray-300" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-gray-100 truncate">{firstMedia.name || "Archivo"}</p>
                <p className="text-[10px] text-gray-400 uppercase truncate">
                  {firstMedia.mime || "application/octet-stream"}
                </p>
              </div>
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2.5 text-[11px] text-gray-400">
        <button
          type="button"
          onClick={() => onToggleLike?.(post._id)}
          className={`h-8 px-2.5 rounded-full border inline-flex items-center gap-1 active:scale-95 transition-all ${
            post.likedByMe
              ? "border-rose-400/50 bg-rose-500/20 text-rose-300"
              : "border-white/15 hover:bg-white/5 text-gray-300"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${post.likedByMe ? "fill-current" : ""}`} />
          <span>{post.likesCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleComments}
          className={`h-8 px-2.5 rounded-full border inline-flex items-center gap-1 active:scale-95 transition-all ${
            isCommentsOpen || hasActiveComments
              ? "border-cyan-400/40 text-cyan-300"
              : "border-white/15 hover:bg-white/5 text-gray-300"
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>{post.commentsCount || 0}</span>
        </button>
      </div>

      {isCommentsOpen ? (
        <div className="mt-2.5 rounded-xl border border-[color:var(--border-soft)] bg-[#101b23] p-2.5 space-y-2">
          <div className="max-h-44 overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {commentsLoading ? <p className="text-[11px] text-gray-400">Cargando comentarios...</p> : null}
            {!commentsLoading && commentsError ? <p className="text-[11px] text-red-300">{commentsError}</p> : null}
            {!commentsLoading && !commentsError && commentsLoaded && !comments.length ? (
              <p className="text-[11px] text-gray-400">Todavia no hay comentarios.</p>
            ) : null}
            {!commentsLoading &&
              comments.map((comment) => (
                <div key={comment._id} className="rounded-lg border border-[color:var(--border-soft)] bg-white/[0.02] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-gray-200 font-medium truncate">{comment.authorName || "Usuario"}</p>
                    <p className="text-[10px] text-gray-500 shrink-0">{formatCommentDate(comment.createdAt)}</p>
                  </div>
                  <p className="mt-0.5 text-[12px] text-gray-100 whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
              ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitComment();
                }
              }}
              placeholder="Escribe un comentario..."
              className="flex-1 h-9 px-2.5 rounded-md border border-white/15 bg-[#111b21] text-[12px] text-gray-100 placeholder:text-gray-500 outline-none focus:border-[#00a884]"
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={!String(commentDraft || "").trim() || commentsSubmitting}
              className="h-9 w-9 rounded-md bg-[#00a884] hover:bg-[#008f72] active:scale-95 transition-all disabled:opacity-50 text-white inline-flex items-center justify-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
