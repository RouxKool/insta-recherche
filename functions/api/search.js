import { embedQuery, EMBEDDING_DIMENSION } from "../../scripts/lib/voyage.js";
import postsData from "../../data/posts.json";

const MAX_RESULTS = 3;
const MIN_SIMILARITY = 0.35;
const EXCERPT_LENGTH = 150;

export async function onRequestPost({ request, env }) {
  let query;
  try {
    ({ query } = await request.json());
  } catch {
    return jsonResponse({ error: "Corps de requête JSON invalide." }, 400);
  }

  if (!query || typeof query !== "string" || !query.trim()) {
    return jsonResponse({ error: "Le champ 'query' est requis." }, 400);
  }

  if (postsData.embedding_dimension !== EMBEDDING_DIMENSION || postsData.posts.length === 0) {
    return jsonResponse({ results: [] });
  }

  const queryVector = await embedQuery(query.trim(), { apiKey: env.VOYAGE_API_KEY });

  const scored = postsData.posts
    .map((post) => ({ post, score: cosineSimilarity(queryVector, post.embedding) }))
    .filter((entry) => entry.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const results = scored.map(({ post, score }) => ({
    id: post.id,
    caption_excerpt: excerpt(post.caption, EXCERPT_LENGTH),
    permalink: post.permalink,
    thumbnails: post.thumbnails,
    score: Math.round(score * 1000) / 1000,
  }));

  return jsonResponse({ results });
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function excerpt(text, length) {
  const clean = (text ?? "").trim();
  return clean.length > length ? `${clean.slice(0, length).trim()}…` : clean;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
