"""Builds backend/src/main/resources/seed/coding-problems.json.
Test 'call' is a Java expression or a statement block ending in return; 'expected' is a Java expression."""
import json, os

def T(name, call, expected, hidden=False):
    return {"name": name, "call": call, "expected": expected, "hidden": hidden}

P = []

P.append(dict(
 title="Reverse the words in a sentence", band="0-5", difficulty="EASY", topic="Core Java", minutes=15,
 description="""Implement `reverseWords(String s)` in class `Solution`.

Return the words of `s` in reverse order, separated by a single space. Leading, trailing and repeated spaces must be removed.

Examples
- "payment received today" -> "today received payment"
- "  hello   world " -> "world hello"
- "   " -> "" (empty string)""",
 starter="""public class Solution {

    public String reverseWords(String s) {
        // TODO: implement
        return "";
    }
}
""",
 ref="""public class Solution {
    public String reverseWords(String s) {
        if (s == null || s.isBlank()) return "";
        String[] parts = s.trim().split("\\\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = parts.length - 1; i >= 0; i--) {
            sb.append(parts[i]);
            if (i > 0) sb.append(' ');
        }
        return sb.toString();
    }
}
""",
 tests=[T("Simple sentence","new Solution().reverseWords(\"payment received today\")","\"today received payment\""),
        T("Extra spaces","new Solution().reverseWords(\"  hello   world \")","\"world hello\""),
        T("Single word","new Solution().reverseWords(\"ledger\")","\"ledger\""),
        T("Empty string","new Solution().reverseWords(\"\")","\"\"",True),
        T("Only spaces","new Solution().reverseWords(\"    \")","\"\"",True)]))

P.append(dict(
 title="Balanced brackets", band="0-5", difficulty="EASY", topic="Collections", minutes=15,
 description="""Implement `isBalanced(String s)` in class `Solution`.

Return `true` if every bracket `()`, `[]`, `{}` in `s` is closed in the correct order. Other characters are ignored.

Examples
- "{[()]}" -> true
- "([)]" -> false
- "amount(1)[2]" -> true""",
 starter="""import java.util.*;

public class Solution {

    public boolean isBalanced(String s) {
        // TODO: implement
        return false;
    }
}
""",
 ref="""import java.util.*;

public class Solution {
    public boolean isBalanced(String s) {
        Deque<Character> st = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') st.push(c);
            else if (c == ')' || c == ']' || c == '}') {
                if (st.isEmpty()) return false;
                char o = st.pop();
                if ((c == ')' && o != '(') || (c == ']' && o != '[') || (c == '}' && o != '{')) return false;
            }
        }
        return st.isEmpty();
    }
}
""",
 tests=[T("Nested","new Solution().isBalanced(\"{[()]}\")","true"),
        T("Crossed","new Solution().isBalanced(\"([)]\")","false"),
        T("With text","new Solution().isBalanced(\"amount(1)[2]\")","true"),
        T("Unclosed","new Solution().isBalanced(\"((\")","false",True),
        T("Closing first","new Solution().isBalanced(\")(\")","false",True),
        T("Empty","new Solution().isBalanced(\"\")","true",True)]))

P.append(dict(
 title="Two sum", band="0-5", difficulty="MEDIUM", topic="Collections", minutes=20,
 description="""Implement `twoSum(int[] nums, int target)` in class `Solution`.

Return the indices `[i, j]` (i < j) of the two numbers that add up to `target`. Exactly one solution exists. Aim for O(n) time.

Example
- nums = [2, 7, 11, 15], target = 9 -> [0, 1]""",
 starter="""import java.util.*;

public class Solution {

    public int[] twoSum(int[] nums, int target) {
        // TODO: implement
        return new int[0];
    }
}
""",
 ref="""import java.util.*;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[]{j, i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
""",
 tests=[T("Example","new Solution().twoSum(new int[]{2,7,11,15}, 9)","new int[]{0,1}"),
        T("Middle pair","new Solution().twoSum(new int[]{3,2,4}, 6)","new int[]{1,2}"),
        T("Duplicates","new Solution().twoSum(new int[]{3,3}, 6)","new int[]{0,1}",True),
        T("Negatives","new Solution().twoSum(new int[]{-4,10,5,-1}, 1)","new int[]{0,2}",True),
        T("Large input","int n = 200000; int[] a = new int[n]; for (int i = 0; i < n; i++) a[i] = i; return new Solution().twoSum(a, 399997);","new int[]{199998,199999}",True)]))

P.append(dict(
 title="First unique transaction code", band="0-5", difficulty="EASY", topic="Collections", minutes=15,
 description="""Implement `firstUniqueIndex(String s)` in class `Solution`.

Return the index of the first character that appears exactly once in `s`, or -1 if there is none.

Examples
- "swiftcode" -> 0 ('s')
- "aabbcdd" -> 4 ('c')
- "aabb" -> -1""",
 starter="""public class Solution {

    public int firstUniqueIndex(String s) {
        // TODO: implement
        return -1;
    }
}
""",
 ref="""import java.util.*;

public class Solution {
    public int firstUniqueIndex(String s) {
        Map<Character, Integer> count = new HashMap<>();
        for (char c : s.toCharArray()) count.merge(c, 1, Integer::sum);
        for (int i = 0; i < s.length(); i++) if (count.get(s.charAt(i)) == 1) return i;
        return -1;
    }
}
""",
 tests=[T("First char","new Solution().firstUniqueIndex(\"swiftcode\")","0"),
        T("Middle","new Solution().firstUniqueIndex(\"aabbcdd\")","4"),
        T("None","new Solution().firstUniqueIndex(\"aabb\")","-1"),
        T("Empty","new Solution().firstUniqueIndex(\"\")","-1",True),
        T("Last char","new Solution().firstUniqueIndex(\"xxyyz\")","4",True)]))

P.append(dict(
 title="Totals by account", band="6-10", difficulty="MEDIUM", topic="Java 8+", minutes=20,
 description="""Implement `totalsByAccount(List<String> txns)` in class `Solution`.

Each entry has the form `ACCOUNT:TYPE:AMOUNT` where TYPE is `CR` (credit) or `DR` (debit) and AMOUNT is a whole number of cents. Return a `Map<String, Long>` of the net balance change per account (credits positive, debits negative). Ignore malformed entries. Streams are encouraged.

Example
- ["A1:CR:500", "A2:DR:200", "A1:DR:150"] -> {A1=350, A2=-200}""",
 starter="""import java.util.*;
import java.util.stream.*;

public class Solution {

    public Map<String, Long> totalsByAccount(List<String> txns) {
        // TODO: implement
        return new HashMap<>();
    }
}
""",
 ref="""import java.util.*;
import java.util.stream.*;

public class Solution {
    public Map<String, Long> totalsByAccount(List<String> txns) {
        return txns.stream()
                .map(t -> t.split(":"))
                .filter(p -> p.length == 3 && (p[1].equals("CR") || p[1].equals("DR")) && p[2].matches("\\\\d+"))
                .collect(Collectors.groupingBy(p -> p[0],
                        Collectors.summingLong(p -> (p[1].equals("CR") ? 1 : -1) * Long.parseLong(p[2]))));
    }
}
""",
 tests=[T("Example","new Solution().totalsByAccount(List.of(\"A1:CR:500\", \"A2:DR:200\", \"A1:DR:150\"))","Map.of(\"A1\", 350L, \"A2\", -200L)"),
        T("Single account","new Solution().totalsByAccount(List.of(\"X:CR:1\", \"X:CR:2\", \"X:DR:3\"))","Map.of(\"X\", 0L)"),
        T("Malformed ignored","new Solution().totalsByAccount(List.of(\"A:CR:10\", \"bad\", \"B:XX:5\", \"C:DR:abc\"))","Map.of(\"A\", 10L)",True),
        T("Empty list","new Solution().totalsByAccount(List.of())","Map.of()",True)]))

P.append(dict(
 title="LRU cache", band="6-10", difficulty="MEDIUM", topic="Collections", minutes=25,
 description="""Implement class `LRUCache` with:
- `LRUCache(int capacity)`
- `int get(int key)` returns the value or -1 if absent
- `void put(int key, int value)` inserts or updates; when capacity is exceeded evict the least recently used entry

Both operations should be O(1). Keep the class non-public (it lives in Solution.java).""",
 starter="""import java.util.*;

class LRUCache {

    public LRUCache(int capacity) {
        // TODO
    }

    public int get(int key) {
        // TODO
        return -1;
    }

    public void put(int key, int value) {
        // TODO
    }
}
""",
 ref="""import java.util.*;

class LRUCache extends LinkedHashMap<Integer, Integer> {
    private final int capacity;

    public LRUCache(int capacity) {
        super(16, 0.75f, true);
        this.capacity = capacity;
    }

    public int get(int key) { return getOrDefault(key, -1); }

    public void put(int key, int value) { super.put(key, value); }

    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> e) { return size() > capacity; }
}
""",
 tests=[T("Evicts least recent","LRUCache c = new LRUCache(2); c.put(1, 1); c.put(2, 2); c.get(1); c.put(3, 3); return c.get(2);","-1"),
        T("Keeps recently used","LRUCache c = new LRUCache(2); c.put(1, 1); c.put(2, 2); c.get(1); c.put(3, 3); return c.get(1);","1"),
        T("Update refreshes","LRUCache c = new LRUCache(2); c.put(1, 1); c.put(2, 2); c.put(1, 10); c.put(3, 3); return c.get(1) + c.get(2);","9",True),
        T("Capacity one","LRUCache c = new LRUCache(1); c.put(1, 1); c.put(2, 2); return c.get(1) + \",\" + c.get(2);","\"-1,2\"",True)]))

P.append(dict(
 title="Duplicate payment detection", band="6-10", difficulty="MEDIUM", topic="Collections", minutes=20,
 description="""Implement `findDuplicates(List<String> paymentIds)` in class `Solution`.

Return the payment IDs that occur more than once, each reported once, in the order in which the second occurrence is seen.

Example
- ["P1","P2","P1","P3","P2","P1"] -> ["P1","P2"]""",
 starter="""import java.util.*;

public class Solution {

    public List<String> findDuplicates(List<String> paymentIds) {
        // TODO: implement
        return new ArrayList<>();
    }
}
""",
 ref="""import java.util.*;

public class Solution {
    public List<String> findDuplicates(List<String> ids) {
        Set<String> seen = new HashSet<>();
        Set<String> dup = new LinkedHashSet<>();
        for (String id : ids) if (!seen.add(id)) dup.add(id);
        return new ArrayList<>(dup);
    }
}
""",
 tests=[T("Example","new Solution().findDuplicates(List.of(\"P1\",\"P2\",\"P1\",\"P3\",\"P2\",\"P1\"))","List.of(\"P1\",\"P2\")"),
        T("No duplicates","new Solution().findDuplicates(List.of(\"A\",\"B\"))","List.of()"),
        T("Order of second occurrence","new Solution().findDuplicates(List.of(\"X\",\"Y\",\"Y\",\"X\"))","List.of(\"Y\",\"X\")",True),
        T("Empty","new Solution().findDuplicates(List.of())","List.of()",True)]))

P.append(dict(
 title="Merge overlapping settlement windows", band="10-15", difficulty="MEDIUM", topic="Core Java", minutes=20,
 description="""Implement `merge(int[][] intervals)` in class `Solution`.

Each interval is `[start, end]`. Merge all overlapping or touching intervals and return them sorted by start.

Example
- [[1,3],[8,10],[2,6],[15,18]] -> [[1,6],[8,10],[15,18]]
- [[1,4],[4,5]] -> [[1,5]]""",
 starter="""import java.util.*;

public class Solution {

    public int[][] merge(int[][] intervals) {
        // TODO: implement
        return new int[0][];
    }
}
""",
 ref="""import java.util.*;

public class Solution {
    public int[][] merge(int[][] intervals) {
        if (intervals.length == 0) return new int[0][];
        int[][] a = intervals.clone();
        Arrays.sort(a, Comparator.comparingInt(x -> x[0]));
        List<int[]> out = new ArrayList<>();
        int[] cur = a[0].clone();
        for (int i = 1; i < a.length; i++) {
            if (a[i][0] <= cur[1]) cur[1] = Math.max(cur[1], a[i][1]);
            else { out.add(cur); cur = a[i].clone(); }
        }
        out.add(cur);
        return out.toArray(new int[0][]);
    }
}
""",
 tests=[T("Example","new Solution().merge(new int[][]{{1,3},{8,10},{2,6},{15,18}})","new int[][]{{1,6},{8,10},{15,18}}"),
        T("Touching","new Solution().merge(new int[][]{{1,4},{4,5}})","new int[][]{{1,5}}"),
        T("Contained","new Solution().merge(new int[][]{{1,10},{2,3},{4,5}})","new int[][]{{1,10}}",True),
        T("Empty","new Solution().merge(new int[0][])","new int[0][]",True)]))

P.append(dict(
 title="Token bucket rate limiter", band="10-15", difficulty="HARD", topic="Concurrency", minutes=30,
 description="""Implement class `RateLimiter` (non-public, in Solution.java):
- `RateLimiter(int capacity, int refillPerSecond)` starts with a full bucket
- `boolean allow(long nowMillis)` returns true and consumes a token if one is available

Tokens refill continuously at `refillPerSecond` and never exceed `capacity`. Time is passed in explicitly so behaviour is deterministic. Make `allow` thread-safe.""",
 starter="""class RateLimiter {

    public RateLimiter(int capacity, int refillPerSecond) {
        // TODO
    }

    public synchronized boolean allow(long nowMillis) {
        // TODO
        return false;
    }
}
""",
 ref="""class RateLimiter {
    private final int capacity;
    private final double perMs;
    private double tokens;
    private long last = -1;

    public RateLimiter(int capacity, int refillPerSecond) {
        this.capacity = capacity;
        this.perMs = refillPerSecond / 1000.0;
        this.tokens = capacity;
    }

    public synchronized boolean allow(long now) {
        if (last >= 0 && now > last) tokens = Math.min(capacity, tokens + (now - last) * perMs);
        if (last < 0 || now > last) last = now;
        if (tokens >= 1) { tokens -= 1; return true; }
        return false;
    }
}
""",
 tests=[T("Burst up to capacity","RateLimiter r = new RateLimiter(3, 1); int ok = 0; for (int i = 0; i < 5; i++) if (r.allow(1000)) ok++; return ok;","3"),
        T("Refills over time","RateLimiter r = new RateLimiter(2, 1); r.allow(0); r.allow(0); boolean before = r.allow(500); boolean after = r.allow(1000); return before + \",\" + after;","\"false,true\""),
        T("Never exceeds capacity","RateLimiter r = new RateLimiter(2, 10); int ok = 0; for (int i = 0; i < 5; i++) if (r.allow(60000)) ok++; return ok;","2",True),
        T("Steady rate","RateLimiter r = new RateLimiter(1, 2); int ok = 0; for (long t = 0; t <= 2000; t += 100) if (r.allow(t)) ok++; return ok;","5",True)]))

P.append(dict(
 title="Top K frequent error codes", band="10-15", difficulty="MEDIUM", topic="Java 8+", minutes=20,
 description="""Implement `topK(String[] codes, int k)` in class `Solution`.

Return the `k` most frequent codes, ordered by frequency descending and, for ties, alphabetically ascending.

Example
- ["E42","E17","E42","E99","E17","E42"], k = 2 -> ["E42","E17"]""",
 starter="""import java.util.*;
import java.util.stream.*;

public class Solution {

    public List<String> topK(String[] codes, int k) {
        // TODO: implement
        return new ArrayList<>();
    }
}
""",
 ref="""import java.util.*;
import java.util.stream.*;

public class Solution {
    public List<String> topK(String[] codes, int k) {
        Map<String, Long> freq = Arrays.stream(codes).collect(Collectors.groupingBy(c -> c, Collectors.counting()));
        return freq.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(k).map(Map.Entry::getKey).collect(Collectors.toList());
    }
}
""",
 tests=[T("Example","new Solution().topK(new String[]{\"E42\",\"E17\",\"E42\",\"E99\",\"E17\",\"E42\"}, 2)","List.of(\"E42\",\"E17\")"),
        T("Tie broken alphabetically","new Solution().topK(new String[]{\"B\",\"A\",\"C\",\"B\",\"A\"}, 2)","List.of(\"A\",\"B\")"),
        T("k larger than distinct","new Solution().topK(new String[]{\"X\"}, 3)","List.of(\"X\")",True),
        T("Three-way tie","new Solution().topK(new String[]{\"c\",\"b\",\"a\"}, 2)","List.of(\"a\",\"b\")",True)]))

P.append(dict(
 title="Service startup order", band="15+", difficulty="HARD", topic="System Design", minutes=30,
 description="""Implement `startupOrder(Map<String, List<String>> deps)` in class `Solution`.

`deps` maps each service to the services it depends on (which must start first). Services that only appear as dependencies must also be started. Return a valid start order; when several services are ready at the same time, start them in alphabetical order. If there is a cycle, throw `IllegalStateException`.

Example
- {"payments": ["ledger","auth"], "ledger": ["db"], "auth": ["db"]} -> ["db","auth","ledger","payments"]""",
 starter="""import java.util.*;

public class Solution {

    public List<String> startupOrder(Map<String, List<String>> deps) {
        // TODO: implement (topological sort)
        return new ArrayList<>();
    }
}
""",
 ref="""import java.util.*;

public class Solution {
    public List<String> startupOrder(Map<String, List<String>> deps) {
        Map<String, Integer> indeg = new TreeMap<>();
        Map<String, List<String>> users = new HashMap<>();
        deps.forEach((svc, ds) -> {
            indeg.putIfAbsent(svc, 0);
            for (String d : ds) {
                indeg.putIfAbsent(d, 0);
                indeg.merge(svc, 1, Integer::sum);
                users.computeIfAbsent(d, k -> new ArrayList<>()).add(svc);
            }
        });
        PriorityQueue<String> ready = new PriorityQueue<>();
        indeg.forEach((s, n) -> { if (n == 0) ready.add(s); });
        List<String> order = new ArrayList<>();
        while (!ready.isEmpty()) {
            String s = ready.poll();
            order.add(s);
            for (String u : users.getOrDefault(s, List.of())) if (indeg.merge(u, -1, Integer::sum) == 0) ready.add(u);
        }
        if (order.size() != indeg.size()) throw new IllegalStateException("cycle");
        return order;
    }
}
""",
 tests=[T("Example","new Solution().startupOrder(Map.of(\"payments\", List.of(\"ledger\",\"auth\"), \"ledger\", List.of(\"db\"), \"auth\", List.of(\"db\")))","List.of(\"db\",\"auth\",\"ledger\",\"payments\")"),
        T("Independent services","new Solution().startupOrder(Map.of(\"b\", List.of(), \"a\", List.of()))","List.of(\"a\",\"b\")"),
        T("Cycle detected","try { new Solution().startupOrder(Map.of(\"a\", List.of(\"b\"), \"b\", List.of(\"a\"))); return \"no error\"; } catch (IllegalStateException e) { return \"cycle\"; }","\"cycle\"",True),
        T("Chain","new Solution().startupOrder(Map.of(\"c\", List.of(\"b\"), \"b\", List.of(\"a\")))","List.of(\"a\",\"b\",\"c\")",True)]))

P.append(dict(
 title="Circuit breaker state machine", band="15+", difficulty="HARD", topic="Microservices", minutes=30,
 description="""Implement class `CircuitBreaker` (non-public, in Solution.java):
- `CircuitBreaker(int failureThreshold, long openMillis)`
- `boolean allowRequest(long now)`
- `void recordSuccess()`
- `void recordFailure(long now)`
- `String state()` returns "CLOSED", "OPEN" or "HALF_OPEN"

Rules: starts CLOSED. `failureThreshold` consecutive failures open the breaker. While OPEN, requests are rejected until `openMillis` have passed since opening; the next `allowRequest` then moves to HALF_OPEN and allows exactly one trial request (further requests are rejected until it completes). A success in HALF_OPEN closes the breaker and resets failures; a failure reopens it. A success in CLOSED resets the failure count.""",
 starter="""class CircuitBreaker {

    public CircuitBreaker(int failureThreshold, long openMillis) {
        // TODO
    }

    public synchronized boolean allowRequest(long now) {
        // TODO
        return true;
    }

    public synchronized void recordSuccess() {
        // TODO
    }

    public synchronized void recordFailure(long now) {
        // TODO
    }

    public synchronized String state() {
        return "CLOSED";
    }
}
""",
 ref="""class CircuitBreaker {
    private final int threshold;
    private final long openMillis;
    private String state = "CLOSED";
    private int failures;
    private long openedAt;
    private boolean trialInFlight;

    public CircuitBreaker(int failureThreshold, long openMillis) {
        this.threshold = failureThreshold;
        this.openMillis = openMillis;
    }

    public synchronized boolean allowRequest(long now) {
        switch (state) {
            case "CLOSED": return true;
            case "OPEN":
                if (now - openedAt >= openMillis) { state = "HALF_OPEN"; trialInFlight = true; return true; }
                return false;
            default:
                if (trialInFlight) return false;
                trialInFlight = true;
                return true;
        }
    }

    public synchronized void recordSuccess() {
        failures = 0;
        trialInFlight = false;
        state = "CLOSED";
    }

    public synchronized void recordFailure(long now) {
        trialInFlight = false;
        if (state.equals("HALF_OPEN")) { state = "OPEN"; openedAt = now; return; }
        failures++;
        if (failures >= threshold) { state = "OPEN"; openedAt = now; }
    }

    public synchronized String state() { return state; }
}
""",
 tests=[T("Opens after threshold","CircuitBreaker b = new CircuitBreaker(3, 1000); for (int i = 0; i < 3; i++) b.recordFailure(0); return b.state() + \",\" + b.allowRequest(10);","\"OPEN,false\""),
        T("Half-open after wait","CircuitBreaker b = new CircuitBreaker(1, 1000); b.recordFailure(0); boolean first = b.allowRequest(1000); boolean second = b.allowRequest(1001); return b.state() + \",\" + first + \",\" + second;","\"HALF_OPEN,true,false\""),
        T("Success closes","CircuitBreaker b = new CircuitBreaker(1, 100); b.recordFailure(0); b.allowRequest(200); b.recordSuccess(); return b.state() + \",\" + b.allowRequest(201);","\"CLOSED,true\"",True),
        T("Trial failure reopens","CircuitBreaker b = new CircuitBreaker(1, 100); b.recordFailure(0); b.allowRequest(100); b.recordFailure(150); return b.state() + \",\" + b.allowRequest(200) + \",\" + b.allowRequest(250);","\"OPEN,false,true\"",True),
        T("Success resets count","CircuitBreaker b = new CircuitBreaker(2, 100); b.recordFailure(0); b.recordSuccess(); b.recordFailure(1); return b.state();","\"CLOSED\"",True)]))

def main():
    out = []
    for p in P:
        out.append({"title": p["title"], "band": p["band"], "difficulty": p["difficulty"], "topic": p["topic"],
                    "suggestedMinutes": p["minutes"], "description": p["description"], "starterCode": p["starter"],
                    "referenceSolution": p["ref"], "testCases": p["tests"]})
    path = os.path.join(os.path.dirname(__file__), "..", "backend", "src", "main", "resources", "seed", "coding-problems.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print("problems", len(out))

if __name__ == "__main__":
    main()
