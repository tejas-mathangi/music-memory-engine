/**
 * Music Memory Engine - Core Logic
 * Implements Graph-based similarity, Priority Queue ranking, and Sliding Window history.
 */

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  tempo: number; // BPM
  mood: string;
}

export interface UserAction {
  type: 'play' | 'skip' | 'replay';
  songId: string;
  timestamp: Date;
  timeOfDay: 'morning' | 'afternoon' | 'night';
}

/**
 * Graph Implementation
 * Nodes are songs, edges are weighted by similarity (genre, tempo, mood)
 */
export class SongGraph {
  nodes: Map<string, Song> = new Map();
  edges: Map<string, Array<{ to: string; weight: number }>> = new Map();

  addSong(song: Song) {
    this.nodes.set(song.id, song);
    this.edges.set(song.id, []);
  }

  calculateSimilarity(s1: Song, s2: Song): number {
    let score = 0;
    if (s1.genre === s2.genre) score += 5;
    if (Math.abs(s1.tempo - s2.tempo) < 10) score += 3;
    if (s1.mood === s2.mood) score += 2;
    return score;
  }

  buildEdges() {
    const songs = Array.from(this.nodes.values());
    for (let i = 0; i < songs.length; i++) {
      for (let j = i + 1; j < songs.length; j++) {
        const weight = this.calculateSimilarity(songs[i], songs[j]);
        if (weight > 0) {
          this.edges.get(songs[i].id)?.push({ to: songs[j].id, weight });
          this.edges.get(songs[j].id)?.push({ to: songs[i].id, weight });
        }
      }
    }
  }

  getSimilarSongs(songId: string): Array<{ id: string; weight: number }> {
    return (this.edges.get(songId) || []).map(e => ({ id: e.to, weight: e.weight }));
  }

  getGraphData() {
    const nodes = Array.from(this.nodes.values()).map(s => ({
      id: s.id,
      title: s.title,
      genre: s.genre
    }));
    
    const links: Array<{ source: string; target: string; weight: number }> = [];
    for (const [from, edgeList] of this.edges.entries()) {
      for (const edge of edgeList) {
        // Avoid duplicate links in undirected graph
        if (from < edge.to) {
          links.push({ source: from, target: edge.to, weight: edge.weight });
        }
      }
    }
    
    return { nodes, links };
  }
}

/**
 * Priority Queue Implementation (Max-Heap)
 * Used to rank recommended songs by score
 */
export class PriorityQueue<T> {
  private heap: Array<{ item: T; priority: number }> = [];

  push(item: T, priority: number) {
    this.heap.push({ item, priority });
    this.bubbleUp();
  }

  pop(): T | undefined {
    if (this.size === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.size > 0) {
      this.heap[0] = last;
      this.bubbleDown();
    }
    return top.item;
  }

  get size() { return this.heap.length; }

  private bubbleUp() {
    let index = this.heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[index].priority <= this.heap[parent].priority) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }
  }

  private bubbleDown() {
    let index = 0;
    while (true) {
      let largest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < this.size && this.heap[left].priority > this.heap[largest].priority) largest = left;
      if (right < this.size && this.heap[right].priority > this.heap[largest].priority) largest = right;
      if (largest === index) break;
      [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
      index = largest;
    }
  }
}

/**
 * Sliding Window Implementation
 * Tracks last N songs to detect recent shifts in taste
 */
export class SlidingWindow<T> {
  private window: T[] = [];
  constructor(private maxSize: number) {}

  add(item: T) {
    this.window.push(item);
    if (this.window.length > this.maxSize) {
      this.window.shift();
    }
  }

  get items() { return [...this.window]; }
}

/**
 * Music Recommendation Engine
 */
export class MusicEngine {
  graph: SongGraph;
  userPlayCounts: Map<string, Map<string, number>> = new Map(); // userId -> Map<songId, count>
  userSkips: Map<string, Set<string>> = new Map(); // userId -> Set<songId>
  userWindows: Map<string, SlidingWindow<string>> = new Map(); // userId -> Window<songId>

  constructor() {
    this.graph = new SongGraph();
  }

  registerUser(userId: string) {
    if (!this.userPlayCounts.has(userId)) {
      this.userPlayCounts.set(userId, new Map());
      this.userSkips.set(userId, new Set());
      this.userWindows.set(userId, new SlidingWindow(10));
    }
  }

  handleAction(userId: string, action: UserAction) {
    this.registerUser(userId);
    const counts = this.userPlayCounts.get(userId)!;
    const window = this.userWindows.get(userId)!;
    const skips = this.userSkips.get(userId)!;

    if (action.type === 'play' || action.type === 'replay') {
      const current = counts.get(action.songId) || 0;
      counts.set(action.songId, current + (action.type === 'replay' ? 2 : 1));
      window.add(action.songId);
      skips.delete(action.songId);
    } else if (action.type === 'skip') {
      skips.add(action.songId);
    }
  }

  getRecommendations(userId: string, limit: number = 5): Song[] {
    this.registerUser(userId);
    const pq = new PriorityQueue<string>();
    const counts = this.userPlayCounts.get(userId)!;
    const skips = this.userSkips.get(userId)!;
    const window = this.userWindows.get(userId)!;
    const recentSongs = window.items;

    const scores = new Map<string, number>();

    // 1. Base scores from play history
    for (const [songId, count] of counts.entries()) {
      scores.set(songId, count * 2);
    }

    // 2. Penalize skips
    for (const songId of skips) {
      scores.set(songId, (scores.get(songId) || 0) - 5);
    }

    // 3. Boost similar to recent songs
    for (const recentId of recentSongs) {
      const similar = this.graph.getSimilarSongs(recentId);
      for (const { id, weight } of similar) {
        const current = scores.get(id) || 0;
        scores.set(id, current + weight);
      }
    }

    // 4. Boost songs frequently played (Engagement)
    for (const [songId, count] of counts.entries()) {
      if (count > 5) {
        scores.set(songId, (scores.get(songId) || 0) + 10);
      }
    }

    // Push all non-skipped songs to PQ
    for (const [songId, score] of scores.entries()) {
      if (!skips.has(songId)) {
        pq.push(songId, score);
      }
    }

    // Fallback: if PQ is too small, push some other songs from graph
    if (pq.size < limit) {
      for (const songId of this.graph.nodes.keys()) {
        if (!scores.has(songId) && !skips.has(songId)) {
          pq.push(songId, 0);
        }
      }
    }

    const recs: Song[] = [];
    const seen = new Set<string>();
    while (recs.length < limit && pq.size > 0) {
      const id = pq.pop()!;
      if (!seen.has(id)) {
        recs.push(this.graph.nodes.get(id)!);
        seen.add(id);
      }
    }

    return recs;
  }
}
