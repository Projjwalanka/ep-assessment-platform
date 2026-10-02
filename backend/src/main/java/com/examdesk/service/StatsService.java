package com.examdesk.service;

import com.examdesk.model.*;
import com.examdesk.repo.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

import static com.examdesk.util.Maps.of;
import static com.examdesk.util.Maps.round1;

/** Dashboard aggregates. Data volumes are small (hundreds of rows), so this aggregates in memory. */
@Service
@RequiredArgsConstructor
public class StatsService {
    private static final List<String> LABELS = List.of("Strongly recommend", "Recommend", "Consider for next round", "Not recommended");
    private static final DateTimeFormatter WEEK = DateTimeFormatter.ofPattern("d MMM");

    private final ExamRepo exams;
    private final CandidateRepo candidates;
    private final EvaluatorRepo evaluators;
    private final QuestionRepo questions;
    private final QuestionSetRepo sets;
    private final CodingProblemRepo problems;
    private final Views views;
    private final ObjectMapper mapper;

    public Map<String, Object> admin() {
        List<Exam> all = exams.findAllByOrderByAssignedAtDesc();
        List<Exam> done = all.stream().filter(Exam::isFinal).toList();
        List<Candidate> cands = candidates.findAll();
        List<Question> qs = questions.findAll().stream().filter(q -> q.isActive() && q.isMaster()).toList();

        Map<String, Map<String, Integer>> matrix = new TreeMap<>();
        for (Question q : qs) matrix.computeIfAbsent(q.getTopic(), k -> new LinkedHashMap<>()).merge(q.getBand(), 1, Integer::sum);
        List<Map<String, Object>> questionMatrix = matrix.entrySet().stream().map(e -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("topic", e.getKey());
            int total = 0;
            for (String b : com.examdesk.util.Bands.ALL) { int n = e.getValue().getOrDefault(b, 0); row.put(b, n); total += n; }
            row.put("total", total);
            return row;
        }).toList();

        LocalDate thisWeek = LocalDate.now(ZoneOffset.UTC).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            LocalDate start = thisWeek.minusWeeks(i);
            Instant from = start.atStartOfDay().toInstant(ZoneOffset.UTC), to = start.plusWeeks(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            List<Exam> wk = done.stream().filter(e -> e.getSubmittedAt() != null && !e.getSubmittedAt().isBefore(from) && e.getSubmittedAt().isBefore(to)).toList();
            trend.add(of("week", WEEK.format(start), "exams", wk.size(), "avgScore", avg(wk)));
        }

        Map<String, List<Candidate>> byEval = Views.group(cands, Candidate::getEvaluatorEmpNo);
        List<Map<String, Object>> load = evaluators.findAll().stream().filter(Evaluator::isActive).map(ev -> {
            List<Exam> mine = all.stream().filter(x -> ev.getEmpNo().equals(x.getEvaluatorEmpNo())).toList();
            return of("empNo", ev.getEmpNo(), "name", ev.getName(),
                    "candidates", byEval.getOrDefault(ev.getEmpNo(), List.of()).size(),
                    "pending", mine.stream().filter(x -> !x.isFinal()).count(),
                    "toReview", mine.stream().filter(x -> Exam.SUBMITTED.equals(x.getStatus())).count(),
                    "reviewed", mine.stream().filter(x -> Exam.REVIEWED.equals(x.getStatus())).count());
        }).toList();

        int[] buckets = new int[5];
        for (Exam e : done) if (e.getTotalScore() != null) buckets[Math.min(4, (int) (e.getTotalScore() / 20))]++;
        List<Map<String, Object>> scoreBuckets = new ArrayList<>();
        for (int i = 0; i < 5; i++) scoreBuckets.add(of("range", (i * 20) + "–" + (i == 4 ? 100 : i * 20 + 19), "count", buckets[i]));

        Map<String, Object> counts = of(
                "questions", qs.size(), "sets", sets.findAll().stream().filter(QuestionSet::isAdminDefined).count(),
                "codingProblems", problems.findAll().stream().filter(CodingProblem::isActive).count(),
                "candidates", cands.size(), "evaluators", evaluators.count(),
                "unmapped", cands.stream().filter(c -> c.getEvaluatorEmpNo() == null && c.isActive()).count(),
                "exams", all.size(), "pending", all.stream().filter(e -> !e.isFinal()).count(),
                "awaitingReview", all.stream().filter(e -> Exam.SUBMITTED.equals(e.getStatus())).count(),
                "reviewed", all.stream().filter(e -> Exam.REVIEWED.equals(e.getStatus())).count(),
                "avgScore", avg(done));

        return of("counts", counts, "questionMatrix", questionMatrix, "recommendationDist", recDist(done),
                "decisionDist", decisionDist(done), "trend", trend, "evaluatorLoad", load, "scoreBuckets", scoreBuckets,
                "bandPerformance", bandPerformance(done),
                "recent", views.exams(done.stream().sorted(Comparator.comparing(Exam::getSubmittedAt).reversed()).limit(8).toList()));
    }

    public Map<String, Object> evaluator(String empNo) {
        List<Candidate> mine = candidates.findByEvaluatorEmpNo(empNo);
        Set<String> eps = mine.stream().map(Candidate::getEpNo).collect(Collectors.toSet());
        List<Exam> list = exams.findAllByOrderByAssignedAtDesc().stream()
                .filter(e -> empNo.equals(e.getEvaluatorEmpNo()) || eps.contains(e.getCandidateEpNo())).toList();
        List<Exam> done = list.stream().filter(Exam::isFinal).toList();

        Map<String, String> names = views.candidateNames();
        Map<String, Exam> latest = new LinkedHashMap<>();
        done.stream().sorted(Comparator.comparing(Exam::getSubmittedAt)).forEach(e -> latest.put(e.getCandidateEpNo(), e));
        List<Map<String, Object>> candidateScores = latest.values().stream()
                .map(e -> of("epNo", e.getCandidateEpNo(), "name", names.getOrDefault(e.getCandidateEpNo(), e.getCandidateEpNo()),
                        "overall", e.getTotalScore(), "mcq", e.getMcqScore(), "coding", e.getCodingScore(),
                        "recommendationScore", e.getRecommendationScore(), "examId", e.getId()))
                .sorted(Comparator.comparing(m -> -((Number) m.get("recommendationScore")).doubleValue())).toList();

        Map<String, double[]> topic = new TreeMap<>();
        for (Exam e : done) {
            if (e.getReportJson() == null) continue;
            try {
                for (JsonNode t : mapper.readTree(e.getReportJson()).path("topics")) {
                    double[] acc = topic.computeIfAbsent(t.path("topic").asText(), k -> new double[2]);
                    acc[0] += t.path("correct").asDouble();
                    acc[1] += t.path("total").asDouble();
                }
            } catch (Exception ignored) { }
        }
        List<Map<String, Object>> topicAverages = topic.entrySet().stream().filter(x -> x.getValue()[1] > 0)
                .map(x -> of("topic", x.getKey(), "percent", round1(100 * x.getValue()[0] / x.getValue()[1]))).toList();

        Map<String, Object> counts = of("candidates", mine.size(),
                "notAssigned", mine.stream().filter(c -> list.stream().noneMatch(e -> e.getCandidateEpNo().equals(c.getEpNo()))).count(),
                "pending", list.stream().filter(e -> !e.isFinal()).count(),
                "toReview", list.stream().filter(e -> Exam.SUBMITTED.equals(e.getStatus())).count(),
                "reviewed", list.stream().filter(e -> Exam.REVIEWED.equals(e.getStatus())).count(),
                "avgScore", avg(done));
        return of("counts", counts, "recommendationDist", recDist(done), "candidateScores", candidateScores,
                "topicAverages", topicAverages, "recent", views.exams(list.stream().limit(8).toList()));
    }

    private List<Map<String, Object>> recDist(List<Exam> done) {
        Map<String, Long> c = done.stream().filter(e -> e.getRecommendation() != null)
                .collect(Collectors.groupingBy(Exam::getRecommendation, Collectors.counting()));
        return LABELS.stream().map(l -> of("label", l, "count", c.getOrDefault(l, 0L))).toList();
    }

    private List<Map<String, Object>> decisionDist(List<Exam> done) {
        Map<String, Long> c = done.stream().collect(Collectors.groupingBy(e -> e.getReviewDecision() == null ? "PENDING" : e.getReviewDecision(), Collectors.counting()));
        return List.of("PROCEED", "HOLD", "REJECT", "PENDING").stream().map(k -> of("decision", k, "count", c.getOrDefault(k, 0L))).toList();
    }

    private List<Map<String, Object>> bandPerformance(List<Exam> done) {
        return com.examdesk.util.Bands.ALL.stream().map(b -> {
            List<Exam> xs = done.stream().filter(e -> b.equals(e.getBand())).toList();
            return of("band", b, "exams", xs.size(), "avgScore", avg(xs),
                    "bar", EvaluationService.BAND_BAR.get(b));
        }).toList();
    }

    private static Double avg(List<Exam> xs) {
        OptionalDouble d = xs.stream().filter(e -> e.getTotalScore() != null).mapToDouble(Exam::getTotalScore).average();
        return d.isPresent() ? round1(d.getAsDouble()) : null;
    }

}
