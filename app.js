const form = document.getElementById("search-form");
const input = document.getElementById("query");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

const MAX_RESULTS = 12;

let indexedPosts = [];

async function init() {
  setStatus("Chargement de la base...");
  try {
    const response = await fetch("data/posts.json");
    const { posts } = await response.json();
    indexedPosts = posts.map((post) => ({ ...post, search_caption: normalize(post.caption) }));
    setStatus(posts.length === 0 ? "Base vide pour l'instant — lance une mise à jour." : "");
  } catch (error) {
    setStatus("Impossible de charger la base de posts.");
    console.error(error);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  renderResults(search(query));
});

/**
 * Recherche mots-clés (sous-chaîne, insensible aux accents/casse) plutôt que
 * de la recherche floue générique : sur des légendes longues, un algorithme
 * fuzzy générique (type Fuse.js) rate des correspondances littérales
 * évidentes. On priorise les posts qui contiennent la phrase exacte, puis
 * ceux qui contiennent tous les mots de la requête, triés par date.
 *
 * Plusieurs mots-clés séparés par une virgule sont acceptés (ex.
 * "doomscroll, scroll compulsif") : un post matche s'il correspond à
 * n'importe lequel des mots-clés (OR), pour élargir la recherche à
 * plusieurs reformulations d'un même sujet en une seule requête.
 */
function search(rawQuery) {
  const keywords = rawQuery
    .split(",")
    .map((keyword) => normalize(keyword).trim())
    .filter(Boolean);
  if (keywords.length === 0) return [];

  return indexedPosts
    .map((post) => {
      let bestRank = null;
      for (const keyword of keywords) {
        const words = keyword.split(/\s+/).filter(Boolean);
        const isPhraseMatch = post.search_caption.includes(keyword);
        const allWordsMatch = words.every((word) => post.search_caption.includes(word));
        if (isPhraseMatch) bestRank = 0;
        else if (allWordsMatch && bestRank === null) bestRank = 1;
      }
      return bestRank === null ? null : { post, rank: bestRank };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || new Date(b.post.timestamp) - new Date(a.post.timestamp))
    .map((entry) => entry.post);
}

function renderResults(allMatches) {
  if (!allMatches || allMatches.length === 0) {
    setStatus("Rien trouvé — ce sujet n'a peut-être pas encore été couvert.");
    resultsEl.innerHTML = "";
    return;
  }

  const posts = allMatches.slice(0, MAX_RESULTS);
  const suffix = posts.length === 1 ? "" : "s";
  setStatus(
    allMatches.length > posts.length
      ? `${posts.length} résultat${suffix} affiché${suffix} sur ${allMatches.length} trouvés.`
      : `${posts.length} résultat${suffix} trouvé${suffix}.`
  );
  resultsEl.innerHTML = posts.map(cardHtml).join("");
}

function cardHtml(post) {
  const thumb = post.thumbnails?.[0]?.url;
  const image = thumb
    ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
    : `<div class="thumb-placeholder"></div>`;

  return `
    <article class="card">
      ${image}
      <div class="card-body">
        <p class="caption">${escapeHtml(excerpt(post.caption, 150))}</p>
        <a class="permalink" href="${escapeHtml(post.permalink)}" target="_blank" rel="noopener noreferrer">
          Voir sur Instagram →
        </a>
      </div>
    </article>
  `;
}

function excerpt(text, length) {
  const clean = (text ?? "").trim();
  return clean.length > length ? `${clean.slice(0, length).trim()}…` : clean;
}

function setStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = !message;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function normalize(text) {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

init();
