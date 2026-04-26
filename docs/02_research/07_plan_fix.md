The full fix list — what to change before Claude Code runs
I'll group these into three tiers so you know what's blocking, what's annoying, and what's just polish.
Tier 1 — Blocking. Fix today before Claude Code starts.
Fix 1. Run the build gate. Close ADR-009.
ADR-009 is Proposed. Until it says Outcome A or Outcome B, Claude Code doesn't know whether to wire the live path or the recorded path. The plan's task S3-B1-T1 is the trigger. Run it, then edit ADR-009 to remove the template block and pick an outcome. This is more important than any other documentation work.
Fix 2. Resolve the modality-to-breath-pattern mapping.
The Intervention DDD has two parallel taxonomies and never connects them:

Affirmation modality: breath / witness / anchor
BreathPattern: natural / cyclic_sigh / extended_exhale
BreathPatternLibrary: State → BreathPattern

But which wins? If the affirmation is modality: anchor and the state is activated, does the user get cyclic_sigh (from State) or no breath pattern at all (because the modality is anchor)?
Fix: Add to the Intervention DDD §Public Interface that BreathPattern is selected by state only; modality is metadata used for affirmation diversity but does not drive the BreathGuide. Or pick the opposite. Pick one and write it down. Right now the DDD has both as load-bearing.
Fix 3. Reconcile the recency window number.
Three different numbers floating around:

Intervention DDD §Ubiquitous Language: "last 5"
Memory DDD §Public Interface: recentAffirmationIds() returns "last 5"
Earlier doc 05 §7 (which I reviewed earlier): "last 10"
Implementation plan task S5-B1-T2: "exclude last 5"

Pick one number. The new docs converged on 5; if doc 05 still says 10, banner-correct it. Otherwise Claude Code will pattern-match whichever it sees first and the test will be misaligned with the implementation.
Fix 4. Decide whether hr_bpm is in the Supabase schema or not.

ADR-006 cuts HRV
ADR-007 schema (in doc 05 §8) has hr_bpm column
Memory DDD §Aggregates writes hr_bpm "if available"
ADR-006 §Neutral defends keeping the field "for future analytics"

This is OK as long as the docs say the same OK in the same words. They don't quite. Either:

Remove hr_bpm from the schema entirely (cleaner), or
Add a one-line comment in ADR-007's schema noting "kept for V2 migration path; V1 writes one display sample, never used by classifier"

The "store an unused column" pattern is correct production thinking but it confuses agents because it looks like dead code.
Tier 2 — Annoying. Fix today or tomorrow, but not blocking.
Fix 5. Fix the ADR-011 promotion math.
ADR-011 says auth+RLS is 4-6 hours of work. The promotion criterion is "≥ 2 hours of focus time remaining." This is impossible. Either:

Mark ADR-011 Deferred — post-buildathon today (my recommendation), or
Change the criterion to "≥ 6 hours of focus time remaining at Day 6 09:00"

Right now Claude Code reads "if Day 6 has 2 hours of slack, do auth" and the gate fires correctly per the plan but the work doesn't fit. The agent will start auth, fail to finish, and ship broken. Pre-emptively defer it. Keep the ADR as a post-buildathon artifact.
Fix 6. Resolve the ADR-008 lock vs ADR-009 fallback contradiction.
ADR-008: WebSocket URL is hardcoded ws://localhost:8765/ws/sensing, no env var.
ADR-009 Outcome B: "Recording the fixture from a Linux machine if available."
If the daemon runs on a different machine on your LAN, the URL is not localhost. The locked constant breaks. Fix: ADR-008 should add: "Exception: when import.meta.env.DEV === true, the URL may be overridden by VITE_SENSING_WS_URL. Production builds (Vercel) always use the locked constant." Three lines of code, removes the contradiction.
Fix 7. Consolidate ADR-017 with the rest of the privacy story.
The Always-Local stub function exists to serve a test that exercises a code path no user can reach. This is over-engineered. Three ways to fix:
a) Drop ADR-017 entirely. Remove isAlwaysLocal() from V1. Remove the kill-switch test. Rely on the structural privacy from doc 05 §3 (raw vitals never reach the browser). README says "Always-Local toggle is post-buildathon."
b) Promote it. Spend 30 minutes shipping a real toggle UI that writes to localStorage. The function returns true or false based on real user choice. The test exercises both branches with real flow. This is the cleanest version.
c) Keep the stub. Accept the over-engineering. Document it explicitly: "the function and test exist to prove the contract before the UI ships."
My pick: (a) drop it. The structural privacy is the moat. The toggle UI is a v1.5 feature. Today, you're carrying complexity for nothing.
Fix 8. Add late_push and cumulative_load to the explicit-cuts list.
The triggers we discussed earlier (late_push, cumulative_load) are nowhere in the new docs. They were silently dropped between drafts. The State DDD lists 5 triggers and these aren't among them.
Fix: add a one-liner to the State DDD §Out of scope: "The late_push (post-10pm depletion) and cumulative_load (sustained sympathetic) triggers from earlier drafts are post-buildathon. V1's 5 triggers cover the demo arc."
This protects the agent from reintroducing them based on stale references.
Tier 3 — Polish. Optional, do during waiting time on Days 4–5.
Fix 9. The placeholder corpus needs writing today, not Day 5.
Plan task S5-B1-T1 says "if user-supplied corpus arrived: drop in. Else: ship 12-entry placeholder." The placeholder doesn't exist yet and you're solo. Write the 12-entry placeholder today during a waiting window (e.g., while cargo build runs). 4 affirmations × 3 states = 12 sentences. 30 minutes. Then Day 5 is just "ship the corpus, whether it's the placeholder or the real thing."
Fix 10. The Supabase whats_alive storage is half-specified.
Memory DDD says: "User-typed text lives only in IndexedDB in V1." Plan task S5-B2-T6 says: "no Supabase per ADR-007." But ADR-007 doesn't list whats_alive in the explicit no-list — it just lists the two tables and says "no other tables in V1."
This is fine semantically, but add a one-line invariant to ADR-007's §Decision: "no whats_alive table in V1; user-typed text persists only in IndexedDB." Closes the loop.
Fix 11. The release binary distribution path is single-machine.
Plan task S6-B3-T1 ships wifi-densepose-sensing-server-macos-arm64. Your demo machine is presumably an M-series Mac. But what if a judge tries the live URL on Linux or Windows? Recorded fallback covers them, but the README needs to be explicit: "Live mode requires macOS arm64 with the released binary. All other platforms use ?source=recorded." One sentence, prevents confused judges.
Three-line summary
The architecture is sound. The contradictions are small. They're all fixable in 60 minutes. Most are one-line edits to existing docs.
My top three actions for you, right now, in order:

Run the build gate and close ADR-009 (15 minutes)
Resolve the modality vs breath pattern mapping in the Intervention DDD (10 minutes; pick one rule, write it down)
Mark ADR-011 as Deferred — post-buildathon and remove ADR-017 entirely (10 minutes; reduces cognitive load by ~20%)

Do those three and Claude Code will run cleanly. The other 8 fixes are improvements, not blockers.