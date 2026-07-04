import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape, { Core, EventObject, NodeSingular } from 'cytoscape';
import { getGraphStyles } from '../../graph/graphStyles';
import type { GraphNode, GraphData, LayoutData } from '../../graph/graphTypes';

interface Props { graphData: GraphData | null; layoutData?: LayoutData | null; nodeTypeFilters: Record<string,boolean>; edgeTypeFilters: Record<string,boolean>; clusterFilter: number | null; selectedNodeId: string | null; onNodeClick: (node: GraphNode|null) => void; isLoading?: boolean; }

const GraphCanvas: React.FC<Props> = ({ graphData, layoutData, nodeTypeFilters, edgeTypeFilters, clusterFilter, selectedNodeId, onNodeClick, isLoading }) => {
  const cyRef = useRef<Core|null>(null);

  const filtered = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };
    const ntypes = Object.entries(nodeTypeFilters).filter(([,v])=>v!==false).map(([k])=>k);
    const etypes = Object.entries(edgeTypeFilters).filter(([,v])=>v!==false).map(([k])=>k);
    const ns = new Set<string>();
    const nodes = graphData.nodes.filter(n => { if (!ntypes.includes(n.type)) return false; if (clusterFilter !== null && n.cluster !== clusterFilter) return false; ns.add(n.id); return true; });
    const edges = graphData.edges.filter(e => etypes.includes(e.type) && ns.has(e.source) && ns.has(e.target));
    return { nodes, edges };
  }, [graphData, nodeTypeFilters, edgeTypeFilters, clusterFilter]);

  const eles = useMemo(() => {
    const e: cytoscape.ElementDefinition[] = [];
    for (const n of filtered.nodes) {
      const p: {x?:number;y?:number} = {}; const lp = layoutData?.positions[n.id];
      if (n.x !== undefined) { p.x=n.x; p.y=n.y; } else if (lp) { p.x=lp.x; p.y=lp.y; }
      e.push({ group:'nodes', data:{id:n.id,label:n.label,type:n.type,weight:n.weight,cluster:n.cluster}, position: p.x!==undefined ? {x:p.x,y:p.y} : undefined });
    }
    for (const edge of filtered.edges) e.push({ group:'edges', data:{id:edge.id,source:edge.source,target:edge.target,type:edge.type,weight:edge.weight} });
    return e;
  }, [filtered, layoutData]);

  const handleInit = useCallback((cy: Core) => {
    cyRef.current = cy;
    cy.on('tap', 'node', (evt: EventObject) => { const d = (evt.target as NodeSingular).data(); onNodeClick(graphData?.nodes.find(n=>n.id===d.id)||null); });
    cy.on('tap', (evt: EventObject) => { if (evt.target === cy) onNodeClick(null); });
    if (eles.length > 0 && !layoutData) cy.layout({ name:'cose', animate:true, animationDuration:300, fit:true, padding:30 }).run();
    else if (eles.length > 0) setTimeout(() => cy.fit(undefined, 50), 50);
  }, [graphData, layoutData, onNodeClick, eles.length]);

  useEffect(() => {
    if (!cyRef.current || !selectedNodeId) return;
    const node = cyRef.current.getElementById(selectedNodeId);
    if (node.length > 0) { cyRef.current.animate({ fit:{eles:node,padding:100}, duration:400 }); node.select(); }
  }, [selectedNodeId]);

  if (isLoading) return <div className="graph-loading"><div className="loading-spinner"></div><p>Loading graph...</p></div>;
  if (!graphData || !graphData.nodes.length) return <div className="graph-empty"><p>No graph data loaded.</p></div>;

  return (
    <div className="graph-canvas-container">
      <CytoscapeComponent elements={eles} style={{width:'100%',height:'100%',position:'absolute',top:0,left:0}} stylesheet={getGraphStyles()} layout={{name:'preset'}} cy={handleInit} zoomingEnabled={true} panningEnabled={true} minZoom={0.1} maxZoom={10} wheelSensitivity={0.3} />
      <div className="graph-info">{filtered.nodes.length} nodes / {filtered.edges.length} edges</div>
    </div>
  );
};

export default GraphCanvas;
