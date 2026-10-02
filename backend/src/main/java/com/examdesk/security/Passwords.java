package com.examdesk.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.security.SecureRandom;

public final class Passwords {
    private Passwords() {}

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(10);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

    public static String hash(String raw) { return ENCODER.encode(raw); }

    public static boolean matches(String raw, String hash) {
        return raw != null && hash != null && ENCODER.matches(raw, hash);
    }

    /** Human-friendly random code without ambiguous characters (0/O, 1/l). */
    public static String generate(int length) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }
}
