# Insta Recherche

Site de recherche par mots-clés dans les contenus déjà publiés sur Instagram. Tape une question du type *"est-ce qu'on a déjà parlé de doomscroll ?"* et retrouve les carrousels correspondants (légende, miniature, lien).

**Version actuelle : recherche par mots-clés/fuzzy (rapide à mettre en ligne, zéro compte externe).** Si le projet plaît, une vraie recherche sémantique (IA) pourra être ajoutée plus tard — voir la note en bas de ce fichier.

## Architecture

```
GitHub Actions (cron tous les 3 jours, ou déclenchement manuel)
   → récupère les posts via l'Instagram Graph API (carrousels, >= 2024 uniquement)
   → récupère likes/commentaires (gratuit, même requête) + reach (API Insights, batché)
   → écrit data/posts.json
   → push déclenche la republication de GitHub Pages

GitHub Pages (site 100% statique)
   → sert index.html/app.js/style.css + data/posts.json
   → la recherche tourne entièrement dans le navigateur : phrase exacte
     prioritaire, puis repli sur "tous les mots présents", insensible aux
     accents/casse. Plusieurs mots-clés séparés par une virgule sont
     acceptés (logique OR) pour couvrir plusieurs reformulations d'un
     même sujet en une seule recherche.
   → affiche pour chaque résultat les likes/commentaires/reach, et une
     moyenne + médiane d'engagement calculées sur l'ensemble des posts
     trouvés pour le sujet recherché
```

Tout est gratuit, tout reste sur GitHub — pas de compte tiers à gérer.

## Schéma de données (`data/posts.json`)

```jsonc
{
  "generated_at": "2026-07-02T05:00:00.000Z",
  "posts": [
    {
      "id": "179...",
      "caption": "...",
      "permalink": "https://www.instagram.com/p/.../",
      "timestamp": "2026-06-30T14:22:10+0000",
      "media_type": "CAROUSEL_ALBUM",
      "like_count": 1230,
      "comments_count": 45,
      "reach": 12500,
      "thumbnails": [{ "media_type": "IMAGE", "url": "https://..." }]
    }
  ]
}
```

- Seuls les posts à partir du 1er janvier 2024 sont conservés (contenu plus ancien hors ligne éditoriale actuelle) — voir `MIN_DATE` dans `scripts/fetch-posts.js`.
- `like_count`/`comments_count` viennent gratuitement de la même requête que le reste (aucun appel API supplémentaire).
- `reach` vient de l'API Insights (`{media-id}/insights?metric=reach`), récupéré par lots de 50 pour rester rapide même avec des milliers de posts. Nécessite la permission `instagram_manage_insights` sur le token ; si elle manque, `reach` reste à `null` partout sans faire échouer le reste de la mise à jour (voir `fetchReachByPostId` dans `scripts/lib/instagram.js`). Le reach peut aussi être indisponible pour de très anciens posts.

**Note** : les URLs `media_url`/`thumbnail_url` renvoyées par l'API Instagram sont des liens CDN signés qui expirent au bout de quelques heures à ~24h. Le cron régulier garde les miniatures fraîches ; si le site n'est pas re-déployé pendant plusieurs jours, certaines miniatures anciennes peuvent ne plus s'afficher.

## Setup

### 1. Instagram Graph API

(Déjà en place pour ce projet — noté ici pour référence future.)

1. App sur [Meta for Developers](https://developers.facebook.com/), produit "Instagram".
2. Compte Instagram Business lié à une Page Facebook.
3. Token d'accès longue durée avec permission de lecture des médias.
4. L'`ig-user-id` du compte.

⚠️ **Les tokens longue durée expirent après 60 jours.** Renouvellement manuel (`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...`) puis mise à jour du secret GitHub `INSTAGRAM_ACCESS_TOKEN`.

### 2. Secrets GitHub Actions

Repo → **Settings → Secrets and variables → Actions**, ajouter :

- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`

Le workflow `.github/workflows/update-posts.yml` tourne tous les 3 jours à 05:00 UTC, et peut aussi être lancé manuellement depuis **Actions → Mise à jour de la base de posts → Run workflow**.

### 3. Activer GitHub Pages

1. Repo → **Settings → Pages**.
2. **Source** : "Deploy from a branch".
3. **Branch** : `main`, dossier `/ (root)`.
4. **Save**.
5. L'URL du site apparaît en haut de cette même page après quelques minutes (souvent `https://<utilisateur>.github.io/insta-recherche/`).

Chaque push sur `main` (y compris ceux du bot GitHub Actions) republie automatiquement le site.

## Développement local

```bash
npm install
cp .env.example .env   # renseigner les 2 variables
```

Lancer le pipeline de mise à jour des données :

```bash
node --env-file=.env scripts/fetch-posts.js
```

Prévisualiser le site en local (nécessaire pour que le `fetch("data/posts.json")` fonctionne — ouvrir `index.html` directement dans le navigateur ne marche pas) :

```bash
npx serve .
```

## Fichiers clés

- `scripts/fetch-posts.js` — récupère les posts Instagram (+ engagement) et écrit `data/posts.json`
- `scripts/lib/instagram.js` — client Instagram Graph API (pagination, filtrage carrousels, likes/commentaires, reach en batch)
- `app.js` — charge `data/posts.json`, fait la recherche mots-clés côté navigateur et calcule les stats d'engagement
- `.github/workflows/update-posts.yml` — mise à jour automatique tous les 3 jours

## Passer à une vraie recherche sémantique plus tard

La recherche par mots-clés ne comprend pas les reformulations totalement différentes (ex. "défilement compulsif" ne matchera pas "doomscroll" si aucun mot ne se recoupe). Si ça devient un besoin réel, la voie recommandée est d'ajouter des embeddings (ex. Voyage AI) : recalculer une "empreinte sémantique" par légende au moment de la mise à jour, et comparer la question de l'utilisateur à ces empreintes. Ça nécessite de cacher une clé API au moment de la recherche (impossible sur un site 100% statique comme GitHub Pages), donc ça impliquerait d'ajouter une petite fonction serveur (ex. Cloudflare Pages Functions, ou si le média utilise déjà une plateforme interne comme Chough/Next.js, une API route serait plus simple encore).
