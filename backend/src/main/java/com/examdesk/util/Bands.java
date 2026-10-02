package com.examdesk.util;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Experience bands and difficulty levels used across the assessment. */
public final class Bands {
    private Bands() {}

    public static final List<String> ALL = List.of("0-5", "6-10", "10-15", "15+");
    public static final List<String> DIFFICULTIES = List.of("EASY", "MEDIUM", "HARD");
    private static final Pattern NUM = Pattern.compile("(\\d+)");

    public static String fromYears(Double years) {
        if (years == null) return null;
        if (years <= 5) return "0-5";
        if (years <= 10) return "6-10";
        if (years <= 15) return "10-15";
        return "15+";
    }

    /** Accepts "0-5", "6 to 10", "15 plus", "12" etc. Returns null when unrecognised. */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim();
        if (ALL.contains(s)) return s;
        Matcher m = NUM.matcher(s);
        if (!m.find()) return null;
        int n = Integer.parseInt(m.group(1));
        if (n < 6) return "0-5";
        if (n < 10) return "6-10";
        if (n < 15) return "10-15";
        return "15+";
    }

    public static String difficulty(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim().toUpperCase();
        if (s.startsWith("E") || s.startsWith("L") || s.equals("1")) return "EASY";
        if (s.startsWith("H") || s.equals("3") || s.startsWith("ADV")) return "HARD";
        if (s.startsWith("M") || s.equals("2") || s.startsWith("INT")) return "MEDIUM";
        return null;
    }

    public static int distance(String a, String b) {
        int i = ALL.indexOf(a), j = ALL.indexOf(b);
        if (i < 0 || j < 0) return 9;
        return Math.abs(i - j);
    }
}
