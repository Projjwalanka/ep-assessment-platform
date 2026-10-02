package com.examdesk.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "coding_problems")
@Getter @Setter @NoArgsConstructor
public class CodingProblem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String technology = "JAVA";
    private String band;
    private String difficulty = "MEDIUM";
    private String topic;
    @Column(length = 20000)
    private String description;
    @Column(length = 50000)
    private String starterCode;
    @Column(length = 50000)
    private String referenceSolution;
    @Convert(converter = JsonConverters.TestCaseList.class)
    @Column(length = 50000)
    private List<TestCase> testCases = new ArrayList<>();
    private Integer suggestedMinutes = 20;
    /** true = admin-defined library problem; false = evaluator's own */
    private boolean predefined = true;
    private String ownerEmpNo;
    private boolean active = true;
    private Instant createdAt = Instant.now();
}
