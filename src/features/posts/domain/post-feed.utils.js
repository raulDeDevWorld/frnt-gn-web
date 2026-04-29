export function parsePostMedia(post) {
  const mediaList = Array.isArray(post?.media) ? post.media : [];
  return mediaList
    .map((item) => {
      const url = String(item?.url || "").trim();
      if (!url) return null;
      return {
        url,
        mime: String(item?.mime || "application/octet-stream"),
        name: item?.name ? String(item.name) : null,
        size: Number(item?.size) || 0,
      };
    })
    .filter(Boolean);
}

export function normalizeIncomingPost(post, { fallbackRoomKey = "public", normalizeRoomKey }) {
  const roomKey = normalizeRoomKey(post?.roomKey || fallbackRoomKey);
  const media = parsePostMedia(post);

  return {
    _id: String(post?._id || ""),
    roomId: post?.roomId ? String(post.roomId) : null,
    roomKey,
    authorId: String(post?.authorId || "unknown"),
    authorName: String(post?.authorName || "Usuario"),
    content: String(post?.content || ""),
    media,
    likesCount: Number(post?.likesCount) || 0,
    commentsCount: Number(post?.commentsCount) || 0,
    likedByMe: Boolean(post?.likedByMe),
    createdAt: Number(post?.createdAt) || Date.now(),
    updatedAt: Number(post?.updatedAt) || Date.now(),
  };
}

export function mergePostsDesc(existing, incoming) {
  const map = new Map();
  for (const post of existing || []) {
    if (post?._id) map.set(post._id, post);
  }
  for (const post of incoming || []) {
    if (post?._id) map.set(post._id, post);
  }

  return [...map.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function buildPostPreview(post) {
  if (!post) return "";
  if (post.content) return post.content;
  if (post.media?.length) return "Archivo";
  return "Post";
}
