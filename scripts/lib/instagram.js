const GRAPH_API_VERSION = "v22.0";
const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,timestamp,children{media_type,media_url,thumbnail_url}";
const MAX_THUMBNAILS = 3;

/**
 * Fetches every carousel album post from an Instagram Business account,
 * following cursor-based pagination until exhausted.
 */
export async function fetchCarouselPosts({ accessToken, businessAccountId }) {
  const posts = [];
  let url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${businessAccountId}/media`);
  url.searchParams.set("fields", MEDIA_FIELDS);
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", accessToken);

  while (url) {
    const response = await fetch(url);
    const body = await response.json();

    if (!response.ok) {
      throw new Error(
        `Instagram Graph API error (${response.status}): ${body?.error?.message ?? JSON.stringify(body)}`
      );
    }

    for (const item of body.data ?? []) {
      if (item.media_type !== "CAROUSEL_ALBUM") continue;
      posts.push(toPost(item));
    }

    const next = body.paging?.next;
    url = next ? new URL(next) : null;
  }

  return posts;
}

function toPost(item) {
  const children = item.children?.data ?? [];
  const thumbnails = children
    .map((child) => ({
      media_type: child.media_type,
      url: child.media_type === "VIDEO" ? child.thumbnail_url : child.media_url,
    }))
    .filter((thumb) => Boolean(thumb.url))
    .slice(0, MAX_THUMBNAILS);

  return {
    id: item.id,
    caption: item.caption ?? "",
    permalink: item.permalink,
    timestamp: item.timestamp,
    media_type: item.media_type,
    thumbnails,
  };
}
