// ============================================================
// MangaViz – Series Collector (Local Script)
// ============================================================
// Run: npx tsx scripts/collect-series.ts
// Fetches series from MangaUpdates API and caches raw responses.
// Respects rate limiting and supports checkpointing.
// ============================================================

import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.mangaupdates.com/v1';
const CACHE_DIR = path.resolve(__dirname, '..', 'cache', 'raw');
const MAX_SERIES = parseInt(process.env.MAX_SERIES || '500', 10);
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY || '800', 10);
const CHECKPOINT_FILE = path.resolve(CACHE_DIR, '.checkpoint.json');

interface Checkpoint {
  collectedIds: number[];
  currentPage: number;
  completed: boolean;
  lastUpdated: string;
}

function getCachePath(...segments: string[]): string {
  const fullPath = path.join(CACHE_DIR, ...segments);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  return fullPath;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  endpoint: string,
  body: Record<string, unknown>,
  maxRetries = 3
): Promise<unknown> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 429 && attempt < maxRetries) {
          const wait = Math.pow(2, attempt) * 1000;
          console.log(`  Rate limited (429). Waiting ${wait}ms...`);
          await sleep(wait);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const wait = Math.pow(2, attempt) * 500;
      console.log(`  Attempt ${attempt} failed. Retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
}

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return null;
}

function saveCheckpoint(cp: Checkpoint) {
  cp.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

function saveCacheEntry(
  category: string,
  filename: string,
  data: unknown,
  endpoint: string,
  requestBody?: unknown
) {
  const entry = {
    source: 'api.mangaupdates.com',
    endpoint,
    requestBody: requestBody || null,
    fetchedAt: new Date().toISOString(),
    responseData: data,
    apiVersion: 'v1',
  };
  const filepath = getCachePath(category, filename);
  fs.writeFileSync(filepath, JSON.stringify(entry, null, 2));
  console.log(`  Cached: ${filepath}`);
}

async function collectSeriesBySearch() {
  console.log(`\n=== Collecting series (max ${MAX_SERIES}) ===\n`);

  let checkpoint = loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      collectedIds: [],
      currentPage: 1,
      completed: false,
      lastUpdated: new Date().toISOString(),
    };
  }

  if (checkpoint.completed) {
    console.log('Collection already completed. Delete .checkpoint to restart.');
    return checkpoint.collectedIds;
  }

  const allIds = new Set(checkpoint.collectedIds);
  let page = checkpoint.currentPage;

  console.log(`Resuming from page ${page} (${allIds.size} already collected)`);

  while (allIds.size < MAX_SERIES) {
    console.log(`\nFetching page ${page}...`);

    try {
      const result = (await fetchWithRetry('/series/search', {
        page,
        perpage: 100,
        orderby: 'rating',
        direction: 'desc',
      })) as {
        total_hits: number;
        results: Array<{ record: { id: number; title: string } }>;
      };

      const hits = result.results || [];
      if (hits.length === 0) {
        console.log('No more results.');
        break;
      }

      console.log(`  Got ${hits.length} results (total: ${result.total_hits})`);

      // Cache search response
      const searchFilename = `search-page-${page.toString().padStart(4, '0')}.json`;
      saveCacheEntry('series-search', searchFilename, result, '/series/search', {
        page,
        perpage: 100,
        orderby: 'rating',
        direction: 'desc',
      });

      // Fetch details for each series
      for (const hit of hits) {
        const id = hit.record.id;
        if (allIds.has(id)) continue;

        allIds.add(id);
        const detailFilename = `series-${id}.json`;

        try {
          // Avoid re-fetching cached details
          const detailPath = getCachePath('series-detail', detailFilename);
          if (!fs.existsSync(detailPath)) {
            const detail = await fetchWithRetry(`/series/${id}`, {});
            saveCacheEntry('series-detail', detailFilename, detail, `/series/${id}`);

            // Fetch recommendations and related series
            try {
              const recs = await fetchWithRetry(`/series/${id}/recommendations`, {});
              saveCacheEntry(
                'series-detail',
                `series-${id}-recs.json`,
                recs,
                `/series/${id}/recommendations`
              );
            } catch {
              // Optional data
            }

            try {
              const related = await fetchWithRetry(`/series/${id}/related`, {});
              saveCacheEntry(
                'series-detail',
                `series-${id}-related.json`,
                related,
                `/series/${id}/related`
              );
            } catch {
              // Optional data
            }
          }

          // Save checkpoint periodically
          if (allIds.size % 50 === 0) {
            saveCheckpoint({
              collectedIds: Array.from(allIds),
              currentPage: page,
              completed: false,
              lastUpdated: new Date().toISOString(),
            });
            console.log(`  Checkpoint: ${allIds.size}/${MAX_SERIES}`);
          }
        } catch (err) {
          console.error(`  Error fetching series ${id}:`, err);
        }

        // Rate limiting
        await sleep(REQUEST_DELAY + Math.random() * 200);
      }

      page++;
      saveCheckpoint({
        collectedIds: Array.from(allIds),
        currentPage: page,
        completed: false,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Error on page ${page}:`, err);
      await sleep(5000);
    }
  }

  const collectedIds = Array.from(allIds);
  saveCheckpoint({
    collectedIds,
    currentPage: page,
    completed: true,
    lastUpdated: new Date().toISOString(),
  });

  console.log(`\n=== Collection complete: ${collectedIds.length} series ===`);
  return collectedIds;
}

// Run
collectSeriesBySearch().catch(console.error);
