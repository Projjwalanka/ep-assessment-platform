package com.examdesk.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "candidates")
@Getter @Setter @NoArgsConstructor
public class Candidate {
    /** EP number is the candidate's primary key. */
    @Id @Column(length = 40)
    private String epNo;
    private String name;
    private String email;
    private String phone;
    private Double totalExperience;
    /** Assessment band; derived from experience when not set explicitly. */
    private String band;
    private String currentCompany;
    private String currentRole;
    @Column(length = 1000)
    private String primarySkills;
    private String noticePeriod;
    private String location;
    private String education;
    @Column(length = 2000)
    private String summary;
    @JsonIgnore
    private String accessCode;
    private String evaluatorEmpNo;
    private boolean profileCompleted;
    private boolean active = true;
    private Instant createdAt = Instant.now();
}
