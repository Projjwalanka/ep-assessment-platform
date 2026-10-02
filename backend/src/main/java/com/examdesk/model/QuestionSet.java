package com.examdesk.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** A reusable paper template (MCQs + hands-on + timing). */
@Entity
@Table(name = "question_sets")
@Getter @Setter @NoArgsConstructor
public class QuestionSet {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    @Column(length = 2000)
    private String description;
    private String technology = "JAVA";
    private String band;
    @Convert(converter = JsonConverters.LongList.class)
    @Column(length = 8000)
    private List<Long> questionIds = new ArrayList<>();
    @Convert(converter = JsonConverters.LongList.class)
    @Column(length = 2000)
    private List<Long> codingIds = new ArrayList<>();
    /** null or 0 = untimed */
    private Integer durationMinutes;
    private boolean adminDefined;
    private String ownerEmpNo;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
}
