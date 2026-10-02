package com.examdesk.web;

import com.examdesk.model.*;
import com.examdesk.repo.*;
import com.examdesk.security.AuthInterceptor;
import com.examdesk.security.Session;
import com.examdesk.service.*;
import com.examdesk.util.Bands;
import com.examdesk.util.Maps;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Endpoints shared by admins and evaluators: question bank, hands-on library, sets, assigning and reports. */
@RestController
@RequestMapping("/api/common")
@RequiredArgsConstructor
public class CommonController {
    private final QuestionRepo questions;
    private final CodingProblemRepo problems;
    private final QuestionSetRepo sets;
    private final CandidateRepo candidates;
    private final ExamRepo exams;
    private final SettingsService settings;
    private final GeneratorService generator;
    private final ExamService examService;
    private final CodeRunner runner;
    private final Views views;
    private final ObjectMapper mapper;

    @GetMapping("/meta")
    public Map<String, Object> meta() {
        List<String> topics = questions.findAll().stream().filter(Question::isActive).map(Question::getTopic)
                .filter(Objects::nonNull).distinct().sorted().toList();
        return Maps.of("bands", Bands.ALL, "difficulties", Bands.DIFFICULTIES, "topics", topics,
                "technologies", SettingsService.technologies(), "settings", settings.all(),
                "bandBars", EvaluationService.BAND_BAR);
    }

    // ------------------------------------------------------------ questions

    @GetMapping("/questions")
    public List<Map<String, Object>> listQuestions(@RequestAttribute(AuthInterceptor.ATTR) Session s,
                                                   @RequestParam(required = false) String band,
                                                   @RequestParam(required = false) String topic,
                                                   @RequestParam(required = false) String difficulty,
                                                   @RequestParam(required = false) String q,
                                                   @RequestParam(required = false, defaultValue = "all") String scope) {
        String needle = q == null ? null : q.toLowerCase(Locale.ROOT).trim();
        return questions.findAll().stream().filter(Question::isActive)
                .filter(x -> visible(s, x))
                .filter(x -> !"mine".equals(scope) || s.id().equals(x.getCreatedBy()))
                .filter(x -> !"master".equals(scope) || x.isMaster())
                .filter(x -> band == null || band.isBlank() || band.equals(x.getBand()))
                .filter(x -> topic == null || topic.isBlank() || topic.equals(x.getTopic()))
                .filter(x -> difficulty == null || difficulty.isBlank() || difficulty.equals(x.getDifficulty()))
                .filter(x -> needle == null || needle.isEmpty() || x.getText().toLowerCase(Locale.ROOT).contains(needle))
                .sorted(Comparator.comparing(Question::getId).reversed())
                .map(CommonController::question).toList();
    }

    @PostMapping("/questions/by-ids")
    public List<Map<String, Object>> byIds(@RequestBody List<Long> ids) {
        Map<Long, Question> m = questions.findAllById(ids).stream().collect(Collectors.toMap(Question::getId, Function.identity()));
        return ids.stream().map(m::get).filter(Objects::nonNull).map(CommonController::question).toList();
    }

    @PostMapping("/questions")
    public Map<String, Object> createQuestion(@RequestAttribute(AuthInterceptor.ATTR) Session s, @RequestBody Map<String, Object> body) {
        if (s.isEvaluator() && (!settings.allowEvaluatorQuestions() || settings.enforceAdminSets()))
            throw ApiException.forbidden("Your admin has turned off evaluator-written questions.");
        Question q = new Question();
        fill(q, body);
        q.setSource(s.isAdmin() ? "ADMIN" : "EVALUATOR");
        q.setCreatedBy(s.id());
        q.setMaster(s.isAdmin() || Boolean.TRUE.equals(body.get("addToMaster")));
        return question(questions.save(q));
    }

    @PutMapping("/questions/{id}")
    public Map<String, Object> updateQuestion(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id,
                                              @RequestBody Map<String, Object> body) {
        Question q = questions.findById(id).orElseThrow(() -> ApiException.notFound("Question not found."));
        if (!s.isAdmin() && !s.id().equals(q.getCreatedBy())) throw ApiException.forbidden("Only the admin can edit master questions.");
        fill(q, body);
        if (s.isAdmin() && body.containsKey("master")) q.setMaster(Boolean.TRUE.equals(body.get("master")));
        if (s.isEvaluator() && Boolean.TRUE.equals(body.get("addToMaster"))) q.setMaster(true);
        return question(questions.save(q));
    }

    @DeleteMapping("/questions/{id}")
    public Map<String, Object> deleteQuestion(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id) {
        Question q = questions.findById(id).orElseThrow(() -> ApiException.notFound("Question not found."));
        if (!s.isAdmin() && !(s.id().equals(q.getCreatedBy()) && !q.isMaster()))
            throw ApiException.forbidden("Only the admin can remove master questions.");
        q.setActive(false);   // soft delete: past reports and sets keep resolving it
        questions.save(q);
        return Maps.of("ok", true);
    }

    private boolean visible(Session s, Question q) {
        return s.isAdmin() || q.isMaster() || s.id().equals(q.getCreatedBy());
    }

    private void fill(Question q, Map<String, Object> b) {
        String text = Maps.str(b, "text");
        List<String> options = b.get("options") instanceof List<?> l
                ? l.stream().map(o -> o == null ? "" : String.valueOf(o).trim()).filter(o -> !o.isEmpty()).toList() : List.of();
        int correct = b.get("correctIndex") instanceof Number n ? n.intValue() : -1;
        String band = Bands.normalize(Maps.str(b, "band"));
        String topic = Maps.str(b, "topic");
        if (text == null || text.isBlank()) throw ApiException.bad("Question text is required.");
        if (options.size() < 2 || options.size() > 6) throw ApiException.bad("Give between 2 and 6 options.");
        if (correct < 0 || correct >= options.size()) throw ApiException.bad("Mark the correct option.");
        if (band == null) throw ApiException.bad("Choose an experience band.");
        if (topic == null || topic.isBlank()) throw ApiException.bad("Topic is required.");
        q.setText(text);
        q.setOptions(new ArrayList<>(options));
        q.setCorrectIndex(correct);
        q.setBand(band);
        q.setTopic(topic);
        q.setDifficulty(Optional.ofNullable(Bands.difficulty(Maps.str(b, "difficulty"))).orElse("MEDIUM"));
        q.setExplanation(Maps.str(b, "explanation"));
        String tech = Maps.str(b, "technology");
        q.setTechnology(tech == null ? "JAVA" : tech.toUpperCase(Locale.ROOT));
    }

    public static Map<String, Object> question(Question q) {
        return Maps.of("id", q.getId(), "technology", q.getTechnology(), "topic", q.getTopic(), "band", q.getBand(),
                "difficulty", q.getDifficulty(), "text", q.getText(), "options", q.getOptions(),
                "correctIndex", q.getCorrectIndex(), "explanation", q.getExplanation(), "source", q.getSource(),
                "createdBy", q.getCreatedBy(), "master", q.isMaster(), "createdAt", q.getCreatedAt());
    }

    // ------------------------------------------------------------ hands-on

    @GetMapping("/coding")
    public List<Map<String, Object>> listCoding(@RequestAttribute(AuthInterceptor.ATTR) Session s) {
        return problems.findAll().stream().filter(CodingProblem::isActive)
                .filter(p -> s.isAdmin() || p.isPredefined() || s.id().equals(p.getOwnerEmpNo()))
                .sorted(Comparator.comparing((CodingProblem p) -> Bands.ALL.indexOf(p.getBand())).thenComparing(CodingProblem::getId))
                .map(p -> coding(p, false)).toList();
    }

    @GetMapping("/coding/{id}")
    public Map<String, Object> getCoding(@PathVariable Long id) {
        return coding(problems.findById(id).orElseThrow(() -> ApiException.notFound("Problem not found.")), true);
    }

    @PostMapping("/coding")
    public Map<String, Object> createCoding(@RequestAttribute(AuthInterceptor.ATTR) Session s, @RequestBody Map<String, Object> body) {
        if (s.isEvaluator() && settings.enforceAdminSets()) throw ApiException.forbidden("Your admin requires admin-defined papers.");
        CodingProblem p = new CodingProblem();
        fill(p, body);
        p.setPredefined(s.isAdmin());
        p.setOwnerEmpNo(s.isAdmin() ? null : s.id());
        return coding(problems.save(p), true);
    }

    @PutMapping("/coding/{id}")
    public Map<String, Object> updateCoding(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id,
                                            @RequestBody Map<String, Object> body) {
        CodingProblem p = problems.findById(id).orElseThrow(() -> ApiException.notFound("Problem not found."));
        if (!s.isAdmin() && !s.id().equals(p.getOwnerEmpNo())) throw ApiException.forbidden("Only the admin can edit library problems.");
        fill(p, body);
        return coding(problems.save(p), true);
    }

    @DeleteMapping("/coding/{id}")
    public Map<String, Object> deleteCoding(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id) {
        CodingProblem p = problems.findById(id).orElseThrow(() -> ApiException.notFound("Problem not found."));
        if (!s.isAdmin() && !s.id().equals(p.getOwnerEmpNo())) throw ApiException.forbidden("Only the admin can remove library problems.");
        p.setActive(false);
        problems.save(p);
        return Maps.of("ok", true);
    }

    @PostMapping("/coding/validate")
    public CodeRunner.RunResult validate(@RequestBody Map<String, Object> body) {
        List<TestCase> tests = mapper.convertValue(body.get("testCases"), new TypeReference<List<TestCase>>() {});
        return runner.run(Maps.str(body, "code"), tests, true, 30);
    }

    private void fill(CodingProblem p, Map<String, Object> b) {
        String title = Maps.str(b, "title");
        if (title == null || title.isBlank()) throw ApiException.bad("Title is required.");
        List<TestCase> tests = b.get("testCases") == null ? List.of()
                : mapper.convertValue(b.get("testCases"), new TypeReference<List<TestCase>>() {});
        tests = tests.stream().filter(t -> t.call() != null && !t.call().isBlank() && t.expected() != null && !t.expected().isBlank()).toList();
        if (tests.isEmpty()) throw ApiException.bad("Add at least one test case with a call and expected value.");
        String starter = b.get("starterCode") == null ? null : String.valueOf(b.get("starterCode"));
        if (starter == null || starter.isBlank()) throw ApiException.bad("Starter code is required.");
        p.setTitle(title);
        p.setBand(Optional.ofNullable(Bands.normalize(Maps.str(b, "band"))).orElse("0-5"));
        p.setDifficulty(Optional.ofNullable(Bands.difficulty(Maps.str(b, "difficulty"))).orElse("MEDIUM"));
        p.setTopic(Maps.str(b, "topic"));
        p.setDescription(b.get("description") == null ? "" : String.valueOf(b.get("description")));
        p.setStarterCode(starter);
        p.setReferenceSolution(b.get("referenceSolution") == null ? null : String.valueOf(b.get("referenceSolution")));
        p.setTestCases(new ArrayList<>(tests));
        p.setSuggestedMinutes(b.get("suggestedMinutes") instanceof Number n ? Math.max(5, n.intValue()) : 20);
    }

    static Map<String, Object> coding(CodingProblem p, boolean full) {
        Map<String, Object> m = Maps.of("id", p.getId(), "title", p.getTitle(), "band", p.getBand(), "difficulty", p.getDifficulty(),
                "topic", p.getTopic(), "suggestedMinutes", p.getSuggestedMinutes(), "predefined", p.isPredefined(),
                "ownerEmpNo", p.getOwnerEmpNo(), "testCount", p.getTestCases().size(),
                "hiddenCount", p.getTestCases().stream().filter(TestCase::hidden).count());
        if (full) {
            m.put("description", p.getDescription());
            m.put("starterCode", p.getStarterCode());
            m.put("referenceSolution", p.getReferenceSolution());
            m.put("testCases", p.getTestCases());
        } else {
            String d = p.getDescription() == null ? "" : p.getDescription().replaceAll("\\s+", " ");
            m.put("excerpt", d.length() > 160 ? d.substring(0, 157) + "…" : d);
        }
        return m;
    }

    // ------------------------------------------------------------ sets

    @GetMapping("/sets")
    public List<Map<String, Object>> listSets(@RequestAttribute(AuthInterceptor.ATTR) Session s) {
        Map<Long, Question> qMap = questions.findAll().stream().collect(Collectors.toMap(Question::getId, Function.identity()));
        return sets.findAll().stream()
                .filter(x -> x.isAdminDefined() || s.isAdmin() || s.id().equals(x.getOwnerEmpNo()))
                .sorted(Comparator.comparing(QuestionSet::isAdminDefined).reversed()
                        .thenComparing(x -> Bands.ALL.indexOf(x.getBand())).thenComparing(QuestionSet::getId))
                .map(x -> set(x, qMap, false)).toList();
    }

    @GetMapping("/sets/{id}")
    public Map<String, Object> getSet(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id) {
        QuestionSet x = sets.findById(id).orElseThrow(() -> ApiException.notFound("Set not found."));
        if (!x.isAdminDefined() && !s.isAdmin() && !s.id().equals(x.getOwnerEmpNo())) throw ApiException.forbidden("Not your set.");
        Map<Long, Question> qMap = questions.findAllById(x.getQuestionIds()).stream().collect(Collectors.toMap(Question::getId, Function.identity()));
        return set(x, qMap, true);
    }

    @PostMapping("/sets")
    public Map<String, Object> createSet(@RequestAttribute(AuthInterceptor.ATTR) Session s, @RequestBody Map<String, Object> body) {
        if (s.isEvaluator() && settings.enforceAdminSets()) throw ApiException.forbidden("Your admin requires admin-defined sets; you can't save your own.");
        QuestionSet x = new QuestionSet();
        fill(x, body);
        x.setAdminDefined(s.isAdmin());
        x.setOwnerEmpNo(s.isAdmin() ? null : s.id());
        return set(sets.save(x), Map.of(), false);
    }

    @PutMapping("/sets/{id}")
    public Map<String, Object> updateSet(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id,
                                         @RequestBody Map<String, Object> body) {
        QuestionSet x = sets.findById(id).orElseThrow(() -> ApiException.notFound("Set not found."));
        if (x.isAdminDefined() ? !s.isAdmin() : !(s.isAdmin() || s.id().equals(x.getOwnerEmpNo())))
            throw ApiException.forbidden("You can't edit this set. Save a copy as your own template instead.");
        fill(x, body);
        x.setUpdatedAt(Instant.now());
        return set(sets.save(x), Map.of(), false);
    }

    @DeleteMapping("/sets/{id}")
    public Map<String, Object> deleteSet(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id) {
        QuestionSet x = sets.findById(id).orElseThrow(() -> ApiException.notFound("Set not found."));
        if (x.isAdminDefined() ? !s.isAdmin() : !(s.isAdmin() || s.id().equals(x.getOwnerEmpNo())))
            throw ApiException.forbidden("You can't delete this set.");
        sets.delete(x);
        return Maps.of("ok", true);
    }

    @PostMapping("/sets/generate")
    public Map<String, Object> generate(@RequestAttribute(AuthInterceptor.ATTR) Session s, @RequestBody Map<String, Object> body) {
        String band = Optional.ofNullable(Bands.normalize(Maps.str(body, "band"))).orElse("0-5");
        int count = body.get("count") instanceof Number n ? Math.max(1, Math.min(100, n.intValue())) : 20;
        int codingCount = body.get("codingCount") instanceof Number n ? Math.max(0, Math.min(5, n.intValue())) : 0;
        List<String> topics = body.get("topics") instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.of();
        Long seed = body.get("seed") instanceof Number n ? n.longValue() : null;
        List<Question> pool = questions.findAll().stream().filter(q -> q.isActive() && visible(s, q)).toList();
        List<CodingProblem> cp = problems.findAll().stream().filter(p -> p.isActive() && (s.isAdmin() || p.isPredefined() || s.id().equals(p.getOwnerEmpNo()))).toList();
        GeneratorService.Generated g = generator.generate(Maps.str(body, "technology"), band, count, codingCount, topics, pool, cp, seed);
        Map<Long, Question> qMap = pool.stream().collect(Collectors.toMap(Question::getId, Function.identity()));
        return Maps.of("band", band, "questionIds", g.questionIds(), "codingIds", g.codingIds(),
                "suggestedDuration", g.suggestedDuration(), "note", g.note(),
                "questions", g.questionIds().stream().map(qMap::get).map(CommonController::question).toList());
    }

    private void fill(QuestionSet x, Map<String, Object> b) {
        String name = Maps.str(b, "name");
        if (name == null || name.isBlank()) throw ApiException.bad("Give the set a name.");
        List<Long> q = ExamService.longs(b.get("questionIds")), c = ExamService.longs(b.get("codingIds"));
        if (q.isEmpty() && c.isEmpty()) throw ApiException.bad("Add at least one question or hands-on problem.");
        x.setName(name);
        x.setDescription(Maps.str(b, "description"));
        x.setBand(Optional.ofNullable(Bands.normalize(Maps.str(b, "band"))).orElse("0-5"));
        x.setQuestionIds(new ArrayList<>(new LinkedHashSet<>(q)));
        x.setCodingIds(new ArrayList<>(new LinkedHashSet<>(c)));
        x.setDurationMinutes(b.get("durationMinutes") instanceof Number n && n.intValue() > 0 ? n.intValue() : null);
        String tech = Maps.str(b, "technology");
        x.setTechnology(tech == null ? "JAVA" : tech.toUpperCase(Locale.ROOT));
    }

    private Map<String, Object> set(QuestionSet x, Map<Long, Question> qMap, boolean full) {
        Map<String, Integer> diff = new LinkedHashMap<>(), topics = new TreeMap<>();
        for (Long id : x.getQuestionIds()) {
            Question q = qMap.get(id);
            if (q == null) continue;
            diff.merge(q.getDifficulty(), 1, Integer::sum);
            topics.merge(q.getTopic(), 1, Integer::sum);
        }
        Map<String, Object> m = Maps.of("id", x.getId(), "name", x.getName(), "description", x.getDescription(),
                "technology", x.getTechnology(), "band", x.getBand(), "questionIds", x.getQuestionIds(), "codingIds", x.getCodingIds(),
                "questionCount", x.getQuestionIds().size(), "codingCount", x.getCodingIds().size(),
                "durationMinutes", x.getDurationMinutes(), "adminDefined", x.isAdminDefined(), "ownerEmpNo", x.getOwnerEmpNo(),
                "difficultyMix", diff, "topicMix", topics, "updatedAt", x.getUpdatedAt());
        if (full) {
            m.put("questions", x.getQuestionIds().stream().map(qMap::get).filter(Objects::nonNull).map(CommonController::question).toList());
            Map<Long, CodingProblem> pMap = problems.findAllById(x.getCodingIds()).stream().collect(Collectors.toMap(CodingProblem::getId, Function.identity()));
            m.put("coding", x.getCodingIds().stream().map(pMap::get).filter(Objects::nonNull).map(p -> coding(p, false)).toList());
        }
        return m;
    }

    // ------------------------------------------------------------ candidates, exams, reports

    @GetMapping("/candidates/{ep}")
    public Map<String, Object> candidate(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable String ep) {
        Candidate c = candidates.findById(ExamService.norm(ep)).orElseThrow(() -> ApiException.notFound("Candidate not found."));
        if (s.isEvaluator() && !s.id().equals(c.getEvaluatorEmpNo())) throw ApiException.forbidden("This candidate is not assigned to you.");
        List<Exam> list = exams.findByCandidateEpNoOrderByAssignedAtDesc(c.getEpNo());
        return Maps.of("candidate", views.candidate(c, views.evaluatorNames(), list, s.isAdmin()), "exams", views.exams(list));
    }

    @PostMapping("/exams")
    public Map<String, Object> assign(@RequestAttribute(AuthInterceptor.ATTR) Session s, @RequestBody Map<String, Object> body) {
        return examService.assign(s, body);
    }

    @DeleteMapping("/exams/{id}")
    public Map<String, Object> cancel(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id) {
        examService.cancel(s, id);
        return Maps.of("ok", true);
    }

    @GetMapping("/exams/{id}/report")
    public Map<String, Object> report(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id) {
        return examService.report(s, id);
    }

    @PutMapping("/exams/{id}/review")
    public Map<String, Object> review(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id,
                                      @RequestBody Map<String, Object> body) {
        return examService.review(s, id, body);
    }
}
