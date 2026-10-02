package com.examdesk.repo;

import com.examdesk.model.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CandidateRepo extends JpaRepository<Candidate, String> {
    List<Candidate> findByEvaluatorEmpNo(String empNo);
}
