package com.examdesk.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "evaluators")
@Getter @Setter @NoArgsConstructor
public class Evaluator {
    /** Employee number is the evaluator's primary key. */
    @Id @Column(length = 40)
    private String empNo;
    private String name;
    private String email;
    private String department;
    @JsonIgnore
    private String passwordHash;
    private boolean active = true;
    private Instant createdAt = Instant.now();
}
