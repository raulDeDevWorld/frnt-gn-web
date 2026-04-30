"use client";

import { MessageBubble } from "@/components/MessageBubble.jsx";

function InlineHint({ text }) {
  return (
    <div className="mx-auto mb-2 w-fit rounded-full border border-[color:var(--border-soft)] bg-[#141e26] px-3 py-1 text-[11px] text-[color:var(--text-soft)]">
      {text}
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="max-w-xl mx-auto space-y-2 pt-2">
      {[0, 1, 2, 3].map((id) => (
        <div key={id} className={`flex ${id % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <div className="max-w-[78%] surface-card px-3 py-2.5 space-y-2">
            <div className="h-2.5 w-40 skeleton-line" />
            <div className="h-2.5 w-28 skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ title, subtitle }) {
  return (
    <div className="mx-auto mt-8 max-w-md surface-card px-5 py-6 text-center">
      <p className="text-[14px] text-gray-100 font-semibold">{title}</p>
      <p className="mt-1 text-[12px] text-[color:var(--text-soft)]">{subtitle}</p>
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
  const isInitialLoading = showPrivateChat && selectedPrivatePaging.loading && !selectedPrivatePaging.initialized;
  const isEmptyChat =
    showPrivateChat && selectedPrivatePaging.initialized && !selectedPrivatePaging.loading && !currentMessages.length;

  return (
    <>
      {isInitialLoading ? <ChatSkeleton /> : null}

      {isEmptyChat ? (
        <EmptyBlock title="Aun no hay mensajes en este chat." subtitle="Escribe algo para iniciar la conversacion." />
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
        <EmptyBlock
          title="Selecciona una conversacion"
          subtitle="Abre la lista de chats y elige un contacto para empezar."
        />
      ) : null}

      {showPrivateChat ? <div ref={bottomRef} className="h-3" /> : null}
    </>
  );
}
