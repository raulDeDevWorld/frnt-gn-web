"use client";

import { RoomPostCard } from "@/components/RoomPostCard.jsx";

export function PostsView({
  isPostsView,
  selectedRoomPaging,
  filteredRoomPosts,
  currentRoomPosts,
  postCommentsById,
  userId,
  onToggleLike,
  onLoadComments,
  onCreateComment,
  onStartDm,
  onMediaClick,
}) {
  return (
    <>
      {isPostsView && selectedRoomPaging.loading && !selectedRoomPaging.initialized ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0f171d] px-4 py-5 text-center text-[12px] text-gray-300">
          Cargando posts...
        </div>
      ) : null}

      {isPostsView && filteredRoomPosts.length > 0 ? (
        <div className="max-w-2xl mx-auto space-y-3 pb-24">
          {filteredRoomPosts.map((post) => (
            <RoomPostCard
              key={post._id}
              post={post}
              currentUserId={userId}
              commentState={postCommentsById[post._id] || null}
              onToggleLike={onToggleLike}
              onLoadComments={onLoadComments}
              onCreateComment={onCreateComment}
              onStartDm={onStartDm}
              onMediaClick={(m) =>
                onMediaClick({
                  fileUrl: m.mediaUrl,
                  fileType: m.fileType,
                  fileName: m.fileName,
                })
              }
            />
          ))}
        </div>
      ) : null}

      {isPostsView && selectedRoomPaging.loadingMore ? (
        <div className="text-center text-[11px] text-gray-300 py-2">Cargando posts anteriores...</div>
      ) : null}

      {isPostsView && selectedRoomPaging.initialized && !selectedRoomPaging.loading && !currentRoomPosts.length ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0f171d] px-5 py-7 text-center">
          <p className="text-[13px] text-gray-200 font-medium">Aun no hay posts en esta sala.</p>
          <p className="mt-1 text-[12px] text-gray-400">Publica el primero para iniciar la conversacion.</p>
        </div>
      ) : null}

      {isPostsView &&
      selectedRoomPaging.initialized &&
      !selectedRoomPaging.loading &&
      currentRoomPosts.length > 0 &&
      !filteredRoomPosts.length ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0f171d] px-5 py-7 text-center">
          <p className="text-[13px] text-gray-200 font-medium">Sin resultados para tu busqueda o filtro.</p>
          <p className="mt-1 text-[12px] text-gray-400">Prueba con menos filtros o una palabra diferente.</p>
        </div>
      ) : null}

      {isPostsView &&
      selectedRoomPaging.initialized &&
      selectedRoomPaging.hasMore &&
      !selectedRoomPaging.loadingMore &&
      filteredRoomPosts.length > 0 ? (
        <div className="text-center text-[11px] text-gray-400 py-1">Desliza hacia abajo para cargar mas</div>
      ) : null}
    </>
  );
}
