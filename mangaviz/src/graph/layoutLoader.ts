import type { GraphData, LayoutData, GraphNode, GraphEdge } from './graphTypes';
const BASE = import.meta.env.BASE_URL || '/';
const MAX_ATLAS_NODES = 1000;
async function load<T>(p:string): Promise<T> { const r=await fetch(BASE+'data/'+p); if(!r.ok)throw new Error('Failed '+p); return r.json() as Promise<T>; }
export async function loadManifest() { return load<{version:string;buildDate:string;seriesCount:number;totalNodes:number;totalEdges:number;shards:Record<string,string[]>;searchIndex:string}>('manifest.json'); }

function limitAtlasGraph(nodes: GraphNode[], edges: GraphEdge[]) {
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
      || right.weight - left.weight
      || left.id.localeCompare(right.id);
  });
  const limitedNodes = rankedNodes.slice(0, MAX_ATLAS_NODES);
  const retainedIds = new Set(limitedNodes.map((node) => node.id));
  return {
    nodes: limitedNodes,
    edges: edges.filter((edge) => retainedIds.has(edge.source) && retainedIds.has(edge.target)),
  };
}

export async function loadAtlasData(): Promise<{graph:GraphData;layout:LayoutData;manifest:{version:string;buildDate:string;seriesCount:number;totalNodes:number;totalEdges:number}}> {
  const m = await loadManifest();
  let allNodes: GraphNode[] = []; let allEdges: GraphEdge[] = [];
  for (const s of m.shards.nodes||[]) { allNodes=allNodes.concat(await load<GraphNode[]>(s)); }
  for (const s of m.shards.edges||[]) { allEdges=allEdges.concat(await load<GraphEdge[]>(s)); }
  const limitedGraph = limitAtlasGraph(allNodes, allEdges);
  allNodes = limitedGraph.nodes;
  allEdges = limitedGraph.edges;
  const visibleIds = new Set(allNodes.map((node) => node.id));
  let pos: Record<string,{x:number;y:number}>={}; let cls: Record<string,number>={};
  for (const s of m.shards.positions||[]) { const p=await load<Record<string,{x:number;y:number}>>(s); pos={...pos,...p}; }
  for (const s of m.shards.clusters||[]) { const c=await load<Record<string,number>>(s); cls={...cls,...c}; }
  pos = Object.fromEntries(Object.entries(pos).filter(([id]) => visibleIds.has(id)));
  cls = Object.fromEntries(Object.entries(cls).filter(([id]) => visibleIds.has(id)));
  for (const n of allNodes) { if(pos[n.id]){n.x=pos[n.id].x;n.y=pos[n.id].y;} if(cls[n.id]!==undefined)n.cluster=cls[n.id]; }
  const visibleSeriesCount = allNodes.filter((node) => node.type === 'series' && node.seriesMetadata).length;
  return {graph:{nodes:allNodes,edges:allEdges},layout:{positions:pos,clusters:cls},manifest:{version:m.version,buildDate:m.buildDate,seriesCount:visibleSeriesCount,totalNodes:allNodes.length,totalEdges:allEdges.length}};
}
export async function loadSearchIndex(visibleNodeIds?: Set<string>) {
  const r = await fetch((import.meta.env.BASE_URL||'/')+'data/search-index.json');
  if (!r.ok) throw new Error('Failed search-index');
  const entries = await r.json() as {id:string;label:string;type:string;seriesId?:number}[];
  return visibleNodeIds ? entries.filter((entry) => visibleNodeIds.has(entry.id)) : entries;
}
