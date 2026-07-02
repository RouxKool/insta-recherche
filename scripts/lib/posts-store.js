import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSION } from "./voyage.js";

export function hashCaption(caption) {
  return createHash("sha1").update(caption ?? "").digest("hex");
}

/**
 * Loads the existing data/posts.json store, returning an empty/default
 * shape if the file doesn't exist yet or is invalid.
 */
export async function loadStore(path) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.posts)) return parsed;
  } catch {
    // Missing or unreadable file — fall through to default empty store.
  }
  return { generated_at: null, embedding_model: null, embedding_dimension: null, posts: [] };
}

/**
 * Compares freshly fetched posts against the existing store and decides
 * which ones need a (re)embedding call. A post needs embedding if it's new,
 * its caption changed, or the embedding model/dimension changed since the
 * last run (which invalidates all previously stored vectors).
 */
export function planEmbeddings(fetchedPosts, existingStore) {
  const modelChanged =
    existingStore.embedding_model !== EMBEDDING_MODEL ||
    existingStore.embedding_dimension !== EMBEDDING_DIMENSION;

  const existingById = new Map(existingStore.posts.map((post) => [post.id, post]));

  const needsEmbedding = [];
  const reusable = [];

  for (const post of fetchedPosts) {
    const captionHash = hashCaption(post.caption);
    const existing = existingById.get(post.id);
    const unchanged = existing && existing.caption_hash === captionHash && !modelChanged;

    if (unchanged) {
      reusable.push({ ...post, caption_hash: captionHash, embedding: existing.embedding, last_embedded_at: existing.last_embedded_at });
    } else {
      needsEmbedding.push({ ...post, caption_hash: captionHash });
    }
  }

  return { needsEmbedding, reusable, modelChanged };
}

/**
 * Merges freshly embedded posts with reused (unchanged) posts into the
 * final store shape, sorted newest first.
 */
export function buildStore({ embedded, reusable }) {
  const posts = [...embedded, ...reusable].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  return {
    generated_at: new Date().toISOString(),
    embedding_model: EMBEDDING_MODEL,
    embedding_dimension: EMBEDDING_DIMENSION,
    posts,
  };
}

export async function saveStore(path, store) {
  await writeFile(path, JSON.stringify(store, null, 2) + "\n", "utf8");
}
