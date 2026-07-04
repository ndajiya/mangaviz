const DEFAULT_BASE = import.meta.env.VITE_MANGAUPDATES_PROXY_URL?.replace(/\/$/, '') || '/api/mangaupdates';
const DIRECT_BASE = 'https://api.mangaupdates.com/v1';
const resolveUrl = (ep: string, useDirect = false) => {
  const path = ep.startsWith('/') ? ep : `/${ep}`;
  return useDirect ? `${DIRECT_BASE}${path}` : `${DEFAULT_BASE}${path}`;
};
class API {
  private last = 0;
  async fetch<T>(ep: string, o: {method?:string;body?:unknown} = {}): Promise<T> {
    const now = Date.now(); if (now - this.last < 600) await new Promise(r => setTimeout(r, 600 - (now - this.last)));
    this.last = Date.now();
    const url = resolveUrl(ep);
    const res = await fetch(url, { method: o.method||'GET', headers: {'Content-Type':'application/json',Accept:'application/json'}, body: o.body ? JSON.stringify(o.body) : undefined });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch {}
      if (res.status === 403 || res.status === 404) {
        const directRes = await fetch(resolveUrl(ep, true), { method: o.method||'GET', headers: {'Content-Type':'application/json',Accept:'application/json'}, body: o.body ? JSON.stringify(o.body) : undefined });
        if (!directRes.ok) {
          let directDetail = '';
          try { directDetail = await directRes.text(); } catch {}
          throw new Error(`API ${directRes.status}${directDetail ? `: ${directDetail}` : ''}`);
        }
        return directRes.json() as Promise<T>;
      }
      throw new Error(`API ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    return res.json() as Promise<T>;
  }
  searchSeries(o: {search?:string;page?:number;perPage?:number} = {}) { return this.fetch<{total_hits:number;results:SR[]}>('/series/search', {method:'POST',body:{page:o.page||1,perpage:o.perPage||25,...(o.search?{search:o.search}:{})}}); }
  getSeriesDetail(id: number) { return this.fetch<SDR>(`/series/${id}`); }
}
export interface SR { record: { id?: number; series_id?: number; title: string; url?: string; image?: {url?:{thumb?:string;original?:string}}; type?: string; year?: string; status?: string; bayesian_rating?: number; rating_votes?: number; genres?: {genre?:string;genre_name?:string;genre_slug?:string}[]; licensed?: boolean; completed?: boolean; }; hit: {total_hits:number}; }
export interface SDR { id?: number; series_id?: number; title: string; url?: string; description?: string; image?: {url?:{thumb?:string;original?:string}}; type?: string; year?: string; status?: string; licensed?: boolean; completed?: boolean; bayesian_rating?: number; rating_votes?: number; genres?: {genre?:string;genre_name?:string;genre_slug?:string}[]; categories?: {category?:string;category_slug?:string;series_id?:number;votes?:number}[]; authors?: {name:string;author_id?:number;id?:number;type?:string}[]; artists?: {name:string;author_id?:number;id?:number;type?:string}[]; publishers?: {publisher_name?:string;name?:string;publisher_id?:number;id?:number;type?:string;notes?:string}[]; publications?: {publication_name?:string;name?:string;publisher_id?:number;id?:number}[]; recommendations?: {series_id?:number;series_name?:string;title?:string;weight?:number;count?:number}[]; related?: {related_series_id?:number;related_series_name?:string;relation_type?:string}[]; related_series?: {series_id?:number;title?:string;relation_type?:string}[]; }
export const api = new API(); export default api;
