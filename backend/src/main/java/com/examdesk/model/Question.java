package com.examdesk.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "questions", indexes = {@Index(columnList = "band"), @Index(columnList = "topic")})
@Getter @Setter @NoArgsConstructor
public class Question {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String technology = "JAVA";
    private String topic;
    private String band;
    private String difficulty = "MEDIUM";
    @Column(length = 4000)
    private String text;
    @Convert(converter = JsonConverters.StringList.class)
    @Column(length = 8000)
    private List<String> options = new ArrayList<>();
    private int correctIndex;
    @Column(length = 4000)
    private String explanation;
    /** SEED, ADMIN, EVALUATOR, IMPORT */
    private String source = "ADMIN";
    private String createdBy;
    /** true = part of the master bank; false = evaluator's private question */
    private boolean master = true;
    private boolean active = true;
    private Instant createdAt = Instant.now();
}
