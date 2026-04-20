package com.musicengine.service;

import com.musicengine.domain.Song;
import com.musicengine.domain.User;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Core Algorithm for the Music Memory Engine.
 * 
 * DESIGN RATIONALE:
 * - Uses a PriorityQueue (Max-Heap) to rank scores dynamically O(log N).
 * - Implements a sliding window penalty/boost system.
 * - Leverages the MusicGraph to explore "unseen" songs similar to the user's taste.
 */
@Service
public class RecommendationService {
    private final MusicGraph musicGraph;

    public RecommendationService(MusicGraph musicGraph) {
        this.musicGraph = musicGraph;
    }

    public List<Song> getRecommendations(User user, int limit) {
        // Map to store calculated weights for potential recommendations
        Map<String, Double> scoredCandidates = new HashMap<>();

        // 1. Process Long-Term Taste (Play Counts HashMap)
        user.getPlayCounts().forEach((songId, count) -> {
            // Boost neighbors of frequently played songs
            for (MusicGraph.SimilarityEdge edge : musicGraph.getNeighbors(songId)) {
                double boost = count * edge.weight * 0.5;
                scoredCandidates.merge(edge.targetSongId, boost, Double::sum);
            }
        });

        // 2. Process Short-Term context (Sliding Window)
        // More weight to the most recent items in the sliding window
        int windowIndex = 0;
        for (String recentId : user.getSlidingWindow()) {
            double recencyMultiplier = (windowIndex + 1) / 5.0; // Higher weight for later items
            for (MusicGraph.SimilarityEdge edge : musicGraph.getNeighbors(recentId)) {
                double boost = edge.weight * (2.0 + recencyMultiplier);
                scoredCandidates.merge(edge.targetSongId, boost, Double::sum);
            }
            windowIndex++;
        }

        // 3. Exclude Skips and filter results
        for (String skipId : user.getSkippedSongs()) {
            scoredCandidates.remove(skipId);
        }

        // 4. Rank using PriorityQueue (Max-Heap)
        PriorityQueue<SongScore> rankingQueue = new PriorityQueue<>(
            Comparator.comparingDouble(s -> -s.score)
        );

        scoredCandidates.forEach((id, score) -> {
            // Don't recommend songs already recently played or skipped
            if (!user.getSlidingWindow().contains(id)) {
                rankingQueue.offer(new SongScore(id, score));
            }
        });

        // 5. Final Extraction
        List<Song> finalRecommendations = new ArrayList<>();
        while (!rankingQueue.isEmpty() && finalRecommendations.size() < limit) {
            Song song = musicGraph.getSong(rankingQueue.poll().songId);
            if (song != null) finalRecommendations.add(song);
        }

        return finalRecommendations;
    }

    private static class SongScore {
        String songId;
        double score;
        SongScore(String id, double s) { 
            this.songId = id; 
            this.score = s; 
        }
    }
}
