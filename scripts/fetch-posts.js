import { writeFile } from "node:fs/promises";
import { fetchCarouselPosts } from "./lib/instagram.js";

const DATA_PATH = new URL("../data/posts.json", import.meta.url);

// Le contenu plus ancien ne fait plus partie de la ligne éditoriale actuelle,
// inutile de le proposer dans les résultats de recherche.
const MIN_DATE = new Date("2024-01-01T00:00:00Z");

async function main() {
  const accessToken = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const businessAccountId = requireEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID");

  console.log("Récupération des posts Instagram (carrousels)...");
  const allPosts = await fetchCarouselPosts({ accessToken, businessAccountId });
  const posts = allPosts.filter((post) => new Date(post.timestamp) >= MIN_DATE);
  posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const store = { generated_at: new Date().toISOString(), posts };
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2) + "\n", "utf8");

  console.log(
    `data/posts.json mis à jour avec ${posts.length} carrousel(s) (${allPosts.length - posts.length} exclu(s) avant 2024).`
  );
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
