import type { GraphData, LayoutData, GraphNode, GraphEdge } from './graphTypes';
const BASE = import.meta.env.BASE_URL || '/';
async function load<T>(p: string): Promise<T> { const r = await fetch(`${BASE}data/${p}`); if (!r.ok) throw new Error(`Failed ${p}`); return r.json() as Promise<T>; }

export async function loadManifest() {
  return load<{version:string;buildDate:string;seriesCount:number;totalNodes:number;totalEdges:number;shards:Record<string,string[]>;searchIndex:string}>('manifest.json');
}

export async function loadSearchIndex() {
  return load<{id:string;label:string;type:string;seriesId?:number}[]>('search-index.json');
}

export async function loadAtlasData(): Promise<{graph:GraphData;layout:LayoutData;manifest:{version:string;buildDate:string;seriesCount:number;totalNodes:number;totalEdges:number}}> {
  const m = await loadManifest();
  let allNodes: GraphNode[] = []; let allEdges: GraphEdge[] = [];
  for (const s of m.shards.nodes||[]) { const n = await load<GraphNode[]>(s); allNodes = allNodes.concat(n); }
  for (const s of m.shards.edges||[]) { const e = await load<GraphEdge[]>(s); allEdges = allEdges.concat(e); }
  let pos: Record<string,{x:number;y:number}> = {};
  for (const s of m.shards.positions||[]) { const p = await load<Record<string,{x:number;y:number}>>(s); pos = {...pos,...p}; }
  let cls: Record<string,number> = {};
  for (const s of m.shards.clusters||[]) { const c = await load<Record<string,number>>(s); cls = {...cls,...c}; }
  for (const n of allNodes) { if (pos[n.id]) { n.x=pos[n.id].x; n.y=pos[n.id].y; } if (cls[n.id] !== undefined) n.cluster = cls[n.id]; }
  return { graph: { nodes: allNodes, edges: allEdges }, layout: { positions: pos, clusters: cls }, manifest: { version: m.version, buildDate: m.buildDate, seriesCount: m.seriesCount, totalNodes: m.totalNodes, totalEdges: m.totalEdges } };
}
