import type { Stylesheet } from 'cytoscape';
export const NC: Record<string,string> = { series:'#FF6B6B', genre:'#4ECDC4', category:'#45B7D1', author:'#96CEB4', artist:'#FFEAA7', publisher:'#DDA0DD', publication:'#F0E68C' };
export function getGraphStyles(): Stylesheet[] {
  return [
    { selector: 'node', style: { 'background-color':'#666', label:'data(label)', 'text-valign':'bottom', 'text-halign':'center', color:'#fff', 'font-size':'10px', 'text-outline-width':2, 'text-outline-color':'#1a1a2e', width:'mapData(weight,0,100,8,60)', height:'mapData(weight,0,100,8,60)', 'border-width':1, 'border-color':'#fff', 'border-opacity':0.3, 'min-zoomed-font-size':6, 'text-wrap':'wrap', 'text-max-width':'120px' } },
    { selector: 'node[type = "series"]', style: { 'background-color':NC.series, 'border-color':'#ff4444', 'border-width':2, 'font-size':'12px' } },
    { selector: 'node[type = "genre"]', style: { 'background-color':NC.genre } },
    { selector: 'node[type = "category"]', style: { 'background-color':NC.category } },
    { selector: 'node[type = "author"]', style: { 'background-color':NC.author, shape:'diamond' } },
    { selector: 'node[type = "artist"]', style: { 'background-color':NC.artist, shape:'diamond' } },
    { selector: 'node[type = "publisher"]', style: { 'background-color':NC.publisher, shape:'square' } },
    { selector: 'node[type = "publication"]', style: { 'background-color':NC.publication, shape:'square' } },
    { selector: 'node:selected', style: { 'border-color':'#FFD700', 'border-width':4, 'border-opacity':1, 'shadow-blur':20, 'shadow-color':'#FFD700', 'shadow-opacity':0.5 } },
    { selector: 'edge', style: { width:1, 'line-color':'#555', 'target-arrow-color':'#888', 'target-arrow-shape':'triangle', 'curve-style':'bezier', opacity:0.3 } },
    { selector: 'edge[type = "has_genre"]', style: { 'line-color':NC.genre, opacity:0.4 } },
    { selector: 'edge[type = "has_category"]', style: { 'line-color':NC.category, opacity:0.4 } },
    { selector: 'edge[type = "written_by"]', style: { 'line-color':NC.author, 'line-style':'dashed' } },
    { selector: 'edge[type = "illustrated_by"]', style: { 'line-color':NC.artist, 'line-style':'dashed' } },
    { selector: 'edge[type = "published_by"]', style: { 'line-color':NC.publisher } },
    { selector: 'edge[type = "serialized_in"]', style: { 'line-color':NC.publication } },
    { selector: 'edge[type = "related_to"]', style: { 'line-color':NC.series, width:2 } },
    { selector: 'edge[type = "recommended_with"]', style: { 'line-color':'#FFD700', width:'mapData(weight,0,10,1,4)', opacity:0.5 } },
    { selector: 'edge.highlighted', style: { opacity:0.8, width:2 } },
    { selector: 'edge.faded', style: { opacity:0.05 } },
  ];
}
