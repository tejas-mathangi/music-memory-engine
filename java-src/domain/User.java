package com.musicengine.domain;

import lombok.Data;
import java.util.*;

@Data
public class User {
    private String id;
    private Map<String, Integer> playCounts = new HashMap<>(); // HashMap for userId -> Map<songId, count>
    private Set<String> skippedSongs = new HashSet<>();
    private List<String> slidingWindow = new LinkedList<>(); // Sliding Window
    
    private static final int MAX_WINDOW_SIZE = 10;

    public void addPlay(String songId, boolean isReplay) {
        playCounts.put(songId, playCounts.getOrDefault(songId, 0) + (isReplay ? 2 : 1));
        
        slidingWindow.add(songId);
        if (slidingWindow.size() > MAX_WINDOW_SIZE) {
            slidingWindow.remove(0);
        }
        skippedSongs.remove(songId);
    }

    public void addSkip(String songId) {
        skippedSongs.add(songId);
    }
}
