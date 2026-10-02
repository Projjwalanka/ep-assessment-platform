package com.examdesk.service;

import com.examdesk.model.TestCase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.tools.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Compiles candidate code in-process (javax.tools) and runs the generated test harness in a separate,
 * memory-capped JVM with an empty environment and a hard timeout. Suitable for an MVP on a single host;
 * for untrusted public traffic put this behind a container sandbox (see README).
 */
@Service
public class CodeRunner {

    public record TestResult(String name, boolean hidden, String status, boolean passed,
                             String actual, String expected, String error, long millis) {}

    public record RunResult(boolean compiled, String compileErrors, List<TestResult> tests,
                            int passed, int total, String console, boolean timedOut, String error) {
        public static RunResult failure(String message, int total) {
            return new RunResult(false, message, List.of(), 0, total, "", false, message);
        }
    }

    private static final String MARK = "@@TC\t";
    private static final Pattern PUBLIC_CLASS = Pattern.compile("public\\s+(?:final\\s+|abstract\\s+)*(?:class|record|enum|interface)\\s+(\\w+)");
    private static final Pattern PACKAGE = Pattern.compile("(?m)^\\s*package\\s+[\\w.]+\\s*;");
    private static final List<String> BLOCKED = List.of(
            "Runtime.getRuntime", "ProcessBuilder", "ProcessHandle", "System.exit", "System.getenv", "System.setProperty",
            "java.io.File", "FileInputStream", "FileOutputStream", "FileReader", "FileWriter", "RandomAccessFile",
            "java.nio.file", "Files.", "Paths.", "java.net", "Socket", "HttpClient", "URLConnection",
            "Class.forName", "ClassLoader", "java.lang.reflect", "setAccessible", "getDeclared", "sun.misc", "Unsafe",
            "java.lang.invoke", "MethodHandles", "JNI", "loadLibrary", "System.load");

    private final Semaphore permits;
    private final long processTimeoutSeconds;
    private final long testTimeoutMs;
    private final String childHeap;

    public CodeRunner(@Value("${app.runner.max-parallel:1}") int maxParallel,
                      @Value("${app.runner.process-timeout-seconds:20}") long processTimeoutSeconds,
                      @Value("${app.runner.test-timeout-ms:3000}") long testTimeoutMs,
                      @Value("${app.runner.child-heap:64m}") String childHeap) {
        this.permits = new Semaphore(Math.max(1, maxParallel), true);
        this.processTimeoutSeconds = processTimeoutSeconds;
        this.testTimeoutMs = testTimeoutMs;
        this.childHeap = childHeap;
    }

    /** @param waitSeconds how long to queue for a runner slot (submissions wait longer than "Run tests"). */
    public RunResult run(String code, List<TestCase> allTests, boolean includeHidden, long waitSeconds) {
        List<TestCase> tests = allTests == null ? List.of()
                : allTests.stream().filter(t -> includeHidden || !t.hidden()).toList();
        if (code == null || code.isBlank()) return RunResult.failure("No code submitted.", tests.size());

        List<String> blocked = BLOCKED.stream().filter(code::contains).toList();
        if (!blocked.isEmpty()) {
            return RunResult.failure("These APIs are not allowed in the assessment sandbox: "
                    + String.join(", ", blocked) + ". Remove them and run again.", tests.size());
        }
        boolean acquired;
        try {
            acquired = permits.tryAcquire(waitSeconds, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return RunResult.failure("Run was interrupted.", tests.size());
        }
        if (!acquired) return RunResult.failure("The code runner is busy. Wait a few seconds and run again.", tests.size());
        Path dir = null;
        try {
            dir = Files.createTempDirectory("examdesk-run");
            return execute(dir, code, tests);
        } catch (Exception e) {
            return RunResult.failure("Runner error: " + e.getMessage(), tests.size());
        } finally {
            permits.release();
            deleteQuietly(dir);
        }
    }

    private RunResult execute(Path dir, String rawCode, List<TestCase> tests) throws Exception {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) return RunResult.failure("Java compiler not available: run the server on a JDK, not a JRE.", tests.size());

        String code = PACKAGE.matcher(rawCode).replaceAll("");
        Matcher m = PUBLIC_CLASS.matcher(code);
        String fileName = (m.find() ? m.group(1) : "Solution") + ".java";
        Path src = dir.resolve(fileName);
        Files.writeString(src, code, StandardCharsets.UTF_8);

        String userErrors = compile(compiler, dir, src);
        if (userErrors != null) {
            return new RunResult(false, userErrors, List.of(), 0, tests.size(), "", false, null);
        }
        if (tests.isEmpty()) return new RunResult(true, null, List.of(), 0, 0, "", false, null);

        Path harness = dir.resolve("__Harness.java");
        Files.writeString(harness, harnessSource(tests), StandardCharsets.UTF_8);
        String harnessErrors = compile(compiler, dir, harness);
        if (harnessErrors != null) {
            return new RunResult(false, "Your code compiles, but the tests cannot call it. Check that class names, "
                    + "method names, parameter types and return types match the problem statement.\n\n" + harnessErrors,
                    List.of(), 0, tests.size(), "", false, null);
        }
        return runHarness(dir, tests);
    }

    private String compile(JavaCompiler compiler, Path dir, Path file) throws IOException {
        DiagnosticCollector<JavaFileObject> diags = new DiagnosticCollector<>();
        try (StandardJavaFileManager fm = compiler.getStandardFileManager(diags, Locale.ENGLISH, StandardCharsets.UTF_8)) {
            Iterable<? extends JavaFileObject> units = fm.getJavaFileObjects(file.toFile());
            List<String> opts = List.of("-d", dir.toString(), "-classpath", dir.toString(), "-proc:none", "-nowarn", "-Xlint:none", "-g:none");
            Boolean ok = compiler.getTask(null, fm, diags, opts, null, units).call();
            if (Boolean.TRUE.equals(ok)) return null;
        }
        return diags.getDiagnostics().stream()
                .filter(d -> d.getKind() == Diagnostic.Kind.ERROR)
                .limit(15)
                .map(d -> (file.getFileName().toString().startsWith("__") ? "Test call" : "Line " + d.getLineNumber())
                        + ": " + d.getMessage(Locale.ENGLISH))
                .collect(Collectors.joining("\n"));
    }

    private RunResult runHarness(Path dir, List<TestCase> tests) throws Exception {
        String javaBin = Paths.get(System.getProperty("java.home"), "bin", "java").toString();
        ProcessBuilder pb = new ProcessBuilder(javaBin, "-Xmx" + childHeap, "-Xss4m", "-XX:+UseSerialGC",
                "-XX:TieredStopAtLevel=1", "-XX:-UsePerfData", "-Xshare:auto", "-Djava.awt.headless=true",
                "-cp", dir.toString(), "__Harness");
        pb.directory(dir.toFile());
        pb.environment().clear(); // never leak server secrets (ADMIN_PASSWORD etc.) to candidate code
        pb.redirectErrorStream(true);
        Process p = pb.start();

        StringBuilder out = new StringBuilder();
        Thread reader = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                char[] buf = new char[4096];
                int n;
                while ((n = br.read(buf)) != -1) {
                    synchronized (out) { if (out.length() < 200_000) out.append(buf, 0, n); }
                }
            } catch (IOException ignored) { }
        });
        reader.setDaemon(true);
        reader.start();

        long budget = Math.min(processTimeoutSeconds, 5 + tests.size() * (testTimeoutMs / 1000 + 1));
        boolean finished = p.waitFor(budget, TimeUnit.SECONDS);
        if (!finished) p.destroyForcibly();
        reader.join(2000);

        String output;
        synchronized (out) { output = out.toString(); }
        Map<Integer, String[]> byIndex = new HashMap<>();
        StringBuilder console = new StringBuilder();
        for (String line : output.split("\n")) {
            if (line.startsWith(MARK)) {
                String[] f = line.substring(MARK.length()).split("\t", -1);
                if (f.length >= 6) byIndex.put(Integer.parseInt(f[0]), f);
            } else if (console.length() < 4000 && !line.isBlank()) {
                console.append(line).append('\n');
            }
        }

        List<TestResult> results = new ArrayList<>();
        int passed = 0;
        for (int i = 0; i < tests.size(); i++) {
            TestCase t = tests.get(i);
            String[] f = byIndex.get(i);
            if (f == null) {
                String why = finished ? "Test did not complete (program crashed or ran out of memory)." : "Stopped: total run time limit exceeded.";
                results.add(new TestResult(t.name(), t.hidden(), "ERROR", false, "", "", why, 0));
                continue;
            }
            boolean ok = "PASS".equals(f[1]);
            if (ok) passed++;
            results.add(new TestResult(t.name(), t.hidden(), f[1], ok, unesc(f[2]), unesc(f[3]), unesc(f[4]), parseLong(f[5])));
        }
        return new RunResult(true, null, results, passed, tests.size(), console.toString(), !finished, null);
    }

    String harnessSource(List<TestCase> tests) {
        StringBuilder calls = new StringBuilder();
        for (int i = 0; i < tests.size(); i++) {
            TestCase t = tests.get(i);
            String call = t.call() == null ? "null" : t.call().trim();
            boolean block = call.contains("return ") || call.endsWith(";");
            String actual = block ? "() -> { " + call + (call.endsWith(";") || call.endsWith("}") ? "" : ";") + " }" : "() -> (Object) (" + call + ")";
            String expected = "() -> (Object) (" + (t.expected() == null || t.expected().isBlank() ? "null" : t.expected().trim()) + ")";
            calls.append("        t(").append(i).append(", ").append(actual).append(", ").append(expected).append(");\n");
        }
        return """
                import java.util.*;
                import java.util.function.*;
                import java.util.stream.*;
                import java.util.concurrent.*;
                import java.util.concurrent.atomic.*;
                import java.math.*;

                public class __Harness {
                    interface Call { Object call() throws Throwable; }
                    static final long LIMIT = %d;

                    public static void main(String[] args) {
                %s        System.out.flush();
                        Runtime.getRuntime().halt(0);
                    }

                    static void t(int i, Call actual, Call expected) {
                        final Object[] box = new Object[1];
                        final Throwable[] err = new Throwable[1];
                        Thread th = new Thread(() -> { try { box[0] = actual.call(); } catch (Throwable e) { err[0] = e; } });
                        th.setDaemon(true);
                        long st = System.nanoTime();
                        th.start();
                        try { th.join(LIMIT); } catch (InterruptedException ignored) { }
                        long ms = (System.nanoTime() - st) / 1_000_000;
                        if (th.isAlive()) { emit(i, "TIMEOUT", "", "", "Timed out after " + LIMIT + " ms (infinite loop or too slow)", ms); return; }
                        Object exp;
                        try { exp = expected.call(); } catch (Throwable e) { emit(i, "ERROR", "", "", "Invalid expected value: " + e, ms); return; }
                        if (err[0] != null) {
                            Throwable e = err[0];
                            emit(i, "ERROR", "", str(exp), e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage()), ms);
                            return;
                        }
                        boolean ok = eq(box[0], exp);
                        emit(i, ok ? "PASS" : "FAIL", str(box[0]), str(exp), "", ms);
                    }

                    static boolean eq(Object a, Object b) {
                        if (a instanceof Number x && b instanceof Number y) {
                            if (a instanceof Double || a instanceof Float || b instanceof Double || b instanceof Float)
                                return Math.abs(x.doubleValue() - y.doubleValue()) < 1e-6;
                            return x.longValue() == y.longValue();
                        }
                        if (a instanceof Character && b instanceof String) return a.toString().equals(b);
                        return Objects.deepEquals(a, b);
                    }

                    static String str(Object o) {
                        if (o == null) return "null";
                        if (o.getClass().isArray()) { String s = Arrays.deepToString(new Object[]{o}); return s.substring(1, s.length() - 1); }
                        if (o instanceof String s) return "\\"" + s + "\\"";
                        if (o instanceof Character c) return "'" + c + "'";
                        return String.valueOf(o);
                    }

                    static void emit(int i, String status, String actual, String expected, String err, long ms) {
                        System.out.println("@@TC\\t" + i + "\\t" + status + "\\t" + esc(actual) + "\\t" + esc(expected) + "\\t" + esc(err) + "\\t" + ms);
                    }

                    static String esc(String s) {
                        if (s == null) return "";
                        s = s.replace("\\\\", "\\\\\\\\").replace("\\t", "\\\\t").replace("\\n", "\\\\n").replace("\\r", "");
                        return s.length() > 600 ? s.substring(0, 600) + "..." : s;
                    }
                }
                """.formatted(testTimeoutMs, calls);
    }

    private static String unesc(String s) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) {
                char n = s.charAt(++i);
                sb.append(n == 'n' ? '\n' : n == 't' ? '\t' : n);
            } else sb.append(c);
        }
        return sb.toString();
    }

    private static long parseLong(String s) {
        try { return Long.parseLong(s.trim()); } catch (Exception e) { return 0; }
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null) return;
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) { } });
        } catch (IOException ignored) { }
    }
}
