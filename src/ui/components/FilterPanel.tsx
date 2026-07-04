import React from 'react';
interface Props {
  nodeTypeFilters: Record<string,boolean>; edgeTypeFilters: Record<string,boolean>;
  onToggleNodeType: (t:string)=>void; onToggleEdgeType: (t:string)=>void;
  clusterFilter: number|null; onClusterFilter: (c:number|null)=>void; totalClusters: number;
}
const NTS = [{k:'series',l:'Series'},{k:'genre',l:'Genres'},{k:'category',l:'Categories'},{k:'author',l:'Authors'},{k:'artist',l:'Artists'},{k:'publisher',l:'Publishers'},{k:'publication',l:'Publications'}];
const ETS = [{k:'has_genre',l:'Genre'},{k:'has_category',l:'Category'},{k:'written_by',l:'Written By'},{k:'illustrated_by',l:'Illustrated By'},{k:'published_by',l:'Published By'},{k:'serialized_in',l:'Serialized In'},{k:'related_to',l:'Related'},{k:'recommended_with',l:'Recommendations'}];
const FilterPanel: React.FC<Props> = ({ nodeTypeFilters, edgeTypeFilters, onToggleNodeType, onToggleEdgeType, clusterFilter, onClusterFilter, totalClusters }) => (
  <div className="filter-panel">
    <h3>Filters</h3>
    <div className="filter-section"><h4>Node Types</h4>{NTS.map(nt => <label key={nt.k} className="filter-checkbox"><input type="checkbox" checked={nodeTypeFilters[nt.k]!==false} onChange={()=>onToggleNodeType(nt.k)} /><span>{nt.l}</span></label>)}</div>
    <div className="filter-section"><h4>Edge Types</h4>{ETS.map(et => <label key={et.k} className="filter-checkbox"><input type="checkbox" checked={edgeTypeFilters[et.k]!==false} onChange={()=>onToggleEdgeType(et.k)} /><span>{et.l}</span></label>)}</div>
    {totalClusters > 0 && <div className="filter-section"><h4>Cluster</h4><select value={clusterFilter??''} onChange={e=>onClusterFilter(e.target.value?Number(e.target.value):null)}><option value="">All</option>{Array.from({length:totalClusters},(_,i)=><option key={i} value={i}>Cluster {i}</option>)}</select></div>}
  </div>
);
export default FilterPanel;
