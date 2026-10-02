package com.examdesk.web;

import com.examdesk.model.Candidate;
import com.examdesk.model.Evaluator;
import com.examdesk.repo.CandidateRepo;
import com.examdesk.repo.EvaluatorRepo;
import com.examdesk.security.AuthInterceptor;
import com.examdesk.security.Passwords;
import com.examdesk.security.Session;
import com.examdesk.security.SessionStore;
import com.examdesk.util.Maps;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {
    private final SessionStore sessions;
    private final CandidateRepo candidates;
    private final EvaluatorRepo evaluators;
    /** Simple brute-force brake: 8 failures per login id locks it for 5 minutes. */
    private final Map<String, int[]> failures = new ConcurrentHashMap<>();
    private final Map<String, Instant> lockedUntil = new ConcurrentHashMap<>();

    @Value("${app.admin.username}") private String adminUser;
    @Value("${app.admin.password}") private String adminPassword;
    @Value("${app.seed.demo:true}") private boolean demo;

    @GetMapping("/health")
    public Map<String, Object> health() { return Maps.of("status", "UP", "time", Instant.now(), "demo", demo,
            "defaultAdmin", "admin".equals(adminUser) && "Admin@123".equals(adminPassword)); }

    @PostMapping("/auth/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> body) {
        String role = String.valueOf(body.getOrDefault("role", "")).toUpperCase(Locale.ROOT);
        String loginId = Maps.str(body, "loginId");
        String password = body.get("password") == null ? "" : String.valueOf(body.get("password"));
        if (loginId == null || loginId.isBlank() || password.isBlank()) throw ApiException.bad("Enter your ID and password.");
        String key = role + ":" + loginId.toUpperCase(Locale.ROOT);
        Instant lock = lockedUntil.get(key);
        if (lock != null && lock.isAfter(Instant.now())) throw new ApiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                "Too many failed attempts. Try again in a few minutes.");

        Session s = switch (role) {
            case "ADMIN" -> constantEquals(loginId, adminUser) && constantEquals(password, adminPassword)
                    ? sessions.create("ADMIN", adminUser, "Administrator") : null;
            case "EVALUATOR" -> {
                Evaluator e = evaluators.findById(loginId.trim().toUpperCase(Locale.ROOT)).orElse(null);
                yield e != null && e.isActive() && Passwords.matches(password, e.getPasswordHash())
                        ? sessions.create("EVALUATOR", e.getEmpNo(), e.getName()) : null;
            }
            case "CANDIDATE" -> {
                Candidate c = candidates.findById(loginId.trim().toUpperCase(Locale.ROOT)).orElse(null);
                yield c != null && c.isActive() && c.getAccessCode() != null && constantEquals(password.trim(), c.getAccessCode())
                        ? sessions.create("CANDIDATE", c.getEpNo(), c.getName() == null ? c.getEpNo() : c.getName()) : null;
            }
            default -> throw ApiException.bad("Choose candidate, evaluator or admin.");
        };
        if (s == null) {
            int[] f = failures.computeIfAbsent(key, k -> new int[1]);
            if (++f[0] >= 8) { lockedUntil.put(key, Instant.now().plusSeconds(300)); f[0] = 0; }
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "CANDIDATE".equals(role) ? "EP number or access code is incorrect." : "ID or password is incorrect.");
        }
        failures.remove(key);
        return me(s);
    }

    @PostMapping("/auth/logout")
    public Map<String, Object> logout(HttpServletRequest req) {
        Session s = (Session) req.getAttribute(AuthInterceptor.ATTR);
        if (s != null) sessions.remove(s.token());
        return Maps.of("ok", true);
    }

    @GetMapping("/auth/me")
    public Map<String, Object> current(@RequestAttribute(AuthInterceptor.ATTR) Session s) { return me(s); }

    private Map<String, Object> me(Session s) {
        Boolean profileCompleted = s.isCandidate() ? candidates.findById(s.id()).map(Candidate::isProfileCompleted).orElse(false) : null;
        return Maps.of("token", s.token(), "role", s.role(), "id", s.id(), "name", s.name(), "profileCompleted", profileCompleted);
    }

    private static boolean constantEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
