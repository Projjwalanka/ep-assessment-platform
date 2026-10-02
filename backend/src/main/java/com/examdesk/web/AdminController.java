package com.examdesk.web;

import com.examdesk.model.*;
import com.examdesk.repo.*;
import com.examdesk.security.AuthInterceptor;
import com.examdesk.security.Passwords;
import com.examdesk.security.Session;
import com.examdesk.security.SessionStore;
import com.examdesk.service.*;
import com.examdesk.util.Bands;
import com.examdesk.util.Maps;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final CandidateRepo candidates;
    private final EvaluatorRepo evaluators;
    private final ExamRepo exams;
    private final QuestionRepo questions;
    private final SettingsService settings;
    private final StatsService stats;
    private final ImportService importer;
    private final SessionStore sessions;
    private final Views views;

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() { return stats.admin(); }

    // ------------------------------------------------------------ candidates

    @GetMapping("/candidates")
    public List<Map<String, Object>> listCandidates() {
        Map<String, List<Exam>> byCand = Views.group(exams.findAll(), Exam::getCandidateEpNo);
        Map<String, String> en = views.evaluatorNames();
        return candidates.findAll().stream().sorted(Comparator.comparing(Candidate::getEpNo))
                .map(c -> views.candidate(c, en, byCand.getOrDefault(c.getEpNo(), List.of()), true)).toList();
    }

    @PostMapping("/candidates")
    public Map<String, Object> createCandidate(@RequestBody Map<String, Object> body) {
        String ep = ExamService.norm(Maps.str(body, "epNo"));
        if (ep == null || !ep.matches("[A-Z0-9_\\-]{3,40}")) throw ApiException.bad("EP number must be 3–40 letters, digits, - or _.");
        if (candidates.existsById(ep)) throw ApiException.conflict("A candidate with EP number " + ep + " already exists.");
        Candidate c = new Candidate();
        c.setEpNo(ep);
        fillCandidate(c, body);
        String code = Maps.str(body, "accessCode");
        c.setAccessCode(code == null || code.isBlank() ? Passwords.generate(8) : code);
        return views.candidate(candidates.save(c), views.evaluatorNames(), List.of(), true);
    }

    @PutMapping("/candidates/{ep}")
    public Map<String, Object> updateCandidate(@PathVariable String ep, @RequestBody Map<String, Object> body) {
        Candidate c = candidate(ep);
        fillCandidate(c, body);
        if (body.containsKey("active")) c.setActive(Boolean.TRUE.equals(body.get("active")));
        return views.candidate(candidates.save(c), views.evaluatorNames(), exams.findByCandidateEpNoOrderByAssignedAtDesc(c.getEpNo()), true);
    }

    @DeleteMapping("/candidates/{ep}")
    public Map<String, Object> deleteCandidate(@PathVariable String ep) {
        Candidate c = candidate(ep);
        sessions.removeFor("CANDIDATE", c.getEpNo());
        if (exams.findByCandidateEpNoOrderByAssignedAtDesc(c.getEpNo()).isEmpty()) {
            candidates.delete(c);
            return Maps.of("ok", true, "deleted", true);
        }
        c.setActive(false);   // keep history for reporting
        candidates.save(c);
        return Maps.of("ok", true, "deleted", false);
    }

    @PostMapping("/candidates/{ep}/reset-code")
    public Map<String, Object> resetCode(@PathVariable String ep) {
        Candidate c = candidate(ep);
        c.setAccessCode(Passwords.generate(8));
        candidates.save(c);
        sessions.removeFor("CANDIDATE", c.getEpNo());
        return Maps.of("epNo", c.getEpNo(), "accessCode", c.getAccessCode());
    }

    @GetMapping("/candidates/{ep}/exams")
    public List<Map<String, Object>> candidateExams(@PathVariable String ep) {
        return views.exams(exams.findByCandidateEpNoOrderByAssignedAtDesc(candidate(ep).getEpNo()));
    }

    private void fillCandidate(Candidate c, Map<String, Object> b) {
        if (b.containsKey("name")) c.setName(Maps.str(b, "name"));
        if (b.containsKey("email")) c.setEmail(Maps.str(b, "email"));
        if (b.containsKey("phone")) c.setPhone(Maps.str(b, "phone"));
        if (b.containsKey("totalExperience")) {
            Object v = b.get("totalExperience");
            try { c.setTotalExperience(v == null || String.valueOf(v).isBlank() ? null : Double.parseDouble(String.valueOf(v))); }
            catch (NumberFormatException e) { throw ApiException.bad("Experience must be a number of years."); }
        }
        String band = Bands.normalize(Maps.str(b, "band"));
        if (band != null) c.setBand(band);
        else if (c.getBand() == null) c.setBand(Bands.fromYears(c.getTotalExperience()));
        if (b.containsKey("evaluatorEmpNo")) c.setEvaluatorEmpNo(evaluatorOrNull(Maps.str(b, "evaluatorEmpNo")));
        if (c.getName() == null || c.getName().isBlank()) throw ApiException.bad("Candidate name is required.");
    }

    // ------------------------------------------------------------ evaluators

    @GetMapping("/evaluators")
    public List<Map<String, Object>> listEvaluators() {
        Map<String, List<Candidate>> byEval = Views.group(candidates.findAll(), Candidate::getEvaluatorEmpNo);
        Map<String, List<Exam>> exByEval = Views.group(exams.findAll(), Exam::getEvaluatorEmpNo);
        return evaluators.findAll().stream().sorted(Comparator.comparing(Evaluator::getEmpNo)).map(e -> {
            List<Exam> ex = exByEval.getOrDefault(e.getEmpNo(), List.of());
            return Maps.of("empNo", e.getEmpNo(), "name", e.getName(), "email", e.getEmail(), "department", e.getDepartment(),
                    "active", e.isActive(), "createdAt", e.getCreatedAt(),
                    "candidateCount", byEval.getOrDefault(e.getEmpNo(), List.of()).size(),
                    "pending", ex.stream().filter(x -> !x.isFinal()).count(),
                    "toReview", ex.stream().filter(x -> Exam.SUBMITTED.equals(x.getStatus())).count(),
                    "reviewed", ex.stream().filter(x -> Exam.REVIEWED.equals(x.getStatus())).count());
        }).toList();
    }

    @PostMapping("/evaluators")
    public Map<String, Object> createEvaluator(@RequestBody Map<String, Object> body) {
        String emp = ExamService.norm(Maps.str(body, "empNo"));
        if (emp == null || !emp.matches("[A-Z0-9_\\-]{3,40}")) throw ApiException.bad("Employee number must be 3–40 letters, digits, - or _.");
        if (evaluators.existsById(emp)) throw ApiException.conflict("Evaluator " + emp + " already exists.");
        Evaluator e = new Evaluator();
        e.setEmpNo(emp);
        fillEvaluator(e, body);
        String pwd = Maps.str(body, "password");
        boolean generated = pwd == null || pwd.isBlank();
        if (generated) pwd = Passwords.generate(10);
        else if (pwd.length() < 8) throw ApiException.bad("Password must be at least 8 characters.");
        e.setPasswordHash(Passwords.hash(pwd));
        evaluators.save(e);
        return Maps.of("empNo", e.getEmpNo(), "name", e.getName(), "password", generated ? pwd : null);
    }

    @PutMapping("/evaluators/{emp}")
    public Map<String, Object> updateEvaluator(@PathVariable String emp, @RequestBody Map<String, Object> body) {
        Evaluator e = evaluator(emp);
        fillEvaluator(e, body);
        if (body.containsKey("active")) {
            e.setActive(Boolean.TRUE.equals(body.get("active")));
            if (!e.isActive()) sessions.removeFor("EVALUATOR", e.getEmpNo());
        }
        evaluators.save(e);
        return Maps.of("ok", true);
    }

    @DeleteMapping("/evaluators/{emp}")
    public Map<String, Object> deleteEvaluator(@PathVariable String emp) {
        Evaluator e = evaluator(emp);
        sessions.removeFor("EVALUATOR", e.getEmpNo());
        List<Candidate> mapped = candidates.findByEvaluatorEmpNo(e.getEmpNo());
        mapped.forEach(c -> c.setEvaluatorEmpNo(null));
        candidates.saveAll(mapped);
        if (exams.findByEvaluatorEmpNoOrderByAssignedAtDesc(e.getEmpNo()).isEmpty()) {
            evaluators.delete(e);
            return Maps.of("ok", true, "deleted", true, "unmapped", mapped.size());
        }
        e.setActive(false);
        evaluators.save(e);
        return Maps.of("ok", true, "deleted", false, "unmapped", mapped.size());
    }

    @PostMapping("/evaluators/{emp}/reset-password")
    public Map<String, Object> resetPassword(@PathVariable String emp) {
        Evaluator e = evaluator(emp);
        String pwd = Passwords.generate(10);
        e.setPasswordHash(Passwords.hash(pwd));
        evaluators.save(e);
        sessions.removeFor("EVALUATOR", e.getEmpNo());
        return Maps.of("empNo", e.getEmpNo(), "password", pwd);
    }

    private void fillEvaluator(Evaluator e, Map<String, Object> b) {
        if (b.containsKey("name")) e.setName(Maps.str(b, "name"));
        if (b.containsKey("email")) e.setEmail(Maps.str(b, "email"));
        if (b.containsKey("department")) e.setDepartment(Maps.str(b, "department"));
        if (e.getName() == null || e.getName().isBlank()) throw ApiException.bad("Evaluator name is required.");
    }

    // ------------------------------------------------------------ mapping, exams

    @PostMapping("/mapping")
    public Map<String, Object> map(@RequestBody Map<String, Object> body) {
        String emp = evaluatorOrNull(Maps.str(body, "empNo"));
        List<String> eps = body.get("epNos") instanceof List<?> l ? l.stream().map(x -> ExamService.norm(String.valueOf(x))).toList() : List.of();
        if (eps.isEmpty()) throw ApiException.bad("Select at least one candidate.");
        List<Candidate> list = candidates.findAllById(eps);
        list.forEach(c -> c.setEvaluatorEmpNo(emp));
        candidates.saveAll(list);
        return Maps.of("updated", list.size(), "empNo", emp);
    }

    @GetMapping("/exams")
    public List<Map<String, Object>> exams(@RequestParam(required = false) String status,
                                           @RequestParam(required = false) String evaluator,
                                           @RequestParam(required = false) String band,
                                           @RequestParam(required = false) String recommendation,
                                           @RequestParam(required = false) String q) {
        String needle = q == null ? null : q.toLowerCase(Locale.ROOT).trim();
        return views.exams(exams.findAllByOrderByAssignedAtDesc()).stream()
                .filter(m -> blank(status) || status.equals(m.get("status")))
                .filter(m -> blank(evaluator) || evaluator.equals(m.get("evaluatorEmpNo")))
                .filter(m -> blank(band) || band.equals(m.get("band")))
                .filter(m -> blank(recommendation) || recommendation.equals(m.get("recommendation")))
                .filter(m -> blank(needle) || (m.get("candidateName") + " " + m.get("candidateEpNo") + " " + m.get("title"))
                        .toLowerCase(Locale.ROOT).contains(needle))
                .toList();
    }

    // ------------------------------------------------------------ import

    @PostMapping("/questions/import")
    public Map<String, Object> importPreview(@RequestParam("file") MultipartFile file,
                                             @RequestParam(required = false) String band,
                                             @RequestParam(required = false) String topic,
                                             @RequestParam(required = false) String difficulty) {
        return importer.preview(file, new ImportService.Defaults(band, topic, difficulty));
    }

    @PostMapping("/questions/bulk")
    public Map<String, Object> bulk(@RequestAttribute(AuthInterceptor.ATTR) Session s, @RequestBody List<Map<String, Object>> rows) {
        List<Question> list = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> existing = new HashSet<>();
        questions.findAll().stream().filter(Question::isActive).forEach(q -> existing.add(key(q.getText())));
        int duplicates = 0;
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> r = rows.get(i);
            try {
                String text = Maps.str(r, "text");
                if (text != null && !existing.add(key(text))) { duplicates++; continue; }
                Question q = new Question();
                List<String> options = r.get("options") instanceof List<?> l ? l.stream().map(String::valueOf).map(String::trim).filter(x -> !x.isEmpty()).toList() : List.of();
                int correct = r.get("correctIndex") instanceof Number n ? n.intValue() : -1;
                String band = Bands.normalize(Maps.str(r, "band"));
                String topic = Maps.str(r, "topic");
                if (text == null || text.isBlank() || options.size() < 2 || correct < 0 || correct >= options.size() || band == null || topic == null || topic.isBlank())
                    throw new IllegalArgumentException("incomplete");
                q.setText(text);
                q.setOptions(new ArrayList<>(options));
                q.setCorrectIndex(correct);
                q.setBand(band);
                q.setTopic(topic);
                q.setDifficulty(Optional.ofNullable(Bands.difficulty(Maps.str(r, "difficulty"))).orElse("MEDIUM"));
                q.setExplanation(Maps.str(r, "explanation"));
                q.setSource("IMPORT");
                q.setCreatedBy(s.id());
                list.add(q);
            } catch (IllegalArgumentException e) {
                errors.add("Row " + (i + 1) + " skipped: missing text, options, answer, band or topic");
            }
        }
        questions.saveAll(list);
        return Maps.of("saved", list.size(), "duplicates", duplicates, "errors", errors);
    }

    // ------------------------------------------------------------ settings

    @GetMapping("/settings")
    public Map<String, Object> getSettings() { return settings.all(); }

    @PutMapping("/settings")
    public Map<String, Object> putSettings(@RequestBody Map<String, Object> body) { return settings.update(body); }

    // ------------------------------------------------------------ helpers

    private Candidate candidate(String ep) {
        return candidates.findById(ExamService.norm(ep)).orElseThrow(() -> ApiException.notFound("Candidate " + ep + " not found."));
    }

    private Evaluator evaluator(String emp) {
        return evaluators.findById(ExamService.norm(emp)).orElseThrow(() -> ApiException.notFound("Evaluator " + emp + " not found."));
    }

    private String evaluatorOrNull(String emp) {
        if (emp == null || emp.isBlank()) return null;
        Evaluator e = evaluator(emp);
        if (!e.isActive()) throw ApiException.bad("Evaluator " + e.getEmpNo() + " is inactive.");
        return e.getEmpNo();
    }

    private static String key(String text) { return text == null ? "" : text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", ""); }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
}
