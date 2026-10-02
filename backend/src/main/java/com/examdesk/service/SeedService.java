package com.examdesk.service;

import com.examdesk.model.*;
import com.examdesk.repo.*;
import com.examdesk.security.Passwords;
import com.examdesk.util.Bands;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * First-start data: the 200+ question master bank, the hands-on library, four admin question sets and
 * (optionally, app.seed.demo=true) demo evaluators, candidates and historical evaluations so dashboards have data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SeedService implements ApplicationRunner {
    private final QuestionRepo questions;
    private final CodingProblemRepo problems;
    private final QuestionSetRepo sets;
    private final EvaluatorRepo evaluators;
    private final CandidateRepo candidates;
    private final ExamRepo exams;
    private final GeneratorService generator;
    private final EvaluationService evaluation;
    private final SettingsService settings;
    private final ObjectMapper mapper;

    @Value("${app.seed.demo:true}")
    private boolean seedDemo;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (questions.count() == 0) seedQuestions();
        if (problems.count() == 0) seedProblems();
        if (sets.count() == 0) seedSets();
        if (seedDemo && evaluators.count() == 0 && candidates.count() == 0) seedDemo();
    }

    private void seedQuestions() throws Exception {
        List<Map<String, Object>> raw = read("seed/questions.json");
        List<Question> list = new ArrayList<>();
        for (Map<String, Object> r : raw) {
            Question q = new Question();
            q.setTechnology("JAVA");
            q.setBand((String) r.get("band"));
            q.setTopic((String) r.get("topic"));
            q.setDifficulty((String) r.get("difficulty"));
            q.setText((String) r.get("text"));
            q.setOptions(mapper.convertValue(r.get("options"), new TypeReference<List<String>>() {}));
            q.setCorrectIndex(((Number) r.get("correctIndex")).intValue());
            q.setExplanation((String) r.get("explanation"));
            q.setSource("SEED");
            q.setCreatedBy("system");
            list.add(q);
        }
        questions.saveAll(list);
        log.info("Seeded {} master questions", list.size());
    }

    private void seedProblems() throws Exception {
        List<Map<String, Object>> raw = read("seed/coding-problems.json");
        List<CodingProblem> list = new ArrayList<>();
        for (Map<String, Object> r : raw) {
            CodingProblem p = new CodingProblem();
            p.setTitle((String) r.get("title"));
            p.setBand((String) r.get("band"));
            p.setDifficulty((String) r.get("difficulty"));
            p.setTopic((String) r.get("topic"));
            p.setSuggestedMinutes(((Number) r.get("suggestedMinutes")).intValue());
            p.setDescription((String) r.get("description"));
            p.setStarterCode((String) r.get("starterCode"));
            p.setReferenceSolution((String) r.get("referenceSolution"));
            p.setTestCases(mapper.convertValue(r.get("testCases"), new TypeReference<List<TestCase>>() {}));
            p.setPredefined(true);
            list.add(p);
        }
        problems.saveAll(list);
        log.info("Seeded {} hands-on problems", list.size());
    }

    private void seedSets() {
        List<Question> pool = questions.findAll();
        List<CodingProblem> cp = problems.findAll();
        Object[][] defs = {
                {"Java Associate (0–5 yrs)", "0-5", 20, 45, "Core Java, collections, Spring Boot basics and REST fundamentals with one warm-up coding task."},
                {"Java Senior Developer (6–10 yrs)", "6-10", 25, 55, "Spring, JPA, concurrency and microservice patterns with a practical data-processing task."},
                {"Java Lead (10–15 yrs)", "10-15", 25, 60, "Design trade-offs, resilience, performance and messaging, plus a design-heavy coding task."},
                {"Java Architect (15+ yrs)", "15+", 25, 60, "Distributed systems, architecture decisions, security and platform concerns."}};
        long seed = 11;
        for (Object[] d : defs) {
            GeneratorService.Generated g = generator.generate("JAVA", (String) d[1], (int) d[2], 1, null, pool, cp, seed++);
            QuestionSet s = new QuestionSet();
            s.setName((String) d[0]);
            s.setBand((String) d[1]);
            s.setDescription((String) d[4]);
            s.setQuestionIds(new ArrayList<>(g.questionIds()));
            s.setCodingIds(new ArrayList<>(g.codingIds()));
            s.setDurationMinutes((int) d[3]);
            s.setAdminDefined(true);
            sets.save(s);
        }
        log.info("Seeded {} admin question sets", defs.length);
    }

    // ------------------------------------------------------------------ demo

    private record Demo(String ep, String name, String email, double years, String company, String role, String skills,
                        String location, String evaluator, Double ability, int daysAgo, String decision, String notes) {}

    private void seedDemo() {
        String pwd = Passwords.hash("Eval@123");
        evaluators.saveAll(List.of(
                evaluator("E1001", "Anita Deshpande", "anita.deshpande@bank.example", "Payments Engineering", pwd),
                evaluator("E1002", "Rahul Menon", "rahul.menon@bank.example", "Core Banking Platforms", pwd),
                evaluator("E1003", "Priya Sharma", "priya.sharma@bank.example", "Cards & Lending", pwd)));

        List<Demo> demo = List.of(
                new Demo("EP10001", "Arjun Nair", "arjun.nair@example.com", 3.5, null, null, null, null, "E1001", null, 0, null, null),
                new Demo("EP10002", "Meera Iyer", "meera.iyer@example.com", 7, "Infosys", "Senior Software Engineer",
                        "Java, Spring Boot, Microservices, Kafka, PostgreSQL, JUnit", "Pune", "E1001", 0.85, 6, null, null),
                new Demo("EP10003", "Vikram Singh", "vikram.singh@example.com", 12, "TCS", "Technical Lead",
                        "Java, Spring Boot, Microservices, Oracle, System Design, Kubernetes", "Bengaluru", "E1002", 0.62, 3, null, null),
                new Demo("EP10004", "Sneha Kulkarni", "sneha.kulkarni@example.com", 2, "Wipro", "Software Engineer",
                        "Java, Spring Boot, REST, MySQL, Multithreading", "Mumbai", "E1001", 0.45, 20, "REJECT",
                        "Fundamentals need more depth, especially collections and concurrency. Re-assess in 6 months."),
                new Demo("EP10005", "Rohan Das", "rohan.das@example.com", 16, "Cognizant", "Principal Architect",
                        "Java, Microservices, System Design, Kafka, Spring Security, AWS", "Kolkata", "E1002", 0.78, 34, "PROCEED",
                        "Strong architecture reasoning. Move to the design panel round."),
                new Demo("EP10006", "Kavya Menon", "kavya.menon@example.com", 8, "Accenture", "Software Engineer III",
                        "Java, Spring Data JPA, Hibernate, REST APIs, Docker", "Hyderabad", "E1002", 0.70, 12, null, null),
                new Demo("EP10007", "Aditya Rao", "aditya.rao@example.com", 4, "HCLTech", "Software Engineer",
                        "Java 8, Streams, Spring Boot, SQL, JUnit, Mockito", "Chennai", "E1001", 0.66, 9, null, null),
                new Demo("EP10008", "Farhan Qureshi", "farhan.qureshi@example.com", 11, null, null, null, null, null, null, 0, null, null),
                new Demo("EP10009", "Neha Gupta", "neha.gupta@example.com", 5, "Capgemini", "Associate Consultant",
                        "Java, Spring Boot, REST APIs, Angular, SQL", "Noida", "E1001", 0.58, 48, "HOLD",
                        "Borderline. Check hands-on depth in a technical interview before deciding."),
                new Demo("EP10010", "Sanjay Patil", "sanjay.patil@example.com", 9, "LTIMindtree", "Lead Engineer",
                        "Java, Spring Boot, Microservices, RabbitMQ, Concurrency", "Pune", "E1002", 0.74, 55, "PROCEED",
                        "Good grasp of messaging and service boundaries."),
                new Demo("EP10011", "Divya Rao", "divya.rao@example.com", 13, "Tech Mahindra", "Technical Architect",
                        "Java, System Design, Spring Cloud, Security, Performance tuning", "Bengaluru", "E1002", 0.52, 67, "REJECT",
                        "Architecture answers were generic; weak on resilience patterns."),
                new Demo("EP10012", "Karan Malhotra", "karan.malhotra@example.com", 1.5, "Mphasis", "Associate Engineer",
                        "Java, Collections, Spring Boot, SQL", "Gurugram", "E1001", 0.72, 27, "PROCEED",
                        "Impressive for experience level. Proceed to manager round."));

        Map<String, QuestionSet> setByBand = sets.findAll().stream().filter(QuestionSet::isAdminDefined)
                .collect(Collectors.toMap(QuestionSet::getBand, Function.identity(), (a, b) -> a));
        Map<Long, Question> qMap = questions.findAll().stream().collect(Collectors.toMap(Question::getId, Function.identity()));
        Map<Long, CodingProblem> pMap = problems.findAll().stream().collect(Collectors.toMap(CodingProblem::getId, Function.identity()));
        Random rnd = new Random(42);

        for (Demo d : demo) {
            Candidate c = new Candidate();
            c.setEpNo(d.ep());
            c.setName(d.name());
            c.setEmail(d.email());
            c.setTotalExperience(d.years());
            c.setBand(Bands.fromYears(d.years()));
            c.setCurrentCompany(d.company());
            c.setCurrentRole(d.role());
            c.setPrimarySkills(d.skills());
            c.setLocation(d.location());
            c.setPhone(d.company() == null ? null : "+91 98" + (10000000 + rnd.nextInt(89999999)));
            c.setNoticePeriod(d.company() == null ? null : List.of("30 days", "60 days", "90 days").get(rnd.nextInt(3)));
            c.setEducation(d.company() == null ? null : List.of("B.E. Computer Science", "B.Tech IT", "MCA", "M.Tech Software Systems").get(rnd.nextInt(4)));
            c.setAccessCode("WELCOME1");
            c.setEvaluatorEmpNo(d.evaluator());
            c.setProfileCompleted(d.company() != null);
            c.setCreatedAt(Instant.now().minus(Duration.ofDays(d.daysAgo() + 5L)));
            candidates.save(c);

            QuestionSet set = setByBand.get(c.getBand());
            if (d.evaluator() == null || set == null) continue;
            if (d.ability() == null) {
                exams.save(newExam(c, set, d.evaluator(), Instant.now().minus(Duration.ofHours(3))));
                continue;
            }
            if (d.ep().equals("EP10003")) {  // an earlier, weaker attempt to show history
                simulate(c, set, d.evaluator(), 0.36, d.daysAgo() + 58, 2, "HOLD",
                        "Asked to re-attempt after brushing up on microservice resilience.", qMap, pMap, rnd);
            }
            int tabs = d.ep().equals("EP10004") ? 4 : rnd.nextInt(3);
            simulate(c, set, d.evaluator(), d.ability(), d.daysAgo(), tabs, d.decision(), d.notes(), qMap, pMap, rnd);
        }
        log.info("Seeded demo evaluators, {} candidates and historical evaluations", demo.size());
    }

    private void simulate(Candidate c, QuestionSet set, String evaluator, double ability, int daysAgo, int tabs,
                          String decision, String notes, Map<Long, Question> qMap, Map<Long, CodingProblem> pMap, Random rnd) {
        Instant submitted = Instant.now().minus(Duration.ofDays(daysAgo)).minus(Duration.ofMinutes(rnd.nextInt(600)));
        int used = (int) Math.round(set.getDurationMinutes() * (0.6 + rnd.nextDouble() * 0.35));
        Instant started = submitted.minus(Duration.ofMinutes(used));
        Exam e = newExam(c, set, evaluator, started.minus(Duration.ofHours(20 + rnd.nextInt(30))));
        e.setStatus(Exam.IN_PROGRESS);
        e.setStartedAt(started);
        e.setDeadline(started.plus(Duration.ofMinutes(set.getDurationMinutes())));
        e.setTabSwitches(tabs);

        Map<String, Integer> answers = new HashMap<>();
        List<Question> qs = new ArrayList<>();
        for (Long id : set.getQuestionIds()) {
            Question q = qMap.get(id);
            if (q == null) continue;
            qs.add(q);
            if (rnd.nextDouble() < 0.03) continue;
            double p = ability + switch (q.getDifficulty()) { case "EASY" -> 0.12; case "HARD" -> -0.12; default -> 0.0; };
            int n = q.getOptions().size();
            int choice = rnd.nextDouble() < p ? q.getCorrectIndex() : (q.getCorrectIndex() + 1 + rnd.nextInt(Math.max(1, n - 1))) % n;
            answers.put(String.valueOf(id), choice);
        }
        e.setAnswers(answers);

        Map<String, String> code = new HashMap<>();
        Map<Long, CodeRunner.RunResult> results = new HashMap<>();
        List<CodingProblem> ps = new ArrayList<>();
        for (Long id : set.getCodingIds()) {
            CodingProblem p = pMap.get(id);
            if (p == null) continue;
            ps.add(p);
            code.put(String.valueOf(id), ability >= 0.7 ? p.getReferenceSolution() : p.getStarterCode());
            List<CodeRunner.TestResult> tests = new ArrayList<>();
            int passed = 0;
            for (TestCase t : p.getTestCases()) {
                boolean ok = rnd.nextDouble() < Math.min(0.98, ability + 0.1);
                if (ok) passed++;
                tests.add(new CodeRunner.TestResult(t.name(), t.hidden(), ok ? "PASSED" : "FAILED", ok,
                        ok ? t.expected() : "(different value)", t.expected(), null, 3 + rnd.nextInt(40)));
            }
            results.put(id, new CodeRunner.RunResult(true, null, tests, passed, tests.size(), "", false, null));
        }
        e.setCode(code);
        e.setSubmittedAt(submitted);
        evaluation.evaluate(e, c, qs, ps, results, settings.mcqWeight());
        e.setStatus(Exam.SUBMITTED);
        if (decision != null) {
            e.setStatus(Exam.REVIEWED);
            e.setReviewDecision(decision);
            e.setReviewNotes(notes);
            e.setReviewedBy(evaluator.equals("E1001") ? "Anita Deshpande (E1001)" : "Rahul Menon (E1002)");
            e.setReviewedAt(submitted.plus(Duration.ofHours(18)));
        }
        exams.save(e);
    }

    private Exam newExam(Candidate c, QuestionSet set, String evaluator, Instant assignedAt) {
        Exam e = new Exam();
        e.setTitle(set.getName());
        e.setCandidateEpNo(c.getEpNo());
        e.setEvaluatorEmpNo(evaluator);
        e.setAssignedBy("EVALUATOR:" + evaluator);
        e.setSetId(set.getId());
        e.setBand(set.getBand());
        e.setQuestionIds(new ArrayList<>(set.getQuestionIds()));
        e.setCodingIds(new ArrayList<>(set.getCodingIds()));
        e.setDurationMinutes(set.getDurationMinutes());
        e.setAssignedAt(assignedAt);
        return e;
    }

    private static Evaluator evaluator(String emp, String name, String email, String dept, String hash) {
        Evaluator e = new Evaluator();
        e.setEmpNo(emp);
        e.setName(name);
        e.setEmail(email);
        e.setDepartment(dept);
        e.setPasswordHash(hash);
        return e;
    }

    private List<Map<String, Object>> read(String path) throws Exception {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return mapper.readValue(in, new TypeReference<List<Map<String, Object>>>() {});
        }
    }
}
