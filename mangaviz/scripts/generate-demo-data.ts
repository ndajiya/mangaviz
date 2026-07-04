import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');

interface DSE {
  id: number; title: string; type: string; year: string;
  rating: number; votes: number; status: string; desc: string;
  genres: string[]; cats: string[];
  authors: string[]; artists: string[]; pubs: string[]; mags: string[];
  recs: [number,string,number][]; rels: any[];
}

const SERIES: DSE[] = [
  { id: 1, title: 'Berserk', type: 'Manga', year: '1989', rating: 9.3, votes: 150000, status: 'Ongoing', desc: 'Guts, the Black Swordsman, seeks revenge in a dark medieval fantasy world.', genres: ['Action','Adventure','Dark Fantasy','Drama','Horror','Supernatural'], cats: ['Seinen','Mature','Violence','Gore'], authors: ['Kentaro Miura'], artists: ['Kentaro Miura'], pubs: ['Hakusensha'], mags: ['Young Animal'], recs: [[3,'Vinland Saga',95],[5,'Attack on Titan',80],[7,'Vagabond',90],[12,'Claymore',75]], rels: [] },
  { id: 2, title: 'One Piece', type: 'Manga', year: '1997', rating: 9.0, votes: 200000, status: 'Ongoing', desc: 'Monkey D. Luffy sets sail to find the One Piece and become Pirate King.', genres: ['Action','Adventure','Comedy','Drama','Fantasy','Shounen'], cats: ['Shounen','Adventure','Pirates','Superpowers'], authors: ['Eiichiro Oda'], artists: ['Eiichiro Oda'], pubs: ['Shueisha'], mags: ['Weekly Shonen Jump'], recs: [[4,'Naruto',85],[6,'Bleach',75],[8,'Hunter x Hunter',80],[9,'Dragon Ball',70]], rels: [] },
  { id: 3, title: 'Vinland Saga', type: 'Manga', year: '2005', rating: 9.1, votes: 80000, status: 'Ongoing', desc: 'Thorfinn seeks revenge and redemption in Viking-age Scandinavia.', genres: ['Action','Adventure','Drama','Historical','Seinen'], cats: ['Seinen','Historical','Vikings','War'], authors: ['Makoto Yukimura'], artists: ['Makoto Yukimura'], pubs: ['Kodansha'], mags: ['Monthly Afternoon'], recs: [[1,'Berserk',95],[7,'Vagabond',85],[5,'Attack on Titan',70]], rels: [] },
  { id: 4, title: 'Naruto', type: 'Manga', year: '1999', rating: 8.5, votes: 180000, status: 'Completed', desc: 'A young ninja seeks recognition and dreams of becoming Hokage.', genres: ['Action','Adventure','Comedy','Fantasy','Martial Arts','Shounen'], cats: ['Shounen','Ninja','Superpowers','Coming of Age'], authors: ['Masashi Kishimoto'], artists: ['Masashi Kishimoto'], pubs: ['Shueisha'], mags: ['Weekly Shonen Jump'], recs: [[2,'One Piece',85],[6,'Bleach',80],[9,'Dragon Ball',75],[11,'My Hero Academia',70]], rels: [] },
  { id: 5, title: 'Attack on Titan', type: 'Manga', year: '2009', rating: 9.0, votes: 220000, status: 'Completed', desc: 'Humanity fights for survival against man-eating Titans.', genres: ['Action','Drama','Fantasy','Horror','Mystery','Shounen'], cats: ['Shounen','Post-Apocalyptic','Military','Survival'], authors: ['Hajime Isayama'], artists: ['Hajime Isayama'], pubs: ['Kodansha'], mags: ['Bessatsu Shonen Magazine'], recs: [[1,'Berserk',80],[3,'Vinland Saga',70],[10,'Death Note',65]], rels: [] },
  { id: 6, title: 'Bleach', type: 'Manga', year: '2001', rating: 8.2, votes: 150000, status: 'Completed', desc: 'Ichigo Kurosaki gains Soul Reaper powers and fights evil spirits.', genres: ['Action','Adventure','Comedy','Fantasy','Supernatural','Shounen'], cats: ['Shounen','Soul Reapers','Superpowers','Swords'], authors: ['Tite Kubo'], artists: ['Tite Kubo'], pubs: ['Shueisha'], mags: ['Weekly Shonen Jump'], recs: [[4,'Naruto',80],[2,'One Piece',75],[11,'My Hero Academia',65]], rels: [] },
  { id: 7, title: 'Vagabond', type: 'Manga', year: '1998', rating: 9.2, votes: 90000, status: 'Hiatus', desc: 'Fictionalized account of legendary swordsman Miyamoto Musashi.', genres: ['Action','Adventure','Drama','Historical','Martial Arts','Seinen'], cats: ['Seinen','Historical','Samurai','Philosophical'], authors: ['Takehiko Inoue'], artists: ['Takehiko Inoue'], pubs: ['Kodansha','Shogakukan'], mags: ['Morning'], recs: [[1,'Berserk',90],[3,'Vinland Saga',85]], rels: [] },
  { id: 8, title: 'Hunter x Hunter', type: 'Manga', year: '1998', rating: 9.0, votes: 120000, status: 'Hiatus', desc: 'Gon Freecss becomes a Hunter to find his missing father.', genres: ['Action','Adventure','Fantasy','Martial Arts','Shounen'], cats: ['Shounen','Adventure','Superpowers','Examination'], authors: ['Yoshihiro Togashi'], artists: ['Yoshihiro Togashi'], pubs: ['Shueisha'], mags: ['Weekly Shonen Jump'], recs: [[2,'One Piece',80],[4,'Naruto',75]], rels: [] },
  { id: 9, title: 'Dragon Ball', type: 'Manga', year: '1984', rating: 8.7, votes: 180000, status: 'Completed', desc: 'Son Goku goes on adventures to find the seven Dragon Balls.', genres: ['Action','Adventure','Comedy','Fantasy','Martial Arts','Shounen'], cats: ['Shounen','Martial Arts','Superpowers','Aliens'], authors: ['Akira Toriyama'], artists: ['Akira Toriyama'], pubs: ['Shueisha'], mags: ['Weekly Shonen Jump'], recs: [[2,'One Piece',70],[4,'Naruto',75],[11,'My Hero Academia',65]], rels: [] },
  { id: 10, title: 'Death Note', type: 'Manga', year: '2003', rating: 8.9, votes: 160000, status: 'Completed', desc: 'A student gains the power to kill by writing names in a notebook.', genres: ['Mystery','Psychological','Supernatural','Thriller','Shounen'], cats: ['Shounen','Psychological','Detective','Supernatural'], authors: ['Tsugumi Ohba'], artists: ['Takeshi Obata'], pubs: ['Shueisha'], mags: ['Weekly Shonen Jump'], recs: [[5,'Attack on Titan',65]], rels: [] },
  { id: 11, title: 'My Hero Academia', type: 'Manga', year: '2014', rating: 8.5, votes: 130000, status: 'Ongoing', desc: 'A boy born without powers dreams of becoming the greatest hero.', genres: ['Action','Comedy','Superhero','School','Shounen'], cats: ['Shounen','Superheroes','School','Superpowers'], authors: ['Kohei Horikoshi'], artists: ['Kohei Horikoshi'], pubs: ['Shueisha'], mags: ['Weekly Shonen Jump'], recs: [[4,'Naruto',70],[2,'One Piece',65],[6,'Bleach',65]], rels: [] },
  { id: 12, title: 'Claymore', type: 'Manga', year: '2001', rating: 8.4, votes: 60000, status: 'Completed', desc: 'Half-human warriors hunt man-eating Yoma.', genres: ['Action','Dark Fantasy','Drama','Horror','Supernatural'], cats: ['Seinen','Dark Fantasy','Swords','Female Lead'], authors: ['Norihiro Yagi'], artists: ['Norihiro Yagi'], pubs: ['Shueisha'], mags: ['Monthly Shonen Jump'], recs: [[1,'Berserk',75]], rels: [] },
  { id: 112, title: 'Solo Leveling', type: 'Manhwa', year: '2018', rating: 8.9, votes: 110000, status: 'Completed', desc: 'The weakest hunter gains a unique leveling power.', genres: ['Action','Adventure','Fantasy','Supernatural','Dungeon'], cats: ['Manhwa','Webtoon','System','Leveling'], authors: ['Chugong'], artists: ['DUBU'], pubs: ['Kakaopage'], mags: ['KakaoWebtoon'], recs: [[113,'The Beginning After The End',75],[115,"Omniscient Reader's Viewpoint",70]], rels: [] },
  { id: 113, title: 'The Beginning After The End', type: 'Manhwa', year: '2018', rating: 8.5, votes: 60000, status: 'Ongoing', desc: 'A king reincarnates into a fantasy world.', genres: ['Action','Adventure','Fantasy','Magic','Reincarnation'], cats: ['Manhwa','Webtoon','Reincarnation','Magic'], authors: ['TurtleMe'], artists: ['Fuyuki23'], pubs: ['Tapas'], mags: ['Tapas Webtoon'], recs: [[112,'Solo Leveling',75]], rels: [] },
  { id: 114, title: 'Tower of God', type: 'Manhwa', year: '2010', rating: 8.6, votes: 70000, status: 'Ongoing', desc: 'A boy enters a mysterious tower to find his friend.', genres: ['Action','Adventure','Fantasy','Mystery','Drama'], cats: ['Manhwa','Webtoon','Tower','Tests'], authors: ['SIU'], artists: ['SIU'], pubs: ['Naver'], mags: ['Naver Webtoon'], recs: [], rels: [] },
  { id: 115, title: "Omniscient Reader's Viewpoint", type: 'Manhwa', year: '2020', rating: 8.8, votes: 55000, status: 'Ongoing', desc: 'A web novel reader becomes the protagonist of his favorite novel.', genres: ['Action','Adventure','Fantasy','Survival','System'], cats: ['Manhwa','Webtoon','System','Apocalypse'], authors: ['Sing N Song'], artists: ['Sleepy-C'], pubs: ['Munpia'], mags: ['Munpia Webtoon'], recs: [[112,'Solo Leveling',80]], rels: [] },
];

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

fs.mkdirSync(DATA_DIR, { recursive: true });
const nodeMap = new Map<string, any>();
const edges: any[] = [];
const edgeSet = new Set<string>();

function addNode(id: string, label: string, type: string, weight = 1, sm?: any) {
  if (!nodeMap.has(id)) nodeMap.set(id, { id, label, type, weight, metadata: {}, seriesMetadata: sm });
  return nodeMap.get(id)!;
}
function addEdge(s: string, t: string, type: string, w = 1) {
  const eid = `${s}--${t}--${type}`;
  if (edgeSet.has(eid)) return;
  edgeSet.add(eid); edges.push({ id: eid, source: s, target: t, type, weight: w, metadata: {} });
}

for (const s of SERIES) {
  const sid = `series:${s.id}`;
  const w = Math.max(1, s.rating * s.votes * 0.01);
  const assoc = { authors: s.authors.map(n=>({name:n})), artists: s.artists.map(n=>({name:n})), publishers: s.pubs.map(n=>({name:n})), publications: s.mags.map(n=>({name:n})), genres: s.genres.map(n=>({name:n,slug:slugify(n)})), categories: s.cats.map(n=>({name:n,slug:slugify(n)})) };
  const sm = { seriesId: s.id, type: s.type, year: s.year, rating: s.rating, ratingVotes: s.votes, url: `https://www.mangaupdates.com/series.html?id=${s.id}`, status: s.status, description: s.desc, associated: assoc, recommendations: s.recs.map(r=>({title:r[1],id:r[0],weight:r[2]})), relatedSeries: [] };
  addNode(sid, s.title, 'series', w, sm);
  for (const g of s.genres) { const gid = `genre:${slugify(g)}`; addNode(gid, g, 'genre'); addEdge(sid, gid, 'has_genre'); }
  for (const c of s.cats) { const cid = `category:${slugify(c)}`; addNode(cid, c, 'category'); addEdge(sid, cid, 'has_category'); }
  for (const a of s.authors) { const aid = `author:${slugify(a)}`; addNode(aid, a, 'author'); addEdge(sid, aid, 'written_by'); }
  for (const a of s.artists) { const aid = `artist:${slugify(a)}`; addNode(aid, a, 'artist'); addEdge(sid, aid, 'illustrated_by'); }
  for (const p of s.pubs) { const pid = `publisher:${slugify(p)}`; addNode(pid, p, 'publisher'); addEdge(sid, pid, 'published_by'); }
  for (const m of s.mags) { const mid = `publication:${slugify(m)}`; addNode(mid, m, 'publication'); addEdge(sid, mid, 'serialized_in'); }
  for (const r of s.recs) { addNode(`series:${r[0]}`, r[1], 'series', r[2]/100); addEdge(sid, `series:${r[0]}`, 'recommended_with', r[2]/10); }
}

const byType: Record<string, any[]> = {};
for (const n of nodeMap.values()) { if (!byType[n.type]) byType[n.type] = []; byType[n.type].push(n); }
const byEdgeType: Record<string, any[]> = {};
for (const e of edges) { if (!byEdgeType[e.type]) byEdgeType[e.type] = []; byEdgeType[e.type].push(e); }

for (const [t, ns] of Object.entries(byType)) fs.writeFileSync(path.join(DATA_DIR, `nodes.${t}.json`), JSON.stringify(ns));
for (const [t, es] of Object.entries(byEdgeType)) fs.writeFileSync(path.join(DATA_DIR, `edges.${t}.json`), JSON.stringify(es));

const searchIdx = (byType.series || []).map((n: any) => ({ id: n.id, label: n.label, type: 'series', seriesId: n.seriesMetadata?.seriesId }));
fs.writeFileSync(path.join(DATA_DIR, 'search-index.json'), JSON.stringify(searchIdx));

const positions: Record<string,{x:number,y:number}> = {};
const seriesNodes = byType.series || [];
const otherNodes = Object.entries(byType).filter(([k]) => k !== 'series').flatMap(([,v]) => v);
seriesNodes.forEach((n: any, i: number) => { const a = 2*Math.PI*i/seriesNodes.length; positions[n.id] = {x: Math.cos(a)*600+Math.random()*50, y: Math.sin(a)*600+Math.random()*50}; });
otherNodes.forEach((n: any, i: number) => { const a = 2*Math.PI*i/Math.max(otherNodes.length,1); positions[n.id] = {x: Math.cos(a)*(800+Math.random()*200), y: Math.sin(a)*(800+Math.random()*200)}; });
fs.writeFileSync(path.join(DATA_DIR, 'positions.json'), JSON.stringify(positions));

const clusters: Record<string,number> = {};
seriesNodes.forEach((n: any) => { clusters[n.id] = Math.abs(n.label.split('').reduce((a:number,c:string)=>a+c.charCodeAt(0),0)) % 5; });
otherNodes.forEach((n: any) => { clusters[n.id] = 0; });
fs.writeFileSync(path.join(DATA_DIR, 'clusters.json'), JSON.stringify(clusters));

const manifest = { version: '1.0.0', buildDate: new Date().toISOString(), seriesCount: byType.series?.length||0, totalNodes: nodeMap.size, totalEdges: edges.length, shards: { nodes: Object.keys(byType).map(t=>`nodes.${t}.json`), edges: Object.keys(byEdgeType).map(t=>`edges.${t}.json`), positions: ['positions.json'], clusters: ['clusters.json'] }, searchIndex: 'search-index.json' };
fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Generated: ${nodeMap.size} nodes, ${edges.length} edges, ${byType.series?.length||0} series`);
