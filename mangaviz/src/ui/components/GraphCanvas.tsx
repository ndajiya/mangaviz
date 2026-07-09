import React,{useCallback,useMemo,useRef,useEffect,useState} from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import type{Core,EventObject,NodeSingular} from 'cytoscape';
import {getGraphStyles} from '../../graph/graphStyles';
import type{GraphNode,GraphData,LayoutData} from '../../graph/graphTypes';
interface Props{graphData:GraphData|null;layoutData?:LayoutData|null;nodeTypeFilters:Record<string,boolean>;edgeTypeFilters:Record<string,boolean>;clusterFilter:number|null;selectedNodeId:string|null;focusToken?:number;onNodeClick:(n:GraphNode|null)=>void;isLoading?:boolean;isAtlasMode?:boolean;}
const LIVE_LAYOUT: cytoscape.LayoutOptions = {
  name:'cose',
  animate:true,
  animationDuration:550,
  fit:true,
  padding:80,
  randomize:true,
  nodeDimensionsIncludeLabels:true,
  nodeOverlap:28,
  nodeRepulsion:(node) => node.data('type') === 'series' ? 220000 : 150000,
  idealEdgeLength:(edge) => {
    const type = edge.data('type');
    if (type === 'has_genre' || type === 'has_category') return 86;
    if (type === 'written_by' || type === 'illustrated_by' || type === 'published_by' || type === 'serialized_in') return 112;
    if (type === 'recommended_with' || type === 'related_to') return 210;
    return 132;
  },
  edgeElasticity:(edge) => {
    const type = edge.data('type');
    if (type === 'has_genre' || type === 'has_category') return 220;
    if (type === 'written_by' || type === 'illustrated_by' || type === 'published_by' || type === 'serialized_in') return 150;
    if (type === 'recommended_with' || type === 'related_to') return 90;
    return 110;
  },
  gravity:0.35,
  gravityRangeCompound:1.4,
  nestingFactor:0.9,
  numIter:2200,
  initialTemp:1200,
  coolingFactor:0.96,
  minTemp:1,
  componentSpacing:180,
};
const GC:React.FC<Props>=({graphData,layoutData,nodeTypeFilters,edgeTypeFilters,clusterFilter,selectedNodeId,focusToken=0,onNodeClick,isLoading,isAtlasMode})=>{
  const cyR=useRef<Core|null>(null);
  const zoomRef=useRef(1);
  const zoomInputRef=useRef<HTMLInputElement|null>(null);
  const [atlasSpread,setAtlasSpread]=useState(1);
  const fltrd=useMemo(()=>{if(!graphData)return{nodes:[],edges:[]};const nt=Object.entries(nodeTypeFilters).filter(([,v])=>v!==false).map(([k])=>k);const et=Object.entries(edgeTypeFilters).filter(([,v])=>v!==false).map(([k])=>k);const ns=new Set<string>();const nodes=graphData.nodes.filter(n=>{if(!nt.includes(n.type))return false;if(clusterFilter!==null&&n.cluster!==clusterFilter)return false;ns.add(n.id);return true;});const edges=graphData.edges.filter(e=>et.includes(e.type)&&ns.has(e.source)&&ns.has(e.target));return{nodes,edges};},[graphData,nodeTypeFilters,edgeTypeFilters,clusterFilter]);
  const eles=useMemo(()=>{const e:cytoscape.ElementDefinition[]=[];const positionedNodes=fltrd.nodes.map((n)=>{const lp=layoutData?.positions[n.id];if(n.x!==undefined&&n.y!==undefined)return{id:n.id,x:n.x,y:n.y};if(lp)return{id:n.id,x:lp.x,y:lp.y};return{id:n.id};});const anchored=positionedNodes.filter((n):n is {id:string;x:number;y:number}=>n.x!==undefined&&n.y!==undefined);const center=anchored.length>0?anchored.reduce((acc,n)=>({x:acc.x+n.x,y:acc.y+n.y}),{x:0,y:0}):{x:0,y:0};const centerX=anchored.length>0?center.x/anchored.length:0;const centerY=anchored.length>0?center.y/anchored.length:0;for(const n of fltrd.nodes){const p:{x?:number;y?:number}={};const lp=layoutData?.positions[n.id];if(n.x!==undefined&&n.y!==undefined){p.x=n.x;p.y=n.y;}else if(lp){p.x=lp.x;p.y=lp.y;}if(isAtlasMode&&atlasSpread!==1&&p.x!==undefined&&p.y!==undefined){p.x=centerX+(p.x-centerX)*atlasSpread;p.y=centerY+(p.y-centerY)*atlasSpread;}e.push({group:'nodes',data:{id:n.id,label:n.label,type:n.type,weight:n.weight,cluster:n.cluster},position:p.x!==undefined?{x:p.x,y:p.y}:undefined});}for(const ed of fltrd.edges)e.push({group:'edges',data:{id:ed.id,source:ed.source,target:ed.target,type:ed.type,weight:ed.weight}});return e;},[fltrd,layoutData,isAtlasMode,atlasSpread]);
  const layout = useMemo(() => layoutData ? { name:'preset' } : LIVE_LAYOUT, [layoutData]);
  const graphKey = useMemo(() => layoutData ? `atlas-graph-${atlasSpread.toFixed(2)}` : `live-${fltrd.nodes.length}-${fltrd.edges.length}-${fltrd.nodes[0]?.id || 'empty'}-${fltrd.edges[0]?.id || 'empty'}`, [layoutData, atlasSpread, fltrd.nodes, fltrd.edges]);
  const updateZoomControl=useCallback((value:number)=>{if(zoomInputRef.current){zoomInputRef.current.value=Number(value.toFixed(2)).toString();}},[]);
  const handleZoomChange=useCallback((value:number)=>{const cy=cyR.current;if(!cy)return;const next=Math.max(0.1,Math.min(10,Number(value.toFixed(2))));zoomRef.current=next;updateZoomControl(next);cy.zoom(next);cy.center();},[updateZoomControl]);
  const handleAtlasSpread=useCallback(()=>{setAtlasSpread((value)=>Math.min(10,Number((value+0.15).toFixed(2))));},[]);
  const resetAtlasSpread=useCallback(()=>setAtlasSpread(1),[]);
  const init=useCallback((cy:Core)=>{cyR.current=cy;const syncZoom=()=>{const next=Number(cy.zoom().toFixed(2));zoomRef.current=next;updateZoomControl(next);};zoomRef.current=Number(cy.zoom().toFixed(2));updateZoomControl(zoomRef.current);cy.on('zoom',syncZoom);cy.on('tap','node',(evt:EventObject)=>{const d=(evt.target as NodeSingular).data();onNodeClick(graphData?.nodes.find(n=>n.id===d.id)||null);});cy.on('tap',(evt:EventObject)=>{if(evt.target===cy)onNodeClick(null);});if(eles.length>0&&layoutData)setTimeout(()=>cy.fit(undefined,50),50);return()=>{cy.off('zoom',syncZoom);};},[graphData,layoutData,onNodeClick,eles.length,updateZoomControl]);
  useEffect(()=>{if(layoutData||!cyR.current||!graphData?.nodes.length)return;const settleTimer=window.setTimeout(()=>{const cy=cyR.current;if(!cy)return;const minReadableZoom=.65;if(cy.zoom()<minReadableZoom){zoomRef.current=minReadableZoom;updateZoomControl(minReadableZoom);cy.zoom(minReadableZoom);cy.center();}},900);return()=>window.clearTimeout(settleTimer);},[layoutData,graphData,updateZoomControl]);
  useEffect(()=>{setAtlasSpread(1);},[graphData,layoutData,isAtlasMode]);
  useEffect(()=>{if(!cyR.current||!selectedNodeId)return;const centerSelectedNode=()=>{const cy=cyR.current;if(!cy)return;const n=cy.getElementById(selectedNodeId);if(n.length===0)return;const renderedPos=n.renderedPosition();const targetZoom=Math.min(2.4,Math.max(1.2,cy.zoom()));cy.stop();cy.animate({center:{x:renderedPos.x,y:renderedPos.y},zoom:targetZoom,duration:450,easing:'ease-out-cubic'});n.select();};const timerId=window.setTimeout(centerSelectedNode,0);const retryId=window.setTimeout(centerSelectedNode,220);return ()=>{window.clearTimeout(timerId);window.clearTimeout(retryId);};},[selectedNodeId,focusToken]);
  if(isLoading)return<div className="graph-loading"><div className="loading-spinner"></div><p>Loading graph...</p></div>;
  if(!graphData||!graphData.nodes.length)return<div className="graph-empty"><p>No graph data loaded.</p></div>;
  return<div className="graph-canvas-container"><CytoscapeComponent key={graphKey} elements={eles} style={{width:'100%',height:'100%',position:'absolute',top:0,left:0}} stylesheet={getGraphStyles()} layout={layout} cy={init} zoomingEnabled={true} panningEnabled={true} minZoom={0.1} maxZoom={10} wheelSensitivity={0.3}/><div className="atlas-zoom-bar"><span className="atlas-zoom-label">Zoom</span><button className="atlas-zoom-btn" onClick={()=>handleZoomChange(Math.max(0.1,zoomRef.current-0.2))} aria-label="Zoom out">−</button><input ref={zoomInputRef} className="atlas-zoom-slider" type="range" min="0.1" max="10" step="0.1" defaultValue={1} onChange={(e)=>handleZoomChange(Number(e.target.value))}/><button className="atlas-zoom-btn" onClick={()=>handleZoomChange(Math.min(10,zoomRef.current+0.2))} aria-label="Zoom in">+</button>{isAtlasMode&&<><button className="atlas-zoom-reset" onClick={handleAtlasSpread} aria-label="Increase Atlas node spacing">Spread</button><button className="atlas-zoom-reset" onClick={resetAtlasSpread} disabled={atlasSpread===1}>Density {atlasSpread.toFixed(2)}x</button></>}<button className="atlas-zoom-reset" onClick={()=>handleZoomChange(1)}>Reset</button></div><div className="graph-info">{fltrd.nodes.length} nodes / {fltrd.edges.length} edges</div></div>;
};
export default GC;
