import type { GraphData, GraphNode, NodeType, EdgeType, SeriesMetadata } from './graphTypes';
import type { SeriesDetailResponse } from '../api/mangaupdates';

export function buildGraphFromSeriesDetails(details: SeriesDetailResponse[]): GraphData {
  const nm = new Map<string,GraphNode>();
  const es = new Set<string>(); const edges: GraphData['edges'] = [];
  const n = (id:string,label:string,type:NodeType,w=1) => { if (!nm.has(id)) nm.set(id,{id,label,type,weight:w,metadata:{}}); else { const x=nm.get(id)!; x.weight=Math.max(x.weight,w); } return nm.get(id)!; };
  const ae = (s:string,t:string,type:EdgeType,w=1)=>{ const eid=`${s}--${t}--${type}`; if(es.has(eid))return; es.add(eid); edges.push({id:eid,source:s,target:t,type,weight:w}); };

  for (const d of details) {
    const sid = `series:${d.id}`;
    const sm: SeriesMetadata = { seriesId: d.id, type: d.type, year: d.year, rating: d.bayesian_rating, ratingVotes: d.rating_votes, image: d.image?.url?.thumb||d.image?.url?.original, url: d.url, status: d.status, licensed: d.licensed, completed: d.completed, description: d.description, associated: { authors: d.authors?.map(a=>({name:a.name,id:a.id})), artists: d.artists?.map(a=>({name:a.name,id:a.id})), publishers: d.publishers?.map(p=>({name:p.name,id:p.id})), publications: d.publications?.map(p=>({name:p.name,id:p.id})), genres: d.genres?.map(g=>({name:g.genre_name,slug:g.genre_slug})), categories: d.categories?.map(c=>({name:c.category,slug:c.category_slug})) } };
    if (d.recommendations) sm.recommendations = d.recommendations.map(r=>({title:r.title,id:r.series_id,weight:r.count}));
    if (d.related_series) sm.relatedSeries = d.related_series.map(r=>({title:r.title,id:r.series_id,relation:r.relation_type}));
    const w = d.bayesian_rating ? Math.max(1, d.bayesian_rating * (d.rating_votes||1) * 0.01) : 1;
    const node = n(sid, d.title, 'series', w);
    node.seriesMetadata = sm;

    if (d.genres) for (const g of d.genres) { const gid = `genre:${g.genre_slug||g.genre_name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`; n(gid,g.genre_name,'genre'); ae(sid,gid,'has_genre'); }
    if (d.categories) for (const c of d.categories) { const cid = `category:${c.category_slug||c.category.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`; n(cid,c.category,'category'); ae(sid,cid,'has_category'); }
    if (d.authors) for (const a of d.authors) { const aid = `author:${a.id||a.name.replace(/[^a-z0-9]+/g,'-').toLowerCase()}`; n(aid,a.name,'author'); ae(sid,aid,'written_by'); }
    if (d.artists) for (const a of d.artists) { const aid = `artist:${a.id||a.name.replace(/[^a-z0-9]+/g,'-').toLowerCase()}`; n(aid,a.name,'artist'); ae(sid,aid,'illustrated_by'); }
    if (d.publishers) for (const p of d.publishers) { const pid = `publisher:${p.id||p.name.replace(/[^a-z0-9]+/g,'-').toLowerCase()}`; n(pid,p.name,'publisher'); ae(sid,pid,'published_by'); }
    if (d.publications) for (const p of d.publications) { const pid = `publication:${p.id||p.name.replace(/[^a-z0-9]+/g,'-').toLowerCase()}`; n(pid,p.name,'publication'); ae(sid,pid,'serialized_in'); }
    if (d.recommendations) for (const r of d.recommendations) { if (r.series_id && r.series_id !== d.id) { const rw = r.count||1; n(`series:${r.series_id}`, r.title, 'series', rw); ae(sid, `series:${r.series_id}`, 'recommended_with', rw); } }
    if (d.related_series) for (const r of d.related_series) { if (r.series_id && r.series_id !== d.id) { n(`series:${r.series_id}`, r.title, 'series'); ae(sid, `series:${r.series_id}`, 'related_to'); } }
  }

  const nodes = Array.from(nm.values());
  return { nodes, edges, stats: {
    totalNodes: nodes.length, totalEdges: edges.length,
    seriesCount: nodes.filter(n => n.type === 'series').length,
    genreCount: nodes.filter(n => n.type === 'genre').length,
    categoryCount: nodes.filter(n => n.type === 'category').length,
    authorArtistCount: nodes.filter(n => n.type === 'author'||n.type === 'artist').length,
    publisherCount: nodes.filter(n => n.type === 'publisher').length,
    topGenres: [], topCategories: [], highestDegreeSeries: [],
    mostRecommendedSeries: [], highestRatedSeries: [], mostConnectedAuthor: null, mostConnectedPublisher: null,
  }};
}
