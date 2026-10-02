package com.examdesk.util;

import java.util.LinkedHashMap;
import java.util.Map;

/** Ordered map builder that (unlike Map.of) accepts null values. */
public final class Maps {
    private Maps() {}

    public static Map<String, Object> of(Object... kv) {
        if (kv.length % 2 != 0) throw new IllegalArgumentException("key/value pairs expected");
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    public static String str(Map<String, ?> m, String key) {
        Object v = m.get(key);
        return v == null ? null : String.valueOf(v).trim();
    }

    public static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
