export const EMBEDDING_MODEL = "voyage-3.5";
export const EMBEDDING_DIMENSION = 1024;

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const BATCH_SIZE = 128;
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 5000;

/**
 * Embeds an array of document texts (e.g. Instagram captions) in batches.
 * Returns an array of embedding vectors in the same order as the input.
 *
 * If `onBatch(vectors, offset)` is provided, it's called after each batch
 * resolves (with the batch's vectors and its start index in `texts`) so the
 * caller can persist progress incrementally on long runs.
 */
export async function embedDocuments(texts, { apiKey, onBatch }) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embed(batch, { apiKey, inputType: "document" });
    vectors.push(...embeddings);
    if (onBatch) await onBatch(embeddings, i);
  }
  return vectors;
}

/**
 * Embeds a single search query. Voyage's asymmetric embeddings expect
 * input_type "query" here vs "document" at indexing time for best retrieval.
 */
export async function embedQuery(text, { apiKey }) {
  const [vector] = await embed([text], { apiKey, inputType: "query" });
  return vector;
}

async function embed(texts, { apiKey, inputType }, attempt = 1) {
  const response = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL,
      input_type: inputType,
    }),
  });

  if (response.status === 429 && attempt <= MAX_RETRIES) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : BASE_BACKOFF_MS * 2 ** (attempt - 1);
    console.log(
      `Voyage AI limite de débit atteinte (429), nouvelle tentative dans ${Math.round(waitMs / 1000)}s (essai ${attempt}/${MAX_RETRIES})...`
    );
    await sleep(waitMs);
    return embed(texts, { apiKey, inputType }, attempt + 1);
  }

  const body = await response.json();

  if (!response.ok) {
    const message = body?.detail ?? body?.error ?? JSON.stringify(body);
    throw new Error(`Voyage AI error (${response.status}): ${message}`);
  }

  return body.data.map((entry) => entry.embedding);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
