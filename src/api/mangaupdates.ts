const API_BASE = 'https://api.mangaupdates.com/v1';

class MangaUpdatesAPI {
  private lastRequestTime = 0;
  private minSpacing = 600;

  async fetch<T>(endpoint: string, opts: {method?:string;body?:unknown} = {}): Promise<T> {
    const now = Date.now();
    if (now - this.lastRequestTime < this.minSpacing) await new Promise(r => setTimeout(r, this.minSpacing - (now - this.lastRequestTime)));
    this.lastRequestTime = Date.now();
    const res = await fetch(`${API_BASE}${endpoint}`, { method: opts.method||'GET', headers: {'Content-Type':'application/json',Accept:'application/json'}, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json() as Promise<T>;
  }

  searchSeries(o: {search?:string;page?:number;perPage?:number} = {}) {
    return this.fetch<{total_hits:number;results:SeriesSearchResult[]}>('/series/search', {method:'POST', body:{page:o.page||1,perpage:o.perPage||25,...(o.search?{search:o.search}:{})}});
  }
  getSeriesDetail(id: number) { return this.fetch<SeriesDetailResponse>(`/series/${id}`); }
  getSeriesRecommendations(id: number) { return this.fetch<{recommendations:{series_id:number;title:string;count?:number}[]}>(`/series/${id}/recommendations`); }
  getSeriesRelated(id: number) { return this.fetch<{related_series:{series_id:number;title:string;relation_type?:string}[]}>(`/series/${id}/related`); }
  getGenres() { return this.fetch<{id:number;name:string;slug?:string}[]>('/genres/list'); }
}

export interface SeriesSearchResult { record: { id: number; title: string; url?: string; image?: {url?:{thumb?:string}}; type?: string; year?: string; status?: string; bayesian_rating?: number; rating_votes?: number; genres?: {genre_name:string;genre_slug?:string}[]; licensed?: boolean; completed?: boolean; }; hit: {total_hits:number}; }
export interface SeriesDetailResponse {
  id: number; title: string; url?: string; description?: string; image?: {url?:{thumb?:string;original?:string}};
  type?: string; year?: string; status?: string; licensed?: boolean; completed?: boolean;
  bayesian_rating?: number; rating_votes?: number;
  genres?: {genre_name:string;genre_slug?:string}[]; categories?: {category:string;category_slug?:string}[];
  authors?: {name:string;id?:number}[]; artists?: {name:string;id?:number}[];
  publishers?: {name:string;id?:number}[]; publications?: {name:string;id?:number}[];
  recommendations?: {series_id:number;title:string;count?:number}[];
  related_series?: {series_id:number;title:string;relation_type?:string}[];
}

export const api = new MangaUpdatesAPI();
export default api;
