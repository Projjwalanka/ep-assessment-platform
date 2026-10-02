package com.examdesk.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Deep links such as /report/12 are client-side routes: serve index.html so React Router can take over. */
@Component
public class SpaForwardFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        if ("GET".equals(req.getMethod()) && !path.equals("/") && !path.startsWith("/api")
                && !path.contains(".")) {
            req.getRequestDispatcher("/index.html").forward(req, res);
            return;
        }
        chain.doFilter(req, res);
    }
}
