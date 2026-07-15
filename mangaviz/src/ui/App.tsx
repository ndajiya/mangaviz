import React, { useState, useEffect, useCallback } from "react";
import type { GraphNode, GraphData, AppMode, SearchIndexEntry } from "../graph/graphTypes";
import { loadAtlasData, loadSearchIndex } from "../graph/layoutLoader";
import { buildGraphFromSeriesDetails, requireSeriesMetadata } from "../graph/buildGraph";
import api from "../api/mangaupdates";
import { cacheSet, cacheGet } from "../cache/indexedDbCache";
import GC from "./components/GraphCanvas";
import SP from "./components/SearchPanel";
import MT from "./components/ModeToggle";
import NDP from "./components/NodeDetailPanel";
import LegendPanel from "./components/LegendPanel";
import FP from "./components/FilterPanel";
import StatsPanel from "./components/StatsPanel";
import AtlasAdminPanel from "./components/AtlasAdminPanel";

const LIVE_GRAPH_CACHE_PREFIX = "live:knowledge-graph:";
const LIVE_GRAPH_CACHE_TTL_MS = 1000 * 60 * 60;
const getLiveGraphCacheKey = (term: string) => `${LIVE_GRAPH_CACHE_PREFIX}${term.trim().toLowerCase()}`;
type LiveNoticeKind = "input_required" | "no_results" | "cache_fallback" | "hard_failure";
type LiveNotice = { kind: LiveNoticeKind; message: string };
const getLiveNoticeMeta = (kind: LiveNoticeKind) => {
  switch (kind) {
    case "input_required":
      return { title: "Search Needed", hint: "Enter a title to query MangaUpdates." };
    case "no_results":
      return { title: "No Live Results", hint: "MangaUpdates returned zero matches for this query." };
    case "cache_fallback":
      return { title: "Showing Cached Live Graph", hint: "The latest live refresh failed, so the browser reused a cached Live-mode graph for this same query." };
    case "hard_failure":
      return { title: "Live Request Failed", hint: "Open DevTools to inspect the console trace for the exact failure branch and payload." };
  }
};
const traceLiveNotice = (kind: LiveNoticeKind, payload: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  const level = kind === "hard_failure" ? "error" : kind === "cache_fallback" ? "warn" : "info";
  console[level]("[LiveMode]", { kind, ...payload });
};
const atlasAdminEnabled = import.meta.env.VITE_ATLAS_ADMIN_ENABLED === "true";

const App: React.FC = () => {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"filters" | "details" | null>(null);
  const [mode, setMode] = useState<AppMode>("atlas");
  const [atlasData, setAtlasData] = useState<GraphData | null>(null);
  const [atlasLayout, setAtlasLayout] = useState<any>(null);
  const [atlasManifest, setAtlasManifest] = useState<any>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[] | null>(null);
  const [atlasLoading, setAtlasLoading] = useState(true);
  const [liveData, setLiveData] = useState<GraphData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveNotice, setLiveNotice] = useState<LiveNotice | null>(null);
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
    written_by: false,
    illustrated_by: false,
    published_by: false,
    serialized_in: false,
    related_to: true,
    recommended_with: true,
  });
  const [clusterF, setClusterF] = useState<number | null>(null);
  const [selNode, setSelNode] = useState<GraphNode | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
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
          setSearchIndex(await loadSearchIndex(new Set(d.graph.nodes.map((node) => node.id))));
        } catch {}
      } catch (e) {
        console.warn("Atlas unavailable:", e);
      } finally {
        setAtlasLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => {
      setIsMobileViewport(mq.matches);
      if (!mq.matches) setMobilePanel(null);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const hNC = useCallback((n: GraphNode | null) => {
    setSelNode(n);
    setSelId(n?.id ?? null);
    if (n && isMobileViewport) setMobilePanel("details");
  }, [isMobileViewport]);
  const hDC = useCallback(
    (id: string) => {
      const n = active?.nodes.find((n) => n.id === id);
      if (n) {
        setSelNode(n);
        setSelId(id);
        setFocusNodeId(id);
        setFocusToken((v) => v + 1);
        if (isMobileViewport) setMobilePanel("details");
      }
    },
    [active, isMobileViewport],
  );
  const hAS = useCallback(
    (t: string) => {
      const l = t.toLowerCase();
      const m = active?.nodes.find((n) => n.label.toLowerCase().includes(l) || n.id.includes(l));
      if (m) {
        hNC(m);
        setFocusNodeId(m.id);
        setFocusToken((value) => value + 1);
      }
    },
    [active, hNC],
  );
  const hLS = useCallback(async (t: string) => {
    const term = t.trim();
    const liveCacheKey = getLiveGraphCacheKey(term);
    if (!term) {
      const notice = { kind: "input_required" as const, message: "Enter a search term to query MangaUpdates." };
      setLiveNotice(notice);
      traceLiveNotice(notice.kind, { term, liveCacheKey, reason: "empty_input" });
      return;
    }
    setLiveLoading(true);
    setLiveNotice(null);
    setLiveData(null);
    setSelNode(null);
    setSelId(null);
    setFocusNodeId(null);
    let searchedSeriesId: number | null = null;
    try {
      const searchResults = await api.searchSeries({ search: term, perPage: 5 });
      if (!searchResults.results?.length) {
        const notice = { kind: "no_results" as const, message: 'No live results for "' + term + '".' };
        setLiveNotice(notice);
        traceLiveNotice(notice.kind, { term, liveCacheKey, resultCount: 0, cacheUsed: false });
        return;
      }
      const details: Awaited<ReturnType<typeof api.getSeriesDetail>>[] = [];
      for (const result of searchResults.results.slice(0, 5)) {
        const id = result.record.series_id ?? result.record.id;
        if (!id) continue;
        await new Promise((resolve) => setTimeout(resolve, 700));
        try {
          const detail = await api.getSeriesDetail(id);
          details.push(detail);
          if (searchedSeriesId === null) searchedSeriesId = detail.series_id ?? detail.id ?? id;
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
      await cacheSet(liveCacheKey, freshGraph, LIVE_GRAPH_CACHE_TTL_MS);
      setLiveData(freshGraph);
      const searchedNode = freshGraph.nodes.find((node) => node.id === `series:${searchedSeriesId}`)
        || freshGraph.nodes.find((node) => node.type === "series");
      if (searchedNode) {
        setSelNode(searchedNode);
        setSelId(searchedNode.id);
        setFocusNodeId(searchedNode.id);
        setFocusToken((value) => value + 1);
      }
    } catch (e) {
      const cachedGraph = await cacheGet<GraphData>(liveCacheKey, LIVE_GRAPH_CACHE_TTL_MS);
      if (cachedGraph) {
        const completeCachedGraph = requireSeriesMetadata(cachedGraph);
        setLiveData(completeCachedGraph);
        const normalizedTerm = term.toLowerCase();
        const searchedNode = completeCachedGraph.nodes.find((node) => node.type === "series" && node.label.toLowerCase().includes(normalizedTerm))
          || completeCachedGraph.nodes.find((node) => node.type === "series");
        if (searchedNode) {
          setSelNode(searchedNode);
          setSelId(searchedNode.id);
          setFocusNodeId(searchedNode.id);
          setFocusToken((value) => value + 1);
        }
        const notice = { kind: "cache_fallback" as const, message: "Live refresh failed after trying all MangaUpdates routes; showing the cached knowledge graph." };
        setLiveNotice(notice);
        traceLiveNotice(notice.kind, { term, liveCacheKey, error: e instanceof Error ? e.message : "Unknown error", nodeCount: completeCachedGraph.nodes.length, edgeCount: completeCachedGraph.edges.length, cacheUsed: true });
      } else {
        const notice = { kind: "hard_failure" as const, message: "Live search failed: " + (e instanceof Error ? e.message : "Unknown error") };
        setLiveNotice(notice);
        traceLiveNotice(notice.kind, { term, liveCacheKey, error: e instanceof Error ? e.message : "Unknown error", cacheUsed: false });
      }
    } finally {
      setLiveLoading(false);
    }
  }, []);
  const tM = useCallback((m: AppMode) => {
    setMode(m);
    setSelNode(null);
    setSelId(null);
    setFocusNodeId(null);
    setLiveNotice(null);
    setMobilePanel(null);
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
          <button type="button" className="mobile-panel-btn" onClick={() => setMobilePanel((p) => p === "filters" ? null : "filters")}>
            Filters
          </button>
          <button type="button" className="mobile-panel-btn" onClick={() => setMobilePanel((p) => p === "details" ? null : "details")}>
            Details
          </button>
        </div>
      </header>
      {mobilePanel && <button type="button" className="mobile-panel-backdrop" aria-label="Close mobile panel" onClick={() => setMobilePanel(null)} />}
      <div className="app-body">
        <aside className={"left-panel"+(mobilePanel==="filters"?" is-open":"")}>
          <div className="mobile-panel-header">
            <h3>Filters</h3>
            <button type="button" className="close-btn" onClick={() => setMobilePanel(null)}>&times;</button>
          </div>
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
          {mode === "live" && liveNotice && (
            <div className={`live-error live-error--${liveNotice.kind}`}>
              <p className="live-error-title">{getLiveNoticeMeta(liveNotice.kind).title}</p>
              <p>{liveNotice.message}</p>
              <p className="live-error-hint">{getLiveNoticeMeta(liveNotice.kind).hint}</p>
            </div>
          )}
          <GC
            graphData={active}
            layoutData={mode === "atlas" ? atlasLayout : null}
            nodeTypeFilters={ntF}
            edgeTypeFilters={etF}
            clusterFilter={clusterF}
            focusNodeId={focusNodeId}
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
          {atlasAdminEnabled && <AtlasAdminPanel />}
        </main>
        <aside className={"right-panel"+(mobilePanel==="details"?" is-open":"")}>
          <div className="mobile-panel-header">
            <h3>{selNode ? "Details" : "Inspector"}</h3>
            <button type="button" className="close-btn" onClick={() => setMobilePanel(null)}>&times;</button>
          </div>
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
