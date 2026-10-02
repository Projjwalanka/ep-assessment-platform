package com.examdesk.service;

import com.examdesk.model.AppSetting;
import com.examdesk.repo.SettingRepo;
import com.examdesk.util.Maps;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SettingsService {
    public static final String ENFORCE_ADMIN_SETS = "enforceAdminSets";
    public static final String ALLOW_EVALUATOR_QUESTIONS = "allowEvaluatorQuestions";
    public static final String MCQ_WEIGHT = "mcqWeight";

    private final SettingRepo repo;

    public boolean enforceAdminSets() { return Boolean.parseBoolean(get(ENFORCE_ADMIN_SETS, "false")); }

    public boolean allowEvaluatorQuestions() { return Boolean.parseBoolean(get(ALLOW_EVALUATOR_QUESTIONS, "true")); }

    /** Share of the overall score carried by MCQs when a paper also has hands-on problems (0-100). */
    public int mcqWeight() {
        try { return Math.max(0, Math.min(100, Integer.parseInt(get(MCQ_WEIGHT, "65")))); }
        catch (NumberFormatException e) { return 65; }
    }

    public Map<String, Object> all() {
        return Maps.of(
                ENFORCE_ADMIN_SETS, enforceAdminSets(),
                ALLOW_EVALUATOR_QUESTIONS, allowEvaluatorQuestions(),
                MCQ_WEIGHT, mcqWeight(),
                "technologies", technologies());
    }

    public Map<String, Object> update(Map<String, Object> body) {
        if (body.containsKey(ENFORCE_ADMIN_SETS)) put(ENFORCE_ADMIN_SETS, String.valueOf(Boolean.TRUE.equals(body.get(ENFORCE_ADMIN_SETS))));
        if (body.containsKey(ALLOW_EVALUATOR_QUESTIONS)) put(ALLOW_EVALUATOR_QUESTIONS, String.valueOf(Boolean.TRUE.equals(body.get(ALLOW_EVALUATOR_QUESTIONS))));
        if (body.get(MCQ_WEIGHT) instanceof Number n) put(MCQ_WEIGHT, String.valueOf(Math.max(0, Math.min(100, n.intValue()))));
        return all();
    }

    /** Technology catalogue. Only Java is enabled in this MVP; UI and QA are listed as planned. */
    public static List<Map<String, Object>> technologies() {
        return List.of(
                Maps.of("code", "JAVA", "name", "Java back-end", "enabled", true),
                Maps.of("code", "UI", "name", "UI / front-end", "enabled", false),
                Maps.of("code", "QA", "name", "QA / automation", "enabled", false));
    }

    private String get(String key, String def) {
        return repo.findById(key).map(AppSetting::getValue).orElse(def);
    }

    private void put(String key, String value) { repo.save(new AppSetting(key, value)); }
}
