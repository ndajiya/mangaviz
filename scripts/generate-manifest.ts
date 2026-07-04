// ============================================================
// MangaViz – Manifest Generator
// ============================================================
// Generates manifest.json from the data directory contents.
// Run: npx tsx scripts/generate-manifest.ts
// ============================================================

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data');

interface Manifest {
  version: string;
  buildDate: string;
  seriesCount: number;
  totalNodes: number;
  totalEdges: number;
  shards: {
    nodes: string[];
    edges: string[];
    positions: string[];
    clusters: string[];
  };
  searchIndex: string;
}

async function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));

  const nodeShards = files.filter((f) => f.startsWith('nodes.'));
  const edgeShards = files.filter((f) => f.startsWith('edges.'));
  const hasPositions = files.includes('positions.json');
  const hasClusters = files.includes('clusters.json');
  const hasSearchIndex = files.includes('search-index.json');

  // Count nodes and edges
  let totalNodes = 0;
  let totalEdges = 0;
  let seriesCount = 0;

  for (const shard of nodeShards) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, shard), 'utf-8'));
      totalNodes += data.length || 0;
      if (shard === 'nodes.series.json') {
        seriesCount = data.length || 0;
      }
    } catch { /* ignore */ }
  }

  for (const shard of edgeShards) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, shard), 'utf-8'));
      totalEdges += data.length || 0;
    } catch { /* ignore */ }
  }

  const manifest: Manifest = {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    seriesCount,
    totalNodes,
    totalEdges,
    shards: {
      nodes: nodeShards,
      edges: edgeShards,
      positions: hasPositions ? ['positions.json'] : [],
      clusters: hasClusters ? ['clusters.json'] : [],
    },
    searchIndex: hasSearchIndex ? 'search-index.json' : '',
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`Manifest generated:
  Nodes: ${totalNodes} (${nodeShards.length} shards)
  Edges: ${totalEdges} (${edgeShards.length} shards)
  Series: ${seriesCount}
  Positions: ${hasPositions}
  Clusters: ${hasClusters}
  Search Index: ${hasSearchIndex}`);
}

main().catch(console.error);
