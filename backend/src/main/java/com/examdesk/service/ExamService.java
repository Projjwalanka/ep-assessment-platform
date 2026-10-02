package com.examdesk.service;

import com.examdesk.model.*;
import com.examdesk.repo.*;
import com.examdesk.security.Session;
import com.examdesk.util.Bands;
import com.examdesk.util.Maps;
import com.examdesk.web.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Exam lifecycle: assign -> start -> autosave/run -> submit (or auto-submit) -> evaluate -> review. */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamService {
    private static final long GRACE_SECONDS = 90;

    private final ExamRepo exams;
    private final CandidateRepo candidates;
    private final QuestionRepo questions;
    private final CodingProblemRepo problems;
    private final QuestionSetRepo sets;
    private final SettingsService settings;
    private final CodeRunner runner;
    private final EvaluationService evaluation;
    private final Views views;
    private final ObjectMapper mapper;
    private final Set<Long> finalizing = ConcurrentHashMap.newKeySet();

    // ---------------- staff ----------------

    public Map<String, Object> assign(Session s, Map<String, Object> body) {
        String ep = norm(Maps.str(body, "candidateEpNo"));
        Candidate c = candidates.findById(ep == null ? "" : ep).orElseThrow(() -> ApiException.notFound("Candidate " + ep + " not found."));
        if (!c.isActive()) throw ApiException.bad("Candidate " + ep + " is inactive.");
        if (s.isEvaluator() && !s.id().equals(c.getEvaluatorEmpNo()))
            throw ApiException.forbidden("Candidate " + ep + " is not assigned to you.");

        Long setId = body.get("setId") instanceof Number n ? n.longValue() : null;
        QuestionSet set = setId == null ? null : sets.findById(setId).orElseThrow(() -> ApiException.notFound("Question set not found."));
        List<Long> qIds = longs(body.get("questionIds"));
        List<Long> cIds = longs(body.get("codingIds"));
        Integer duration = body.get("durationMinutes") instanceof Number n && n.intValue() > 0 ? n.intValue() : null;
        String band = Optional.ofNullable(Bands.normalize(Maps.str(body, "band")))
                .orElse(Optional.ofNullable(c.getBand()).orElse(Bands.fromYears(c.getTotalExperience())));
        String title = Maps.str(body, "title");

        if (s.isEvaluator() && settings.enforceAdminSets()) {
            if (set == null || !set.isAdminDefined())
                throw ApiException.forbidden("Your admin requires papers to come from an admin-defined question set.");
            qIds = set.getQuestionIds(); cIds = set.getCodingIds(); duration = set.getDurationMinutes(); band = set.getBand();
        } else if (set != null && qIds.isEmpty() && cIds.isEmpty()) {
            qIds = set.getQuestionIds(); cIds = set.getCodingIds();
            if (!body.containsKey("durationMinutes")) duration = set.getDurationMinutes();
            if (set.getBand() != null) band = set.getBand();
        }
        if (set != null && !set.isAdminDefined() && s.isEvaluator() && !s.id().equals(set.getOwnerEmpNo()))
            throw ApiException.forbidden("That set belongs to another evaluator.");
        if (qIds.isEmpty() && cIds.isEmpty()) throw ApiException.bad("Add at least one question or hands-on problem.");
        List<Long> finalQ = qIds, finalC = cIds;
        long foundQ = questions.findAllById(finalQ).stream().filter(Question::isActive).count();
        if (foundQ != new HashSet<>(finalQ).size()) throw ApiException.bad("Some questions no longer exist. Refresh and try again.");
        if (problems.findAllById(finalC).size() != new HashSet<>(finalC).size()) throw ApiException.bad("Some hands-on problems no longer exist.");

        Exam e = new Exam();
        e.setTitle(title == null || title.isBlank() ? (set != null ? set.getName() : "Java assessment (" + band + " yrs)") : title);
        e.setCandidateEpNo(c.getEpNo());
        e.setEvaluatorEmpNo(s.isEvaluator() ? s.id() : c.getEvaluatorEmpNo());
        e.setAssignedBy(s.role() + ":" + s.id());
        e.setSetId(set == null ? null : set.getId());
        e.setBand(band);
        e.setQuestionIds(new ArrayList<>(new LinkedHashSet<>(finalQ)));
        e.setCodingIds(new ArrayList<>(new LinkedHashSet<>(finalC)));
        e.setDurationMinutes(duration);
        return views.exam(exams.save(e));
    }

    public void cancel(Session s, Long id) {
        Exam e = get(id);
        checkStaffAccess(s, e);
        if (!Exam.ASSIGNED.equals(e.getStatus())) throw ApiException.conflict("Only papers that haven't been started can be withdrawn.");
        exams.delete(e);
    }

    public Map<String, Object> report(Session s, Long id) {
        Exam e = get(id);
        checkStaffAccess(s, e);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("summary", views.exam(e));
        out.put("review", Maps.of("decision", e.getReviewDecision(), "notes", e.getReviewNotes(),
                "reviewedBy", e.getReviewedBy(), "reviewedAt", e.getReviewedAt()));
        if (e.getReportJson() != null) {
            try { out.put("report", mapper.readValue(e.getReportJson(), new TypeReference<Map<String, Object>>() {})); }
            catch (Exception ex) { throw new IllegalStateException("Stored report is unreadable", ex); }
        }
        List<Map<String, Object>> history = views.exams(exams.findByCandidateEpNoOrderByAssignedAtDesc(e.getCandidateEpNo()));
        out.put("history", history);
        return out;
    }

    public Map<String, Object> review(Session s, Long id, Map<String, Object> body) {
        Exam e = get(id);
        checkStaffAccess(s, e);
        if (!e.isFinal()) throw ApiException.conflict("The candidate hasn't submitted this paper yet.");
        String decision = Maps.str(body, "decision");
        if (decision == null || !List.of("PROCEED", "HOLD", "REJECT").contains(decision.toUpperCase(Locale.ROOT)))
            throw ApiException.bad("Decision must be Proceed, Hold or Reject.");
        e.setReviewDecision(decision.toUpperCase(Locale.ROOT));
        e.setReviewNotes(Maps.str(body, "notes"));
        e.setReviewedBy(s.name() + " (" + s.id() + ")");
        e.setReviewedAt(Instant.now());
        e.setStatus(Exam.REVIEWED);
        return views.exam(exams.save(e));
    }

    public void checkStaffAccess(Session s, Exam e) {
        if (s.isAdmin()) return;
        if (s.isEvaluator()) {
            if (s.id().equals(e.getEvaluatorEmpNo())) return;
            Candidate c = candidates.findById(e.getCandidateEpNo()).orElse(null);
            if (c != null && s.id().equals(c.getEvaluatorEmpNo())) return;
        }
        throw ApiException.forbidden("This candidate is not assigned to you.");
    }

    // ---------------- candidate ----------------

    public Map<String, Object> start(String ep, Long id) {
        Exam e = own(ep, id);
        Candidate c = candidates.findById(ep).orElseThrow();
        if (!c.isProfileCompleted()) throw ApiException.bad("Complete your profile before starting the assessment.");
        if (e.isFinal()) throw ApiException.conflict("This assessment has already been submitted.");
        if (Exam.ASSIGNED.equals(e.getStatus())) {
            e.setStatus(Exam.IN_PROGRESS);
            e.setStartedAt(Instant.now());
            if (e.getDurationMinutes() != null) e.setDeadline(e.getStartedAt().plus(Duration.ofMinutes(e.getDurationMinutes())));
            e = exams.save(e);
        } else if (expired(e)) {
            finalizeExam(e.getId(), true);
            throw ApiException.conflict("Time is up. Your answers were submitted automatically.");
        }
        return paper(e);
    }

    private Map<String, Object> paper(Exam e) {
        Map<Long, Question> qMap = questions.findAllById(e.getQuestionIds()).stream().collect(Collectors.toMap(Question::getId, Function.identity()));
        Map<Long, CodingProblem> pMap = problems.findAllById(e.getCodingIds()).stream().collect(Collectors.toMap(CodingProblem::getId, Function.identity()));
        List<Map<String, Object>> qs = e.getQuestionIds().stream().map(qMap::get).filter(Objects::nonNull)
                .map(q -> Maps.of("id", q.getId(), "topic", q.getTopic(), "text", q.getText(), "options", q.getOptions())).toList();
        List<Map<String, Object>> ps = e.getCodingIds().stream().map(pMap::get).filter(Objects::nonNull)
                .map(p -> Maps.of("id", p.getId(), "title", p.getTitle(), "difficulty", p.getDifficulty(), "topic", p.getTopic(),
                        "description", p.getDescription(), "starterCode", p.getStarterCode(),
                        "tests", p.getTestCases().stream().filter(t -> !t.hidden())
                                .map(t -> Maps.of("name", t.name(), "call", t.call(), "expected", t.expected())).toList(),
                        "hiddenCount", p.getTestCases().stream().filter(TestCase::hidden).count())).toList();
        Long remaining = e.getDeadline() == null ? null : Math.max(0, Duration.between(Instant.now(), e.getDeadline()).getSeconds());
        return Maps.of("examId", e.getId(), "title", e.getTitle(), "band", e.getBand(), "durationMinutes", e.getDurationMinutes(),
                "remainingSeconds", remaining, "startedAt", e.getStartedAt(), "questions", qs, "coding", ps,
                "saved", Maps.of("answers", e.getAnswers(), "code", e.getCode(), "flagged", e.getFlagged(), "tabSwitches", e.getTabSwitches()));
    }

    public Map<String, Object> saveProgress(String ep, Long id, Map<String, Object> body) {
        Exam e = own(ep, id);
        if (!Exam.IN_PROGRESS.equals(e.getStatus())) throw ApiException.conflict("This assessment is not in progress.");
        if (expired(e)) {
            finalizeExam(e.getId(), true);
            throw ApiException.conflict("Time is up. Your answers were submitted automatically.");
        }
        apply(e, body);
        e.setLastSavedAt(Instant.now());
        exams.save(e);
        Long remaining = e.getDeadline() == null ? null : Math.max(0, Duration.between(Instant.now(), e.getDeadline()).getSeconds());
        return Maps.of("savedAt", e.getLastSavedAt(), "remainingSeconds", remaining);
    }

    public CodeRunner.RunResult run(String ep, Long id, Map<String, Object> body) {
        Exam e = own(ep, id);
        if (!Exam.IN_PROGRESS.equals(e.getStatus()) || expired(e)) throw ApiException.conflict("This assessment is not in progress.");
        Long problemId = body.get("problemId") instanceof Number n ? n.longValue() : null;
        if (problemId == null || !e.getCodingIds().contains(problemId)) throw ApiException.bad("Unknown hands-on problem.");
        String code = Maps.str(body, "code");
        Map<String, String> codeMap = new HashMap<>(e.getCode() == null ? Map.of() : e.getCode());
        codeMap.put(String.valueOf(problemId), code == null ? "" : code);
        e.setCode(codeMap);
        e.setLastSavedAt(Instant.now());
        exams.save(e);
        CodingProblem p = problems.findById(problemId).orElseThrow();
        return runner.run(code, p.getTestCases(), false, 30);
    }

    public Map<String, Object> submit(String ep, Long id, Map<String, Object> body) {
        Exam e = own(ep, id);
        if (e.isFinal()) return views.examForCandidate(e);
        if (!Exam.IN_PROGRESS.equals(e.getStatus())) throw ApiException.conflict("Start the assessment before submitting.");
        if (!expired(e) && body != null) { apply(e, body); exams.save(e); }
        return views.examForCandidate(finalizeExam(e.getId(), false));
    }

    // ---------------- finalize ----------------

    /** Runs every hands-on test (hidden included), scores and stores the report. Idempotent and re-entrancy safe. */
    public Exam finalizeExam(Long id, boolean auto) {
        if (!finalizing.add(id)) {
            for (int i = 0; i < 240 && finalizing.contains(id); i++) sleep(500);
            return get(id);
        }
        try {
            Exam e = get(id);
            if (e.isFinal()) return e;
            Instant submittedAt = Instant.now();
            if (e.getDeadline() != null && submittedAt.isAfter(e.getDeadline())) submittedAt = e.getDeadline();
            e.setSubmittedAt(submittedAt);
            e.setAutoSubmitted(auto);
            Candidate c = candidates.findById(e.getCandidateEpNo()).orElseThrow();
            Map<Long, Question> qMap = questions.findAllById(e.getQuestionIds()).stream().collect(Collectors.toMap(Question::getId, Function.identity()));
            List<Question> qs = e.getQuestionIds().stream().map(qMap::get).filter(Objects::nonNull).toList();
            Map<Long, CodingProblem> pMap = problems.findAllById(e.getCodingIds()).stream().collect(Collectors.toMap(CodingProblem::getId, Function.identity()));
            List<CodingProblem> ps = e.getCodingIds().stream().map(pMap::get).filter(Objects::nonNull).toList();
            Map<Long, CodeRunner.RunResult> results = new HashMap<>();
            for (CodingProblem p : ps) {
                String code = e.getCode() == null ? null : e.getCode().get(String.valueOf(p.getId()));
                results.put(p.getId(), runner.run(code, p.getTestCases(), true, 180));
            }
            evaluation.evaluate(e, c, qs, ps, results, settings.mcqWeight());
            e.setStatus(Exam.SUBMITTED);
            return exams.save(e);
        } finally {
            finalizing.remove(id);
        }
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void autoSubmitExpired() {
        for (Exam e : exams.findByStatusAndDeadlineBefore(Exam.IN_PROGRESS, Instant.now().minusSeconds(GRACE_SECONDS))) {
            try { finalizeExam(e.getId(), true); log.info("Auto-submitted exam {}", e.getId()); }
            catch (Exception ex) { log.warn("Auto-submit failed for exam {}: {}", e.getId(), ex.getMessage()); }
        }
    }

    // ---------------- helpers ----------------

    @SuppressWarnings("unchecked")
    private void apply(Exam e, Map<String, Object> body) {
        if (body.get("answers") instanceof Map<?, ?> m) {
            Map<String, Integer> answers = new HashMap<>();
            Set<String> allowed = e.getQuestionIds().stream().map(String::valueOf).collect(Collectors.toSet());
            m.forEach((k, v) -> { if (v instanceof Number n && allowed.contains(String.valueOf(k))) answers.put(String.valueOf(k), n.intValue()); });
            e.setAnswers(answers);
        }
        if (body.get("code") instanceof Map<?, ?> m) {
            Map<String, String> code = new HashMap<>(e.getCode() == null ? Map.of() : e.getCode());
            Set<String> allowed = e.getCodingIds().stream().map(String::valueOf).collect(Collectors.toSet());
            m.forEach((k, v) -> { if (v != null && allowed.contains(String.valueOf(k))) code.put(String.valueOf(k), String.valueOf(v)); });
            e.setCode(code);
        }
        if (body.containsKey("flagged")) e.setFlagged(longs(body.get("flagged")));
        if (body.get("tabSwitches") instanceof Number n) e.setTabSwitches(Math.max(e.getTabSwitches(), n.intValue()));
    }

    private boolean expired(Exam e) {
        return e.getDeadline() != null && Instant.now().isAfter(e.getDeadline().plusSeconds(GRACE_SECONDS));
    }

    private Exam own(String ep, Long id) {
        Exam e = get(id);
        if (!e.getCandidateEpNo().equals(ep)) throw ApiException.notFound("Assessment not found.");
        return e;
    }

    public Exam get(Long id) { return exams.findById(id).orElseThrow(() -> ApiException.notFound("Assessment not found.")); }

    public static List<Long> longs(Object o) {
        if (!(o instanceof Collection<?> c)) return new ArrayList<>();
        List<Long> out = new ArrayList<>();
        for (Object x : c) {
            if (x instanceof Number n) out.add(n.longValue());
            else if (x != null) try { out.add(Long.parseLong(String.valueOf(x))); } catch (NumberFormatException ignored) {}
        }
        return out;
    }

    public static String norm(String id) { return id == null ? null : id.trim().toUpperCase(Locale.ROOT); }

    private static void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } }
}
