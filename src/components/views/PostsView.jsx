"use client";

import { RoomPostCard } from "@/components/RoomPostCard.jsx";

function PostsSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {[0, 1, 2].map((id) => (
        <div key={id} className="surface-card px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full skeleton-line" />
            <div className="space-y-2">
              <div className="h-2.5 w-28 skeleton-line" />
              <div className="h-2 w-16 skeleton-line" />
            </div>
          </div>
          <div className="h-2.5 w-[92%] skeleton-line" />
          <div className="h-2.5 w-[74%] skeleton-line" />
          <div className="h-40 rounded-xl skeleton-line" />
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ title, subtitle }) {
  return (
    <div className="mx-auto max-w-2xl surface-card px-5 py-7 text-center">
      <p className="text-[14px] text-gray-100 font-semibold">{title}</p>
      <p className="mt-1 text-[12px] text-[color:var(--text-soft)]">{subtitle}</p>
    </div>
  );
}

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
  const isInitialLoading = isPostsView && selectedRoomPaging.loading && !selectedRoomPaging.initialized;
  const showEmptyRoom = isPostsView && selectedRoomPaging.initialized && !selectedRoomPaging.loading && !currentRoomPosts.length;
  const showNoResults =
    isPostsView &&
    selectedRoomPaging.initialized &&
    !selectedRoomPaging.loading &&
    currentRoomPosts.length > 0 &&
    !filteredRoomPosts.length;

  return (
    <>
      {isInitialLoading ? <PostsSkeleton /> : null}

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
        <div className="text-center text-[11px] text-[color:var(--text-soft)] py-2">Cargando posts anteriores...</div>
      ) : null}

      {showEmptyRoom ? (
        <EmptyBlock title="Aun no hay posts en esta sala." subtitle="Publica el primero para abrir la conversacion." />
      ) : null}

      {showNoResults ? (
        <EmptyBlock title="No encontramos resultados." subtitle="Prueba con menos filtros o una busqueda diferente." />
      ) : null}

      {isPostsView &&
      selectedRoomPaging.initialized &&
      selectedRoomPaging.hasMore &&
      !selectedRoomPaging.loadingMore &&
      filteredRoomPosts.length > 0 ? (
        <div className="text-center text-[11px] text-[color:var(--text-soft)] py-1">Desliza hacia abajo para cargar mas</div>
      ) : null}
    </>
  );
}
