package com.examdesk.repo;

import com.examdesk.model.Exam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface ExamRepo extends JpaRepository<Exam, Long> {
    List<Exam> findByCandidateEpNoOrderByAssignedAtDesc(String epNo);
    List<Exam> findByEvaluatorEmpNoOrderByAssignedAtDesc(String empNo);
    List<Exam> findAllByOrderByAssignedAtDesc();
    List<Exam> findByStatusAndDeadlineBefore(String status, Instant cutoff);
}
