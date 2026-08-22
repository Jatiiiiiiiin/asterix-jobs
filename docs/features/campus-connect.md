# Campus Connect

A separate track for college students, used for bulk campus recruiting. It sits behind its own access gate, distinct from normal candidate login.

## Getting in

A student picks their college from a dropdown (around 39 colleges are set up) and enters a 6-digit access code — each college has its own fixed code, handed out by the university's placement cell or an admin. A wrong code shows an error; the right one shows "Access Granted" and routes straight into the test. There's no self-serve way to skip this — you need both the right college and the right code.

## The test

A proctored, timed assessment:

- **Camera, microphone, and full-screen mode are required** before the test starts.
- Switching tabs or exiting full-screen gives **two warnings**, then **permanently blocks the account** — enforced on the admin side too, not just a client-side pop-up.
- **60-minute countdown**, auto-submits when time runs out.
- **52 questions total**, AI-generated: 25 aptitude/logical-reasoning multiple-choice, 25 technical multiple-choice (data structures, algorithms, OOP, databases, OS, networks, basic Python/Java/C++), and 2 open-ended coding problems. Difficulty is fixed at "moderate."

The paper is generated **once per college**, then reused for every student from that college — so everyone at the same school sits the identical test, not individually randomized questions.

## What happens after submitting

Score (correct answers out of total, as a percentage), the student's skills, and a resume link are saved. **The student doesn't see their score** — the completion screen just says results are under review and the recruitment team will follow up. Scores are only visible to admins, tiered as ELITE PERFORMER (≥80%), QUALIFIED (≥60%), or LOW SCORE (<40%), and exportable as CSV grouped by college — see [Admin tools](/features/admin#test-results).

::: warning A proctoring violation is a permanent block, not a warning-only flag
Two tab-switches or full-screen exits and the account is locked out — this isn't a soft nudge. If a student reports being unable to log back in after a test, this is very likely why; an admin has to manually unblock them (see [Admin tools](/features/admin#blocked-candidates)).
:::
