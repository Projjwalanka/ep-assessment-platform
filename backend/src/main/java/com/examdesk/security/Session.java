package com.examdesk.security;

import java.time.Instant;

/** Authenticated principal. role = ADMIN | EVALUATOR | CANDIDATE; id = username / employee# / EP#. */
public record Session(String token, String role, String id, String name, Instant expiresAt) {
    public boolean isAdmin() { return "ADMIN".equals(role); }
    public boolean isEvaluator() { return "EVALUATOR".equals(role); }
    public boolean isCandidate() { return "CANDIDATE".equals(role); }
}
