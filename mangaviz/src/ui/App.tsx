import React, { useState, useEffect, useCallback } from "react";
import type { GraphNode, GraphData, AppMode, SearchIndexEntry } from "../graph/graphTypes";
import { loadAtlasData, loadSearchIndex } from "../graph/layoutLoader";
import { buildGraphFromSeriesDetails } from "../graph/buildGraph";
import api from "../api/mangaupdates";
import { cacheSet, cacheGet } from "../cache/indexedDbCache";
import GC from "./components/GraphCanvas";
import SP from "./components/SearchPanel";
import MT from "./components/ModeToggle";
import NDP from "./components/NodeDetailPanel";
import LegendPanel from "./components/LegendPanel";
import FP from "./components/FilterPanel";
import StatsPanel from "./components/StatsPanel";

const LIVE_GRAPH_CACHE_KEY = "live:knowledge-graph";

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>("atlas");
  const [atlasData, setAtlasData] = useState<GraphData | null>(null);
  const [atlasLayout, setAtlasLayout] = useState<any>(null);
  const [atlasManifest, setAtlasManifest] = useState<any>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[] | null>(null);
  const [atlasLoading, setAtlasLoading] = useState(true);
  const [liveData, setLiveData] = useState<GraphData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const active = mode === "atlas" ? atlasData : liveData;

  const [ntF, setNtF] = useState<Record<string, boolean>>({
    series: true,
    genre: true,
    category: true,
    author: true,
    artist: true,
    publisher: true,
    publication: true,
  });
  const [etF, setEtF] = useState<Record<string, boolean>>({
    has_genre: true,
    has_category: true,
    written_by: true,
    illustrated_by: true,
    published_by: true,
    serialized_in: true,
    related_to: true,
    recommended_with: true,
  });
  const [clusterF, setClusterF] = useState<number | null>(null);
  const [selNode, setSelNode] = useState<GraphNode | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const tClusters = active?.nodes.reduce((m, n) => (n.cluster !== undefined ? Math.max(m, n.cluster) : m), -1) ?? 0;

  useEffect(() => {
    (async () => {
      try {
        setAtlasLoading(true);
        const d = await loadAtlasData();
        setAtlasData(d.graph);
        setAtlasLayout(d.layout);
        setAtlasManifest(d.manifest);
        try {
          setSearchIndex(await loadSearchIndex());
        } catch {}
      } catch (e) {
        console.warn("Atlas unavailable:", e);
      } finally {
        setAtlasLoading(false);
      }
    })();
  }, []);
  const hNC = useCallback((n: GraphNode | null) => {
    setSelNode(n);
    setSelId(n?.id ?? null);
    setFocusToken((v) => v + 1);
  }, []);
  const hDC = useCallback(
    (id: string) => {
      const n = active?.nodes.find((n) => n.id === id);
      if (n) {
        setSelNode(n);
        setSelId(id);
        setFocusToken((v) => v + 1);
      }
    },
    [active],
  );
  const hAS = useCallback(
    (t: string) => {
      const l = t.toLowerCase();
      const m = active?.nodes.find((n) => n.label.toLowerCase().includes(l) || n.id.includes(l));
      if (m) hNC(m);
    },
    [active, hNC],
  );
  const hLS = useCallback(async (t: string) => {
    const term = t.trim();
    if (!term) {
      setLiveError("Enter a search term to query MangaUpdates.");
      return;
    }
    setLiveLoading(true);
    setLiveError(null);
    setLiveData(null);
    try {
      const searchResults = await api.searchSeries({ search: term, perPage: 5 });
      if (!searchResults.results?.length) {
        setLiveError('No live results for "' + term + '".');
        return;
      }
      const details: Awaited<ReturnType<typeof api.getSeriesDetail>>[] = [];
      for (const result of searchResults.results.slice(0, 5)) {
        const id = result.record.series_id ?? result.record.id;
        if (!id) continue;
        await new Promise((resolve) => setTimeout(resolve, 700));
        try {
          details.push(await api.getSeriesDetail(id));
        } catch (err) {
          console.warn("Live detail fetch failed for", id, err);
        }
      }
      if (!details.length) {
        throw new Error("MangaUpdates search succeeded, but every detail request failed.");
      }
      const freshGraph = buildGraphFromSeriesDetails(details);
      if (!freshGraph.nodes.length) {
        throw new Error("MangaUpdates returned no graphable detail data.");
      }
      await cacheSet(LIVE_GRAPH_CACHE_KEY, freshGraph, 1000 * 60 * 60 * 24 * 7);
      setLiveData(freshGraph);
    } catch (e) {
      const cachedGraph = await cacheGet<GraphData>(LIVE_GRAPH_CACHE_KEY, 1000 * 60 * 60 * 24 * 7);
      if (cachedGraph) {
        setLiveData(cachedGraph);
        setLiveError("Live refresh failed after trying all MangaUpdates routes; showing the cached knowledge graph.");
      } else {
        setLiveError("Live search failed: " + (e instanceof Error ? e.message : "Unknown error"));
      }
    } finally {
      setLiveLoading(false);
    }
  }, []);
  const tM = useCallback((m: AppMode) => {
    setMode(m);
    setSelNode(null);
    setSelId(null);
    setLiveError(null);
  }, []);
  const tNT = useCallback((t: string) => setNtF((p) => ({ ...p, [t]: !(p[t] !== false) })), []);
  const tET = useCallback((t: string) => setEtF((p) => ({ ...p, [t]: !(p[t] !== false) })), []);

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-left">
          <h1 className="app-title">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="8" cy="10" r="2" fill="currentColor" />
              <circle cx="16" cy="10" r="2" fill="currentColor" />
              <path d="M8 15c0 2 1.5 4 4 4s4-2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            MangaViz
          </h1>
          <MT mode={mode} onToggle={tM} />
        </div>
        <div className="top-bar-center">
          <SP mode={mode} onSearchAtlas={hAS} onSearchLive={hLS} onSelectNode={hDC} searchIndex={searchIndex} isLoading={mode === "live" && liveLoading} />
        </div>
        <div className="top-bar-right">
          {atlasManifest && <span className="dataset-version">v{atlasManifest.version}</span>}
          <a href="https://www.mangaupdates.com" target="_blank" rel="noopener noreferrer" className="mu-credit">
            MangaUpdates
          </a>
        </div>
      </header>
      <div className="app-body">
        <aside className="left-panel">
          <FP
            nodeTypeFilters={ntF}
            edgeTypeFilters={etF}
            onToggleNodeType={tNT}
            onToggleEdgeType={tET}
            clusterFilter={clusterF}
            onClusterFilter={setClusterF}
            totalClusters={tClusters + 1}
          />
          <LegendPanel />
        </aside>
        <main className="graph-area">
          {mode === "live" && liveError && (
            <div className="live-error">
              <p>{liveError}</p>
              <p className="live-error-hint">If this keeps happening, try refreshing the page and searching again.</p>
            </div>
          )}
          <GC
            graphData={active}
            layoutData={atlasLayout}
            nodeTypeFilters={ntF}
            edgeTypeFilters={etF}
            clusterFilter={clusterF}
            selectedNodeId={selId}
            focusToken={focusToken}
            onNodeClick={hNC}
            isLoading={atlasLoading || liveLoading}
            isAtlasMode={mode === "atlas"}
          />
          {!atlasLoading && !liveLoading && !active && (
            <div className="welcome-overlay">
              <div className="welcome-content">
                <h2>Welcome to MangaViz</h2>
                <p>Explore the manga universe through interactive network graphs.</p>
                <div className="welcome-modes">
                  <div className="welcome-mode">
                    <h3>🗺️ Atlas Mode</h3>
                    <p>Pre-built manga universe graph.</p>
                    <p className="hint">Load atlas to begin.</p>
                  </div>
                  <div className="welcome-mode">
                    <h3>🔍 Live Explorer</h3>
                    <p>Search MangaUpdates in real-time.</p>
                    <p className="hint">Toggle to Live and search.</p>
                  </div>
                </div>
                <p className="welcome-credit">
                  Data from{" "}
                  <a href="https://www.mangaupdates.com" target="_blank" rel="noopener noreferrer">
                    MangaUpdates
                  </a>{" "}
                  · Inspired by{" "}
                  <a href="https://rhiever.github.io/redditviz/" target="_blank" rel="noopener noreferrer">
                    RedditViz
                  </a>
                </p>
              </div>
            </div>
          )}
        </main>
        <aside className="right-panel">
          <NDP node={selNode} onClose={() => setSelNode(null)} onNodeClick={hDC} />
          <div className="stats-area">
            <StatsPanel stats={active?.stats || null} visible={showStats} onToggle={() => setShowStats(!showStats)} />
          </div>
        </aside>
      </div>
    </div>
  );
};
export default App;
