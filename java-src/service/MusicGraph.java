package com.musicengine.service;

import com.musicengine.domain.Song;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Senior Architect Implementation of the Song Similarity Graph.
 * 
 * DESIGN RATIONALE:
 * - Uses an Adjacency List for space efficiency O(V+E).
 * - Implements Metadata-based Similarity calculation during population.
 * - Nodes represent Songs; Edges represent similarity weights [0.0 - 1.0].
 */
@Component
public class MusicGraph {
    private final Map<String, Song> nodes = new HashMap<>();
    private final Map<String, List<SimilarityEdge>> adjacencyList = new HashMap<>();

    /**
     * Populates the graph with a new song and automatically computes edges
     * to existing songs based on metadata heuristics.
     */
    public void addSongAndComputeLinks(Song newSong) {
        nodes.put(newSong.getId(), newSong);
        adjacencyList.putIfAbsent(newSong.getId(), new ArrayList<>());

        // Compute edges to all existing nodes
        for (Song existingSong : nodes.values()) {
            if (existingSong.getId().equals(newSong.getId())) continue;

            double similarity = calculateMetadataSimilarity(newSong, existingSong);
            
            // Only add edges with significant similarity (> 0.3)
            if (similarity > 0.3) {
                addEdge(newSong.getId(), existingSong.getId(), similarity);
            }
        }
    }

    private double calculateMetadataSimilarity(Song s1, Song s2) {
        double score = 0.0;
        
        // 1. Genre Overlap (High weight)
        if (s1.getGenre().equalsIgnoreCase(s2.getGenre())) {
            score += 0.5;
        }
        
        // 2. Artist Similarity (Moderate weight)
        if (s1.getArtist().equalsIgnoreCase(s2.getArtist())) {
            score += 0.3;
        }

        // 3. Tempo Proximity (Mathematical heuristic)
        int tempoDiff = Math.abs(s1.getTempo() - s2.getTempo());
        if (tempoDiff < 10) score += 0.2;
        else if (tempoDiff < 25) score += 0.1;

        return Math.min(1.0, score);
    }

    private void addEdge(String id1, String id2, double weight) {
        adjacencyList.get(id1).add(new SimilarityEdge(id2, weight));
        adjacencyList.computeIfAbsent(id2, k -> new ArrayList<>()).add(new SimilarityEdge(id1, weight));
    }

    public List<SimilarityEdge> getNeighbors(String songId) {
        return adjacencyList.getOrDefault(songId, Collections.emptyList());
    }

    public Song getSong(String id) {
        return nodes.get(id);
    }

    public static class SimilarityEdge {
        public String targetSongId;
        public double weight;

        public SimilarityEdge(String targetSongId, double weight) {
            this.targetSongId = targetSongId;
            this.weight = weight;
        }
    }
}
