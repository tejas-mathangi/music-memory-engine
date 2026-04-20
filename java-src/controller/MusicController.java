package com.musicengine.controller;

import com.musicengine.domain.Song;
import com.musicengine.domain.User;
import com.musicengine.service.RecommendationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class MusicController {
    private final RecommendationService recommendationService;
    // Simple in-memory storage for demo
    private final User currentUser = new User(); 

    public MusicController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
        this.currentUser.setId("user-1");
    }

    @PostMapping("/play")
    public String playSong(@RequestParam String songId, @RequestParam(defaultValue = "false") boolean isReplay) {
        currentUser.addPlay(songId, isReplay);
        return "Song played recorded";
    }

    @PostMapping("/skip")
    public String skipSong(@RequestParam String songId) {
        currentUser.addSkip(songId);
        return "Song skip recorded";
    }

    @GetMapping("/recommendations")
    public List<Song> getRecommendations(@RequestParam(defaultValue = "5") int limit) {
        return recommendationService.getRecommendations(currentUser, limit);
    }
}
