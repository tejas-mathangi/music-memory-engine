import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as d3 from "d3";
import { 
  Play, 
  SkipForward, 
  Heart,
  Home,
  Search,
  Library,
  PlusSquare,
  Network
} from "lucide-react";

// --- Interfaces ---
interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  tempo: number;
  mood: string;
}

interface UserProfile {
  playCounts: Record<string, number>;
  history: string[];
  skips: string[];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  genre: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  weight: number;
}

// --- Helper Functions ---
function getColorsForSongId(id: string): [string, string] {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hues = [
    [340, 260], // Pink to Purple
    [200, 240], // Blue to Indigo
    [160, 200], // Teal to Blue
    [280, 320], // Purple to Magenta
    [20, 60],   // Orange to Yellow
    [120, 180]  // Green to Cyan
  ];
  const pair = hues[hash % hues.length];
  return [`hsl(${pair[0]}, 70%, 50%)`, `hsl(${pair[1]}, 70%, 30%)`];
}

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId] = useState("default-user");
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
  
  // Custom states for Player
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [songsRes, recsRes, profileRes, graphRes] = await Promise.all([
        fetch("/api/songs"),
        fetch(`/api/recommendations?userId=${userId}`),
        fetch(`/api/profile?userId=${userId}`),
        fetch("/api/graph")
      ]);
      
      const songsData: Song[] = await songsRes.json();
      const recsData: Song[] = await recsRes.json();
      const profileData: UserProfile = await profileRes.json();
      const gData = await graphRes.json();
      
      setSongs(songsData);
      setRecommendations(recsData);
      setProfile(profileData);
      setGraphData(gData);

      // Set initial now playing if not set
      if (!nowPlayingId) {
        if (profileData.history && profileData.history.length > 0) {
          setNowPlayingId(profileData.history[0]);
        } else if (recsData && recsData.length > 0) {
          setNowPlayingId(recsData[0].id);
        } else if (songsData.length > 0) {
          setNowPlayingId(songsData[0].id);
        }
      }

    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentSong = useMemo(() => songs.find(s => s.id === nowPlayingId) || null, [songs, nowPlayingId]);

  const handleAction = async (songId: string, type: 'play' | 'skip' | 'like') => {
    if (type === 'like') {
      // Toggle local state
      setLikedSongs(prev => {
        const next = new Set(prev);
        if (next.has(songId)) next.delete(songId);
        else next.add(songId);
        return next;
      });
      // Optionally fire a play action to the backend to register the interaction
      await fetch('/api/play', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, songId, type: 'play' }) // simulate interaction
      });
      return; // Like does not force playback change
    }

    setNowPlayingId(songId);
    setIsPlaying(type === 'play');

    const endpoint = type === 'skip' ? '/api/skip' : '/api/play';
    const body = type === 'skip' ? { userId, songId } : { userId, songId, type };

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      fetchData(); // refresh graph and suggestions immediately
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  // Compute "Because you listened to X"
  const becauseYouListenedTo = useMemo(() => {
    if (!profile || profile.history.length === 0 || graphData.links.length === 0) return [];
    
    // Find last played that is not the current if currently playing, or just top of history
    const lastPlayedId = profile.history[0];
    const neighbors = graphData.links
        .filter(l => (l.source as any).id === lastPlayedId || (l.target as any).id === lastPlayedId)
        .sort((a, b) => b.weight - a.weight)
        .map(l => {
          const sourceId = (l.source as any).id || l.source;
          const targetId = (l.target as any).id || l.target;
          return sourceId === lastPlayedId ? targetId : sourceId;
        })
        .slice(0, 5); // top 5 associated

    return {
        baseSongId: lastPlayedId,
        suggestions: neighbors.map(id => songs.find(s => s.id === id)).filter(Boolean) as Song[]
    };
  }, [profile, graphData, songs]);


  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-sans">
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Network className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <p className="tracking-widest text-sm text-gray-400">LOADING ENGINE...</p>
        </motion.div>
      </div>
    );
  }

  // Determine top bg gradient
  const [color1, color2] = currentSong ? getColorsForSongId(currentSong.id) : ['#121212', '#121212'];

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col font-sans overflow-hidden">
      
      {/* Top Main Section */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className="w-64 bg-black flex flex-col pt-6 px-2 border-r border-white/5">
           <div className="flex items-center gap-2 px-4 mb-8">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
               <Network className="w-4 h-4 text-white" />
             </div>
             <h1 className="font-bold text-lg tracking-tight">Music Engine</h1>
           </div>

           <nav className="flex flex-col gap-2 px-2">
             <SidebarItem icon={Home} label="Home" active />
             <SidebarItem icon={Search} label="Search" />
             <SidebarItem icon={Library} label="Your Library" />
           </nav>

           <div className="mt-8 px-2 flex flex-col gap-2">
              <SidebarItem icon={PlusSquare} label="Create Playlist" />
              <SidebarItem icon={Heart} label="Liked Songs" />
           </div>

           <div className="mt-auto p-4 opacity-50 text-xs">
             Engine State: Active <br/>
             Nodes: {graphData.nodes.length}
           </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 bg-[#121212] overflow-y-auto relative custom-scrollbar">
           {/* Ambient Gradient Background */}
           <motion.div 
             className="absolute top-0 left-0 right-0 h-80 opacity-40 pointer-events-none"
             animate={{ background: `linear-gradient(to bottom, ${color1}, #121212)` }}
             transition={{ duration: 1 }}
           />

           <div className="relative z-10 p-8 flex flex-col gap-10 min-h-full">
              
              <header className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  {/* Mock Navigation Arrows */}
                  <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center cursor-pointer hover:bg-black/60 transition">&lt;</div>
                  <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center cursor-pointer hover:bg-black/60 transition">&gt;</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold bg-white text-black px-4 py-1.5 rounded-full cursor-pointer hover:scale-105 transition">Explore Premium</span>
                  <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center cursor-pointer hover:scale-105 transition border border-white/20">
                     <span className="text-xs font-bold text-indigo-400">U</span>
                  </div>
                </div>
              </header>

              <h2 className="text-3xl font-bold tracking-tight">Good evening</h2>

              {/* Recommended Top Grid (Like Spotify's daily mix block) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.slice(0, 6).map((song) => (
                   <SmallSongCard 
                      key={song.id} 
                      song={song} 
                      onClick={() => handleAction(song.id, 'play')}
                      isActive={nowPlayingId === song.id}
                   />
                ))}
              </div>

              {/* Dynamic Queue: Because you listened to */}
              {becauseYouListenedTo.suggestions && becauseYouListenedTo.suggestions.length > 0 && (
                <section>
                   <h3 className="text-2xl font-bold tracking-tight mb-4 hover:underline cursor-pointer">
                     Because you listened to {songs.find(s => s.id === becauseYouListenedTo.baseSongId)?.title}
                   </h3>
                   <div className="flex overflow-x-auto gap-6 pb-6 no-scrollbar">
                      {becauseYouListenedTo.suggestions.map(song => (
                        <LargeSongCard 
                           key={song.id} 
                           song={song} 
                           onPlay={() => handleAction(song.id, 'play')}
                        />
                      ))}
                   </div>
                </section>
              )}

              {/* Recently Played */}
              <section>
                 <h3 className="text-2xl font-bold tracking-tight mb-4 hover:underline cursor-pointer">
                   Recently Played
                 </h3>
                 <div className="flex overflow-x-auto gap-6 pb-6 no-scrollbar">
                    {profile?.history.slice(0, 8).map((id, index) => {
                      const song = songs.find(s => s.id === id);
                      if (!song) return null;
                      // Use a unique key by appending index since history can have duplicates
                      return (
                        <LargeSongCard 
                           key={`${song.id}-${index}`} 
                           song={song} 
                           onPlay={() => handleAction(song.id, 'play')}
                        />
                      )
                    })}
                 </div>
              </section>

           </div>
        </main>

        {/* Right Panel: Engine Topology Graph */}
        <aside className="w-[320px] bg-[#121212] border-l border-white/5 flex flex-col">
           <div className="p-4 border-b border-white/5 bg-[#181818]/50">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Network className="w-4 h-4 text-indigo-400" />
                Network Topology
              </h3>
              <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                Real-time visualization of how the recommendation engine maps user preferences.
              </p>
           </div>
           <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              <TopologyGraph 
                graphData={graphData} 
                songs={songs}
                activeNodeId={nowPlayingId} 
                onNodeClick={(id) => handleAction(id, 'play')}
              />
           </div>
        </aside>

      </div>

      {/* Bottom Player Bar */}
      <PlayerBar 
        song={currentSong} 
        isPlaying={isPlaying} 
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onSkip={() => currentSong && handleAction(currentSong.id, 'skip')}
        isLiked={currentSong ? likedSongs.has(currentSong.id) : false}
        onToggleLike={() => currentSong && handleAction(currentSong.id, 'like')}
      />

    </div>
  );
}

// --- Components ---

function SidebarItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded cursor-pointer transition-colors ${active ? 'text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
      <Icon className="w-6 h-6" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

function SmallSongCard({ song, onClick, isActive }: { song: Song, onClick: () => void, isActive: boolean }) {
  const [c1, c2] = getColorsForSongId(song.id);
  
  return (
    <div 
      onClick={onClick}
      className="group bg-white/5 hover:bg-white/20 transition-colors rounded-md h-20 flex items-center cursor-pointer overflow-hidden relative"
    >
      <div 
        className="w-20 h-20 flex-shrink-0 flex items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
      >
        <span className="font-bold text-white/50 italic font-serif text-2xl">{song.title[0]}</span>
      </div>
      <div className="px-4 font-bold text-sm tracking-tight truncate flex-1">
        {song.title}
      </div>
      
      {/* Hover Play Button */}
      <div className={`mr-4 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-black shadow-lg shadow-black/50 opacity-0 ${isActive ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity transform hover:scale-105 active:scale-95`}>
        {isActive ? <div className="w-3 h-3 bg-black rounded-sm animate-pulse" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
      </div>
    </div>
  )
}

function LargeSongCard({ song, onPlay }: { song: Song, onPlay: () => void }) {
  const [c1, c2] = getColorsForSongId(song.id);

  return (
    <div className="w-[180px] flex-shrink-0 bg-[#181818] hover:bg-[#282828] transition-colors p-4 rounded-xl cursor-pointer group relative">
      <div 
        className="w-full aspect-square rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] mb-4 flex items-center justify-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
      >
        <span className="font-bold text-white/30 italic font-serif text-6xl mix-blend-overlay">{song.title[0]}</span>
        
        {/* Play Button Overlay */}
        <button 
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-green-500 text-black flex items-center justify-center shadow-lg shadow-black/50 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all hover:scale-105 hover:bg-green-400 active:scale-95 z-10"
        >
          <Play className="w-6 h-6 ml-1 fill-current" />
        </button>
      </div>
      
      <h4 className="font-bold text-sm truncate mb-1 text-white">{song.title}</h4>
      <p className="text-xs text-gray-400 truncate">{song.artist}</p>
    </div>
  )
}

function PlayerBar({ song, isPlaying, onTogglePlay, onSkip, isLiked, onToggleLike }: { song: Song | null, isPlaying: boolean, onTogglePlay: () => void, onSkip: () => void, isLiked: boolean, onToggleLike: () => void }) {
  if (!song) {
    return <footer className="h-24 bg-[#181818] border-t border-[#282828] fixed bottom-0 w-full z-50 flex items-center px-6"></footer>;
  }

  const [c1, c2] = getColorsForSongId(song.id);

  return (
    <footer className="h-24 bg-[#181818] border-t border-[#282828] flex-shrink-0 z-50 flex items-center justify-between px-6">
      
      {/* Left: Now Playing info */}
      <div className="flex items-center gap-4 w-[30%] min-w-[200px]">
        <div 
          className="w-14 h-14 rounded flex items-center justify-center shadow-md overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          <span className="font-bold text-white/30 font-serif text-2xl">{song.title[0]}</span>
          {/* Subtle spinning vinyl effect when playing */}
          {isPlaying && (
            <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 4, ease: "linear", repeat: Infinity }}
               className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent mix-blend-overlay"
            />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm hover:underline cursor-pointer">{song.title}</span>
          <span className="text-xs text-gray-400 hover:underline cursor-pointer">{song.artist}</span>
        </div>
        <button onClick={onToggleLike} className="ml-4 hover:scale-110 transition-transform">
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-green-500 text-green-500' : 'text-gray-400 hover:text-white'}`} />
        </button>
      </div>

      {/* Center: Controls */}
      <div className="flex flex-col items-center max-w-[40%] w-full gap-2">
         <div className="flex items-center gap-6">
            <button className="text-gray-400 hover:text-white transition">
              <SkipForward className="w-4 h-4 rotate-180" />
            </button>
            <button 
              onClick={onTogglePlay}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition active:scale-95"
            >
              {isPlaying ? <div className="w-3 h-3 bg-black rounded-sm" /> : <Play className="w-4 h-4 ml-1 fill-current" />}
            </button>
            <button onClick={onSkip} className="text-gray-400 hover:text-white transition active:scale-95">
              <SkipForward className="w-4 h-4 text-green-500/80 hover:text-green-400" />
            </button>
         </div>
         {/* Fake progress bar */}
         <div className="flex items-center gap-2 w-full max-w-md text-xs text-gray-400">
           <span>0:00</span>
           <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden group cursor-pointer relative">
              <motion.div 
                className="h-full bg-white group-hover:bg-green-500 relative" 
                initial={{ width: "0%" }}
                animate={{ width: isPlaying ? "80%" : "30%" }} // Just visual simulation
                transition={{ duration: 120, ease: "linear" }}
              />
           </div>
           <span>{Math.floor(song.tempo / 30)}:30</span>
         </div>
      </div>

      {/* Right: Extra controls */}
      <div className="flex items-center justify-end gap-3 w-[30%] text-gray-400">
         <span className="text-[10px] font-mono tracking-widest uppercase py-1 px-2 border border-white/20 rounded bg-white/5">
           {song.genre}
         </span>
         <div className="w-24 h-1 bg-white/20 rounded-full ml-4">
           <div className="w-2/3 h-full bg-white rounded-full"></div>
         </div>
      </div>
    </footer>
  );
}

// --- Graph Visualization (Extracted & Cleaned) ---
function TopologyGraph({ graphData, activeNodeId, onNodeClick, songs }: { graphData: any, activeNodeId: string | null, onNodeClick: (id: string) => void, songs: Song[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (graphData.nodes.length === 0 || !svgRef.current) return;

    const width = 320;
    const height = typeof window !== 'undefined' ? window.innerHeight - 150 : 600;

    // Reset coordinates slightly relative to viewport
    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(graphData.links).id(d => d.id).distance(60))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    simulation.on("tick", () => setTick(t => t + 1));

    return () => simulation.stop();
  }, [graphData]);

  if (graphData.nodes.length === 0) return <div className="text-gray-500 text-xs">Waiting for topology...</div>;

  return (
    <svg 
      ref={svgRef}
      className="w-full h-full cursor-grab active:cursor-grabbing" 
      viewBox={`0 0 320 ${typeof window !== 'undefined' ? window.innerHeight - 150 : 600}`}
    >
      <defs>
        <filter id="node-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Render Links */}
      {graphData.links.map((link: any, i: number) => {
        if (!link.source.x || !link.target.x) return null;
        const isActiveLink = (link.source.id === activeNodeId || link.target.id === activeNodeId);
        
        return (
          <motion.line
            key={`link-${i}`}
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke={isActiveLink ? "#22c55e" : "#ffffff"}
            strokeOpacity={isActiveLink ? 0.6 : 0.05 + (link.weight / 15)}
            strokeWidth={isActiveLink ? 2 : 0.5 + (link.weight / 5)}
          />
        );
      })}

      {/* Render Nodes */}
      {graphData.nodes.map((node: any) => {
        if (!node.x || !node.y) return null;
        const isActive = activeNodeId === node.id;
        // Check if there's a strong association with the active node
        const isNeighbor = graphData.links.some((l: any) => 
           (l.source.id === activeNodeId && l.target.id === node.id) || 
           (l.target.id === activeNodeId && l.source.id === node.id)
        );

        return (
          <g 
            key={node.id} 
            onClick={() => onNodeClick(node.id)}
            className="cursor-pointer group"
          >
            <circle
              r={isActive ? 8 : (isNeighbor ? 5 : 3)}
              fill={isActive ? "#22c55e" : (isNeighbor ? "#86efac" : "#404040")}
              cx={node.x}
              cy={node.y}
              className="transition-all duration-300 group-hover:scale-150"
              filter={isActive ? "url(#node-glow)" : ""}
              stroke={isActive ? "#16a34a" : "none"}
              strokeWidth="2"
            />
            {/* Show title only on active or neighbors, or hover */}
            {(isActive || isNeighbor) && (
              <text
                x={node.x + 12}
                y={node.y + 4}
                className={`text-[10px] font-medium pointer-events-none ${isActive ? 'fill-white font-bold' : 'fill-gray-400'}`}
              >
                {node.title}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
