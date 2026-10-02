package com.examdesk.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory opaque bearer tokens: light-weight, no JWT library, revocable instantly. */
@Component
public class SessionStore {
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final long hours;

    public SessionStore(@Value("${app.session.hours:12}") long hours) { this.hours = hours; }

    public Session create(String role, String id, String name) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Session s = new Session(token, role, id, name, Instant.now().plus(Duration.ofHours(hours)));
        sessions.put(token, s);
        return s;
    }

    public Optional<Session> get(String token) {
        if (token == null) return Optional.empty();
        Session s = sessions.get(token);
        if (s == null) return Optional.empty();
        if (s.expiresAt().isBefore(Instant.now())) { sessions.remove(token); return Optional.empty(); }
        return Optional.of(s);
    }

    public void remove(String token) { if (token != null) sessions.remove(token); }

    public void removeFor(String role, String id) {
        sessions.values().removeIf(s -> s.role().equals(role) && s.id().equals(id));
    }

    @Scheduled(fixedDelay = 600_000)
    public void purgeExpired() {
        Instant now = Instant.now();
        sessions.values().removeIf(s -> s.expiresAt().isBefore(now));
    }
}
