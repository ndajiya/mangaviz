import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchIndexEntry, AppMode } from '../../graph/graphTypes';

interface Props { mode: AppMode; onSearchAtlas: (t:string)=>void; onSearchLive: (t:string)=>void; onSelectNode: (id:string)=>void; searchIndex: SearchIndexEntry[]|null; }

const SearchPanel: React.FC<Props> = ({ mode, onSearchAtlas, onSearchLive, onSelectNode, searchIndex }) => {
  const [query, setQuery] = useState(''); const [sug, setSug] = useState<SearchIndexEntry[]>([]); const [showSug, setShowSug] = useState(false); const [loading, setLoading] = useState(false);
  const db = useRef<ReturnType<typeof setTimeout>>();
  const handleSubmit = useCallback((e:React.FormEvent) => { e.preventDefault(); if (!query.trim()) return; if (mode==='atlas') onSearchAtlas(query.trim()); else { setLoading(true); onSearchLive(query.trim()); } setShowSug(false); }, [query,mode,onSearchAtlas,onSearchLive]);
  const handleChange = useCallback((e:React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setQuery(v); if (db.current) clearTimeout(db.current);
    if (v.length<2||mode!=='atlas') { setSug([]); setShowSug(false); return; }
    db.current = setTimeout(() => { if (searchIndex) { const l=v.toLowerCase(); const m=searchIndex.filter(e=>e.label.toLowerCase().includes(l)).slice(0,10); setSug(m); setShowSug(m.length>0); } }, 200);
  }, [mode, searchIndex]);
  const select = useCallback((entry:SearchIndexEntry) => { setQuery(entry.label); setShowSug(false); onSelectNode(entry.id); }, [onSelectNode]);
  useEffect(() => () => { if (db.current) clearTimeout(db.current); }, []);

  return (
    <div className="search-panel">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" value={query} onChange={handleChange} onFocus={() => sug.length>0 && setShowSug(true)} onBlur={() => setTimeout(()=>setShowSug(false),200)} placeholder={mode==='atlas'?'Search manga in Atlas...':'Search MangaUpdates...'} className="search-input" />
        </div>
        <button type="submit" className="search-btn" disabled={loading}>{loading?'...':mode==='atlas'?'Find':'Search'}</button>
      </form>
      {showSug && sug.length > 0 && <div className="suggestions-dropdown">{sug.map(e => (
        <div key={e.id} className="suggestion-item" onMouseDown={() => select(e)}><span className={`suggestion-type ${e.type}`}>{e.type[0].toUpperCase()+e.type.slice(1)}</span><span className="suggestion-label">{e.label}</span></div>
      ))}</div>}
    </div>
  );
};

export default SearchPanel;
