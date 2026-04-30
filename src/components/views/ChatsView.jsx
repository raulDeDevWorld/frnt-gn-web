"use client";

import { MessageBubble } from "@/components/MessageBubble.jsx";

function InlineHint({ text }) {
  return (
    <div className="mx-auto mb-2 w-fit rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-gray-300">
      {text}
    </div>
  );
}

export function ChatsView({
  isChatsView,
  showPrivateChat,
  selectedPrivatePaging,
  currentMessages,
  userId,
  onMediaClick,
  bottomRef,
}) {
  return (
    <>
      {showPrivateChat && selectedPrivatePaging.loading && !selectedPrivatePaging.initialized ? (
        <div className="text-center text-[12px] text-gray-500 dark:text-gray-300 py-6">Cargando mensajes...</div>
      ) : null}

      {showPrivateChat &&
      selectedPrivatePaging.initialized &&
      !selectedPrivatePaging.loading &&
      !currentMessages.length ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-[#0f171d]/85 px-5 py-6 text-center">
          <p className="text-[13px] text-gray-200 font-medium">Aun no hay mensajes en este chat.</p>
          <p className="mt-1 text-[12px] text-gray-400">Escribe algo para iniciar la conversacion.</p>
        </div>
      ) : null}

      {showPrivateChat &&
      selectedPrivatePaging.initialized &&
      selectedPrivatePaging.hasMore &&
      !selectedPrivatePaging.loadingMore &&
      currentMessages.length > 0 ? <InlineHint text="Desliza hacia arriba para cargar mas mensajes" /> : null}

      {showPrivateChat && selectedPrivatePaging.loadingMore ? <InlineHint text="Cargando mensajes anteriores..." /> : null}

      {showPrivateChat
        ? currentMessages.map((msg, i) => (
            <MessageBubble
              key={msg._id || msg.tempId || i}
              msg={msg}
              USER_ID={userId}
              onMediaClick={(m) =>
                onMediaClick({
                  fileUrl: m.mediaUrl,
                  fileType: m.fileType,
                  fileName: m.fileName,
                })
              }
            />
          ))
        : null}

      {isChatsView && !showPrivateChat ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-[#0f171d]/85 px-5 py-6 text-center">
          <p className="text-[13px] text-gray-200 font-medium">Selecciona una conversacion</p>
          <p className="mt-1 text-[12px] text-gray-400">Abre la lista de chats y elige un contacto para empezar.</p>
        </div>
      ) : null}

      {showPrivateChat ? <div ref={bottomRef} className="h-3" /> : null}
    </>
  );
}
