"use client";

import { CheckCheck } from "lucide-react";
import { AudioMessagePlayer } from "@/components/AudioMessagePlayer.jsx";
import { FileMessageRenderer } from "@/components/FileMessageRenderer.jsx";

export function MessageBubble({ msg, USER_ID, onMediaClick }) {
  const isMe = msg.from === USER_ID;
  const SeenIcon = isMe ? CheckCheck : null;
  const iconColor = isMe ? (msg.seen ? "text-blue-500" : "text-gray-400 dark:text-gray-500") : "";

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1.5 px-1 sm:px-2`}>
      <div
        className={`max-w-[90%] md:max-w-[68%] p-2.5 rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.14)] transition-all duration-150 hover:-translate-y-[1px] relative break-words border ${
          isMe
            ? "bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-md border-black/5 dark:border-white/5"
            : "bg-white dark:bg-[#202c33] rounded-tl-md border-black/5 dark:border-white/5"
        }`}
      >
        {!isMe && !msg.private ? (
          <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 mb-1 cursor-pointer">{msg.from}</p>
        ) : null}

        <div className={`${msg.type === "text" && String(msg.content || "").length < 50 ? "pb-2 pr-16" : "pb-4"} min-w-[84px]`}>
          {msg.type === "text" ? (
            <p className="text-[14px] leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{msg.content}</p>
          ) : null}
          {msg.type === "audio" ? <AudioMessagePlayer audioURL={msg.mediaUrl} duration={msg.duration} isMe={isMe} /> : null}
          {msg.type === "image" || msg.type === "file" || msg.type === "video" ? (
            <FileMessageRenderer msg={msg} isMe={isMe} onMediaClick={onMediaClick} />
          ) : null}
        </div>

        <div className="absolute bottom-1 right-1.5 flex items-center gap-1 select-none">
          <span className="text-[10px] text-gray-500 dark:text-gray-300/90">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isMe && SeenIcon ? <SeenIcon className={`w-3.5 h-3.5 ${iconColor}`} /> : null}
        </div>
      </div>
    </div>
  );
}
