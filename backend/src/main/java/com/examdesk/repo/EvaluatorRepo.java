package com.examdesk.repo;

import com.examdesk.model.Evaluator;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvaluatorRepo extends JpaRepository<Evaluator, String> {
}
