import React, { useState, useEffect, useCallback } from 'react';
import type { GraphNode, GraphData, AppMode, SearchIndexEntry } from '../graph/graphTypes';
import { loadAtlasData, loadSearchIndex } from '../graph/layoutLoader';
import { buildGraphFromSeriesDetails } from '../graph/buildGraph';
import api from '../api/mangaupdates';
import { cacheSet, cacheGet } from '../cache/indexedDbCache';
import GraphCanvas from './components/GraphCanvas';
import SearchPanel from './components/SearchPanel';
import ModeToggle from './components/ModeToggle';
import NodeDetailPanel from './components/NodeDetailPanel';
import LegendPanel from './components/LegendPanel';
import FilterPanel from './components/FilterPanel';
import StatsPanel from './components/StatsPanel';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('atlas');
  const [atlasData, setAtlasData] = useState<GraphData|null>(null);
  const [atlasLayout, setAtlasLayout] = useState<any>(null);
  const [atlasManifest, setAtlasManifest] = useState<any>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[]|null>(null);
  const [atlasLoading, setAtlasLoading] = useState(true);
  const [liveData, setLiveData] = useState<GraphData|null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string|null>(null);
  const activeGraphData = mode === 'atlas' ? atlasData : liveData;

  const [nodeTypeFilters, setNodeTypeFilters] = useState<Record<string,boolean>>({series:true,genre:true,category:true,author:true,artist:true,publisher:true,publication:true});
  const [edgeTypeFilters, setEdgeTypeFilters] = useState<Record<string,boolean>>({has_genre:true,has_category:true,written_by:true,illustrated_by:true,published_by:true,serialized_in:true,related_to:true,recommended_with:true});
  const [clusterFilter, setClusterFilter] = useState<number|null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode|null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string|null>(null);
  const [showStats, setShowStats] = useState(false);

  const totalClusters = activeGraphData?.nodes.reduce((max,n)=>n.cluster!==undefined?Math.max(max,n.cluster):max,-1)??0;

  useEffect(() => {
    (async () => {
      try {
        setAtlasLoading(true);
        const data = await loadAtlasData();
        setAtlasData(data.graph); setAtlasLayout(data.layout); setAtlasManifest(data.manifest);
        try { setSearchIndex(await loadSearchIndex()); } catch {}
      } catch(err) { console.warn('Atlas data unavailable:', err); }
      finally { setAtlasLoading(false); }
    })();
  }, []);

  const handleNodeClick = useCallback((node:GraphNode|null) => { setSelectedNode(node); setSelectedNodeId(node?.id??null); }, []);
  const handleDetailClick = useCallback((nodeId:string) => { const n = activeGraphData?.nodes.find(n=>n.id===nodeId); if (n) { setSelectedNode(n); setSelectedNodeId(nodeId); } }, [activeGraphData]);
  const handleAtlasSearch = useCallback((term:string) => { const l=term.toLowerCase(); const m=activeGraphData?.nodes.find(n=>n.label.toLowerCase().includes(l)||n.id.includes(l)); if (m) handleNodeClick(m); }, [activeGraphData, handleNodeClick]);

  const handleLiveSearch = useCallback(async (term:string) => {
    setLiveLoading(true); setLiveError(null);
    try {
      const key = `live:${term.toLowerCase().trim()}`;
      const cached = await cacheGet<GraphData>(key, 3600000);
      if (cached) { setLiveData(cached); setLiveLoading(false); return; }
      const result = await api.searchSeries({search:term, perPage:25});
      if (!result.results?.length) { setLiveError(`No results for "${term}"`); setLiveLoading(false); return; }
      const details = [];
      for (const r of result.results.slice(0, 10)) {
        await new Promise(r=>setTimeout(r,600));
        try { details.push(await api.getSeriesDetail(r.record.id)); } catch {}
      }
      const graph = buildGraphFromSeriesDetails(details);
      setLiveData(graph); await cacheSet(key, graph, 3600000);
    } catch(err) { setLiveError(`API error: ${err instanceof Error?err.message:'Unknown'}`); }
    finally { setLiveLoading(false); }
  }, []);

  const toggleMode = useCallback((m:AppMode) => { setMode(m); setSelectedNode(null); setSelectedNodeId(null); setLiveError(null); }, []);
  const toggleNT = useCallback((t:string) => setNodeTypeFilters(p=>({...p,[t]:!(p[t]!==false)})), []);
  const toggleET = useCallback((t:string) => setEdgeTypeFilters(p=>({...p,[t]:!(p[t]!==false)})), []);

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-left">
          <h1 className="app-title"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="8" cy="10" r="2" fill="currentColor"/><circle cx="16" cy="10" r="2" fill="currentColor"/><path d="M8 15c0 2 1.5 4 4 4s4-2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> MangaViz</h1>
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </div>
        <div className="top-bar-center"><SearchPanel mode={mode} onSearchAtlas={handleAtlasSearch} onSearchLive={handleLiveSearch} onSelectNode={handleDetailClick} searchIndex={searchIndex} /></div>
        <div className="top-bar-right">{atlasManifest && <span className="dataset-version">v{atlasManifest.version}</span>}<a href="https://www.mangaupdates.com" target="_blank" rel="noopener noreferrer" className="mu-credit">MangaUpdates</a></div>
      </header>
      <div className="app-body">
        <aside className="left-panel">
          <FilterPanel nodeTypeFilters={nodeTypeFilters} edgeTypeFilters={edgeTypeFilters} onToggleNodeType={toggleNT} onToggleEdgeType={toggleET} clusterFilter={clusterFilter} onClusterFilter={setClusterFilter} totalClusters={totalClusters+1} />
          <LegendPanel />
        </aside>
        <main className="graph-area">
          {mode==='live' && liveError && <div className="live-error"><p>{liveError}</p><p className="live-error-hint">CORS? Run: <code>npx local-cors-proxy --proxyUrl https://api.mangaupdates.com</code></p></div>}
          <GraphCanvas graphData={activeGraphData} layoutData={atlasLayout} nodeTypeFilters={nodeTypeFilters} edgeTypeFilters={edgeTypeFilters} clusterFilter={clusterFilter} selectedNodeId={selectedNodeId} onNodeClick={handleNodeClick} isLoading={atlasLoading||liveLoading} />
          {!atlasLoading && !liveLoading && !activeGraphData && (
            <div className="welcome-overlay">
              <div className="welcome-content">
                <h2>Welcome to MangaViz</h2><p>Explore the manga universe through interactive network graphs.</p>
                <div className="welcome-modes"><div className="welcome-mode"><h3>🗺️ Atlas Mode</h3><p>Pre-built manga universe graph.</p><p className="hint">Load atlas to begin.</p></div><div className="welcome-mode"><h3>🔍 Live Explorer</h3><p>Search MangaUpdates in real-time.</p><p className="hint">Toggle to Live and search.</p></div></div>
                <p className="welcome-credit">Data from <a href="https://www.mangaupdates.com" target="_blank" rel="noopener noreferrer">MangaUpdates</a> · Inspired by <a href="https://rhiever.github.io/redditviz/" target="_blank" rel="noopener noreferrer">RedditViz</a></p>
              </div>
            </div>
          )}
        </main>
        <aside className="right-panel">
          <NodeDetailPanel node={selectedNode} onClose={()=>setSelectedNode(null)} onNodeClick={handleDetailClick} />
          <div className="stats-area"><StatsPanel stats={activeGraphData?.stats||null} visible={showStats} onToggle={()=>setShowStats(!showStats)} /></div>
        </aside>
      </div>
    </div>
  );
};

export default App;
