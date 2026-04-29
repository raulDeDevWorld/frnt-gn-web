"use client";

import { CheckCheck } from "lucide-react";
import {AudioMessagePlayer} from '@/components/AudioMessagePlayer.jsx'
import {FileMessageRenderer} from '@/components/FileMessageRenderer.jsx'

export function MessageBubble({ msg, USER_ID, onMediaClick }) {
    const isMe = msg.from === USER_ID;
    
    // Lógica del Visto: Si es mio, mostrar checks
    // Doble Check Gris (Enviado/Recibido) -> Doble Check Azul (Visto)
    const SeenIcon = isMe ? CheckCheck : null; 
    const iconColor = isMe ? (msg.seen ? "text-blue-500" : "text-gray-400 dark:text-gray-500") : "";

    return (
        <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 px-2`}>
            <div className={`max-w-[85%] md:max-w-[65%] p-2 rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative break-words 
                ${isMe ? "bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none" : "bg-white dark:bg-[#202c33] rounded-tl-none"}`}>
                
                {!isMe && !msg.private && (
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1 cursor-pointer">{msg.from}</p>
                )}
                
                <div className={`${(msg.type === 'text' && msg.content.length < 50) ? 'pb-2 pr-16' : 'pb-4'} min-w-[80px]`}>
                    {msg.type === "text" && <p className="text-[15px] leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{msg.content}</p>}
                    {msg.type === "audio" && <AudioMessagePlayer audioURL={msg.mediaUrl} duration={msg.duration} isMe={isMe} />}
                    {(msg.type === "image" || msg.type === "file" || msg.type === "video") && <FileMessageRenderer msg={msg} isMe={isMe} onMediaClick={onMediaClick} />}
                </div>

                <div className="absolute bottom-1 right-1.5 flex items-center gap-1 select-none">
                    <span className="text-[10px] text-gray-500 dark:text-gray-300/90">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </span>
                    {isMe && SeenIcon && <SeenIcon className={`w-3.5 h-3.5 ${iconColor}`} />}
                </div>
            </div>
        </div>
    );
}