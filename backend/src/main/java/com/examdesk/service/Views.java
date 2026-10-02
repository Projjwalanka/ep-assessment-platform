package com.examdesk.service;

import com.examdesk.model.Candidate;
import com.examdesk.model.Evaluator;
import com.examdesk.model.Exam;
import com.examdesk.repo.CandidateRepo;
import com.examdesk.repo.EvaluatorRepo;
import com.examdesk.util.Maps;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Builds list/summary DTOs, resolving candidate and evaluator names in bulk. */
@Component
@RequiredArgsConstructor
public class Views {
    private final CandidateRepo candidates;
    private final EvaluatorRepo evaluators;

    public Map<String, String> candidateNames() {
        return candidates.findAll().stream().collect(Collectors.toMap(Candidate::getEpNo, c -> Objects.toString(c.getName(), c.getEpNo())));
    }

    public Map<String, String> evaluatorNames() {
        return evaluators.findAll().stream().collect(Collectors.toMap(Evaluator::getEmpNo, e -> Objects.toString(e.getName(), e.getEmpNo())));
    }

    public List<Map<String, Object>> exams(List<Exam> list) {
        Map<String, String> cn = candidateNames(), en = evaluatorNames();
        return list.stream().map(e -> exam(e, cn, en)).toList();
    }

    public Map<String, Object> exam(Exam e) { return exam(e, candidateNames(), evaluatorNames()); }

    public Map<String, Object> exam(Exam e, Map<String, String> cn, Map<String, String> en) {
        return Maps.of("id", e.getId(), "title", e.getTitle(), "candidateEpNo", e.getCandidateEpNo(),
                "candidateName", cn.getOrDefault(e.getCandidateEpNo(), e.getCandidateEpNo()),
                "evaluatorEmpNo", e.getEvaluatorEmpNo(),
                "evaluatorName", e.getEvaluatorEmpNo() == null ? null : en.getOrDefault(e.getEvaluatorEmpNo(), e.getEvaluatorEmpNo()),
                "technology", e.getTechnology(), "band", e.getBand(), "status", e.getStatus(),
                "questionCount", size(e.getQuestionIds()), "codingCount", size(e.getCodingIds()),
                "durationMinutes", e.getDurationMinutes(), "assignedAt", e.getAssignedAt(), "startedAt", e.getStartedAt(),
                "submittedAt", e.getSubmittedAt(), "mcqScore", e.getMcqScore(), "codingScore", e.getCodingScore(),
                "totalScore", e.getTotalScore(), "recommendationScore", e.getRecommendationScore(),
                "recommendation", e.getRecommendation(), "reviewDecision", e.getReviewDecision(),
                "reviewedBy", e.getReviewedBy(), "setId", e.getSetId(), "assignedBy", e.getAssignedBy(),
                "autoSubmitted", e.isAutoSubmitted(), "tabSwitches", e.getTabSwitches());
    }

    /** Candidate-facing: no scores or recommendation. */
    public Map<String, Object> examForCandidate(Exam e) {
        return Maps.of("id", e.getId(), "title", e.getTitle(), "band", e.getBand(), "status", e.getStatus(),
                "questionCount", size(e.getQuestionIds()), "codingCount", size(e.getCodingIds()),
                "durationMinutes", e.getDurationMinutes(), "assignedAt", e.getAssignedAt(),
                "startedAt", e.getStartedAt(), "deadline", e.getDeadline(), "submittedAt", e.getSubmittedAt());
    }

    public Map<String, Object> candidate(Candidate c, Map<String, String> en, List<Exam> exams, boolean withCode) {
        Map<String, Object> m = Maps.of("epNo", c.getEpNo(), "name", c.getName(), "email", c.getEmail(), "phone", c.getPhone(),
                "totalExperience", c.getTotalExperience(), "band", c.getBand(), "currentCompany", c.getCurrentCompany(),
                "currentRole", c.getCurrentRole(), "primarySkills", c.getPrimarySkills(), "noticePeriod", c.getNoticePeriod(),
                "location", c.getLocation(), "education", c.getEducation(), "summary", c.getSummary(),
                "evaluatorEmpNo", c.getEvaluatorEmpNo(),
                "evaluatorName", c.getEvaluatorEmpNo() == null ? null : en.get(c.getEvaluatorEmpNo()),
                "profileCompleted", c.isProfileCompleted(), "active", c.isActive(), "createdAt", c.getCreatedAt());
        if (withCode) m.put("accessCode", c.getAccessCode());
        if (exams != null) {
            Exam latest = exams.stream().max(Comparator.comparing(Exam::getAssignedAt)).orElse(null);
            Exam scored = exams.stream().filter(x -> x.getRecommendationScore() != null)
                    .max(Comparator.comparing(x -> x.getSubmittedAt() == null ? x.getAssignedAt() : x.getSubmittedAt())).orElse(null);
            m.put("examCount", exams.size());
            m.put("latestStatus", latest == null ? null : latest.getStatus());
            m.put("latestExamId", latest == null ? null : latest.getId());
            m.put("latestScore", scored == null ? null : scored.getTotalScore());
            m.put("latestRecommendationScore", scored == null ? null : scored.getRecommendationScore());
            m.put("latestRecommendation", scored == null ? null : scored.getRecommendation());
            m.put("latestReportId", scored == null ? null : scored.getId());
            m.put("latestDecision", scored == null ? null : scored.getReviewDecision());
        }
        return m;
    }

    public static <T, K> Map<K, List<T>> group(List<T> list, Function<T, K> key) {
        Map<K, List<T>> m = new HashMap<>();
        for (T t : list) { K k = key.apply(t); if (k != null) m.computeIfAbsent(k, x -> new ArrayList<>()).add(t); }
        return m;
    }

    private static int size(List<?> l) { return l == null ? 0 : l.size(); }
}
