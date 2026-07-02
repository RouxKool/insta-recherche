const form = document.getElementById("search-form");
const input = document.getElementById("query");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  setStatus("Recherche en cours...");
  resultsEl.innerHTML = "";

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Erreur serveur (${response.status})`);
    }

    const { results } = await response.json();
    renderResults(results);
  } catch (error) {
    setStatus("Une erreur est survenue. Réessaie dans un instant.");
    console.error(error);
  }
});

function renderResults(results) {
  if (!results || results.length === 0) {
    setStatus("Rien trouvé — ce sujet n'a peut-être pas encore été couvert.");
    return;
  }

  setStatus("");
  resultsEl.innerHTML = results.map(cardHtml).join("");
}

function cardHtml(result) {
  const thumb = result.thumbnails?.[0]?.url;
  const image = thumb
    ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
    : `<div class="thumb-placeholder"></div>`;

  return `
    <article class="card">
      ${image}
      <div class="card-body">
        <p class="caption">${escapeHtml(result.caption_excerpt)}</p>
        <a class="permalink" href="${escapeHtml(result.permalink)}" target="_blank" rel="noopener noreferrer">
          Voir sur Instagram →
        </a>
      </div>
    </article>
  `;
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
