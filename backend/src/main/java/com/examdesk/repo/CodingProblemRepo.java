package com.examdesk.repo;

import com.examdesk.model.CodingProblem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodingProblemRepo extends JpaRepository<CodingProblem, Long> {
}
