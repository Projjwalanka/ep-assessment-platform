package com.examdesk.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

/**
 * Path-based role guard:
 * /api/admin/** ADMIN, /api/evaluator/** EVALUATOR, /api/candidate/** CANDIDATE, /api/common/** ADMIN or EVALUATOR.
 */
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {
    public static final String ATTR = "session";
    private final SessionStore store;

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) return true;
        String header = req.getHeader("Authorization");
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : null;
        Session s = store.get(token).orElse(null);
        if (s == null) return deny(res, 401, "Your session has expired. Sign in again.");

        String path = req.getRequestURI();
        boolean allowed;
        if (path.startsWith("/api/admin/")) allowed = s.isAdmin();
        else if (path.startsWith("/api/evaluator/")) allowed = s.isEvaluator();
        else if (path.startsWith("/api/candidate/")) allowed = s.isCandidate();
        else if (path.startsWith("/api/common/")) allowed = s.isAdmin() || s.isEvaluator();
        else allowed = true;
        if (!allowed) return deny(res, 403, "You don't have access to this area.");

        req.setAttribute(ATTR, s);
        return true;
    }

    private boolean deny(HttpServletResponse res, int status, String msg) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"" + msg + "\"}");
        return false;
    }
}
