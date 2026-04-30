"use client";

import { CheckCheck } from "lucide-react";

function SidebarHeader({ currentUser, USER_ID, darkMode, setDarkMode, onLogout }) {
  return (
    <div className="h-[62px] px-4 bg-[color:var(--surface-1)] flex items-center justify-between shrink-0 border-b border-[color:var(--border-soft)]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-[#2b3c49] rounded-full flex items-center justify-center overflow-hidden">
          <span className="font-semibold text-[#cde0ec] text-xs">
            {String(currentUser?.displayName || currentUser?.username || "YO").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-gray-100 truncate">
            {currentUser?.displayName || currentUser?.username || "Usuario"}
          </p>
          <span className="text-[10px] font-mono text-[color:var(--text-soft)] truncate block">{USER_ID}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onLogout}
          className="px-2.5 py-1 text-[11px] rounded-md bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-100 border border-[color:var(--border-soft)]"
        >
          Salir
        </button>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-2.5 py-1 text-[11px] rounded-md bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-100 border border-[color:var(--border-soft)]"
        >
          {darkMode ? "Light" : "Dark"}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="sticky top-0 z-10 px-4 py-2.5 text-[#6ec6a5] text-[10px] font-semibold uppercase tracking-[0.12em] bg-[color:var(--surface-1)]/95 backdrop-blur border-b border-[color:var(--border-soft)]">
      {children}
    </div>
  );
}

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
        flex-col h-full border-r border-[color:var(--border-soft)] bg-[color:var(--surface-1)]
        transition-all duration-300
        md:flex md:w-[360px] md:min-w-[320px]
        ${mobileView === "chat" ? "hidden" : "flex w-full"}
    `;

  return (
    <div className={sidebarClass}>
      <SidebarHeader currentUser={currentUser} USER_ID={USER_ID} darkMode={darkMode} setDarkMode={setDarkMode} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-[var(--bottom-nav-space)] md:pb-0">
        {activeSection === "posts" ? (
          <>
            <SectionHeader>Feeds de Posts ({publicRooms.length})</SectionHeader>
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
                <button
                  key={roomKey}
                  onClick={() => onSelectRoom(roomKey)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 active:scale-[0.995] transition-all border-b border-[color:var(--border-soft)] ${selectedRoomKey === roomKey ? "bg-white/10" : ""}`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#1f8b72] flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                    R
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-medium text-gray-100 text-[14px] truncate">{room.title || room.roomKey}</span>
                      {timestamp ? (
                        <span className="text-[10px] text-[color:var(--text-soft)]">
                          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[12px] text-[color:var(--text-soft)] truncate">{preview}</p>
                  </div>
                </button>
              );
            })}
          </>
        ) : null}

        {activeSection === "chats" ? (
          <>
            <SectionHeader>Chats Recientes ({directChatThreads.length})</SectionHeader>
            {directChatThreads.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-[color:var(--text-soft)]">Aun no tienes conversaciones directas.</div>
            ) : null}

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
                <button
                  key={peerId}
                  onClick={() => onSelectUser(peerId)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 active:scale-[0.995] transition-all border-b border-[color:var(--border-soft)] ${selectedUser === peerId ? "bg-white/10" : ""}`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#2b3c49] flex items-center justify-center text-[#d1e4f1] text-sm font-semibold relative">
                    U
                    {isOnline ? (
                      <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[#25d366] border border-[color:var(--surface-1)]" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-medium text-gray-100 text-[14px] truncate">{displayName}</span>
                      {timestamp ? (
                        <span className={`text-[10px] ${unseen ? "text-[#25d366] font-semibold" : "text-[color:var(--text-soft)]"}`}>
                          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[12px] text-[color:var(--text-soft)] truncate max-w-[85%] flex items-center gap-1">
                        {lastMsg?.from === USER_ID ? (
                          <CheckCheck className={`w-3.5 h-3.5 ${lastMsg.seen ? "text-blue-500" : "text-gray-500"}`} />
                        ) : null}
                        {preview}
                      </p>
                      {unseen > 0 ? (
                        <span className="bg-[#25d366] text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
                          {unseen}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        ) : null}

        {activeSection === "config" ? (
          <div className="p-8 text-center text-[12px] text-[color:var(--text-soft)]">Configuracion de cuenta en el panel derecho.</div>
        ) : null}
      </div>
    </div>
  );
}
