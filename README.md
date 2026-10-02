# ExamDesk

MCQ and live-coding assessment portal for Java back-end hiring. Admins curate questions and map candidates to evaluators. Evaluators set papers. Candidates take timed tests with a Java editor. Every submission produces a scored profile with a 0–100 recommendation.

React (Vite) front end and Spring Boot 3.3 / Java 21 back end, shipped as one Docker image with an embedded H2 file database. No external services are needed.

## What's in it

**Roles and sign-in**
- **Candidate** signs in with an EP number and an access code issued by the admin.
- **Evaluator** signs in with an employee number and a password.
- **Admin** uses the username and password from the environment.

**Admin**
- Create and edit candidates (EP number is the key) and evaluators (employee number is the key). Issue access codes, reset passwords, deactivate.
- Map candidates to evaluators, one at a time or in bulk.
- Maintain the master question bank:
  - write questions one at a time, or import Excel, CSV, Word, PDF or TXT files with a preview before saving;
  - 222 Java questions are pre-loaded across the 0–5, 6–10, 10–15 and 15+ year bands, covering core Java, collections, concurrency, JVM, Spring, JPA, REST, microservices, messaging, security, SQL, testing and system design.
- Build predefined question sets. Give a count and a band and the generator balances difficulty and topics. Save the result as an editable template. Four sets ship pre-built, one per band.
- Maintain hands-on problems with a starter template, an optional reference solution and embedded visible or hidden tests. Twelve problems ship pre-built, each verified against its reference solution.
- See every evaluation with full history per candidate, filter it, and export it to CSV.
- Settings:
  - force evaluators to use admin sets only;
  - allow or block evaluator-written questions;
  - choose the MCQ vs hands-on weighting;
  - see the technology catalogue. Java is enabled; UI and QA are listed as planned.

**Evaluator**
- See the candidates mapped to them, with status, score and recommendation.
- Assign a paper by picking an admin set or own template, auto-generating one (count, band, focus topics), or hand-picking from the bank.
- Optionally add hands-on problems, choose timed or untimed, and set the minutes.
- Write new questions on the fly, with an option to add them to the master bank.
- Open reports and record a decision (Proceed, Hold or Reject) with notes.

**Candidate**
- Fill in a profile (required before starting).
- Take the assessment:
  - server-side timer with auto-submit when time runs out;
  - question navigator with flags;
  - autosave every 15 seconds;
  - Java editor with **Run tests**;
  - tab switches are recorded.

**Report**
- Recommendation gauge with the band's expected bar marked on it.
- Overall, MCQ, difficulty-weighted and hands-on scores.
- Topic radar and topic bars, plus strengths and gaps.
- Observations: tab switches, auto-submit, unanswered questions, likely guessing, band mismatch.
- Claimed skills checked against tested topics.
- Hands-on code with every test result, including hidden tests.
- Answer-by-answer review and full history. Printable, or save it as a PDF.

## How scoring works

- **MCQ score:** each question is weighted by difficulty (easy 1, medium 2, hard 3).
- **Hands-on score:** average share of tests passed, hidden tests included.
- **Overall score:** MCQ weight % × MCQ score + the rest × hands-on score. The weight defaults to 65 and is set in Settings. A paper without hands-on uses the MCQ score alone.
- **Recommendation score:** 0.85 × overall + 0.10 × skill-claim consistency + 0.05 × completion, minus 5 if the candidate left the window more than 5 times.

| Recommendation score | Label |
|---|---|
| 80 or more | Strongly recommend |
| 65–79 | Recommend |
| 50–64 | Consider for next round |
| Below 50 | Not recommended |

**Expected bar by band:** 55 for 0–5 years, 60 for 6–10, 65 for 10–15 and 70 for 15+. The report says whether the candidate is well above, meets, is slightly below, or is below the bar.

Scores and the report are frozen as a snapshot at submission, so later edits to questions never change past results.

## Demo data

With `SEED_DEMO=true` (the default), the first start loads demo users and about two months of simulated evaluations so the dashboards have something to show.

| Role | Login | Password / code |
|---|---|---|
| Admin | `admin` | `Admin@123` locally, or the value of `ADMIN_PASSWORD` |
| Evaluator | `E1001` (Anita Deshpande), `E1002` (Rahul Menon), `E1003` (no candidates) | `Eval@123` |
| Candidate | `EP10001` to `EP10012` | `WELCOME1` |

`EP10001` (Arjun Nair) has an unstarted paper, so you can walk through the candidate experience end to end. `EP10008` is not mapped to any evaluator.

**For real use**, start on a fresh database with `SEED_DEMO=false`. The question bank, hands-on library and admin sets are still loaded; only the demo people and evaluations are skipped. Set your own `ADMIN_PASSWORD`.

## Run locally

You need Java 21 (a JDK), Maven 3.9 and Node 20.

```bash
# back end on :8080 (creates ./data/examdesk.mv.db)
cd backend && mvn spring-boot:run

# front end on :5173 with hot reload; /api is proxied to :8080
cd frontend && npm install && npm run dev
```

Or run everything as one container:

```bash
docker build -t examdesk .
docker run -p 8080:8080 -v examdesk-data:/app/data -e ADMIN_PASSWORD=change-me examdesk
```

Open http://localhost:8080.

## Deploy on Render

1. Push this folder to a GitHub or GitLab repository.
2. In Render choose **New > Blueprint** and select the repository. `render.yaml` creates a Docker web service with a health check on `/api/health`.
3. Render generates `ADMIN_PASSWORD`. You'll find it under the service's **Environment** tab.

Things to know about Render:

- **Data persistence.** Without a persistent disk, the H2 database lives in the container and is wiped on every deploy and restart. Free services also spin down after inactivity. That's fine for a demo. For real hiring rounds, use a paid instance and uncomment the `disk` block in `render.yaml`, which mounts `/app/data`.
- **Memory.** The free instance has 512 MB, which is enough for a demo with one candidate coding at a time. Each **Run tests** briefly starts a 64 MB child JVM. For several candidates at once, use a larger plan and raise `RUNNER_MAX_PARALLEL`.
- **First request after idle.** On the free plan, the first request after the service has idled takes 30–60 seconds while the JVM starts.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `Admin@123` | Admin sign-in |
| `SEED_DEMO` | `true` | Load demo evaluators, candidates and evaluations on first start |
| `DATA_DIR` | `./data` (`/app/data` in Docker) | Folder for the H2 database file |
| `SESSION_HOURS` | `12` | Sign-in session length |
| `RUNNER_MAX_PARALLEL` | `1` | Hands-on runs allowed at the same time |
| `RUNNER_TIMEOUT` | `20` | Seconds before a run is stopped |
| `RUNNER_HEAP` | `64m` | Memory for each candidate code run |

## Importing questions

**Excel, CSV and Word tables.** Use one row per question with a header row. These columns are recognised: `Question`, `Option A`–`Option E` (or `Option 1`–`5`), `Answer`, `Topic`, `Level` (or `Band` / `Experience`), `Difficulty`, `Explanation`. The Import page has a CSV template to download.

**Answer** can be a letter (`B`), a number (`2`) or the exact option text.

**Level** accepts `0-5`, `6-10`, `10-15` or `15+`, and plain numbers like "7 years" map to the matching band.

**PDF, Word text and TXT** use numbered questions:

```
1. Which annotation marks a Spring Boot entry point?
A) @EnableAutoConfiguration only
B) @SpringBootApplication
C) @Configuration
D) @ComponentScan
Answer: B
Topic: Spring Boot
Level: 0-5
Difficulty: Easy
Explanation: It combines @Configuration, @EnableAutoConfiguration and @ComponentScan.
```

Defaults for band, topic and difficulty can be set on the Import page for files that don't include them. Questions whose text already exists in the bank are skipped.

## Writing hands-on tests

A test has a **call** and an **expected** value, both written in Java.

The **call** is an expression, for example:

```java
new Solution().twoSum(new int[]{2, 7, 11}, 9)
```

It can also be a block of statements ending in `return`, which is useful for stateful classes:

```java
LRUCache c = new LRUCache(2);
c.put(1, 1);
c.put(2, 2);
c.get(1);
c.put(3, 3);
return c.get(2);
```

The **expected** value is another Java expression, for example `new int[]{0, 1}` or `List.of("a", "b")`. Arrays, collections, maps and numbers are compared by value.

Mark a test **hidden** to keep it from candidates. Hidden tests run only at submission. Use **Check tests with reference solution** in the editor to confirm a new problem works before assigning it.

## Security notes

- Passwords are stored as BCrypt hashes. Sessions are random bearer tokens held in memory, so a restart signs everyone out. Candidates' answers are autosaved and aren't lost.
- Candidate access codes are stored so the admin can re-share them. Reset a code to revoke it.
- Login has a basic lockout after repeated failures.
- **Candidate code execution** is designed for an internal MVP:
  - code is compiled in-process and run in a separate JVM with a memory cap, an empty environment, a per-test timeout and a hard process timeout;
  - file, network, process, reflection and similar APIs are refused before compiling;
  - the container runs as a non-root user.

  This is not a full sandbox. If the portal is exposed to untrusted users on the public internet, run hands-on code in an isolated container service (for example Judge0, or a gVisor/Firecracker sandbox) and replace `CodeRunner` accordingly.
- Tab-switch counts and timing are signals for the evaluator, not proof of misconduct.

## Project layout

```
backend/    Spring Boot API (Java 21)
  src/main/java/com/examdesk/
    model/      JPA entities with JSON columns, no join tables
    repo/       Spring Data repositories
    security/   token sessions, role guard by path, BCrypt
    service/    exam lifecycle, scoring/report, generator, importer, code runner, seed, dashboards
    web/        REST controllers (/api/auth, /api/candidate, /api/common, /api/evaluator, /api/admin)
  src/main/resources/seed/   question bank and hands-on library (JSON)
frontend/   React 18 + Vite, Recharts, CodeMirror
tools/      generators for the seed JSON (Python)
Dockerfile, render.yaml
```

To change or extend the pre-loaded content, edit `tools/gen_questions.py` or `tools/gen_coding.py` and re-run them. They only load into an empty database, so content you add through the UI is never overwritten.
