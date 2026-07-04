import React from 'react';
import type{GraphStats} from '../../graph/graphTypes';
interface Props{stats:GraphStats|null;visible:boolean;onToggle:()=>void;}
const SP:React.FC<Props>=({stats,visible,onToggle})=>{
  if(!stats)return<div className="stats-toggle" onClick={onToggle}><span>Stats</span></div>;
  return<div className={"stats-panel"+(visible?' visible':'')}><div className="stats-header"><h3>Statistics</h3><button className="close-btn" onClick={onToggle}>&times;</button></div><div className="stats-content">
  <div className="stat-section"><h4>Overview</h4><div className="stat-grid">{[{l:'Nodes',v:stats.totalNodes},{l:'Edges',v:stats.totalEdges},{l:'Series',v:stats.seriesCount},{l:'Genres',v:stats.genreCount},{l:'Categories',v:stats.categoryCount},{l:'Authors/Artists',v:stats.authorArtistCount},{l:'Publishers',v:stats.publisherCount}].map(s=><div key={s.l} className="stat-item"><span className="stat-value">{s.v.toLocaleString()}</span><span className="stat-label">{s.l}</span></div>)}</div></div>
  {stats.topGenres?.length?<div className="stat-section"><h4>Top Genres</h4><ol className="stat-list">{stats.topGenres.slice(0,5).map((g,i)=><li key={g.name} className="stat-list-item"><span className="stat-rank">#{i+1}</span><span className="stat-name">{g.name}</span><span className="stat-count">{g.count}</span></li>)}</ol></div>:null}
  {stats.highestRatedSeries?.length?<div className="stat-section"><h4>Highest Rated</h4><ol className="stat-list">{stats.highestRatedSeries.slice(0,5).map((s,i)=><li key={s.id} className="stat-list-item"><span className="stat-rank">#{i+1}</span><span className="stat-name">{s.label}</span><span className="stat-count">{s.rating.toFixed(2)}</span></li>)}</ol></div>:null}
  </div></div>;
};
export default SP;
