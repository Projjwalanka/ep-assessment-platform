package com.examdesk.service;

import com.examdesk.model.Candidate;
import com.examdesk.model.CodingProblem;
import com.examdesk.model.Exam;
import com.examdesk.model.Question;
import com.examdesk.util.Bands;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static com.examdesk.util.Maps.of;
import static com.examdesk.util.Maps.round1;

/**
 * Scores a submitted paper and builds the evaluator report (profile analysis + recommendation score).
 * The report is stored as a JSON snapshot on the exam so later edits to questions never change history.
 */
@Service
@RequiredArgsConstructor
public class EvaluationService {

    public static final Map<String, Integer> BAND_BAR = Map.of("0-5", 55, "6-10", 60, "10-15", 65, "15+", 70);
    private static final Map<String, Integer> WEIGHT = Map.of("EASY", 1, "MEDIUM", 2, "HARD", 3);

    /** Skill keyword -> topic. Checked longest keyword first so "spring boot" wins over "spring". */
    private static final LinkedHashMap<String, String> SKILL_TOPICS = new LinkedHashMap<>();
    static {
        String[][] m = {
                {"spring security", "Security"}, {"spring data", "Spring Data JPA"}, {"spring boot", "Spring Boot"},
                {"system design", "System Design"}, {"design pattern", "Design Patterns"}, {"multithreading", "Concurrency"},
                {"microservice", "Microservices"}, {"concurrency", "Concurrency"}, {"architecture", "System Design"},
                {"hibernate", "Spring Data JPA"}, {"postgres", "SQL & Databases"}, {"rabbitmq", "Messaging"},
                {"collection", "Collections"}, {"messaging", "Messaging"}, {"database", "SQL & Databases"},
                {"security", "Security"}, {"mockito", "Testing"}, {"testing", "Testing"}, {"threads", "Concurrency"},
                {"lambda", "Java 8+"}, {"stream", "Java 8+"}, {"java 8", "Java 8+"}, {"java8", "Java 8+"},
                {"oracle", "SQL & Databases"}, {"mysql", "SQL & Databases"}, {"kafka", "Messaging"}, {"oauth", "Security"},
                {"junit", "Testing"}, {"spring", "Spring Core"}, {"cloud", "Microservices"}, {"docker", "Microservices"},
                {"kubernetes", "Microservices"}, {"rest", "REST APIs"}, {"api", "REST APIs"}, {"jpa", "Spring Data JPA"},
                {"jvm", "JVM Internals"}, {"sql", "SQL & Databases"}, {"jwt", "Security"}, {"jms", "Messaging"},
                {"tdd", "Testing"}, {"gc", "JVM Internals"}, {"java", "Core Java"}};
        Arrays.stream(m).sorted((a, b) -> b[0].length() - a[0].length()).forEach(p -> SKILL_TOPICS.put(p[0], p[1]));
    }

    private final ObjectMapper mapper;

    /** Scores the exam, fills the score columns and reportJson, and returns the report. */
    public Map<String, Object> evaluate(Exam exam, Candidate c, List<Question> questions, List<CodingProblem> problems,
                                        Map<Long, CodeRunner.RunResult> results, int mcqWeight) {
        Map<String, Integer> answers = exam.getAnswers() == null ? Map.of() : exam.getAnswers();

        // ---- MCQ ----
        int correct = 0, attempted = 0, wEarned = 0, wTotal = 0;
        Map<String, int[]> byTopic = new TreeMap<>();
        Map<String, int[]> byDiff = new LinkedHashMap<>();
        for (String d : Bands.DIFFICULTIES) byDiff.put(d, new int[2]);
        List<Map<String, Object>> review = new ArrayList<>();
        for (Question q : questions) {
            Integer sel = answers.get(String.valueOf(q.getId()));
            boolean ok = sel != null && sel == q.getCorrectIndex();
            if (sel != null) attempted++;
            if (ok) correct++;
            int w = WEIGHT.getOrDefault(q.getDifficulty(), 2);
            wTotal += w;
            if (ok) wEarned += w;
            int[] t = byTopic.computeIfAbsent(q.getTopic() == null ? "General" : q.getTopic(), k -> new int[2]);
            t[1]++; if (ok) t[0]++;
            int[] d = byDiff.computeIfAbsent(q.getDifficulty() == null ? "MEDIUM" : q.getDifficulty(), k -> new int[2]);
            d[1]++; if (ok) d[0]++;
            review.add(of("id", q.getId(), "topic", q.getTopic(), "difficulty", q.getDifficulty(), "text", q.getText(),
                    "options", q.getOptions(), "correctIndex", q.getCorrectIndex(), "selectedIndex", sel,
                    "correct", ok, "explanation", q.getExplanation()));
        }
        int total = questions.size();
        double mcqPercent = total == 0 ? 0 : 100.0 * correct / total;
        double weightedPercent = wTotal == 0 ? 0 : 100.0 * wEarned / wTotal;

        // ---- Hands-on ----
        List<Map<String, Object>> coding = new ArrayList<>();
        double codingSum = 0;
        boolean compileFailure = false;
        for (CodingProblem p : problems) {
            CodeRunner.RunResult r = results.get(p.getId());
            String code = exam.getCode() == null ? null : exam.getCode().get(String.valueOf(p.getId()));
            int pTotal = r == null ? (p.getTestCases() == null ? 0 : p.getTestCases().size()) : r.total();
            int pPassed = r == null ? 0 : r.passed();
            double pct = pTotal == 0 ? 0 : 100.0 * pPassed / pTotal;
            codingSum += pct;
            boolean compiled = r != null && r.compiled();
            boolean attemptedCode = code != null && !code.isBlank() && !code.equals(p.getStarterCode());
            if (!compiled && attemptedCode) compileFailure = true;
            List<Map<String, Object>> tests = r == null ? List.of() : r.tests().stream().map(t -> of(
                    "name", t.name(), "hidden", t.hidden(), "passed", t.passed(), "status", t.status(),
                    "actual", t.actual(), "expected", t.expected(), "error", t.error(), "millis", t.millis())).toList();
            coding.add(of("problemId", p.getId(), "title", p.getTitle(), "difficulty", p.getDifficulty(),
                    "topic", p.getTopic(), "passed", pPassed, "total", pTotal, "percent", round1(pct),
                    "compiled", compiled, "attempted", attemptedCode,
                    "compileErrors", r == null ? "Not run" : r.compileErrors(), "code", code, "tests", tests));
        }
        Double codingPercent = problems.isEmpty() ? null : codingSum / problems.size();

        double overall = codingPercent == null ? weightedPercent
                : (weightedPercent * mcqWeight + codingPercent * (100 - mcqWeight)) / 100.0;
        if (total == 0 && codingPercent != null) overall = codingPercent;

        // ---- Profile analysis ----
        List<Map<String, Object>> topics = byTopic.entrySet().stream().map(e -> of("topic", e.getKey(),
                "correct", e.getValue()[0], "total", e.getValue()[1],
                "percent", round1(100.0 * e.getValue()[0] / e.getValue()[1]))).toList();
        List<Map<String, Object>> difficulty = byDiff.entrySet().stream().filter(e -> e.getValue()[1] > 0)
                .map(e -> of("difficulty", e.getKey(), "correct", e.getValue()[0], "total", e.getValue()[1],
                        "percent", round1(100.0 * e.getValue()[0] / e.getValue()[1]))).toList();
        List<String> strengths = topics.stream().filter(t -> (int) t.get("total") >= 2 && (double) t.get("percent") >= 75)
                .sorted(Comparator.comparingDouble((Map<String, Object> t) -> -(double) t.get("percent")))
                .map(t -> (String) t.get("topic")).toList();
        List<String> improvements = topics.stream().filter(t -> (double) t.get("percent") < 50)
                .sorted(Comparator.comparingDouble(t -> (double) t.get("percent")))
                .map(t -> (String) t.get("topic")).toList();

        // skill claims
        Map<String, Double> topicPct = new HashMap<>();
        topics.forEach(t -> topicPct.put((String) t.get("topic"), (double) t.get("percent")));
        List<Map<String, Object>> claims = new ArrayList<>();
        double claimSum = 0; int claimN = 0;
        Set<String> seen = new HashSet<>();
        for (String skill : splitSkills(c.getPrimarySkills())) {
            String topic = topicFor(skill);
            if (topic == null || !seen.add(skill.toLowerCase(Locale.ROOT))) continue;
            Double pct = topicPct.get(topic);
            String verdict;
            if (pct == null) verdict = "Not assessed";
            else {
                verdict = pct >= 60 ? "Validated" : pct >= 40 ? "Partly shown" : "Not demonstrated";
                claimSum += pct >= 60 ? 100 : pct >= 40 ? 60 : 20;
                claimN++;
            }
            claims.add(of("skill", skill, "topic", topic, "percent", pct == null ? null : round1(pct), "verdict", verdict));
        }
        double consistency = claimN == 0 ? overall : claimSum / claimN;
        int answeredItems = attempted + (int) coding.stream().filter(x -> (boolean) x.get("attempted")).count();
        int items = total + problems.size();
        double completion = items == 0 ? 0 : 100.0 * answeredItems / items;

        double rec = 0.85 * overall + 0.10 * consistency + 0.05 * completion;
        if (exam.getTabSwitches() > 5) rec -= 5;
        int recommendationScore = (int) Math.round(Math.max(0, Math.min(100, rec)));
        String[] label = label(recommendationScore);

        // experience fit
        String band = exam.getBand() == null ? Bands.fromYears(c.getTotalExperience()) : exam.getBand();
        int bar = BAND_BAR.getOrDefault(band, 60);
        double diff = overall - bar;
        String fit = diff >= 15 ? "Well above the bar" : diff >= 0 ? "Meets the bar" : diff >= -15 ? "Slightly below the bar" : "Below the bar";
        String declaredBand = Bands.fromYears(c.getTotalExperience());

        // time
        Long taken = exam.getStartedAt() == null || exam.getSubmittedAt() == null ? null
                : Duration.between(exam.getStartedAt(), exam.getSubmittedAt()).getSeconds();
        Integer dur = exam.getDurationMinutes();
        Double timeUsed = taken == null || dur == null || dur <= 0 ? null : Math.min(100.0, 100.0 * taken / (dur * 60.0));
        String timeEfficiency = timeUsed == null ? (taken == null ? "Not recorded" : "Untimed paper, finished in " + mins(taken))
                : "Used " + Math.round(timeUsed) + "% of the allotted time (" + mins(taken) + " of " + dur + " min)";

        // flags
        List<Map<String, Object>> flags = new ArrayList<>();
        if (exam.getTabSwitches() > 3) flags.add(of("level", exam.getTabSwitches() > 5 ? "high" : "medium",
                "text", "Left the exam window " + exam.getTabSwitches() + " times"));
        if (exam.isAutoSubmitted()) flags.add(of("level", "medium", "text", "Paper was auto-submitted when time ran out"));
        if (total > 0 && (total - attempted) > 0.2 * total) flags.add(of("level", "medium",
                "text", (total - attempted) + " of " + total + " questions were left unanswered"));
        long unvalidated = claims.stream().filter(x -> "Not demonstrated".equals(x.get("verdict"))).count();
        if (unvalidated > 0) flags.add(of("level", "medium", "text", unvalidated + " claimed skill" + (unvalidated > 1 ? "s were" : " was") + " not demonstrated in the test"));
        if (compileFailure) flags.add(of("level", "low", "text", "Hands-on code did not compile at submission"));
        if (timeUsed != null && timeUsed < 35 && mcqPercent < 45 && total >= 5) flags.add(of("level", "high",
                "text", "Finished very quickly with a low score, which may indicate guessing"));
        if (declaredBand != null && band != null && !declaredBand.equals(band)) flags.add(of("level", "low",
                "text", "Declared experience (" + fmtYears(c.getTotalExperience()) + ") falls in the " + declaredBand + " band but the paper was set for " + band));

        String summary = summary(c, overall, mcqPercent, codingPercent, band, bar, strengths, improvements, label[0]);

        Map<String, Object> report = of(
                "generatedAt", Instant.now().toString(),
                "candidate", of("epNo", c.getEpNo(), "name", c.getName(), "email", c.getEmail(), "phone", c.getPhone(),
                        "totalExperience", c.getTotalExperience(), "currentCompany", c.getCurrentCompany(),
                        "currentRole", c.getCurrentRole(), "primarySkills", c.getPrimarySkills(), "location", c.getLocation(),
                        "noticePeriod", c.getNoticePeriod(), "education", c.getEducation(), "summary", c.getSummary()),
                "exam", of("id", exam.getId(), "title", exam.getTitle(), "band", band, "technology", exam.getTechnology(),
                        "durationMinutes", dur, "startedAt", str(exam.getStartedAt()), "submittedAt", str(exam.getSubmittedAt()),
                        "timeTakenSeconds", taken, "autoSubmitted", exam.isAutoSubmitted(), "tabSwitches", exam.getTabSwitches(),
                        "mcqWeight", codingPercent == null ? 100 : mcqWeight),
                "scores", of("mcqPercent", round1(mcqPercent), "mcqCorrect", correct, "mcqTotal", total,
                        "mcqAttempted", attempted, "weightedPercent", round1(weightedPercent),
                        "codingPercent", codingPercent == null ? null : round1(codingPercent),
                        "overallPercent", round1(overall), "recommendationScore", recommendationScore,
                        "recommendation", label[0], "recommendationLevel", label[1],
                        "components", of("performance", round1(overall), "skillConsistency", round1(consistency),
                                "completion", round1(completion), "integrityPenalty", exam.getTabSwitches() > 5 ? 5 : 0)),
                "topics", topics,
                "difficulty", difficulty,
                "coding", coding,
                "analysis", of("summary", summary, "strengths", strengths, "improvements", improvements, "flags", flags,
                        "skillClaims", claims,
                        "experienceFit", of("band", band, "declaredBand", declaredBand, "bar", bar,
                                "overall", round1(overall), "verdict", fit),
                        "timeEfficiency", of("text", timeEfficiency, "percentUsed", timeUsed == null ? null : round1(timeUsed))),
                "questions", review);

        exam.setMcqScore(round1(mcqPercent));
        exam.setCodingScore(codingPercent == null ? null : round1(codingPercent));
        exam.setTotalScore(round1(overall));
        exam.setRecommendationScore(recommendationScore);
        exam.setRecommendation(label[0]);
        try { exam.setReportJson(mapper.writeValueAsString(report)); }
        catch (Exception e) { throw new IllegalStateException("Could not store report", e); }
        return report;
    }

    public static String[] label(int score) {
        if (score >= 80) return new String[]{"Strongly recommend", "strong"};
        if (score >= 65) return new String[]{"Recommend", "good"};
        if (score >= 50) return new String[]{"Consider for next round", "maybe"};
        return new String[]{"Not recommended", "no"};
    }

    static List<String> splitSkills(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split("[,;/|\\n]+")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    static String topicFor(String skill) {
        String s = " " + skill.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9+ ]", " ") + " ";
        for (Map.Entry<String, String> e : SKILL_TOPICS.entrySet()) {
            String k = e.getKey();
            boolean hit = k.length() <= 4 ? s.matches(".*\\b" + k.replace("+", "\\+") + "\\b.*") : s.contains(k);
            if (hit) return e.getValue();
        }
        return null;
    }

    private static String summary(Candidate c, double overall, double mcq, Double coding, String band, int bar,
                                  List<String> strengths, List<String> improvements, String label) {
        StringBuilder sb = new StringBuilder();
        sb.append(c.getName() == null ? c.getEpNo() : c.getName()).append(" scored ").append(Math.round(round1(overall))).append("% overall (")
                .append(Math.round(round1(mcq))).append("% on MCQs");
        if (coding != null) sb.append(", ").append(Math.round(round1(coding))).append("% on hands-on");
        sb.append(") against a ").append(bar).append("% bar for the ").append(band).append(" years band. ");
        if (!strengths.isEmpty()) sb.append("Strongest in ").append(join(strengths.subList(0, Math.min(3, strengths.size())))).append(". ");
        if (!improvements.isEmpty()) sb.append("Needs work in ").append(join(improvements.subList(0, Math.min(3, improvements.size())))).append(". ");
        sb.append("Recommendation: ").append(label.toLowerCase(Locale.ROOT)).append('.');
        return sb.toString();
    }

    private static String join(List<String> xs) {
        if (xs.size() <= 1) return String.join("", xs);
        return String.join(", ", xs.subList(0, xs.size() - 1)) + " and " + xs.get(xs.size() - 1);
    }

    private static String mins(long seconds) { return Math.max(1, Math.round(seconds / 60.0)) + " min"; }

    private static String fmtYears(Double y) {
        if (y == null) return "not given";
        return (y == Math.floor(y) ? String.valueOf(y.intValue()) : String.valueOf(y)) + " yrs";
    }

    private static String str(Instant i) { return i == null ? null : i.toString(); }
}
