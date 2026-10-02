package com.examdesk.repo;

import com.examdesk.model.QuestionSet;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionSetRepo extends JpaRepository<QuestionSet, Long> {
}
