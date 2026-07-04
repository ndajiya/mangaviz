export type NodeType = 'series' | 'genre' | 'category' | 'author' | 'artist' | 'publisher' | 'publication';
export type EdgeType = 'has_genre' | 'has_category' | 'written_by' | 'illustrated_by' | 'published_by' | 'serialized_in' | 'related_to' | 'recommended_with';

export interface SeriesMetadata {
  seriesId: number; type?: string; year?: string; rating?: number; ratingVotes?: number;
  image?: string; url?: string; status?: string; licensed?: boolean; completed?: boolean; description?: string;
  associated?: { authors?: {name:string;id?:number}[]; artists?: {name:string;id?:number}[]; publishers?: {name:string;id?:number}[]; publications?: {name:string;id?:number}[]; genres?: {name:string;slug?:string}[]; categories?: {name:string;slug?:string}[]; };
  recommendations?: {title:string;id?:number;weight?:number}[]; relatedSeries?: {title:string;id?:number;relation?:string}[];
}

export interface GraphNode { id: string; label: string; type: NodeType; weight: number; x?: number; y?: number; cluster?: number; metadata?: Record<string,unknown>; seriesMetadata?: SeriesMetadata; }
export interface GraphEdge { id: string; source: string; target: string; type: EdgeType; weight: number; metadata?: Record<string,unknown>; }
export interface GraphData { nodes: GraphNode[]; edges: GraphEdge[]; stats?: GraphStats; }
export interface GraphStats {
  totalNodes: number; totalEdges: number; seriesCount: number; genreCount: number; categoryCount: number;
  authorArtistCount: number; publisherCount: number; topGenres: {name:string;count:number}[];
  topCategories: {name:string;count:number}[]; highestDegreeSeries: {id:string;label:string;degree:number}[];
  mostRecommendedSeries: {id:string;label:string;count:number}[]; highestRatedSeries: {id:string;label:string;rating:number}[];
  mostConnectedAuthor: {name:string;count:number}|null; mostConnectedPublisher: {name:string;count:number}|null;
}
export interface LayoutData { positions: Record<string,{x:number;y:number}>; clusters: Record<string,number>; }
export interface SearchIndexEntry { id: string; label: string; type: NodeType; seriesId?: number; }
export type AppMode = 'atlas' | 'live';
