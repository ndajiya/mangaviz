import React,{useState,useCallback,useRef,useEffect} from 'react';
import type{SearchIndexEntry,AppMode} from '../../graph/graphTypes';
interface Props{mode:AppMode;onSearchAtlas:(t:string)=>void;onSearchLive:(t:string)=>void;onSelectNode:(id:string)=>void;searchIndex:SearchIndexEntry[]|null;isLoading?:boolean;}
const SP:React.FC<Props>=({mode,onSearchAtlas,onSearchLive,onSelectNode,searchIndex,isLoading=false})=>{
  const[q,setQ]=useState('');const[sug,setSug]=useState<SearchIndexEntry[]>([]);const[show,setShow]=useState(false);const db=useRef<ReturnType<typeof setTimeout>>();
  const submit=useCallback((e:React.FormEvent)=>{e.preventDefault();const term=q.trim();if(!term)return;if(mode==='atlas')onSearchAtlas(term);else onSearchLive(term);setShow(false);},[q,mode,onSearchAtlas,onSearchLive]);
  const chg=useCallback((e:React.ChangeEvent<HTMLInputElement>)=>{const v=e.target.value;setQ(v);if(db.current)clearTimeout(db.current);if(v.length<2||mode!=='atlas'){setSug([]);setShow(false);return;}db.current=setTimeout(()=>{if(searchIndex){const l=v.toLowerCase();const m=searchIndex.filter(e=>e.label.toLowerCase().includes(l)).slice(0,10);setSug(m);setShow(m.length>0);}},200);},[mode,searchIndex]);
  const sel=useCallback((e:SearchIndexEntry)=>{setQ(e.label);setShow(false);onSelectNode(e.id);},[onSelectNode]);
  useEffect(()=>()=>{if(db.current)clearTimeout(db.current);},[]);
  return<div className="search-panel"><form onSubmit={submit} className="search-form"><div className="search-input-wrapper"><svg className="search-icon" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg><input type="text" value={q} onChange={chg} onFocus={()=>sug.length>0&&setShow(true)} onBlur={()=>setTimeout(()=>setShow(false),200)} placeholder={mode==='atlas'?'Search manga...':'Search MangaUpdates...'} className="search-input"/></div><button type="submit" className="search-btn" disabled={isLoading}>{isLoading?'...':mode==='atlas'?'Find':'Search'}</button></form>
  {show&&sug.length>0&&<div className="suggestions-dropdown">{sug.map(e=><div key={e.id} className="suggestion-item" onMouseDown={()=>sel(e)}><span className={"suggestion-type "+e.type}>{e.type[0].toUpperCase()+e.type.slice(1)}</span><span className="suggestion-label">{e.label}</span></div>)}</div>}</div>;
};
export default SP;
