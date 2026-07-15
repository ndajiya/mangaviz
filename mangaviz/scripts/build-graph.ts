import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), 'cache', 'raw');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'data');
const MAX_ATLAS_NODES = Math.max(1, parseInt(process.env.MAX_ATLAS_NODES || '1000', 10) || 1000);

interface RC { responseData: Record<string,any>; }

function limitGraph(nodes: any[], edges: any[]) {
  if (nodes.length <= MAX_ATLAS_NODES) return { nodes, edges };

  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  const rankedNodes = [...nodes].sort((left, right) => {
    const leftPriority = left.seriesMetadata ? 3 : left.type === 'series' ? 1 : 2;
    const rightPriority = right.seriesMetadata ? 3 : right.type === 'series' ? 1 : 2;
    return rightPriority - leftPriority
      || (degree.get(right.id) || 0) - (degree.get(left.id) || 0)
      || (right.weight || 0) - (left.weight || 0)
      || left.id.localeCompare(right.id);
  });
  const limitedNodes = rankedNodes.slice(0, MAX_ATLAS_NODES);
  const retainedIds = new Set(limitedNodes.map((node) => node.id));
  const limitedEdges = edges.filter((edge) => retainedIds.has(edge.source) && retainedIds.has(edge.target));
  return { nodes: limitedNodes, edges: limitedEdges };
}

function removeStaleGraphShards() {
  if (!fs.existsSync(OUTPUT_DIR)) return;
  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (/^(nodes|edges)\..+\.json(?:\.gz)?$/.test(file)) {
      fs.rmSync(path.join(OUTPUT_DIR, file), { force: true });
    }
  }
}

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

// #region debug-point E:debug-report
const debugReport = async (hypothesisId: string, location: string, msg: string, data: Record<string, unknown> = {}) => {
  let debugServerUrl = 'http://127.0.0.1:7777/event';
  let debugSessionId = 'atlas-refresh-stale';
  try {
    const envFile = path.resolve(process.cwd(), '..', '.dbg', 'atlas-refresh-stale.env');
    const envContent = fs.readFileSync(envFile, 'utf8');
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {}
  await fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: debugSessionId, runId: 'pre-fix', hypothesisId, location, msg: `[DEBUG] ${msg}`, data, ts: Date.now() }),
  }).catch(() => {});
};
// #endregion

function loadSeriesDetails(): Map<number, any> {
  const m = new Map();
  const dd = path.join(CACHE_DIR, 'series-detail');
  if (!fs.existsSync(dd)) return m;
  for (const f of fs.readdirSync(dd)) {
    const match = f.match(/^series-(\d+)\.json$/);
    if (!match) continue;
    const id = parseInt(match[1], 10);
    try {
      const c = JSON.parse(fs.readFileSync(path.join(dd, f), 'utf-8')) as RC;
      const d = c.responseData;
      const s: any = { id, title: d.title||`Series ${id}`, type: d.type, year: d.year, rating: d.bayesian_rating, ratingVotes: d.rating_votes, image: d.image?.url?.thumb, url: d.url, status: d.status, licensed: d.licensed, completed: d.completed, description: d.description, genres: d.genres, categories: d.categories, authors: d.authors, artists: d.artists, publishers: d.publishers, publications: d.publications, recommendations: d.recommendations || [], relatedSeries: d.related_series || [] };
      const rf = path.join(dd, `series-${id}-recs.json`);
      if (fs.existsSync(rf)) { try { const rc = JSON.parse(fs.readFileSync(rf,'utf-8')) as RC; s.recommendations = rc.responseData.recommendations; } catch {} }
      const xf = path.join(dd, `series-${id}-related.json`);
      if (fs.existsSync(xf)) { try { const rc = JSON.parse(fs.readFileSync(xf,'utf-8')) as RC; s.relatedSeries = rc.responseData.related_series; } catch {} }
      m.set(id, s);
    } catch {}
  }
  return m;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  removeStaleGraphShards();
  const seriesMap = loadSeriesDetails();
  console.log(`Loaded ${seriesMap.size} series`);
  // #region debug-point E:build-start
  void debugReport('E', 'build-graph.ts:main:start', 'Graph build started from persisted series detail files.', {
    detailSeriesCount: seriesMap.size,
  });
  // #endregion

  const nodeMap = new Map<string,any>();
  const edgeSet = new Set<string>(); const edges: any[] = [];

  function addNode(id: string, label: string, type: string, weight=1) {
    if (!nodeMap.has(id)) nodeMap.set(id, {id,label,type,weight,metadata:{}});
    return nodeMap.get(id)!;
  }
  function addEdge(s: string, t: string, type: string, w=1) {
    const eid = `${s}--${t}--${type}`;
    if (edgeSet.has(eid)) return; edgeSet.add(eid); edges.push({id:eid,source:s,target:t,type,weight:w,metadata:{}});
  }

  for (const series of seriesMap.values()) {
    const sid = `series:${series.id}`;
    const w = series.rating ? Math.max(1, series.rating * (series.ratingVotes||1) * 0.01) : 1;
    const n = addNode(sid, series.title, 'series', w);
    n.seriesMetadata = { seriesId: series.id, type: series.type, year: series.year, rating: series.rating, ratingVotes: series.ratingVotes, image: series.image, url: series.url, status: series.status, licensed: series.licensed, completed: series.completed, description: series.description, associated: { authors: series.authors, artists: series.artists, publishers: series.publishers, publications: series.publications, genres: series.genres?.map((g:any)=>({name:g.genre_name||g.genre,slug:g.genre_slug||slugify(g.genre_name||g.genre)})), categories: series.categories?.map((c:any)=>({name:c.category,slug:c.category_slug||slugify(c.category)})) }, recommendations: series.recommendations?.map((r:any)=>({title:r.title||r.series_name,id:r.series_id,weight:r.count||r.weight})), relatedSeries: series.relatedSeries?.map((r:any)=>({title:r.title||r.related_series_name,id:r.series_id||r.related_series_id,relation:r.relation_type})) };

    if (series.genres) for (const g of series.genres) { const genreName = g.genre_name||g.genre; if (!genreName) continue; const gid = `genre:${g.genre_slug||slugify(genreName)}`; addNode(gid, genreName, 'genre'); addEdge(sid, gid, 'has_genre'); }
    if (series.categories) for (const c of series.categories) { if (!c.category) continue; const cid = `category:${c.category_slug||slugify(c.category)}`; addNode(cid, c.category, 'category'); addEdge(sid, cid, 'has_category'); }
    if (series.authors) for (const a of series.authors) { if (!a.name) continue; const aid = `author:${a.id||a.author_id||slugify(a.name)}`; addNode(aid, a.name, 'author'); addEdge(sid, aid, 'written_by'); }
    if (series.artists) for (const a of series.artists) { if (!a.name) continue; const aid = `artist:${a.id||a.author_id||slugify(a.name)}`; addNode(aid, a.name, 'artist'); addEdge(sid, aid, 'illustrated_by'); }
    if (series.publishers) for (const p of series.publishers) { const publisherName = p.name||p.publisher_name; if (!publisherName) continue; const pid = `publisher:${p.id||p.publisher_id||slugify(publisherName)}`; addNode(pid, publisherName, 'publisher'); addEdge(sid, pid, 'published_by'); }
    if (series.publications) for (const p of series.publications) { const publicationName = p.name||p.publication_name; if (!publicationName) continue; const pid = `publication:${p.id||slugify(publicationName)}`; addNode(pid, publicationName, 'publication'); addEdge(sid, pid, 'serialized_in'); }
    if (series.recommendations) for (const r of series.recommendations) { const recId = r.series_id; const recTitle = r.title||r.series_name; if (recId && recId !== series.id && recTitle) { const tw = r.count||r.weight||1; addNode(`series:${recId}`, recTitle, 'series', tw); addEdge(sid, `series:${recId}`, 'recommended_with', tw); } }
    if (series.relatedSeries) for (const r of series.relatedSeries) { const relatedId = r.series_id||r.related_series_id; const relatedTitle = r.title||r.related_series_name; if (relatedId && relatedId !== series.id && relatedTitle) { addNode(`series:${relatedId}`, relatedTitle, 'series'); addEdge(sid, `series:${relatedId}`, 'related_to'); } }
  }

  const limitedGraph = limitGraph(Array.from(nodeMap.values()), edges);
  const byType: Record<string,any[]> = {};
  for (const n of limitedGraph.nodes) { if (!byType[n.type]) byType[n.type]=[]; byType[n.type].push(n); }
  const byEdgeType: Record<string,any[]> = {};
  for (const e of limitedGraph.edges) { if (!byEdgeType[e.type]) byEdgeType[e.type]=[]; byEdgeType[e.type].push(e); }

  for (const [t,ns] of Object.entries(byType)) fs.writeFileSync(path.join(OUTPUT_DIR, `nodes.${t}.json`), JSON.stringify(ns));
  for (const [t,es] of Object.entries(byEdgeType)) fs.writeFileSync(path.join(OUTPUT_DIR, `edges.${t}.json`), JSON.stringify(es));

  const si = (byType.series||[]).map((n:any)=>({id:n.id,label:n.label,type:'series',seriesId:n.seriesMetadata?.seriesId}));
  fs.writeFileSync(path.join(OUTPUT_DIR,'search-index.json'), JSON.stringify(si));
  const retainedDetailSeries = (byType.series || []).filter((node: any) => node.seriesMetadata).length;
  const manifest = { version:'1.0.0', buildDate: new Date().toISOString(), seriesCount: retainedDetailSeries, totalNodes: limitedGraph.nodes.length, totalEdges: limitedGraph.edges.length, maxNodes: MAX_ATLAS_NODES, shards: { nodes: Object.keys(byType).map(t=>`nodes.${t}.json`), edges: Object.keys(byEdgeType).map(t=>`edges.${t}.json`), positions: ['positions.json'], clusters: ['clusters.json'] }, searchIndex: 'search-index.json' };
  fs.writeFileSync(path.join(OUTPUT_DIR,'manifest.json'), JSON.stringify(manifest,null,2));
  // #region debug-point E:build-finish
  void debugReport('E', 'build-graph.ts:main:finish', 'Graph build finished and manifest was written.', {
    detailSeriesCount: seriesMap.size,
    seriesNodeCount: byType.series?.length||0,
    totalNodeCount: limitedGraph.nodes.length,
    totalEdgeCount: limitedGraph.edges.length,
    uncappedNodeCount: nodeMap.size,
    maxAtlasNodes: MAX_ATLAS_NODES,
  });
  // #endregion
  console.log(`Graph built: ${limitedGraph.nodes.length} nodes, ${limitedGraph.edges.length} edges (cap: ${MAX_ATLAS_NODES})`);
}

main();
