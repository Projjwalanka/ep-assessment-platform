package com.examdesk.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** One paper assigned to one candidate, and after submission its evaluation snapshot. */
@Entity
@Table(name = "exams", indexes = {@Index(columnList = "candidateEpNo"), @Index(columnList = "evaluatorEmpNo"), @Index(columnList = "status")})
@Getter @Setter @NoArgsConstructor
public class Exam {
    public static final String ASSIGNED = "ASSIGNED", IN_PROGRESS = "IN_PROGRESS", SUBMITTED = "SUBMITTED", REVIEWED = "REVIEWED";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String candidateEpNo;
    private String evaluatorEmpNo;
    private String assignedBy;
    private Long setId;
    private String technology = "JAVA";
    private String band;
    @Convert(converter = JsonConverters.LongList.class)
    @Column(length = 8000)
    private List<Long> questionIds = new ArrayList<>();
    @Convert(converter = JsonConverters.LongList.class)
    @Column(length = 2000)
    private List<Long> codingIds = new ArrayList<>();
    private Integer durationMinutes;
    private String status = ASSIGNED;
    private Instant assignedAt = Instant.now();
    private Instant startedAt;
    private Instant deadline;
    private Instant submittedAt;
    private Instant lastSavedAt;

    @Convert(converter = JsonConverters.IntMap.class)
    @Column(length = 20000)
    private Map<String, Integer> answers = new HashMap<>();
    @Convert(converter = JsonConverters.StringMap.class)
    @Column(length = 200000)
    private Map<String, String> code = new HashMap<>();
    @Convert(converter = JsonConverters.LongList.class)
    @Column(length = 8000)
    private List<Long> flagged = new ArrayList<>();
    private int tabSwitches;
    private boolean autoSubmitted;

    private Double mcqScore;
    private Double codingScore;
    private Double totalScore;
    private Integer recommendationScore;
    private String recommendation;
    @Lob
    private String reportJson;

    private String reviewDecision;
    @Column(length = 4000)
    private String reviewNotes;
    private String reviewedBy;
    private Instant reviewedAt;

    public boolean isFinal() { return SUBMITTED.equals(status) || REVIEWED.equals(status); }
}
