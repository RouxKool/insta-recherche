import { fetchCarouselPosts } from "./lib/instagram.js";
import { embedDocuments } from "./lib/voyage.js";
import { loadStore, planEmbeddings, buildStore, saveStore } from "./lib/posts-store.js";

const DATA_PATH = new URL("../data/posts.json", import.meta.url);

async function main() {
  const accessToken = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const businessAccountId = requireEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  const voyageApiKey = requireEnv("VOYAGE_API_KEY");

  console.log("Récupération des posts Instagram (carrousels)...");
  const fetchedPosts = await fetchCarouselPosts({ accessToken, businessAccountId });
  console.log(`${fetchedPosts.length} carrousel(s) trouvé(s).`);

  const existingStore = await loadStore(DATA_PATH);
  const { needsEmbedding, reusable, modelChanged } = planEmbeddings(fetchedPosts, existingStore);

  if (modelChanged && existingStore.posts.length > 0) {
    console.log("Changement de modèle d'embedding détecté — ré-embedding complet.");
  }
  console.log(
    `${needsEmbedding.length} post(s) à (ré)embedder, ${reusable.length} inchangé(s) réutilisé(s).`
  );

  const embedded = [];
  if (needsEmbedding.length > 0) {
    const captions = needsEmbedding.map((post) => post.caption);
    await embedDocuments(captions, {
      apiKey: voyageApiKey,
      onBatch: async (vectors, offset) => {
        const now = new Date().toISOString();
        for (let i = 0; i < vectors.length; i++) {
          embedded.push({ ...needsEmbedding[offset + i], embedding: vectors[i], last_embedded_at: now });
        }
        // Sauvegarde incrémentale : si le job s'arrête en cours de route
        // (rate limit, timeout...), la progression déjà faite n'est pas perdue.
        await saveStore(DATA_PATH, buildStore({ embedded, reusable }));
        console.log(`Progression : ${embedded.length}/${needsEmbedding.length} légende(s) embeddée(s).`);
      },
    });
  }

  const store = buildStore({ embedded, reusable });
  await saveStore(DATA_PATH, store);

  console.log(`data/posts.json mis à jour avec ${store.posts.length} post(s).`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
