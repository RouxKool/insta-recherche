# Insta Recherche

Site de recherche sémantique dans les contenus déjà publiés sur Instagram. Tape une question du type *"est-ce qu'on a déjà parlé de doomscroll ?"* et retrouve les carrousels correspondants (légende, miniature, lien).

## Architecture

```
GitHub Actions (cron quotidien)
   → récupère les posts via l'Instagram Graph API
   → embed les nouvelles légendes via Voyage AI
   → commit data/posts.json
   → push déclenche le redeploy automatique de Cloudflare Pages

Cloudflare Pages
   → sert le site statique (index.html/app.js/style.css)
   → héberge la Pages Function /api/search (Node/JS) qui :
       - embed la question tapée par l'utilisateur (clé Voyage tenue secrète côté serveur)
       - calcule la similarité cosinus contre data/posts.json
       - renvoie les 2-3 meilleurs résultats
```

Le code source reste entièrement sur GitHub. Cloudflare Pages est uniquement la plateforme de déploiement (connectée directement au repo), nécessaire car un site 100% statique ne peut pas cacher la clé API utilisée pour la recherche en direct.

## Schéma de données (`data/posts.json`)

```jsonc
{
  "generated_at": "2026-07-02T05:00:00.000Z",
  "embedding_model": "voyage-3.5",
  "embedding_dimension": 1024,
  "posts": [
    {
      "id": "179...",
      "caption": "...",
      "permalink": "https://www.instagram.com/p/.../",
      "timestamp": "2026-06-30T14:22:10+0000",
      "media_type": "CAROUSEL_ALBUM",
      "thumbnails": [{ "media_type": "IMAGE", "url": "https://..." }],
      "embedding": [/* 1024 floats */],
      "caption_hash": "sha1...",
      "last_embedded_at": "2026-07-02T05:00:00.000Z"
    }
  ]
}
```

Si `embedding_model`/`embedding_dimension` change (ex. changement de modèle Voyage), tous les posts sont automatiquement ré-embeddés au run suivant.

**Note** : les URLs `media_url`/`thumbnail_url` renvoyées par l'API Instagram sont des liens CDN signés qui expirent au bout de quelques heures à ~24h. Le cron quotidien garde les miniatures fraîches ; si le site n'est pas re-déployé pendant plusieurs jours, certaines miniatures anciennes peuvent ne plus s'afficher.

## Setup

### 1. Instagram Graph API

(Déjà en place pour ce projet — noté ici pour référence future.)

1. Créer une app sur [Meta for Developers](https://developers.facebook.com/), ajouter le produit "Instagram".
2. Lier le compte Instagram Business à une Page Facebook.
3. Générer un token d'accès longue durée avec les permissions nécessaires pour lire les médias (`instagram_basic` ou équivalent selon la version actuelle de l'API).
4. Récupérer l'`ig-user-id` du compte (identifiant du compte Instagram Business).

⚠️ **Les tokens longue durée expirent après 60 jours.** Il faut les renouveler manuellement (`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...` tant que le token a moins de 60 jours) et mettre à jour le secret GitHub `INSTAGRAM_ACCESS_TOKEN`. Pense à mettre un rappel récurrent.

### 2. Voyage AI

1. Créer un compte sur [voyageai.com](https://www.voyageai.com/) (offre gratuite disponible).
2. Récupérer une clé API depuis le dashboard.

### 3. Secrets GitHub Actions

Dans le repo GitHub : **Settings → Secrets and variables → Actions**, ajouter :

- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `VOYAGE_API_KEY`

Le workflow `.github/workflows/update-posts.yml` tourne tous les jours à 05:00 UTC, et peut aussi être lancé manuellement depuis l'onglet **Actions → Mise à jour de la base de posts → Run workflow**.

### 4. Cloudflare Pages

1. [Créer un compte Cloudflare](https://dash.cloudflare.com/sign-up) (gratuit).
2. **Workers & Pages → Create → Pages → Connect to Git**, sélectionner ce repo GitHub.
3. Configuration du build :
   - Framework preset : `None`
   - Build command : *(vide, pas de build)*
   - Build output directory : `/` (racine du repo)
4. **Settings → Environment variables** : ajouter `VOYAGE_API_KEY` (même valeur que le secret GitHub), en mode "Encrypt".
5. Chaque push sur `main` (y compris ceux du bot GitHub Actions) déclenche un redeploy automatique.

## Développement local

```bash
npm install
cp .env.example .env   # renseigner les 3 variables
```

Lancer le pipeline de mise à jour des données :

```bash
node --env-file=.env scripts/fetch-and-embed.js
```

Lancer le site + la Function en local (nécessite un fichier `.dev.vars` avec `VOYAGE_API_KEY=...`, format identique à `.env`) :

```bash
npx wrangler pages dev .
```

Puis tester l'API directement :

```bash
curl -X POST http://localhost:8788/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"doomscroll"}'
```

## Fichiers clés

- `scripts/fetch-and-embed.js` — orchestrateur du pipeline de mise à jour
- `scripts/lib/instagram.js` — client Instagram Graph API (pagination, filtrage carrousels)
- `scripts/lib/voyage.js` — client Voyage AI (embeddings documents + requête)
- `scripts/lib/posts-store.js` — dedupe/merge de `data/posts.json`
- `functions/api/search.js` — endpoint de recherche (Cloudflare Pages Function)
- `index.html` / `app.js` / `style.css` — frontend
