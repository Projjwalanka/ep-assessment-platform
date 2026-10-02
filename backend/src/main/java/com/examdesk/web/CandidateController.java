package com.examdesk.web;

import com.examdesk.model.Candidate;
import com.examdesk.repo.CandidateRepo;
import com.examdesk.repo.ExamRepo;
import com.examdesk.security.AuthInterceptor;
import com.examdesk.security.Session;
import com.examdesk.service.CodeRunner;
import com.examdesk.service.ExamService;
import com.examdesk.service.Views;
import com.examdesk.util.Bands;
import com.examdesk.util.Maps;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/candidate")
@RequiredArgsConstructor
public class CandidateController {
    private final CandidateRepo candidates;
    private final ExamRepo exams;
    private final ExamService examService;
    private final Views views;

    @GetMapping("/me")
    public Map<String, Object> me(@RequestAttribute(AuthInterceptor.ATTR) Session s) {
        Candidate c = candidates.findById(s.id()).orElseThrow(() -> ApiException.notFound("Profile not found."));
        Map<String, Object> profile = views.candidate(c, Map.of(), null, false);
        profile.remove("evaluatorEmpNo");
        profile.remove("evaluatorName");
        return Maps.of("profile", profile,
                "exams", exams.findByCandidateEpNoOrderByAssignedAtDesc(c.getEpNo()).stream().map(views::examForCandidate).toList());
    }

    @PutMapping("/me")
    public Map<String, Object> update(@RequestAttribute(AuthInterceptor.ATTR) Session s, @RequestBody Map<String, Object> body) {
        Candidate c = candidates.findById(s.id()).orElseThrow(() -> ApiException.notFound("Profile not found."));
        String name = Maps.str(body, "name"), email = Maps.str(body, "email");
        Double years = body.get("totalExperience") instanceof Number n ? n.doubleValue() : parse(Maps.str(body, "totalExperience"));
        if (name == null || name.isBlank()) throw ApiException.bad("Name is required.");
        if (email == null || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw ApiException.bad("Enter a valid email address.");
        if (years == null || years < 0 || years > 50) throw ApiException.bad("Enter total experience in years (0–50).");
        c.setName(name);
        c.setEmail(email);
        c.setTotalExperience(years);
        c.setPhone(Maps.str(body, "phone"));
        c.setCurrentCompany(Maps.str(body, "currentCompany"));
        c.setCurrentRole(Maps.str(body, "currentRole"));
        c.setPrimarySkills(Maps.str(body, "primarySkills"));
        c.setNoticePeriod(Maps.str(body, "noticePeriod"));
        c.setLocation(Maps.str(body, "location"));
        c.setEducation(Maps.str(body, "education"));
        String summary = Maps.str(body, "summary");
        c.setSummary(summary != null && summary.length() > 2000 ? summary.substring(0, 2000) : summary);
        if (c.getBand() == null) c.setBand(Bands.fromYears(years));
        c.setProfileCompleted(true);
        candidates.save(c);
        return me(s);
    }

    @PostMapping("/exams/{id}/start")
    public Map<String, Object> start(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id) {
        return examService.start(s.id(), id);
    }

    @PutMapping("/exams/{id}/progress")
    public Map<String, Object> progress(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id,
                                        @RequestBody Map<String, Object> body) {
        return examService.saveProgress(s.id(), id, body);
    }

    @PostMapping("/exams/{id}/run")
    public CodeRunner.RunResult run(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        return examService.run(s.id(), id, body);
    }

    @PostMapping("/exams/{id}/submit")
    public Map<String, Object> submit(@RequestAttribute(AuthInterceptor.ATTR) Session s, @PathVariable Long id,
                                      @RequestBody(required = false) Map<String, Object> body) {
        return examService.submit(s.id(), id, body);
    }

    private static Double parse(String s) {
        try { return s == null || s.isBlank() ? null : Double.parseDouble(s.trim()); } catch (NumberFormatException e) { return null; }
    }
}
