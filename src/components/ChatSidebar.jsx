"use client";

import { CheckCheck } from "lucide-react";

export function ChatSidebar({
  darkMode,
  activeSection,
  selectedUser,
  selectedRoomKey,
  activeUsers,
  directChatThreads,
  privateChats,
  publicRooms,
  roomMessages,
  roomPosts,
  onSelectUser,
  onSelectRoom,
  setDarkMode,
  currentUser,
  onLogout,
  USER_ID,
  mobileView,
}) {
  const sidebarClass = `
        flex-col h-full border-r dark:border-gray-700 bg-white dark:bg-[#111b21] 
        transition-all duration-300
        md:flex md:w-[400px] md:min-w-[350px]
        ${mobileView === "chat" ? "hidden" : "flex w-full"}
    `;

  return (
    <div className={sidebarClass}>
      <div className="h-[60px] px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between shrink-0 border-b dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
            <span className="font-bold text-gray-600 dark:text-gray-300 text-xs">
              {String(currentUser?.displayName || currentUser?.username || "YO").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
              {currentUser?.displayName || currentUser?.username || "Usuario"}
            </p>
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate block">{USER_ID}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onLogout}
            className="px-2 py-1 text-[11px] rounded-md bg-white/80 dark:bg-[#2a3942] hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-black/5 dark:border-white/10"
          >
            Salir
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-300"
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeSection === "posts" && (
          <>
            <div className="px-4 py-3 text-[#008069] dark:text-[#00a884] text-xs font-bold uppercase tracking-wider">
              Feeds de Posts ({publicRooms.length})
            </div>

            {publicRooms.map((room) => {
              const roomKey = room.roomKey;
              const posts = roomPosts?.[roomKey] || [];
              const messages = roomMessages?.[roomKey] || [];
              const latestPost = posts[0];
              const lastMsg = messages[messages.length - 1];
              const preview = latestPost
                ? latestPost.content || (latestPost.media?.length ? "Archivo" : "Post")
                : lastMsg?.type === "text"
                  ? lastMsg.content
                  : lastMsg
                    ? lastMsg.type === "audio"
                      ? "Audio"
                      : "Archivo"
                    : room.lastMessagePreview || "Haz clic para unirte a la sala";
              const timestamp = latestPost?.createdAt || lastMsg?.timestamp || room.lastMessageAt;

              return (
                <div
                  key={roomKey}
                  onClick={() => onSelectRoom(roomKey)}
                  className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors border-b border-gray-100 dark:border-gray-800 ${selectedRoomKey === roomKey ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : ""}`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xl shadow-sm">R</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-medium text-gray-900 dark:text-white text-[17px] truncate">
                        {room.title || room.roomKey}
                      </span>
                      {timestamp && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{preview}</p>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {activeSection === "chats" && (
          <>
            <div className="px-4 py-3 text-[#008069] dark:text-[#00a884] text-xs font-bold uppercase tracking-wider">
              Chats Recientes ({directChatThreads.length})
            </div>

            {directChatThreads.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm italic">
                Aun no tienes conversaciones directas.
              </div>
            )}

            {directChatThreads.map((thread) => {
              const peerId = String(thread?.peerUserId || "").trim();
              if (!peerId) return null;

              const msgs = privateChats[peerId] || [];
              const lastMsg = msgs[msgs.length - 1];
              const unseen = msgs.filter((m) => m.from === peerId && !m.seen).length;
              const isOnline = activeUsers.includes(peerId);
              const displayName = String(thread?.peerDisplayName || peerId);
              const preview = lastMsg
                ? lastMsg.type === "text"
                  ? lastMsg.content
                  : lastMsg.type === "audio"
                    ? "Audio"
                    : "Archivo"
                : thread?.lastMessagePreview || "Sin mensajes";
              const timestamp = lastMsg?.timestamp || thread?.lastMessageAt;

              return (
                <div
                  key={peerId}
                  onClick={() => onSelectUser(peerId)}
                  className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors border-b border-gray-100 dark:border-gray-800 ${selectedUser === peerId ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : ""}`}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200 text-xl relative">
                    U
                    {isOnline ? (
                      <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[#25d366] border border-white dark:border-[#202c33]" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900 dark:text-white text-[17px] truncate">{displayName}</span>
                      {timestamp && (
                        <span className={`text-xs ${unseen ? "text-[#25d366] font-bold" : "text-gray-500 dark:text-gray-400"}`}>
                          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[85%] flex items-center gap-1">
                        {lastMsg?.from === USER_ID && (
                          <CheckCheck className={`w-3.5 h-3.5 ${lastMsg.seen ? "text-blue-500" : "text-gray-400"}`} />
                        )}
                        {preview}
                      </p>
                      {unseen > 0 && (
                        <span className="bg-[#25d366] text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 shadow-sm">
                          {unseen}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {activeSection === "config" && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            Configuracion de cuenta en el panel derecho.
          </div>
        )}
      </div>
    </div>
  );
}
