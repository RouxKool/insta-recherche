const GRAPH_API_VERSION = "v22.0";
const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,children{media_type,media_url,thumbnail_url}";
const MAX_THUMBNAILS = 3;
const INSIGHTS_BATCH_SIZE = 50; // max sub-requêtes par appel batch Graph API

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

/**
 * Fetches "reach" insights for a list of posts via the Graph API batch
 * endpoint (up to 50 sub-requests per HTTP call, so this stays cheap even
 * for thousands of posts). Reach requires the instagram_manage_insights
 * permission and isn't always available for very old posts — any failure
 * (missing permission, unsupported post, etc.) is caught per-post and
 * simply results in `reach: null` for that post rather than aborting the
 * whole run. If the very first batch shows the permission is missing
 * entirely, insights are skipped for all remaining posts to avoid wasting
 * calls on a request that will keep failing the same way.
 */
export async function fetchReachByPostId(posts, { accessToken }) {
  const reachById = new Map();
  let permissionMissing = false;

  for (let i = 0; i < posts.length; i += INSIGHTS_BATCH_SIZE) {
    if (permissionMissing) break;

    const chunk = posts.slice(i, i + INSIGHTS_BATCH_SIZE);
    const batch = chunk.map((post) => ({
      method: "GET",
      relative_url: `${post.id}/insights?metric=reach`,
    }));

    let results;
    try {
      results = await runBatch(batch, accessToken);
    } catch (error) {
      console.log(`Impossible de récupérer le reach pour ce lot : ${error.message}`);
      continue;
    }

    const allFailedWithPermissionError = results.every((result) => isPermissionError(result));
    if (i === 0 && allFailedWithPermissionError) {
      console.log(
        "Le reach n'est pas accessible avec ce token (permission manquante ?) — poursuite sans ces données."
      );
      permissionMissing = true;
      break;
    }

    chunk.forEach((post, index) => {
      reachById.set(post.id, extractReach(results[index]));
    });
  }

  return reachById;
}

async function runBatch(batch, accessToken) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, batch }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Instagram Graph API batch error (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

function isPermissionError(result) {
  if (!result || result.code === 200) return false;
  try {
    const parsed = JSON.parse(result.body);
    return Boolean(parsed?.error);
  } catch {
    return true;
  }
}

function extractReach(result) {
  if (!result || result.code !== 200) return null;
  try {
    const parsed = JSON.parse(result.body);
    return parsed?.data?.[0]?.values?.[0]?.value ?? null;
  } catch {
    return null;
  }
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
    like_count: item.like_count ?? 0,
    comments_count: item.comments_count ?? 0,
    reach: null,
    thumbnails,
  };
}
