const DEFAULT_BASE = import.meta.env.VITE_MANGAUPDATES_PROXY_URL?.replace(/\/$/, '') || '/api/mangaupdates';
const LOCAL_PROXY_BASE = import.meta.env.VITE_LOCAL_MANGAUPDATES_PROXY_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8787/api/mangaupdates';
const DIRECT_BASE = 'https://api.mangaupdates.com/v1';
// #region debug-point C:live-request-paths
const DEBUG_SERVER_URL = 'http://127.0.0.1:7778/event';
const DEBUG_SESSION_ID = 'live-request-failure';
const reportDebug = (hypothesisId: string, msg: string, data: Record<string, unknown>) => {
  void fetch(DEBUG_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: DEBUG_SESSION_ID, runId: 'pre-fix', hypothesisId, location: 'src/api/mangaupdates.ts', msg: `[DEBUG] ${msg}`, data, ts: Date.now() }),
  }).catch(() => {});
};
// #endregion

const resolveUrl = (base: string, ep: string) => {
  const path = ep.startsWith('/') ? ep : `/${ep}`;
  return `${base}${path}`;
};

const isLocalHost = () =>
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

const getCandidateBases = () => {
  const bases = isLocalHost() ? [DEFAULT_BASE, LOCAL_PROXY_BASE, DIRECT_BASE] : [DEFAULT_BASE];
  return bases.filter((base, index) => !!base && bases.indexOf(base) === index);
};

const trimDetail = (detail: string) => detail.trim().replace(/\s+/g, ' ').slice(0, 240);

const describeBase = (base: string) => {
  if (base === DEFAULT_BASE) return 'configured proxy';
  if (base === LOCAL_PROXY_BASE) return 'local proxy';
  if (base === DIRECT_BASE) return 'direct API';
  return base;
};
class API {
  private last = 0;
  async fetch<T>(ep: string, o: {method?:string;body?:unknown} = {}): Promise<T> {
    const now = Date.now(); if (now - this.last < 600) await new Promise(r => setTimeout(r, 600 - (now - this.last)));
    this.last = Date.now();
    const request = { method: o.method||'GET', headers: {'Content-Type':'application/json',Accept:'application/json'}, body: o.body ? JSON.stringify(o.body) : undefined };
    const failures: string[] = [];
    const candidateBases = getCandidateBases();
    reportDebug('C', 'live request started', { ep, method: request.method, candidateBases: candidateBases.map(describeBase), isLocalHost: isLocalHost() });
    for (const base of candidateBases) {
      const url = resolveUrl(base, ep);
      try {
        reportDebug('C', 'live request attempt', { ep, method: request.method, base: describeBase(base), url });
        const res = await fetch(url, request);
        if (!res.ok) {
          let detail = '';
          try { detail = trimDetail(await res.text()); } catch {}
          reportDebug('C', 'live request non-ok response', { ep, method: request.method, base: describeBase(base), url, status: res.status, detail });
          failures.push(`${describeBase(base)}: API ${res.status}${detail ? `: ${detail}` : ''}`);
          continue;
        }
        reportDebug('C', 'live request succeeded', { ep, method: request.method, base: describeBase(base), url, status: res.status });
        return res.json() as Promise<T>;
      } catch (err) {
        reportDebug('C', 'live request threw', { ep, method: request.method, base: describeBase(base), url, error: err instanceof Error ? err.message : 'Network error' });
        failures.push(`${describeBase(base)}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }
    reportDebug('C', 'live request exhausted all bases', { ep, method: request.method, failures });
    throw new Error(`MangaUpdates live request failed. ${failures.join(' | ')}`);
  }
  searchSeries(o: {search?:string;page?:number;perPage?:number} = {}) { return this.fetch<{total_hits:number;results:SR[]}>('/series/search', {method:'POST',body:{page:o.page||1,perpage:o.perPage||25,...(o.search?{search:o.search}:{})}}); }
  getSeriesDetail(id: number) { return this.fetch<SDR>(`/series/${id}`); }
}
export interface SR { record: { id?: number; series_id?: number; title: string; url?: string; image?: {url?:{thumb?:string;original?:string}}; type?: string; year?: string; status?: string; bayesian_rating?: number; rating_votes?: number; genres?: {genre?:string;genre_name?:string;genre_slug?:string}[]; licensed?: boolean; completed?: boolean; }; hit: {total_hits:number}; }
export interface SDR { id?: number; series_id?: number; title: string; url?: string; description?: string; image?: {url?:{thumb?:string;original?:string}}; type?: string; year?: string; status?: string; licensed?: boolean; completed?: boolean; bayesian_rating?: number; rating_votes?: number; genres?: {genre?:string;genre_name?:string;genre_slug?:string}[]; categories?: {category?:string;category_slug?:string;series_id?:number;votes?:number}[]; authors?: {name:string;author_id?:number;id?:number;type?:string}[]; artists?: {name:string;author_id?:number;id?:number;type?:string}[]; publishers?: {publisher_name?:string;name?:string;publisher_id?:number;id?:number;type?:string;notes?:string}[]; publications?: {publication_name?:string;name?:string;publisher_id?:number;id?:number}[]; recommendations?: {series_id?:number;series_name?:string;title?:string;weight?:number;count?:number}[]; related?: {related_series_id?:number;related_series_name?:string;relation_type?:string}[]; related_series?: {series_id?:number;title?:string;relation_type?:string}[]; }
export const api = new API(); export default api;
