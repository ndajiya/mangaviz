// ============================================================
// MangaViz – Layout Preprocessor
// ============================================================
// Computes x/y positions and cluster assignments for graph nodes.
// Uses a simple force-directed approach with community detection.
// Run: npx tsx scripts/precompute-layout.ts
// ============================================================

import fs from 'fs';
import path from 'path';
import type { GraphNode, GraphEdge } from '../src/graph/graphTypes';

const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data');

interface Position {
  x: number;
  y: number;
}

// Simple force-directed layout computation
function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { positions: Record<string, Position>; clusters: Record<string, number> } {
  const positions: Record<string, Position> = {};
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const N = nodes.length;

  if (N === 0) return { positions: {}, clusters: {} };

  // Initialize random positions (seeded)
  let seed = 42;
  function seededRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (const node of nodes) {
    positions[node.id] = {
      x: (seededRandom() - 0.5) * 2000,
      y: (seededRandom() - 0.5) * 2000,
    };
  }

  // Build adjacency
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  // Simple force-directed iterations
  const iterations = 100;
  const area = 2000 * 2000;
  const k = Math.sqrt(area / Math.max(N, 1));

  for (let iter = 0; iter < iterations; iter++) {
    const temperature = (1 - iter / iterations) * 100;
    const forces: Record<string, { fx: number; fy: number }> = {};

    for (const node of nodes) {
      forces[node.id] = { fx: 0, fy: 0 };
    }

    // Repulsive forces (Barnes-Hut approximation using random sampling for speed)
    const sampleSize = Math.min(50, N);
    for (const node of nodes) {
      const p1 = positions[node.id];
      let fx = 0;
      let fy = 0;

      // Sample a subset of other nodes for repulsion
      const others = nodes.filter((n) => n.id !== node.id);
      const shuffled = [...others].sort(() => seededRandom() - 0.5);
      const sample = shuffled.slice(0, sampleSize);

      for (const other of sample) {
        const p2 = positions[other.id];
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        const force = (k * k) / dist;
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      forces[node.id] = { fx, fy };
    }

    // Attractive forces along edges
    for (const edge of edges) {
      const p1 = positions[edge.source];
      const p2 = positions[edge.target];
      if (!p1 || !p2) continue;

      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const force = (dist * dist) / k;

      forces[edge.source].fx += (dx / dist) * force;
      forces[edge.source].fy += (dy / dist) * force;
      forces[edge.target].fx -= (dx / dist) * force;
      forces[edge.target].fy -= (dy / dist) * force;
    }

    // Apply forces with temperature
    for (const node of nodes) {
      const f = forces[node.id];
      const magnitude = Math.sqrt(f.fx * f.fx + f.fy * f.fy) + 0.001;
      positions[node.id].x += (f.fx / magnitude) * Math.min(magnitude, temperature);
      positions[node.id].y += (f.fy / magnitude) * Math.min(magnitude, temperature);
    }
  }

  // Normalize positions to [-1000, 1000] range
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const p = positions[node.id];
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  for (const node of nodes) {
    positions[node.id].x = ((positions[node.id].x - minX) / rangeX) * 1800 - 900;
    positions[node.id].y = ((positions[node.id].y - minY) / rangeY) * 1800 - 900;
  }

  // Simple community detection (Louvain-like approximation)
  // Group by connected components and then subdivide large components
  const visited = new Set<string>();
  const components: string[][] = [];

  function dfs(nodeId: string, comp: string[]) {
    visited.add(nodeId);
    comp.push(nodeId);
    for (const neighbor of adjacency.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, comp);
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const comp: string[] = [];
      dfs(node.id, comp);
      if (comp.length > 1) components.push(comp);
    }
  }

  // Assign cluster IDs
  const clusters: Record<string, number> = {};
  let clusterId = 0;

  for (const comp of components) {
    // Subdivide large components by type
    if (comp.length > 100) {
      const seriesNodes = comp.filter((id) => id.startsWith('series:'));
      const otherNodes = comp.filter((id) => !id.startsWith('series:'));

      for (const id of seriesNodes) {
        clusters[id] = clusterId;
      }
      clusterId++;

      for (const id of otherNodes) {
        clusters[id] = clusterId;
      }
      clusterId++;
    } else {
      for (const id of comp) {
        clusters[id] = clusterId;
      }
      clusterId++;
    }
  }

  return { positions, clusters };
}

async function main() {
  console.log('Loading graph data...');

  // Load all node files
  const dataDir = DATA_DIR;
  if (!fs.existsSync(dataDir)) {
    console.error('No data directory found. Run build-graph first.');
    process.exit(1);
  }

  const allNodes: GraphNode[] = [];
  const allEdges: GraphEdge[] = [];

  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    if (file.startsWith('nodes.') && file.endsWith('.json')) {
      const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const nodes = JSON.parse(content) as GraphNode[];
      allNodes.push(...nodes);
      console.log(`  Loaded ${file}: ${nodes.length} nodes`);
    }
    if (file.startsWith('edges.') && file.endsWith('.json')) {
      const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const edges = JSON.parse(content) as GraphEdge[];
      allEdges.push(...edges);
      console.log(`  Loaded ${file}: ${edges.length} edges`);
    }
  }

  console.log(`\nComputing layout for ${allNodes.length} nodes and ${allEdges.length} edges...`);

  const { positions, clusters } = computeLayout(allNodes, allEdges);

  console.log(`Computed ${Object.keys(positions).length} positions`);
  console.log(`Computed ${Object.keys(clusters).length} cluster assignments`);

  // Save positions
  fs.writeFileSync(
    path.join(dataDir, 'positions.json'),
    JSON.stringify(positions)
  );
  console.log('  Saved positions.json');

  // Save clusters
  fs.writeFileSync(
    path.join(dataDir, 'clusters.json'),
    JSON.stringify(clusters)
  );
  console.log('  Saved clusters.json');

  console.log('\nLayout precomputation complete!');
}

main().catch(console.error);
