import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.mangaupdates.com/v1';
const CACHE_DIR = path.resolve(process.cwd(), 'cache', 'raw');
const DETAIL_DIR = path.join(CACHE_DIR, 'series-detail');
const SEARCH_DIR = path.join(CACHE_DIR, 'series-search');
const RELEASE_DIR = path.join(CACHE_DIR, 'releases-search');
const COLLECTOR_SUMMARY_PATH = path.join(CACHE_DIR, 'collector-summary.json');
const MAX_SERIES = parseInt(process.env.MAX_SERIES || '500', 10);
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY || '800', 10);
const CANDIDATE_TARGET = Math.max(MAX_SERIES, Math.ceil(MAX_SERIES * 1.5));
const MIN_DETAIL_SERIES = parseInt(
  process.env.MIN_DETAIL_SERIES || String(Math.min(MAX_SERIES, Math.max(25, Math.ceil(MAX_SERIES * 0.2)))),
  10,
);
const SEARCH_PAGE_SIZE = 100;
const RELEASE_PAGE_SIZE = 100;
const MIXED_SEEDS = (process.env.ATLAS_MIXED_SEEDS || 'isekai,villainess,romance,fantasy,action,school,dungeon,hunter,revenge,hero,queen,king,murim,regression,time travel,academy')
  .split(',')
  .map((seed) => seed.trim())
  .filter(Boolean);

type Strategy = 'latest_updated' | 'latest_published' | 'recent_popularity' | 'mixed_seed_queries';

type SearchHit = {
  record?: {
    id?: number;
    series_id?: number;
    title?: string;
    year?: string;
    bayesian_rating?: number;
    rating_votes?: number;
    last_updated?: { timestamp?: number };
  };
};

type ReleaseHit = {
  record?: {
    title?: string;
    release_date?: string;
    time_added?: { timestamp?: number };
  };
};

type SearchResponse = {
  results?: SearchHit[];
};

type ReleaseResponse = {
  results?: ReleaseHit[];
};

type Candidate = {
  id: number;
  title: string;
  score: number;
  sources: string[];
};

const isStrategy = (value: string): value is Strategy =>
  ['latest_updated', 'latest_published', 'recent_popularity', 'mixed_seed_queries'].includes(value);

const STRATEGY: Strategy = isStrategy(process.env.ATLAS_STRATEGY || '')
  ? (process.env.ATLAS_STRATEGY as Strategy)
  : 'mixed_seed_queries';

let lastRequestAt = 0;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY) {
    await sleep(REQUEST_DELAY - elapsed);
  }
  lastRequestAt = Date.now();
}

async function requestJson<T>(endpoint: string, init: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {}, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await rateLimit();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: init.method || 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      if (!response.ok) {
        if (response.status === 429 && attempt < maxRetries) {
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        const failure = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}${failure ? `: ${failure}` : ''}`);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw new Error(`Unable to fetch ${endpoint}`);
}

function saveCache(dir: string, file: string, data: unknown, endpoint: string, requestBody?: unknown) {
  const outputDir = path.join(CACHE_DIR, dir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, file),
    JSON.stringify(
      {
        source: 'api.mangaupdates.com',
        endpoint,
        requestBody: requestBody || null,
        fetchedAt: new Date().toISOString(),
        responseData: data,
        apiVersion: 'v1',
      },
      null,
      2,
    ),
  );
}

function writeCollectorSummary(summary: Record<string, unknown>) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(COLLECTOR_SUMMARY_PATH, JSON.stringify(summary, null, 2));
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseYear(value?: string) {
  const year = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(year) ? year : 0;
}

function searchRecordId(hit: SearchHit) {
  const id = hit.record?.series_id ?? hit.record?.id;
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

function searchRecordTitle(hit: SearchHit) {
  return hit.record?.title?.trim() || '';
}

function searchRecordLastUpdated(hit: SearchHit) {
  return hit.record?.last_updated?.timestamp || 0;
}

function ratingSignal(hit: SearchHit) {
  const rating = hit.record?.bayesian_rating || 0;
  const votes = hit.record?.rating_votes || 0;
  return rating * 1000 + Math.log10(votes + 1) * 600;
}

function recordCandidate(candidates: Map<number, Candidate>, id: number, title: string, score: number, source: string) {
  const existing = candidates.get(id);
  if (!existing) {
    candidates.set(id, { id, title, score, sources: [source] });
    return;
  }
  existing.score = Math.max(existing.score, score);
  if (!existing.sources.includes(source)) existing.sources.push(source);
  if (title && (!existing.title || existing.title.startsWith('Series '))) {
    existing.title = title;
  }
}

function latestPublishedScore(hit: SearchHit) {
  return parseYear(hit.record?.year) * 1_000_000 + searchRecordLastUpdated(hit) + ratingSignal(hit);
}

function recentPopularityScore(hit: SearchHit) {
  const yearBoost = Math.max(0, parseYear(hit.record?.year) - 2010) * 1_500;
  return ratingSignal(hit) * 8 + searchRecordLastUpdated(hit) / 1000 + yearBoost;
}

function mixedSeedScore(hit: SearchHit) {
  const yearBoost = Math.max(0, parseYear(hit.record?.year) - 2015) * 1_200;
  return ratingSignal(hit) * 6 + searchRecordLastUpdated(hit) / 2000 + yearBoost;
}

async function searchSeries(body: Record<string, unknown>) {
  const response = await requestJson<SearchResponse>('/series/search', { method: 'POST', body });
  return response.results || [];
}

async function collectSearchPages(options: {
  candidates: Map<number, Candidate>;
  pageLimit: number;
  targetCount: number;
  perpage?: number;
  search?: string;
  orderby: string;
  direction: 'asc' | 'desc';
  score: (hit: SearchHit) => number;
  cachePrefix: string;
}) {
  const perpage = options.perpage || SEARCH_PAGE_SIZE;
  for (let page = 1; page <= options.pageLimit && options.candidates.size < options.targetCount; page += 1) {
    const body = {
      page,
      perpage,
      orderby: options.orderby,
      direction: options.direction,
      ...(options.search ? { search: options.search } : {}),
    };
    const results = await searchSeries(body);
    if (results.length === 0) break;
    saveCache('series-search', `${options.cachePrefix}-page-${String(page).padStart(4, '0')}.json`, { results }, '/series/search', body);
    for (const hit of results) {
      const id = searchRecordId(hit);
      const title = searchRecordTitle(hit);
      if (!id || !title) continue;
      recordCandidate(options.candidates, id, title, options.score(hit), options.cachePrefix);
    }
  }
}

function scoreResolvedSearchHit(hit: SearchHit, queryTitle: string) {
  const title = searchRecordTitle(hit);
  const normalizedTitle = normalizeTitle(title);
  const normalizedQuery = normalizeTitle(queryTitle);
  let score = mixedSeedScore(hit);
  if (normalizedTitle === normalizedQuery) score += 1_000_000_000;
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 500_000_000;
  else if (normalizedTitle.includes(normalizedQuery)) score += 100_000_000;
  return score;
}

async function resolveReleaseTitleToSeries(releaseTitle: string) {
  const body = {
    page: 1,
    perpage: 5,
    orderby: 'year',
    direction: 'desc' as const,
    search: releaseTitle,
  };
  const results = await searchSeries(body);
  saveCache('series-search', `resolve-${normalizeTitle(releaseTitle).replace(/\s+/g, '-').slice(0, 80) || 'title'}.json`, { results }, '/series/search', body);
  const ranked = results
    .map((hit) => {
      const id = searchRecordId(hit);
      return id ? { hit, id, score: scoreResolvedSearchHit(hit, releaseTitle) } : null;
    })
    .filter((entry): entry is { hit: SearchHit; id: number; score: number } => Boolean(entry))
    .sort((left, right) => right.score - left.score);
  if (ranked.length === 0) return null;
  return {
    id: ranked[0].id,
    title: searchRecordTitle(ranked[0].hit),
  };
}

async function collectLatestUpdatedCandidates(candidates: Map<number, Candidate>) {
  const seenTitles = new Set<string>();
  const pageLimit = Math.max(3, Math.ceil(MAX_SERIES / RELEASE_PAGE_SIZE) + 4);
  for (let page = 1; page <= pageLimit && candidates.size < MAX_SERIES; page += 1) {
    const body = { page, perpage: RELEASE_PAGE_SIZE };
    const response = await requestJson<ReleaseResponse>('/releases/search', { method: 'POST', body });
    const results = response.results || [];
    if (results.length === 0) break;
    saveCache('releases-search', `releases-page-${String(page).padStart(4, '0')}.json`, response, '/releases/search', body);
    for (const release of results) {
      const title = release.record?.title?.trim();
      if (!title) continue;
      const normalized = normalizeTitle(title);
      if (!normalized || seenTitles.has(normalized)) continue;
      seenTitles.add(normalized);
      const resolved = await resolveReleaseTitleToSeries(title);
      if (!resolved) continue;
      const timestamp = release.record?.time_added?.timestamp || 0;
      recordCandidate(candidates, resolved.id, resolved.title, timestamp || Date.now(), 'latest_updated');
      if (candidates.size >= MAX_SERIES) break;
    }
  }
}

async function collectLatestPublishedCandidates(candidates: Map<number, Candidate>) {
  await collectSearchPages({
    candidates,
    pageLimit: Math.max(3, Math.ceil(MAX_SERIES / SEARCH_PAGE_SIZE) + 3),
    targetCount: MAX_SERIES,
    orderby: 'year',
    direction: 'desc',
    score: latestPublishedScore,
    cachePrefix: 'latest-published',
  });
}

async function collectRecentPopularityCandidates(candidates: Map<number, Candidate>) {
  await collectSearchPages({
    candidates,
    pageLimit: Math.max(4, Math.ceil(CANDIDATE_TARGET / SEARCH_PAGE_SIZE) + 4),
    targetCount: CANDIDATE_TARGET,
    orderby: 'rating',
    direction: 'desc',
    score: recentPopularityScore,
    cachePrefix: 'recent-popularity-rating',
  });
  await collectSearchPages({
    candidates,
    pageLimit: 4,
    targetCount: CANDIDATE_TARGET,
    orderby: 'year',
    direction: 'desc',
    score: recentPopularityScore,
    cachePrefix: 'recent-popularity-year',
  });
  await collectLatestUpdatedCandidates(candidates);
}

async function collectMixedSeedCandidates(candidates: Map<number, Candidate>) {
  for (const seed of MIXED_SEEDS) {
    if (candidates.size >= CANDIDATE_TARGET) break;
    await collectSearchPages({
      candidates,
      pageLimit: 1,
      targetCount: CANDIDATE_TARGET,
      perpage: 30,
      search: seed,
      orderby: 'year',
      direction: 'desc',
      score: mixedSeedScore,
      cachePrefix: `mixed-year-${normalizeTitle(seed).replace(/\s+/g, '-')}`,
    });
    if (candidates.size >= CANDIDATE_TARGET) break;
    await collectSearchPages({
      candidates,
      pageLimit: 1,
      targetCount: CANDIDATE_TARGET,
      perpage: 20,
      search: seed,
      orderby: 'rating',
      direction: 'desc',
      score: mixedSeedScore,
      cachePrefix: `mixed-rating-${normalizeTitle(seed).replace(/\s+/g, '-')}`,
    });
  }
  if (candidates.size < CANDIDATE_TARGET) {
    await collectLatestUpdatedCandidates(candidates);
  }
}

function getSelectedIds(candidates: Map<number, Candidate>) {
  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_SERIES)
    .map((candidate) => candidate.id);
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function detailPathFor(id: number) {
  return path.join(DETAIL_DIR, `series-${id}.json`);
}

async function fetchSeriesDetail(id: number) {
  const detail = await requestJson<Record<string, unknown>>(`/series/${id}`, { method: 'GET' });
  saveCache('series-detail', `series-${id}.json`, detail, `/series/${id}`);
}

function pruneSeriesDetailCache(selectedIds: Set<number>) {
  if (!fs.existsSync(DETAIL_DIR)) return;
  for (const file of fs.readdirSync(DETAIL_DIR)) {
    const match = file.match(/^series-(\d+)(?:-(recs|related))?\.json$/);
    if (!match) continue;
    const id = Number.parseInt(match[1], 10);
    if (selectedIds.has(id)) continue;
    fs.rmSync(path.join(DETAIL_DIR, file), { force: true });
  }
}

async function buildCandidates() {
  const candidates = new Map<number, Candidate>();
  switch (STRATEGY) {
    case 'latest_updated':
      await collectLatestUpdatedCandidates(candidates);
      break;
    case 'latest_published':
      await collectLatestPublishedCandidates(candidates);
      break;
    case 'recent_popularity':
      await collectRecentPopularityCandidates(candidates);
      break;
    case 'mixed_seed_queries':
      await collectMixedSeedCandidates(candidates);
      break;
  }
  return candidates;
}

async function main() {
  ensureDir(SEARCH_DIR);
  ensureDir(RELEASE_DIR);
  ensureDir(DETAIL_DIR);

  console.log(`Collecting up to ${MAX_SERIES} series using strategy "${STRATEGY}"...`);
  const candidates = await buildCandidates();
  const selectedIds = getSelectedIds(candidates);
  if (selectedIds.length < MIN_DETAIL_SERIES) {
    throw new Error(
      `Collector found only ${selectedIds.length} candidate series for strategy "${STRATEGY}". Expected at least ${MIN_DETAIL_SERIES}.`,
    );
  }

  console.log(`Selected ${selectedIds.length} candidate series IDs.`);
  let fetched = 0;
  for (const [index, id] of selectedIds.entries()) {
    try {
      if (!fs.existsSync(detailPathFor(id))) {
        await fetchSeriesDetail(id);
        fetched += 1;
      }
    } catch (error) {
      console.error(`Error fetching series ${id}:`, error);
    }
    if ((index + 1) % 50 === 0 || index === selectedIds.length - 1) {
      console.log(`  Detailed series ready: ${index + 1}/${selectedIds.length}`);
    }
  }

  const selectedIdSet = new Set(selectedIds);
  pruneSeriesDetailCache(selectedIdSet);
  const readyIds = selectedIds.filter((id) => fs.existsSync(detailPathFor(id)));
  if (readyIds.length < MIN_DETAIL_SERIES) {
    throw new Error(
      `Collector prepared only ${readyIds.length} detailed series after fetching. Expected at least ${MIN_DETAIL_SERIES}.`,
    );
  }

  writeCollectorSummary({
    strategy: STRATEGY,
    maxSeries: MAX_SERIES,
    minDetailSeries: MIN_DETAIL_SERIES,
    candidateCount: candidates.size,
    selectedSeriesCount: selectedIds.length,
    detailSeriesCount: readyIds.length,
    fetchedSeriesCount: fetched,
    generatedAt: new Date().toISOString(),
  });

  console.log(`Done. Prepared ${readyIds.length} detailed series from ${candidates.size} candidates.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
