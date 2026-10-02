package com.examdesk.web;

import com.examdesk.model.Candidate;
import com.examdesk.model.Exam;
import com.examdesk.repo.CandidateRepo;
import com.examdesk.repo.ExamRepo;
import com.examdesk.security.AuthInterceptor;
import com.examdesk.security.Session;
import com.examdesk.service.StatsService;
import com.examdesk.service.Views;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/evaluator")
@RequiredArgsConstructor
public class EvaluatorController {
    private final StatsService stats;
    private final CandidateRepo candidates;
    private final ExamRepo exams;
    private final Views views;

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestAttribute(AuthInterceptor.ATTR) Session s) { return stats.evaluator(s.id()); }

    @GetMapping("/candidates")
    public List<Map<String, Object>> candidates(@RequestAttribute(AuthInterceptor.ATTR) Session s) {
        Map<String, List<Exam>> byCand = Views.group(exams.findAll(), Exam::getCandidateEpNo);
        Map<String, String> en = views.evaluatorNames();
        return candidates.findByEvaluatorEmpNo(s.id()).stream().filter(Candidate::isActive)
                .sorted(Comparator.comparing(Candidate::getEpNo))
                .map(c -> views.candidate(c, en, byCand.getOrDefault(c.getEpNo(), List.of()), false)).toList();
    }
}
