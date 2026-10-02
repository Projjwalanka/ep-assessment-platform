package com.examdesk.service;

import com.examdesk.model.CodingProblem;
import com.examdesk.model.Question;
import com.examdesk.util.Bands;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Builds a balanced paper: difficulty mix by experience band, topic spread (round-robin by least-used topic),
 * fallback to neighbouring bands when the requested band runs short.
 */
@Service
public class GeneratorService {
    private static final Map<String, double[]> MIX = Map.of(
            "0-5", new double[]{0.45, 0.45, 0.10},
            "6-10", new double[]{0.20, 0.60, 0.20},
            "10-15", new double[]{0.10, 0.50, 0.40},
            "15+", new double[]{0.05, 0.35, 0.60});

    public record Generated(List<Long> questionIds, List<Long> codingIds, int suggestedDuration, String note) {}

    public Generated generate(String technology, String band, int count, int codingCount, List<String> topics,
                              List<Question> pool, List<CodingProblem> codingPool, Long seed) {
        Random rnd = seed == null ? new Random() : new Random(seed);
        String tech = technology == null ? "JAVA" : technology;
        String target = Bands.ALL.contains(band) ? band : "0-5";
        List<Question> filtered = new ArrayList<>(pool.stream()
                .filter(q -> q.isActive() && tech.equalsIgnoreCase(q.getTechnology()))
                .filter(q -> topics == null || topics.isEmpty() || topics.contains(q.getTopic()))
                .toList());
        Collections.shuffle(filtered, rnd);

        int[] targets = split(Math.max(0, count), MIX.get(target));
        List<Question> chosen = new ArrayList<>();
        Map<String, Integer> topicUse = new HashMap<>();
        List<Question> primary = filtered.stream().filter(q -> target.equals(q.getBand())).toList();
        for (int d = 0; d < 3; d++) pick(primary, Bands.DIFFICULTIES.get(d), targets[d], chosen, topicUse);
        pick(primary, null, count - chosen.size(), chosen, topicUse);

        boolean borrowed = false;
        for (String b : bandsByDistance(target)) {
            if (chosen.size() >= count || b.equals(target)) continue;
            int before = chosen.size();
            pick(filtered.stream().filter(q -> b.equals(q.getBand())).toList(), null, count - chosen.size(), chosen, topicUse);
            borrowed |= chosen.size() > before;
        }
        chosen.sort(Comparator.comparingInt(q -> Bands.DIFFICULTIES.indexOf(q.getDifficulty())));

        List<CodingProblem> cp = new ArrayList<>(codingPool.stream()
                .filter(p -> p.isActive() && tech.equalsIgnoreCase(p.getTechnology())).toList());
        Collections.shuffle(cp, rnd);
        cp.sort(Comparator.comparingInt(p -> Bands.distance(target, p.getBand())));
        List<Long> codingIds = cp.stream().limit(Math.max(0, codingCount)).map(CodingProblem::getId).toList();

        int minutes = (int) Math.ceil(chosen.size() * 1.5)
                + cp.stream().limit(Math.max(0, codingCount)).mapToInt(p -> p.getSuggestedMinutes() == null ? 20 : p.getSuggestedMinutes()).sum();
        minutes = Math.max(10, (int) (Math.ceil(minutes / 5.0) * 5));
        String note = null;
        if (chosen.size() < count) note = "Only " + chosen.size() + " matching questions are available for these filters.";
        else if (borrowed) note = "Some questions were taken from neighbouring experience bands to reach the requested count.";
        return new Generated(chosen.stream().map(Question::getId).toList(), codingIds, minutes, note);
    }

    private static void pick(List<Question> source, String difficulty, int n, List<Question> chosen, Map<String, Integer> topicUse) {
        for (int k = 0; k < n; k++) {
            Question best = null;
            int bestUse = Integer.MAX_VALUE;
            for (Question q : source) {
                if (chosen.contains(q) || (difficulty != null && !difficulty.equals(q.getDifficulty()))) continue;
                int use = topicUse.getOrDefault(q.getTopic(), 0);
                if (use < bestUse) { best = q; bestUse = use; }
            }
            if (best == null) return;
            chosen.add(best);
            topicUse.merge(best.getTopic(), 1, Integer::sum);
        }
    }

    private static int[] split(int count, double[] mix) {
        int e = (int) Math.round(count * mix[0]);
        int h = (int) Math.round(count * mix[2]);
        int m = Math.max(0, count - e - h);
        return new int[]{e, m, h};
    }

    private static List<String> bandsByDistance(String target) {
        List<String> order = new ArrayList<>(Bands.ALL);
        order.sort(Comparator.comparingInt((String b) -> Bands.distance(target, b))
                .thenComparingInt(b -> -Bands.ALL.indexOf(b)));
        return order;
    }
}
