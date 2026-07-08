# 🗺️ MangaViz – Manga Universe Graph Explorer

A **RedditViz-inspired** interactive network map of manga, manhwa, manhua, novels, authors, artists, genres, categories, publishers, and more — powered by [MangaUpdates](https://www.mangaupdates.com).

**Live Demo**: Deploy to any free static host (Cloudflare Pages, Netlify, Vercel, or local).

---

## ✨ Features

- **Atlas Mode** – Pre-built graph with precomputed positions loads instantly
- **Live Explorer** – Search MangaUpdates API and build graphs on the fly
- **7 node types**: Series, Genre, Category, Author, Artist, Publisher, Publication
- **8 edge types**: Genres, Categories, Written/Illustrated By, Published/Serialized In, Related Series, Recommendations
- **Clickable nodes** with rich detail panels
- **Filter by node/edge type** and cluster
- **Node type badges** (colors, shapes) and edge style differentiation
- **Fast pan/zoom** with Cytoscape.js
- **Search** across the atlas or query the live API
- **Statistics panel** showing graph overview, top genres, highest-rated series
- **MangaUpdates credit** displayed prominently
- **No backend required** – pure static files

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Generate demo data (16 popular manga series)
npm run data:demo

# Build the app
npm run build

# Preview locally
npm run preview
```

Or in one command for development:

```bash
npm run dev
```

---

## 📦 Project Structure

```
mangaviz/
├── src/
│   ├── api/           # MangaUpdates API client
│   ├── cache/         # IndexedDB browser cache
│   ├── graph/         # Types, styles, layout loader, graph builder
│   └── ui/            # React components (App, GraphCanvas, SearchPanel, etc.)
├── scripts/           # Collector, builder, layout, compress tools
├── public/data/       # Static graph JSON files
├── cache/raw/         # Raw API response cache (local only)
└── dist/              # Vite build output
```

---

## 🗺️ Atlas Mode

### How it works

```
MangaUpdates API → slow local collector → raw cache → graph builder
→ layout preprocessor → static JSON files → free static viewer
```

The browser is **the viewer, not the crawler**. All heavy work happens offline.

### Building a full atlas

```bash
# 1. Collect raw data (spaced requests, ~800ms between calls)
#    Default: 500 series. Set MAX_SERIES=5000 for full build.
npm run collect

# 2. Build graph from cache
npm run build:graph

# 3. Precompute layout positions and clusters
npm run layout

# 4. (Optional) Compress JSON with gzip
npm run data:compress

# 5. Generate manifest
npm run data:manifest

# 6. Build the static site
npm run build
```

### Quick lite atlas

```bash
npm run collect:lite    # 200 series
npm run atlas:lite      # Same as data:demo + layout + manifest
```

### On-demand GitHub refresh

For a Vercel-friendly Atlas refresh without any scheduler, use the repo-root GitHub Actions workflow at `.github/workflows/atlas-refresh.yml`.

1. Open **GitHub -> Actions -> Atlas Refresh**
2. Click **Run workflow**
3. Choose `mode`
   - `direct` updates the target branch immediately
   - `pr` opens a reviewable pull request before deploy
4. Optionally set `ref`, `max_series`, and `request_delay`
5. The workflow runs `npm run atlas:full` from `mangaviz/`
6. Updated `mangaviz/public/data/*` is either committed back to the branch or placed in a PR
7. Vercel redeploys after the direct push or after the PR is merged

This keeps Atlas generation out of Vercel build/runtime limits while preserving the normal Vercel deployment flow.

### Three refresh phases

#### Phase 1: Manual GitHub button

- Trigger `Atlas Refresh` from GitHub Actions with `workflow_dispatch`
- Best for explicit operator-controlled rebuilds

#### Phase 2: Protected admin trigger

- The app can trigger Atlas refresh through `POST /api/admin/atlas-refresh`
- This dispatches a GitHub `repository_dispatch` event named `atlas_refresh_requested`
- Enable the UI by setting `VITE_ATLAS_ADMIN_ENABLED=true`
- Admin sign-in now uses `POST /api/admin/session` and a signed `HttpOnly` cookie
- The browser no longer sends the GitHub trigger token or the admin secret on refresh requests
- State-changing admin requests require same-origin browser headers and repeated failed logins are temporarily rate-limited

Required Vercel environment variables:

```bash
ATLAS_ADMIN_PASSWORD=your-long-admin-password
ATLAS_SESSION_SECRET=long-random-session-signing-secret
GITHUB_ATLAS_TRIGGER_TOKEN=github-token-with-repo-access
GITHUB_OWNER=your-github-org-or-user
GITHUB_REPO=your-repository-name
GITHUB_ATLAS_REF=main
VITE_ATLAS_ADMIN_ENABLED=true
```

#### Phase 3: PR review flow

- Set refresh `mode` to `pr`
- The workflow creates a branch and opens a pull request containing refreshed `mangaviz/public/data/*`
- Merge the PR when ready, then Vercel deploys the reviewed Atlas snapshot
- The same authenticated admin session can trigger either direct deploy or PR review mode

### Pre-loaded demo

The repo ships with a demo dataset of **16 popular manga/manhwa** including Berserk, One Piece, Naruto, Attack on Titan, Solo Leveling, and more — ready to explore immediately.

---

## 🔍 Live Explorer Mode

Toggle to **Live Explorer** in the top bar to:

1. **Search by title** – find any series on MangaUpdates
2. **Build a graph** – fetches up to 10 series details and their relationships
3. **Explore** – click nodes to see details, navigate to related works
4. **Cached** – all API responses cached in IndexedDB for 1 hour

> ⚠️ **CORS note**: If your browser blocks direct API calls, the app shows instructions for running a local CORS proxy:
> ```bash
> npx local-cors-proxy --proxyUrl https://api.mangaupdates.com
> ```

**Important**: Live Explorer fetches small slices only (max 10 series). It won't scrape the entire database.

---

## 🌐 Deployment

### Build for production

```bash
npm run build
```

The `dist/` folder contains everything needed.

### Deploy to free static hosting

#### Cloudflare Pages (recommended)

1. Push to a Git repo (GitHub, GitLab)
2. In Cloudflare Pages: New project → connect repo
3. Build command: `npm run build`
4. Build output: `dist`
5. Done!

#### Netlify

1. Push to Git
2. Netlify → New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Done!

#### Vercel

1. Push to Git
2. Vercel → Import project
3. Framework: Vite
4. Done!

#### Local

```bash
npm run build
npx serve dist
```

## 📊 Collector Details

### Request Spacing

The collector respects the MangaUpdates API by:
- Waiting **800ms** between requests (configurable via `REQUEST_DELAY`)
- Adding random jitter (±100ms)
- Retrying with exponential backoff on 429 rate limits
- Caching every response to avoid re-fetching

### Cache Structure

```
cache/raw/
├── series-search/     # Search result pages
├── series-detail/     # Individual series data
├── authors/           # Author data (future)
├── publishers/        # Publisher data (future)
└── genres/            # Genre data (future)
```

Each cache file includes: `source`, `endpoint`, `fetchedAt`, `responseData`, `apiVersion`.

### Checkpointing

The collector saves progress every 50 series. If interrupted, it resumes from the last checkpoint.

---

## 🔧 Architecture Principles

| Principle | Implementation |
|-----------|---------------|
| Browser is viewer, not crawler | Atlas loads prebuilt JSON; Live Explorer fetches small slices only |
| No backend required | Pure static files served from CDN |
| No login/API keys | MangaUpdates v1 API is open |
| Fast loading | Precomputed positions, sharded JSON, gzip |
| Free resources | Open source libs, free static hosting, no paid services |
| Rate limiting | 800ms spacing in collector, 600ms in browser API client |

---

## 📈 Adding More Graph Relationships

The architecture supports adding:

- **Category co-occurrence** edges between categories
- **Genre co-occurrence** edges between genres
- **Author collaboration** edges between authors
- **Timeline edges** based on publication years
- **User rating similarity** edges between series

To add a new relationship type:

1. Add the edge type to `src/graph/graphTypes.ts`
2. Add styling in `src/graph/graphStyles.ts`
3. Update the graph builder in `scripts/build-graph.ts`
4. Regenerate the atlas

---

## 🛠️ Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Cytoscape.js** for graph rendering
- **IndexedDB** for browser caching
- **Node.js** scripts for data collection and processing
- **Free static hosting** (Cloudflare Pages, Netlify, Vercel)

---

## 🙏 Credits

- **Data**: [MangaUpdates](https://www.mangaupdates.com) – the most comprehensive manga database
- **Inspiration**: [RedditViz](https://rhiever.github.io/redditviz/) – the original subreddit network explorer
- **Icons**: SVG icons from Material Design

---

## 📝 License

MIT
