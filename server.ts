import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MusicEngine, Song, UserAction } from "./src/engine/MusicEngine.ts";

const engine = new MusicEngine();

// Sample dataset
const sampleSongs: Song[] = [
  { id: "1", title: "Morning Sun", artist: "Aurora", genre: "Pop", tempo: 120, mood: "Happy" },
  { id: "2", title: "Night Drive", artist: "Synthwave Pro", genre: "Electronic", tempo: 105, mood: "Chill" },
  { id: "3", title: "Summer Breeze", artist: "Tropical Vibes", genre: "Pop", tempo: 115, mood: "Happy" },
  { id: "4", title: "Deep Focus", artist: "Lofi Beats", genre: "Chillout", tempo: 85, mood: "Relaxed" },
  { id: "5", title: "Power Up", artist: "Rock On", genre: "Rock", tempo: 140, mood: "Energetic" },
  { id: "6", title: "Rainy Cafe", artist: "Jazz Quartet", genre: "Jazz", tempo: 70, mood: "Relaxed" },
  { id: "7", title: "Midnight City", artist: "M83", genre: "Electronic", tempo: 105, mood: "Energetic" },
  { id: "8", title: "Clarity", artist: "Zedd", genre: "Electronic", tempo: 128, mood: "Happy" },
  { id: "9", title: "Bohemian Rhapsody", artist: "Queen", genre: "Rock", tempo: 72, mood: "Dramatic" },
  { id: "10", title: "Level Up", artist: "Ciara", genre: "Pop", tempo: 135, mood: "Energetic" },
];

sampleSongs.forEach(s => engine.graph.addSong(s));
engine.graph.buildEdges();

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Persistence layer (in-memory for demo)
  const users = new Set(["default-user"]);

  // API Routes
  app.get("/api/songs", (req, res) => {
    res.json(sampleSongs);
  });

  app.post("/api/play", (req, res) => {
    const { userId, songId, type } = req.body;
    const hour = new Date().getHours();
    let timeOfDay: 'morning' | 'afternoon' | 'night' = 'afternoon';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 18 || hour < 5) timeOfDay = 'night';

    const action: UserAction = {
      type: type || 'play',
      songId,
      timestamp: new Date(),
      timeOfDay
    };
    engine.handleAction(userId, action);
    res.json({ success: true, message: `Recorded ${action.type}` });
  });

  app.post("/api/skip", (req, res) => {
    const { userId, songId } = req.body;
    engine.handleAction(userId, { type: 'skip', songId, timestamp: new Date(), timeOfDay: 'afternoon' });
    res.json({ success: true, message: "Recorded skip" });
  });

  app.get("/api/recommendations", (req, res) => {
    const userId = req.query.userId as string || "default-user";
    const recs = engine.getRecommendations(userId);
    res.json(recs);
  });

  app.get("/api/graph", (req, res) => {
    res.json(engine.graph.getGraphData());
  });

  app.get("/api/profile", (req, res) => {
    const userId = req.query.userId as string || "default-user";
    const counts = engine.userPlayCounts.get(userId);
    const window = engine.userWindows.get(userId);
    const skips = engine.userSkips.get(userId);

    res.json({
      playCounts: counts ? Object.fromEntries(counts) : {},
      history: window ? window.items : [],
      skips: skips ? Array.from(skips) : []
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
