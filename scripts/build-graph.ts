// ============================================================
// MangaViz – Graph Builder Script
// ============================================================
// Reads raw cache and produces normalized graph JSON shards.
// Run: npx tsx scripts/build-graph.ts
// ============================================================

import fs from 'fs';
import path from 'path';
import type { GraphNode, GraphEdge, NodeType, EdgeType } from '../src/graph/graphTypes';

const CACHE_DIR = path.resolve(__dirname, '..', 'cache', 'raw');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'data');

interface RawCacheEntry {
  source: string;
  endpoint: string;
  requestBody?: unknown;
  fetchedAt: string;
  responseData: Record<string, unknown>;
  apiVersion?: string;
}

interface SeriesCache {
  id: number;
  title: string;
  type?: string;
  year?: string;
  rating?: number;
  ratingVotes?: number;
  image?: string;
  url?: string;
  status?: string;
  licensed?: boolean;
  completed?: boolean;
  description?: string;
  genres?: { genre_name: string; genre_slug?: string }[];
  categories?: { category: string; category_slug?: string }[];
  authors?: { name: string; id?: number }[];
  artists?: { name: string; id?: number }[];
  publishers?: { name: string; id?: number }[];
  publications?: { name: string; id?: number }[];
  recommendations?: { series_id: number; title: string; count?: number }[];
  relatedSeries?: { series_id: number; title: string; relation_type?: string }[];
}

function loadCacheEntries(dir: string): RawCacheEntry[] {
  const entries: RawCacheEntry[] = [];
  if (!fs.existsSync(dir)) return entries;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (filepath.endsWith('.json')) {
      try {
        const content = fs.readFileSync(filepath, 'utf-8');
        const entry = JSON.parse(content) as RawCacheEntry;
        entries.push(entry);
      } catch (err) {
        console.warn(`Failed to parse ${filepath}:`, err);
      }
    }
  }
  return entries;
}

function loadSeriesDetails(): Map<number, SeriesCache> {
  const seriesMap = new Map<number, SeriesCache>();
  const detailDir = path.join(CACHE_DIR, 'series-detail');

  if (!fs.existsSync(detailDir)) return seriesMap;

  const files = fs.readdirSync(detailDir);
  for (const file of files) {
    const match = file.match(/^series-(\d+)\.json$/);
    if (!match) continue;

    const id = parseInt(match[1], 10);
    const filepath = path.join(detailDir, file);
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const entry = JSON.parse(content) as RawCacheEntry;
      const data = entry.responseData as Record<string, unknown>;

      const series: SeriesCache = {
        id,
        title: (data.title as string) || `Series ${id}`,
        type: data.type as string,
        year: data.year as string,
        rating: data.bayesian_rating as number,
        ratingVotes: data.rating_votes as number,
        image: ((data.image as Record<string, unknown>)?.url as Record<string, unknown>)
          ?.thumb as string,
        url: data.url as string,
        status: data.status as string,
        licensed: data.licensed as boolean,
        completed: data.completed as boolean,
        description: data.description as string,
        genres: data.genres as { genre_name: string; genre_slug?: string }[],
        categories: data.categories as { category: string; category_slug?: string }[],
        authors: data.authors as { name: string; id?: number }[],
        artists: data.artists as { name: string; id?: number }[],
        publishers: data.publishers as { name: string; id?: number }[],
        publications: data.publications as { name: string; id?: number }[],
      };

      // Load recommendations
      const recFile = path.join(detailDir, `series-${id}-recs.json`);
      if (fs.existsSync(recFile)) {
        try {
          const recContent = fs.readFileSync(recFile, 'utf-8');
          const recEntry = JSON.parse(recContent) as RawCacheEntry;
          const recData = recEntry.responseData as Record<string, unknown>;
          series.recommendations = (
            recData.recommendations as { series_id: number; title: string; count?: number }[]
          );
        } catch { /* ignore */ }
      }

      // Load related series
      const relFile = path.join(detailDir, `series-${id}-related.json`);
      if (fs.existsSync(relFile)) {
        try {
          const relContent = fs.readFileSync(relFile, 'utf-8');
          const relEntry = JSON.parse(relContent) as RawCacheEntry;
          const relData = relEntry.responseData as Record<string, unknown>;
          series.relatedSeries = (
            relData.related_series as { series_id: number; title: string; relation_type?: string }[]
          );
        } catch { /* ignore */ }
      }

      seriesMap.set(id, series);
    } catch (err) {
      console.warn(`Failed to process ${file}:`, err);
    }
  }

  return seriesMap;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

export function buildGraphFromCache(
  seriesMap: Map<number, SeriesCache>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  function addNode(
    id: string,
    label: string,
    type: NodeType,
    weight = 1
  ): GraphNode {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, label, type, weight, metadata: {} });
    }
    return nodeMap.get(id)!;
  }

  function addEdge(
    source: string,
    target: string,
    type: EdgeType,
    weight = 1
  ) {
    const edgeId = `${source}--${target}--${type}`;
    if (edgeSet.has(edgeId)) return;
    edgeSet.add(edgeId);
    edges.push({ id: edgeId, source, target, type, weight, metadata: {} });
  }

  for (const series of seriesMap.values()) {
    const seriesId = `series:${series.id}`;
    const ratingWeight = series.rating
      ? Math.max(1, series.rating * (series.ratingVotes || 1) * 0.01)
      : 1;

    const seriesNode = addNode(seriesId, series.title, 'series', ratingWeight);
    seriesNode.seriesMetadata = {
      seriesId: series.id,
      type: series.type,
      year: series.year,
      rating: series.rating,
      ratingVotes: series.ratingVotes,
      image: series.image,
      url: series.url,
      status: series.status,
      licensed: series.licensed,
      completed: series.completed,
      description: series.description,
      associated: {
        authors: series.authors,
        artists: series.artists,
        publishers: series.publishers,
        publications: series.publications,
        genres: series.genres?.map((g) => ({ name: g.genre_name, slug: g.genre_slug })),
        categories: series.categories?.map((c) => ({
          name: c.category,
          slug: c.category_slug,
        })),
      },
      recommendations: series.recommendations?.map((r) => ({
        title: r.title,
        id: r.series_id,
        weight: r.count,
      })),
      relatedSeries: series.relatedSeries?.map((r) => ({
        title: r.title,
        id: r.series_id,
        relation: r.relation_type,
      })),
    };

    // Genres
    if (series.genres) {
      for (const g of series.genres) {
        const genreSlug = g.genre_slug || slugify(g.genre_name);
        const genreId = `genre:${genreSlug}`;
        addNode(genreId, g.genre_name, 'genre');
        addEdge(seriesId, genreId, 'has_genre');
      }
    }

    // Categories
    if (series.categories) {
      for (const c of series.categories) {
        const catSlug = c.category_slug || slugify(c.category);
        const catId = `category:${catSlug}`;
        addNode(catId, c.category, 'category');
        addEdge(seriesId, catId, 'has_category');
      }
    }

    // Authors
    if (series.authors) {
      for (const a of series.authors) {
        const authId = `author:${a.id || slugify(a.name)}`;
        addNode(authId, a.name, 'author');
        addEdge(seriesId, authId, 'written_by');
      }
    }

    // Artists
    if (series.artists) {
      for (const a of series.artists) {
        const artId = `artist:${a.id || slugify(a.name)}`;
        addNode(artId, a.name, 'artist');
        addEdge(seriesId, artId, 'illustrated_by');
      }
    }

    // Publishers
    if (series.publishers) {
      for (const p of series.publishers) {
        const pubId = `publisher:${p.id || slugify(p.name)}`;
        addNode(pubId, p.name, 'publisher');
        addEdge(seriesId, pubId, 'published_by');
      }
    }

    // Publications
    if (series.publications) {
      for (const p of series.publications) {
        const pubId = `publication:${p.id || slugify(p.name)}`;
        addNode(pubId, p.name, 'publication');
        addEdge(seriesId, pubId, 'serialized_in');
      }
    }

    // Recommendations
    if (series.recommendations) {
      for (const rec of series.recommendations) {
        if (rec.series_id && rec.series_id !== series.id) {
          const targetId = `series:${rec.series_id}`;
          const weight = rec.count || 1;
          addNode(targetId, rec.title, 'series', weight);
          addEdge(seriesId, targetId, 'recommended_with', weight);
        }
      }
    }

    // Related series
    if (series.relatedSeries) {
      for (const rel of series.relatedSeries) {
        if (rel.series_id && rel.series_id !== series.id) {
          const targetId = `series:${rel.series_id}`;
          addNode(targetId, rel.title, 'series');
          addEdge(seriesId, targetId, 'related_to');
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values());
  return { nodes, edges };
}

// Main
async function main() {
  console.log('Loading raw cache...');
  const seriesMap = loadSeriesDetails();
  console.log(`Loaded ${seriesMap.size} series from cache`);

  console.log('Building graph...');
  const { nodes, edges } = buildGraphFromCache(seriesMap);
  console.log(`Built ${nodes.length} nodes and ${edges.length} edges`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Separate nodes by type
  const byType: Record<string, GraphNode[]> = {};
  for (const node of nodes) {
    if (!byType[node.type]) byType[node.type] = [];
    byType[node.type].push(node);
  }

  // Write node shards
  for (const [type, typeNodes] of Object.entries(byType)) {
    const filename = `nodes.${type}.json`;
    fs.writeFileSync(
      path.join(OUTPUT_DIR, filename),
      JSON.stringify(typeNodes)
    );
    console.log(`  Wrote ${filename} (${typeNodes.length} nodes)`);
  }

  // Separate edges by type
  const byEdgeType: Record<string, GraphEdge[]> = {};
  for (const edge of edges) {
    if (!byEdgeType[edge.type]) byEdgeType[edge.type] = [];
    byEdgeType[edge.type].push(edge);
  }

  for (const [type, typeEdges] of Object.entries(byEdgeType)) {
    const filename = `edges.${type}.json`;
    fs.writeFileSync(
      path.join(OUTPUT_DIR, filename),
      JSON.stringify(typeEdges)
    );
    console.log(`  Wrote ${filename} (${typeEdges.length} edges)`);
  }

  // Build search index
  const searchIndex = nodes
    .filter((n) => n.type === 'series')
    .map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type as string,
      seriesId: n.seriesMetadata?.seriesId,
    }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'search-index.json'),
    JSON.stringify(searchIndex)
  );
  console.log(`  Wrote search-index.json (${searchIndex.length} entries)`);

  // Build manifest
  const manifest = {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    seriesCount: byType.series?.length || 0,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    shards: {
      nodes: Object.keys(byType).map((t) => `nodes.${t}.json`),
      edges: Object.keys(byEdgeType).map((t) => `edges.${t}.json`),
      positions: ['positions.json'],
      clusters: ['clusters.json'],
    },
    searchIndex: 'search-index.json',
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('  Wrote manifest.json');

  console.log('\nGraph build complete!');
}

main().catch(console.error);
