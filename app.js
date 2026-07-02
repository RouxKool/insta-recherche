const form = document.getElementById("search-form");
const input = document.getElementById("query");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

const MAX_RESULTS = 3;
const MAX_SCORE = 0.5; // Fuse score: 0 = match parfait, 1 = aucun rapport

let fuse = null;

async function init() {
  setStatus("Chargement de la base...");
  try {
    const response = await fetch("data/posts.json");
    const { posts } = await response.json();
    const indexed = posts.map((post) => ({ ...post, search_caption: normalize(post.caption) }));
    fuse = new Fuse(indexed, {
      keys: ["search_caption"],
      includeScore: true,
      threshold: MAX_SCORE,
      ignoreLocation: true,
    });
    setStatus(posts.length === 0 ? "Base vide pour l'instant — lance une mise à jour." : "");
  } catch (error) {
    setStatus("Impossible de charger la base de posts.");
    console.error(error);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query || !fuse) return;

  const matches = fuse
    .search(normalize(query))
    .filter((match) => match.score <= MAX_SCORE)
    .slice(0, MAX_RESULTS);
  renderResults(matches.map((match) => match.item));
});

function renderResults(posts) {
  if (!posts || posts.length === 0) {
    setStatus("Rien trouvé — ce sujet n'a peut-être pas encore été couvert.");
    resultsEl.innerHTML = "";
    return;
  }

  setStatus("");
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
