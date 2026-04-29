"use client";

import { Paperclip, Play, } from "lucide-react";

export const FileMessageRenderer = ({ msg, isMe, onMediaClick }) => {
    const fileUrl = msg.mediaUrl;
    const isImage = msg.type === "image";
    const isVideo = msg.type === "video";
    
    if (isImage || isVideo) {
        return (
            <div className="cursor-pointer mt-1 mb-1 relative group" onClick={() => onMediaClick(msg)}>
                {isImage && <img src={fileUrl} alt="file" className="max-h-64 rounded-lg object-cover border border-gray-200 dark:border-transparent" />}
                {isVideo && (
                    <div className="relative">
                        <video src={fileUrl} className="max-h-64 rounded-lg object-cover bg-black" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/20 transition-colors">
                            <Play className="text-white w-12 h-12 opacity-80" />
                        </div>
                    </div>
                )}
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 p-3 bg-black/5 dark:bg-white/10 rounded-md border border-black/5 dark:border-transparent">
            <Paperclip className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            <div className="flex flex-col overflow-hidden">
                <a href={fileUrl} download={msg.fileName} className="text-sm font-medium truncate max-w-[150px] hover:underline">
                    {msg.fileName}
                </a>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{msg.fileType.split('/')[1]}</span>
            </div>
        </div>
    );
};