package com.examdesk.service;

import com.examdesk.util.Bands;
import com.examdesk.util.Maps;
import com.examdesk.web.ApiException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns an uploaded file into question drafts for preview. Nothing is saved here: the admin reviews the
 * preview and then posts the accepted rows to /api/admin/questions/bulk.
 *
 * Tabular files (CSV, XLSX, XLS, Word tables) are matched by header names; free text (PDF, Word paragraphs, TXT)
 * uses the numbered-question format described in the README.
 */
@Service
public class ImportService {

    private static final Pattern Q_START = Pattern.compile("^\\s*(?:Q(?:uestion)?\\s*\\.?\\s*\\d*\\s*[:.)\\-]|\\d{1,3}\\s*[.)]|\\d{1,3}\\s*:)\\s*(.*)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern OPTION = Pattern.compile("^\\s*(?:\\(([A-Ea-e])\\)|([A-Ea-e])\\s*[.):\\]])\\s+(.+)$");
    private static final Pattern ANSWER = Pattern.compile("^\\s*(?:correct\\s+)?(?:answer|ans|correct(?:\\s+option)?|key)\\s*[:\\-=]\\s*(.+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern META = Pattern.compile("^\\s*(topic|level|band|experience|difficulty|explanation|reason)\\s*[:\\-=]\\s*(.+)$", Pattern.CASE_INSENSITIVE);

    public record Defaults(String band, String topic, String difficulty) {}

    public Map<String, Object> preview(MultipartFile file, Defaults defaults) {
        if (file == null || file.isEmpty()) throw ApiException.bad("Choose a file to import.");
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("upload").toLowerCase(Locale.ROOT);
        List<Map<String, Object>> rows;
        try (InputStream in = file.getInputStream()) {
            if (name.endsWith(".csv")) rows = fromTable(parseCsv(new String(in.readAllBytes(), StandardCharsets.UTF_8)), defaults);
            else if (name.endsWith(".xlsx") || name.endsWith(".xls")) rows = fromWorkbook(in, defaults);
            else if (name.endsWith(".docx")) rows = fromDocx(in, defaults);
            else if (name.endsWith(".pdf")) rows = fromText(pdfText(in), defaults);
            else if (name.endsWith(".txt") || name.endsWith(".md")) rows = fromText(new String(in.readAllBytes(), StandardCharsets.UTF_8), defaults);
            else throw ApiException.bad("Unsupported file type. Use CSV, Excel (.xlsx/.xls), Word (.docx), PDF or TXT.");
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.bad("Could not read the file: " + e.getMessage());
        }
        long valid = rows.stream().filter(r -> ((List<?>) r.get("errors")).isEmpty()).count();
        return Maps.of("fileName", file.getOriginalFilename(), "total", rows.size(), "valid", valid,
                "invalid", rows.size() - valid, "rows", rows);
    }

    // ---------- tabular ----------

    private List<Map<String, Object>> fromWorkbook(InputStream in, Defaults d) throws Exception {
        try (Workbook wb = WorkbookFactory.create(in)) {
            DataFormatter fmt = new DataFormatter();
            List<Map<String, Object>> out = new ArrayList<>();
            for (Sheet sheet : wb) {
                List<List<String>> table = new ArrayList<>();
                for (Row row : sheet) {
                    List<String> cells = new ArrayList<>();
                    for (int c = 0; c < Math.max(0, row.getLastCellNum()); c++) {
                        Cell cell = row.getCell(c);
                        cells.add(cell == null ? "" : fmt.formatCellValue(cell).trim());
                    }
                    table.add(cells);
                }
                out.addAll(fromTable(table, d));
            }
            return out;
        }
    }

    private List<Map<String, Object>> fromDocx(InputStream in, Defaults d) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(in)) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (XWPFTable t : doc.getTables()) {
                List<List<String>> table = new ArrayList<>();
                for (XWPFTableRow r : t.getRows()) {
                    List<String> cells = new ArrayList<>();
                    for (XWPFTableCell c : r.getTableCells()) cells.add(c.getText().trim());
                    table.add(cells);
                }
                if (headerIndex(table) >= 0) out.addAll(fromTable(table, d));
            }
            StringBuilder text = new StringBuilder();
            for (XWPFParagraph p : doc.getParagraphs()) text.append(p.getText()).append('\n');
            out.addAll(fromText(text.toString(), d));
            return out;
        }
    }

    private String pdfText(InputStream in) throws Exception {
        try (PDDocument pdf = Loader.loadPDF(in.readAllBytes())) {
            return new PDFTextStripper().getText(pdf);
        }
    }

    private int headerIndex(List<List<String>> table) {
        for (int i = 0; i < Math.min(5, table.size()); i++) {
            for (String c : table.get(i)) {
                String k = key(c);
                if (k.equals("question") || k.equals("questiontext") || k.equals("q")) return i;
            }
        }
        return -1;
    }

    private List<Map<String, Object>> fromTable(List<List<String>> table, Defaults d) {
        int h = headerIndex(table);
        if (h < 0) return List.of();
        List<String> header = table.get(h).stream().map(this::key).toList();
        int qCol = -1, ansCol = -1, topicCol = -1, bandCol = -1, diffCol = -1, explCol = -1;
        TreeMap<Integer, Integer> optionCols = new TreeMap<>();
        for (int i = 0; i < header.size(); i++) {
            String k = header.get(i);
            Matcher om = Pattern.compile("^(?:option|opt|choice)?([a-e1-5])$").matcher(k);
            if (k.equals("question") || k.equals("questiontext") || k.equals("q")) qCol = i;
            else if (k.startsWith("answer") || k.startsWith("correct") || k.equals("key") || k.equals("ans")) ansCol = i;
            else if (k.equals("topic") || k.equals("category") || k.equals("area")) topicCol = i;
            else if (k.equals("level") || k.equals("band") || k.startsWith("experience") || k.equals("exp")) bandCol = i;
            else if (k.startsWith("difficulty") || k.equals("complexity")) diffCol = i;
            else if (k.startsWith("explanation") || k.equals("reason") || k.equals("rationale")) explCol = i;
            else if (k.matches("^(option|opt|choice)[a-e1-5]$") && om.find()) {
                String t = om.group(1);
                int idx = Character.isDigit(t.charAt(0)) ? t.charAt(0) - '1' : t.charAt(0) - 'a';
                optionCols.put(idx, i);
            } else if (k.matches("^[a-e]$")) optionCols.put(k.charAt(0) - 'a', i);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (int r = h + 1; r < table.size(); r++) {
            List<String> row = table.get(r);
            String q = cell(row, qCol);
            if (q.isBlank()) continue;
            List<String> options = new ArrayList<>();
            for (int col : optionCols.values()) {
                String o = cell(row, col);
                if (!o.isBlank()) options.add(o);
            }
            out.add(draft(q, options, cell(row, ansCol), cell(row, topicCol), cell(row, bandCol),
                    cell(row, diffCol), cell(row, explCol), d, "Row " + (r + 1)));
        }
        return out;
    }

    // ---------- free text ----------

    List<Map<String, Object>> fromText(String text, Defaults d) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (text == null) return out;
        String[] lines = text.replace("\r", "").split("\n");
        StringBuilder q = null;
        List<String> options = new ArrayList<>();
        String answer = "", topic = "", band = "", diff = "", expl = "";
        int startLine = 0;
        boolean inOptions = false;
        for (int i = 0; i <= lines.length; i++) {
            String line = i < lines.length ? lines[i].strip() : null;
            Matcher qm = line == null ? null : Q_START.matcher(line);
            boolean newQuestion = line == null || (qm.matches() && !OPTION.matcher(line).matches() && (q == null || inOptions || !answer.isBlank()));
            if (newQuestion) {
                if (q != null && !q.toString().isBlank()) {
                    out.add(draft(q.toString().trim(), options, answer, topic, band, diff, expl, d, "Question at line " + startLine));
                }
                if (line == null) break;
                q = new StringBuilder(qm.group(1));
                options = new ArrayList<>();
                answer = topic = band = diff = expl = "";
                inOptions = false;
                startLine = i + 1;
                continue;
            }
            if (q == null || line.isBlank()) continue;
            Matcher am = ANSWER.matcher(line);
            Matcher mm = META.matcher(line);
            Matcher om = OPTION.matcher(line);
            if (am.matches()) answer = am.group(1).trim();
            else if (mm.matches()) {
                String k = mm.group(1).toLowerCase(Locale.ROOT), v = mm.group(2).trim();
                switch (k) {
                    case "topic" -> topic = v;
                    case "level", "band", "experience" -> band = v;
                    case "difficulty" -> diff = v;
                    default -> expl = v;
                }
            } else if (om.matches()) {
                options.add(om.group(3).trim());
                inOptions = true;
            } else if (inOptions && !options.isEmpty() && answer.isBlank()) {
                int last = options.size() - 1;
                options.set(last, options.get(last) + " " + line);
            } else if (!inOptions) {
                q.append('\n').append(line);
            } else if (!expl.isBlank()) {
                expl = expl + " " + line;
            }
        }
        return out;
    }

    // ---------- shared ----------

    private Map<String, Object> draft(String text, List<String> options, String answerRaw, String topic, String bandRaw,
                                      String diffRaw, String explanation, Defaults d, String source) {
        List<String> errors = new ArrayList<>();
        if (options.size() < 2) errors.add("Needs at least 2 options");
        if (options.size() > 6) errors.add("More than 6 options");
        int correct = resolveAnswer(answerRaw, options);
        if (correct < 0) errors.add(answerRaw == null || answerRaw.isBlank() ? "Correct answer is missing" : "Answer '" + answerRaw + "' doesn't match an option");
        String band = Optional.ofNullable(Bands.normalize(bandRaw)).orElse(Bands.normalize(d.band()));
        if (band == null) errors.add("Experience band is missing");
        String difficulty = Optional.ofNullable(Bands.difficulty(diffRaw)).orElse(Optional.ofNullable(Bands.difficulty(d.difficulty())).orElse("MEDIUM"));
        String t = topic == null || topic.isBlank() ? d.topic() : topic.trim();
        if (t == null || t.isBlank()) errors.add("Topic is missing");
        return Maps.of("source", source, "text", text, "options", options, "correctIndex", correct,
                "topic", t, "band", band, "difficulty", difficulty,
                "explanation", explanation == null || explanation.isBlank() ? null : explanation.trim(),
                "technology", "JAVA", "errors", errors);
    }

    static int resolveAnswer(String raw, List<String> options) {
        if (raw == null) return -1;
        String a = raw.trim().replaceAll("^[(\\[]|[)\\].]$", "").trim();
        if (a.isEmpty()) return -1;
        if (a.length() == 1 && Character.isLetter(a.charAt(0))) {
            int idx = Character.toLowerCase(a.charAt(0)) - 'a';
            return idx >= 0 && idx < options.size() ? idx : -1;
        }
        Matcher lead = Pattern.compile("^(?:option\\s*)?([A-Ea-e])(?:[).:\\s]|$)").matcher(a);
        if (lead.find() && a.length() <= 3) {
            int idx = Character.toLowerCase(lead.group(1).charAt(0)) - 'a';
            return idx < options.size() ? idx : -1;
        }
        if (a.matches("\\d")) {
            int idx = Integer.parseInt(a) - 1;
            return idx >= 0 && idx < options.size() ? idx : -1;
        }
        for (int i = 0; i < options.size(); i++) if (options.get(i).equalsIgnoreCase(a)) return i;
        Matcher m = Pattern.compile("^(?:option\\s*)?\\(?([A-Ea-e])\\)?[).:\\s-]+(.+)$").matcher(a);
        if (m.matches()) {
            int idx = Character.toLowerCase(m.group(1).charAt(0)) - 'a';
            return idx < options.size() ? idx : -1;
        }
        return -1;
    }

    private String key(String header) {
        return header == null ? "" : header.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static String cell(List<String> row, int col) {
        return col < 0 || col >= row.size() || row.get(col) == null ? "" : row.get(col).trim();
    }

    /** RFC-4180 style CSV (quoted fields, doubled quotes, embedded newlines). Also accepts ; or tab separators. */
    static List<List<String>> parseCsv(String s) {
        if (s.startsWith("\uFEFF")) s = s.substring(1);
        String firstLine = s.lines().findFirst().orElse("");
        char sep = firstLine.chars().filter(c -> c == ',').count() >= firstLine.chars().filter(c -> c == ';').count()
                ? (firstLine.indexOf('\t') >= 0 && firstLine.indexOf(',') < 0 ? '\t' : ',') : ';';
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder f = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < s.length() && s.charAt(i + 1) == '"') { f.append('"'); i++; }
                    else quoted = false;
                } else f.append(c);
            } else if (c == '"') quoted = true;
            else if (c == sep) { row.add(f.toString()); f.setLength(0); }
            else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < s.length() && s.charAt(i + 1) == '\n') i++;
                row.add(f.toString()); f.setLength(0);
                rows.add(row); row = new ArrayList<>();
            } else f.append(c);
        }
        if (f.length() > 0 || !row.isEmpty()) { row.add(f.toString()); rows.add(row); }
        return rows;
    }
}
