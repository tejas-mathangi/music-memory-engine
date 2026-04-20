package com.musicengine.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Song {
    private String id;
    private String title;
    private String artist;
    private String genre;
    private int tempo;
    private String mood;
}
