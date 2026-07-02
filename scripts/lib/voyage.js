export const EMBEDDING_MODEL = "voyage-3.5";
export const EMBEDDING_DIMENSION = 1024;

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const BATCH_SIZE = 128;

/**
 * Embeds an array of document texts (e.g. Instagram captions) in batches.
 * Returns an array of embedding vectors in the same order as the input.
 */
export async function embedDocuments(texts, { apiKey }) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embed(batch, { apiKey, inputType: "document" });
    vectors.push(...embeddings);
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

async function embed(texts, { apiKey, inputType }) {
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

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Voyage AI error (${response.status}): ${body?.error ?? JSON.stringify(body)}`);
  }

  return body.data.map((entry) => entry.embedding);
}
