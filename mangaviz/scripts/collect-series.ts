import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.mangaupdates.com/v1';
const CACHE_DIR = path.resolve(process.cwd(), 'cache', 'raw');
const MAX_SERIES = parseInt(process.env.MAX_SERIES || '500', 10);
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY || '800', 10);

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(endpoint: string, body: Record<string,unknown>, maxRetries = 3): Promise<any> {
  for (let a = 1; a <= maxRetries; a++) {
    try {
      const r = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { if (r.status === 429 && a < maxRetries) { await sleep(1000 * Math.pow(2, a)); continue; } throw new Error(`HTTP ${r.status}`); }
      return r.json();
    } catch(e) { if (a === maxRetries) throw e; await sleep(500 * Math.pow(2, a)); }
  }
}

function saveCache(dir: string, file: string, data: any, endpoint: string, reqBody?: any) {
  const fp = path.join(CACHE_DIR, dir); fs.mkdirSync(fp, { recursive: true });
  fs.writeFileSync(path.join(fp, file), JSON.stringify({ source: 'api.mangaupdates.com', endpoint, requestBody: reqBody||null, fetchedAt: new Date().toISOString(), responseData: data, apiVersion: 'v1' }, null, 2));
}

async function main() {
  console.log(`Collecting up to ${MAX_SERIES} series...`);
  const allIds = new Set<number>();
  let page = 1;

  while (allIds.size < MAX_SERIES) {
    console.log(`Page ${page}...`);
    const result = await fetchWithRetry('/series/search', { page, perpage: 100, orderby: 'rating', direction: 'desc' });
    const hits = result.results || [];
    if (hits.length === 0) break;
    saveCache('series-search', `search-page-${String(page).padStart(4,'0')}.json`, result, '/series/search', { page, perpage: 100 });

    for (const hit of hits) {
      const id = hit.record.id;
      if (allIds.has(id)) continue;
      allIds.add(id);
      try {
        const detailPath = path.join(CACHE_DIR, 'series-detail', `series-${id}.json`);
        if (!fs.existsSync(detailPath)) {
          const detail = await fetchWithRetry(`/series/${id}`, {});
          saveCache('series-detail', `series-${id}.json`, detail, `/series/${id}`);
          try { const recs = await fetchWithRetry(`/series/${id}/recommendations`, {}); saveCache('series-detail', `series-${id}-recs.json`, recs, `/series/${id}/recommendations`); } catch {}
          try { const rel = await fetchWithRetry(`/series/${id}/related`, {}); saveCache('series-detail', `series-${id}-related.json`, rel, `/series/${id}/related`); } catch {}
        }
      } catch(e) { console.error(`Error on series ${id}:`, e); }
      await sleep(REQUEST_DELAY + Math.random() * 200);
    }
    page++;
    if (allIds.size % 50 === 0) console.log(`  Collected ${allIds.size}/${MAX_SERIES}`);
  }
  console.log(`Done. Collected ${allIds.size} series.`);
}

main().catch(console.error);
