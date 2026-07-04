import type { GraphData, GraphNode, NodeType, EdgeType, SeriesMetadata, GraphStats } from './graphTypes';
import type { SDR } from '../api/mangaupdates';

function slugify(value?: string) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function createNode(map: Map<string, GraphNode>, id: string, label: string, type: NodeType, weight = 1) {
  if (!map.has(id)) map.set(id, { id, label, type, weight, metadata: {} });
  else map.get(id)!.weight = Math.max(map.get(id)!.weight, weight);
  return map.get(id)!;
}

function createEdge(edges: GraphData['edges'], edgeSet: Set<string>, source: string, target: string, type: EdgeType, weight = 1) {
  const id = `${source}--${target}--${type}`;
  if (edgeSet.has(id)) return;
  edgeSet.add(id);
  edges.push({ id, source, target, type, weight });
}

function buildGraphStats(nodes: GraphNode[], edges: GraphData['edges']): GraphStats {
  const degreeByNode = new Map<string, number>();
  for (const edge of edges) {
    degreeByNode.set(edge.source, (degreeByNode.get(edge.source) || 0) + 1);
    degreeByNode.set(edge.target, (degreeByNode.get(edge.target) || 0) + 1);
  }

  const seriesNodes = nodes.filter((node) => node.type === 'series');
  const genreNodes = nodes.filter((node) => node.type === 'genre');
  const categoryNodes = nodes.filter((node) => node.type === 'category');
  const authorNodes = nodes.filter((node) => node.type === 'author' || node.type === 'artist');
  const publisherNodes = nodes.filter((node) => node.type === 'publisher');

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    seriesCount: seriesNodes.length,
    genreCount: genreNodes.length,
    categoryCount: categoryNodes.length,
    authorArtistCount: authorNodes.length,
    publisherCount: publisherNodes.length,
    topGenres: genreNodes.sort((a, b) => b.weight - a.weight).slice(0, 5).map((node) => ({ name: node.label, count: Math.round(node.weight) })),
    topCategories: categoryNodes.sort((a, b) => b.weight - a.weight).slice(0, 5).map((node) => ({ name: node.label, count: Math.round(node.weight) })),
    highestDegreeSeries: seriesNodes
      .map((node) => ({ id: node.id, label: node.label, degree: degreeByNode.get(node.id) || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5),
    mostRecommendedSeries: seriesNodes
      .map((node) => ({ id: node.id, label: node.label, count: Math.round(node.weight) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    highestRatedSeries: seriesNodes
      .filter((node) => typeof node.seriesMetadata?.rating === 'number')
      .map((node) => ({ id: node.id, label: node.label, rating: node.seriesMetadata!.rating! }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5),
    mostConnectedAuthor: authorNodes.length ? { name: authorNodes[0].label, count: degreeByNode.get(authorNodes[0].id) || 0 } : null,
    mostConnectedPublisher: publisherNodes.length ? { name: publisherNodes[0].label, count: degreeByNode.get(publisherNodes[0].id) || 0 } : null,
  };
}

export function buildGraphFromSeriesDetails(details: SDR[]): GraphData {
  const nodesById = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphData['edges'] = [];

  for (const detail of details) {
    const seriesId = detail.series_id ?? detail.id;
    if (!seriesId) continue;

    const sid = `series:${seriesId}`;
    const weight = detail.bayesian_rating ? Math.max(1, detail.bayesian_rating * (detail.rating_votes || 1) * 0.01) : 1;
    const node = createNode(nodesById, sid, detail.title, 'series', weight);

    const sm: SeriesMetadata = {
      seriesId,
      type: detail.type,
      year: detail.year,
      rating: detail.bayesian_rating,
      ratingVotes: detail.rating_votes,
      image: detail.image?.url?.thumb || detail.image?.url?.original,
      url: detail.url,
      status: detail.status,
      licensed: detail.licensed,
      completed: detail.completed,
      description: detail.description,
      associated: {
        authors: (detail.authors || []).filter((author) => (author.type || 'Author').toLowerCase() !== 'artist').map((author) => ({ name: author.name, id: author.author_id || author.id })),
        artists: (detail.authors || []).filter((author) => (author.type || 'Author').toLowerCase() === 'artist').map((author) => ({ name: author.name, id: author.author_id || author.id })),
        publishers: (detail.publishers || []).map((publisher) => ({ name: publisher.publisher_name || publisher.name || '', id: publisher.publisher_id || publisher.id })),
        publications: (detail.publications || []).map((publication) => ({ name: publication.publication_name || publication.name || '', id: publication.publisher_id || publication.id })),
        genres: (detail.genres || []).map((genre) => ({ name: genre.genre_name || genre.genre || '', slug: genre.genre_slug || slugify(genre.genre_name || genre.genre) })),
        categories: (detail.categories || []).map((category) => ({ name: category.category || '', slug: category.category_slug || slugify(category.category) })),
      },
    };

    if (detail.recommendations) {
      sm.recommendations = detail.recommendations.map((recommendation) => ({ title: recommendation.title || recommendation.series_name || '', id: recommendation.series_id, weight: recommendation.weight || recommendation.count }));
    }
    if (detail.related_series) {
      sm.relatedSeries = detail.related_series.map((relation) => ({ title: relation.title || '', id: relation.series_id, relation: relation.relation_type }));
    }
    if (detail.related) {
      sm.relatedSeries = (detail.related || []).map((relation) => ({ title: relation.related_series_name || '', id: relation.related_series_id, relation: relation.relation_type }));
    }
    node.seriesMetadata = sm;

    for (const genre of detail.genres || []) {
      const label = genre.genre_name || genre.genre || '';
      if (!label) continue;
      const gid = `genre:${slugify(label)}`;
      createNode(nodesById, gid, label, 'genre');
      createEdge(edges, edgeSet, sid, gid, 'has_genre');
    }

    for (const category of detail.categories || []) {
      const label = category.category || '';
      if (!label) continue;
      const cid = `category:${slugify(label)}`;
      createNode(nodesById, cid, label, 'category');
      createEdge(edges, edgeSet, sid, cid, 'has_category');
    }

    for (const author of detail.authors || []) {
      const label = author.name;
      if (!label) continue;
      const isArtist = (author.type || 'Author').toLowerCase() === 'artist';
      const aid = `${isArtist ? 'artist' : 'author'}:${author.author_id || author.id || slugify(label)}`;
      createNode(nodesById, aid, label, isArtist ? 'artist' : 'author');
      createEdge(edges, edgeSet, sid, aid, isArtist ? 'illustrated_by' : 'written_by');
    }

    for (const publisher of detail.publishers || []) {
      const label = publisher.publisher_name || publisher.name || '';
      if (!label) continue;
      const pid = `publisher:${publisher.publisher_id || publisher.id || slugify(label)}`;
      createNode(nodesById, pid, label, 'publisher');
      createEdge(edges, edgeSet, sid, pid, 'published_by');
    }

    for (const publication of detail.publications || []) {
      const label = publication.publication_name || publication.name || '';
      if (!label) continue;
      const pid = `publication:${publication.publisher_id || publication.id || slugify(label)}`;
      createNode(nodesById, pid, label, 'publication');
      createEdge(edges, edgeSet, sid, pid, 'serialized_in');
    }

    for (const recommendation of detail.recommendations || []) {
      const targetId = recommendation.series_id;
      const label = recommendation.title || recommendation.series_name || '';
      if (!targetId || !label || targetId === seriesId) continue;
      const rid = `series:${targetId}`;
      const recWeight = recommendation.weight || recommendation.count || 1;
      createNode(nodesById, rid, label, 'series', recWeight);
      createEdge(edges, edgeSet, sid, rid, 'recommended_with', recWeight);
    }

    for (const relation of detail.related || detail.related_series || []) {
      const targetId = relation.related_series_id || relation.series_id;
      const label = relation.related_series_name || relation.title || '';
      if (!targetId || !label || targetId === seriesId) continue;
      const rid = `series:${targetId}`;
      createNode(nodesById, rid, label, 'series');
      createEdge(edges, edgeSet, sid, rid, 'related_to');
    }
  }

  const nodes = Array.from(nodesById.values());
  return { nodes, edges, stats: buildGraphStats(nodes, edges) };
}

export function mergeGraphData(base: GraphData | null | undefined, incoming: GraphData): GraphData {
  const nodesById = new Map<string, GraphNode>((base?.nodes || []).map((node) => [node.id, node]));
  const edgeSet = new Set<string>((base?.edges || []).map((edge) => edge.id));
  const edges: GraphData['edges'] = [...(base?.edges || [])];

  for (const node of incoming.nodes) {
    const existing = nodesById.get(node.id);
    if (!existing) {
      nodesById.set(node.id, { ...node, metadata: { ...(node.metadata || {}) } });
      continue;
    }

    existing.weight = Math.max(existing.weight, node.weight);
    existing.label = existing.label || node.label;
    existing.type = existing.type || node.type;
    existing.metadata = { ...(existing.metadata || {}), ...(node.metadata || {}) };
    if (node.seriesMetadata && !existing.seriesMetadata) existing.seriesMetadata = node.seriesMetadata;
    if (node.x !== undefined) existing.x = node.x;
    if (node.y !== undefined) existing.y = node.y;
    if (node.cluster !== undefined) existing.cluster = node.cluster;
  }

  for (const edge of incoming.edges) {
    if (!edgeSet.has(edge.id)) {
      edgeSet.add(edge.id);
      edges.push({ ...edge });
    }
  }

  const nodes = Array.from(nodesById.values());
  return { nodes, edges, stats: buildGraphStats(nodes, edges) };
}
