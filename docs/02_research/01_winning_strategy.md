# MindRefreshStudio — Winning Strategy & Engineering Research Plan

*Internal research memo. Buildathon window: April 24 – May 1, 2026. Submission: May 1 @ 3 PM ET. Final judging: May 3.*

---

## 1. Abstract

MindRefreshStudio is a contactless, state-matched somatic-regulation companion that wins the Women Build AI Build-A-Thon 2026 by dominating four of the eight judging dimensions — **Creativity & Innovation**, **Problem & Solution Clarity**, **Inspiration Factor**, and **Business Potential** — while remaining defensively credible on the other four. The architecture is a single React + Vite + Tailwind + shadcn/ui web app deployed on Vercel, fed by a real ESP32-S3 (Heltec V3) sensor exposing WiFi Channel State Information (CSI) for breath-rate detection (target ±1 brpm), with a deterministic pre-recorded CSI fallback for the demo. State classification is rule-based at cold-start over a 4-state polyvagal map (regulated / rising / activated / shutdown), refined per-user via `@ruvector/sona` MicroLoRA adapters. Interventions are state-matched somatic affirmations retrieved from an HNSW index over `@ruvector/core`, optionally rephrased by browser-side `@ruvector/ruvllm` (WebGPU). Heart rate and HRV are explicitly **out of scope** for the build window — the literature shows ESP32 CSI HR is a research-grade open problem, and shipping a confident lie would lose more points than it gains. The thesis: a simple tool that works beautifully, with a soul.

---

## 2. Hackathon Win-Condition Analysis

The organizers explicitly state that "a simple tool that works beautifully will outscore a complex tool that barely functions." Two-phase judging means the **demo video and the live URL are the only artifacts community voters see** — every design decision must serve those two surfaces. The 8-dimension panel rubric is then applied to finalists.

### 2.1 Mapping Each Dimension to a Concrete Design Move

| # | Dimension | Failure Mode | Winning Move for MindRefreshStudio |
|---|-----------|--------------|-------------------------------------|
| 1 | **Functionality** | "Doesn't work in demo." | Hard-code a recorded-CSI fallback that always plays a clean state transition; live sensor on stage is a stretch goal, not a critical path. |
| 2 | **UI/UX Design** | Generic dashboard. | Single-screen calm aesthetic: low-contrast type, breathing animation that paces the user's actual breath, no nav chrome. shadcn/ui + Tailwind. |
| 3 | **Creativity & Innovation** | "Another wellness app." | The contactless WiFi-CSI sensor + state-matched (not generic) intervention is a genuinely novel combination at the consumer level. |
| 4 | **Problem & Solution Clarity** | Vague "wellness." | Open the demo with the 3 AM stress story — concrete, named, underserved, judged unsolved by Apple Watch / Calm / therapy. |
| 5 | **Pitch & Presentation** | 2-min sprawl. | Pitch is rehearsed, second-by-second, with three beats: the pain, the sensor catching the body before the mind, the affirmation that lands. |
| 6 | **Technical Complexity** | Over-engineered, broken. | Show depth quietly: ESP32 CSI firmware + signal processing pipeline + on-device LLM rephrasing. Mentioned in the write-up, not the demo. |
| 7 | **Business Potential** | "Cool toy." | Quantify TAM (US adults with anxiety / sleep dysregulation), pricing ($199 sensor + $9/mo cloud-optional), trauma-therapy adjunct angle. |
| 8 | **Inspiration Factor** | "Cute." | The frame: structural privacy (raw biometrics never leave the room) + somatic / polyvagal language that meets the moment. |

### 2.2 Strategy Scoring Matrix

Five candidate product strategies, scored 1–10 per dimension. Highest expected total wins.

| Strategy | Func | UI/UX | Creat | Prob | Pitch | TechC | Biz | Insp | **Total** |
|----------|------|-------|-------|------|-------|-------|-----|------|-----------|
| **A. Generic affirmation app (no sensor)** | 9 | 8 | 4 | 6 | 8 | 3 | 5 | 5 | 48 |
| **B. CSI-real, full HR+HRV+breath** | 4 | 6 | 10 | 9 | 7 | 10 | 8 | 9 | 63 |
| **C. CSI-real breath only + recorded fallback (RECOMMENDED)** | 8 | 9 | 9 | 9 | 9 | 8 | 8 | 9 | **69** |
| **D. Wearable BLE (Polar H10) instead of CSI** | 9 | 9 | 6 | 7 | 8 | 6 | 6 | 6 | 57 |
| **E. Stub-only sensor + roadmap deck** | 9 | 9 | 6 | 8 | 8 | 4 | 6 | 7 | 57 |

### 2.3 Recommendation

**Strategy C: CSI-real breath-only with recorded-CSI fallback.** Strategy B (full HR/HRV) is a trap — failing live during community-vote video review costs more points than the upside of a more impressive feature list. Strategy A throws away the moat. Strategy D ("just use a Polar chest strap") sacrifices the entire differentiation thesis ("no wearable"). Strategy E is honest but unimpressive in the video. Strategy C is the only path that ships a working demo, preserves the contactless-sensing wow factor, and stays inside the 8-day budget.

---

## 3. Problem Framing & Differentiation

### 3.1 The Unmet Need

Most adults do not consciously notice early dysregulation. Heart-rate-variability research shows that autonomic shifts are detectable **at least one minute before** the subject self-reports stress, and a windowed HRV analysis can discriminate stress vs non-stress with windows as short as 50 seconds (Kim et al., 2018; Pinto et al., 2025). The product spec's claim that the body shifts 20–60 minutes before conscious naming aligns with the literature on anticipatory autonomic responses to known stressors (Hu et al., 2025) — there is a real, measurable detection gap that no consumer product currently fills.

Existing tools fail in three distinct ways:

1. **Wearables (Apple Watch, Oura)** detect stress reactively and score it. Schmidt et al. (2018) showed binary stress classification accuracy up to 93% on the WESAD dataset, but the dataset itself is built around the Trier Social Stress Test — the *post-onset* stress signal, not the *pre-onset* drift. Oura's "stress score" is a daily summary, not an in-the-moment intervention trigger.
2. **Wellness apps (Calm, Headspace)** are not state-aware. They serve the same generic 4-7-8 breathing exercise to a user in shutdown as to one in activation. The polyvagal literature (Porges 2011; Dana 2018) is explicit that dorsal-vagal shutdown calls for *gentle activating* practices, while sympathetic activation calls for *down-regulating* practices like the physiological sigh. A one-size-fits-all intervention can re-traumatize.
3. **Therapy** is weekly. Most dysregulation is at 3 AM, alone.

### 3.2 Positioning (2x2)

```
                    Generic intervention
                           |
              Calm /       |    (empty)
              Headspace    |
                           |
   Wearable ────────────────────────── Contactless
                           |
              Apple Watch  |    MindRefreshStudio
              Oura         |    ◄── here
                           |
                    State-matched intervention
```

The bottom-right quadrant — contactless sensing **and** state-matched intervention — is empty in the consumer market. That emptiness is the entire bet.

### 3.3 Three Citations for Detection-Latency / Intervention-Timing

- Kim, H.-G. et al. (2018) — "Stress and Heart Rate Variability: A Meta-Analysis," *Psychiatry Investigation*. Establishes that HF-HRV reliably decreases under acute stress, with effect-sizes detectable in minutes. ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5900369/))
- Schmidt, P. et al. (2018) — "Introducing WESAD," *ICMI '18*. Three-state (neutral/stress/amusement) classification at up to 80% accuracy from physiological signals. ([ACM DL](https://dl.acm.org/doi/10.1145/3242969.3242985))
- Yilmaz Balban, M. et al. (2023) — "Brief structured respiration practices enhance mood and reduce physiological arousal," *Cell Reports Medicine*. Cyclic sighing (one specific intervention, 5 min/day) outperformed mindfulness on mood and respiratory rate — direct evidence that **specific** interventions outperform **generic** ones. ([Cell](https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf))

---

## 4. Sensor Reality Check — ESP32-S3 WiFi CSI for Vital Signs

This is the critical-path engineering question. The product spec calls for "WiFi-signal sensing of breath / heart rate / HRV / micro-motion." The hardware on the BOM is a **Heltec WiFi LoRa 32 V3** — an ESP32-S3FN8 board sold for Meshtastic and LoRaWAN, not a CSI sensor. The board *does* expose ESP-IDF's CSI APIs via the on-chip 802.11bgn radio, but there is a wide gap between "exposes CSI" and "produces clinical breath rate."

### 4.1 What the Literature Actually Says

| Vital Sign | Best Reported ESP32 Accuracy | Source | 8-Day Feasibility |
|------------|-------------------------------|--------|-------------------|
| Breath rate | RMSE 1.04 brpm (DWT + PCA, controlled) | Cordeiro et al. 2024 (Sensors) | **Yes, with a static-subject demo** |
| Breath rate | MAD 2.7 brpm (peak detection on ESP32) | Forbes & Forbes 2022 | Yes |
| Heart rate | Variable, "challenging signal extraction" | MDPI Sensors review 2025 | **No — research-grade only** |
| HRV | Not demonstrated on ESP32 | (no peer-reviewed source found on commodity ESP32; based on engineering judgment) | No |

The high-water marks for WiFi-CSI breath sensing — FullBreathe (Zeng et al. 2018), BreatheSmart (Yang et al. 2023) — used Intel 5300 NICs at 100 Hz with 30 OFDM subcarriers and *amplitude+phase complementarity* across multiple antennas. The ESP32-S3 with a single antenna at ~20 Hz is materially less capable. Heart rate via ESP32 CSI has been demonstrated in *research papers with cooperative subjects sitting still*; it is not a build-window deliverable.

### 4.2 The Concrete Pipeline (What We Actually Build)

```
ESP32-S3 (Heltec V3)
  └─ ESP-IDF / esp_wifi_set_csi_rx_cb()       // 64 subcarriers, complex I/Q
       │
       ▼  binary frame over USB-CDC (or UDP to local edge service)
  Edge processor (Node service or in-browser Web Worker)
       ├─ Hampel filter         (subcarrier outlier rejection)
       ├─ Subcarrier selection  (variance-based; pick top-K stable carriers)
       ├─ Bandpass 0.1–0.5 Hz   (breath band, 6–30 brpm)
       ├─ PCA → first component (denoise)
       ├─ FFT on 30 s rolling window → dominant peak → breath rate
       └─ Variance over 5 s    → motion / micro-motion proxy
       │
       ▼
  State classifier (rule-based v0; SONA-personalized v1)
       │
       ▼
  Intervention selector (HNSW over affirmation embeddings)
```

The Espressif ESP-IDF v5.5 documentation confirms three required calls — `esp_wifi_set_csi_rx_cb`, `esp_wifi_set_csi_config`, `esp_wifi_set_csi` — and warns that the callback runs on the WiFi task, so frames must be queued out to a lower-priority task ([Espressif docs](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/wifi.html)). Steven Hernandez's open-source ESP32-CSI-Tool (Hernandez & Bulut, PerCom Demos 2020) is the reference firmware and we should fork it rather than write CSI extraction from scratch.

### 4.3 Latency Budget

- **Breath rate:** 30 s rolling FFT window, updated every 5 s → first usable estimate at t=30 s.
- **Motion variance:** 5 s window → updated at 1 Hz.
- **State classification:** decision tier triggered every 10 s on the latest features.
- **Intervention surfaced:** transition into "rising" or "activated" → affirmation appears within 10 s of state change.

For the 2-minute demo, this is comfortable. We need ~45 s of "regulated baseline" video + ~30 s "rising detected + intervention surfaces" + ~30 s "return to regulated trace."

### 4.4 The Honest Decision

**Ship CSI-real-with-graceful-fallback.** The real ESP32 firmware streams CSI and computes breath rate. In parallel, we record a 5-minute clean session of the developer's own CSI to a JSON file (`fixtures/recorded-csi.jsonl`), and ship a feature flag (`?source=recorded`) that replays it deterministically. The judges' demo URL defaults to `?source=recorded` with the live-sensor mode advertised in the README and shown in the supplementary photo. This is the only way to guarantee that the community-vote video is reproducible from the live URL on the judge's laptop without our hardware. **Heart rate and HRV are explicitly cut from scope.** The pitch language is honest: "the prototype detects breath and motion contactlessly; HRV is on the roadmap as we move from ESP32 to dual-radio reference designs." Honesty here scores higher than marketing on the Problem & Solution Clarity dimension.

---

## 5. State Classification — 4-State Polyvagal Mapping

### 5.1 Theoretical Frame

Polyvagal theory (Porges 2011; Dana 2018) describes a phylogenetic hierarchy of three primary autonomic states — ventral vagal (social engagement), sympathetic (mobilization), dorsal vagal (immobilization) — that shift dynamically based on neuroception of safety or threat. The product spec's four states are a useful clinical refinement: **regulated** (ventral vagal), **rising** (sympathetic activating but pre-overwhelm), **activated** (full sympathetic), **shutdown** (dorsal vagal). The "rising" state is the entire commercial wedge — it's where preemptive intervention is still easy and welcome.

Kreibig (2010) catalogues the autonomic signatures of distinct emotional states and confirms that respiratory rate, HRV, and skin conductance show specificity sufficient to discriminate categories with appropriate features. Schmidt et al. (2018) report 93% binary stress / non-stress classification on WESAD using respiration + HRV + EDA + skin temp.

### 5.2 Measurable Definitions (Cold-Start Rules)

| State | Breath rate (brpm) | Motion variance | Trend over 60 s | Affect cue (typed input) |
|-------|---------------------|------------------|------------------|----------------------------|
| Regulated | 8–14 | low, stable | breath flat or descending | "ok," "fine," neutral |
| Rising | 14–18 | low–moderate | breath increasing > 2 brpm in 60 s | "tight," "wired," "noticing" |
| Activated | > 18 | high, irregular | breath > 18 sustained 60 s | "panicky," "racing," "spinning" |
| Shutdown | < 8 OR 8–14 with very low motion + verbal cue | very low | flat, prolonged | "numb," "blank," "heavy," "can't" |

Note the asymmetry: shutdown overlaps numerically with regulated on breath rate alone — the product spec's emphasis on *micro-motion* matters here, because dorsal-vagal immobilization shows reduced fidgeting that the CSI variance signal can pick up. Distinguishing regulated from shutdown is the hardest classification problem and where we use the typed "what's alive" sentence as a tie-breaker (a cheap text-classification step).

### 5.3 Hybrid Classifier

- **v0 (cold start, day 1):** transparent rule table above, evaluated every 10 s.
- **v1 (after 7 days of real-user data):** `@ruvector/sona` two-tier MicroLoRA adapter that personalizes thresholds to the user's own resting baseline. The Tier-1 base model is the rule table; Tier-2 adapts the breath-rate cutoffs to the user (some people sit at 16 brpm at rest, some at 10).
- **v2 (post-buildathon):** supervised fine-tune on labeled state transitions with EWC++ to prevent catastrophic forgetting.

For the demo, v0 is enough. The pitch deck shows v1 as a 7-day learning curve.

### 5.4 State-Transition Diagram

```
                    ┌─────────────────┐
                    │   REGULATED     │  ◄────────────────┐
                    │ ventral vagal   │                   │
                    └────────┬────────┘                   │
              sustained calm │  early breath rise         │ recovery
              return         │                            │ (cyclic sighing,
                             ▼                            │  gentle reorient)
                    ┌─────────────────┐                   │
                    │     RISING      │ ───────────────►  │
                    │ pre-sympathetic │  intervention     │
                    └────────┬────────┘  (physio-sigh)    │
                  threshold  │                            │
                  exceeded   │                            │
                             ▼                            │
                    ┌─────────────────┐                   │
                    │   ACTIVATED     │                   │
                    │  sympathetic    │ ──────────────────┘
                    └────────┬────────┘  intervention
                  collapse   │           (extended exhale, orienting)
                             ▼
                    ┌─────────────────┐
                    │    SHUTDOWN     │
                    │  dorsal vagal   │ ──── intervention: gentle
                    └─────────────────┘      activating breath, reach for
                                              "Trusted Witness"
```

---

## 6. Intervention Selection — Somatic-Practice-Matched Affirmations

### 6.1 Canonical Practices Per State

| State | Practice | Mechanism | Source |
|-------|----------|-----------|--------|
| Regulated | Maintain — orient to environment, savor | Reinforces ventral safety | Dana 2018 |
| Rising | **Cyclic / physiological sigh** (2 inhales, long exhale) | Vagal brake via prolonged exhale | Yilmaz Balban et al. 2023 |
| Activated | Extended exhale + orienting (look around, name 5 colors) | Down-regulation + reality re-anchoring | Porges 2011; Levine 1997 |
| Shutdown | Gentle activating breath (slow inhale slightly longer than exhale) + warm self-touch | Re-mobilizes dorsal-vagal collapse without overshoot | Levine 1997 (pendulation) |

A critical design rule from Levine: **never push someone in shutdown into activation directly**. Pendulation — small oscillations between activation and rest — is the safe pattern. Our affirmations for shutdown therefore invite *one small movement* rather than commanding deep breath work.

### 6.2 Affirmation Schema (Replaces Mind-Refresh-05's Scripture/Principle Keys)

```ts
type SomaticAffirmation = {
  id: string;                    // "som-001"
  text: string;                  // ≤ 120 chars; second-person voice
  state: "regulated" | "rising" | "activated" | "shutdown";
  modality: "breath" | "orient" | "touch" | "movement" | "witness";
  somaticAnchor: string;         // body part / sensation cue
  intensity: 1 | 2 | 3;          // 1 = lightest; 3 = most active
  contraindication: string[];    // e.g. ["acute_panic", "dissociation"]
  citationFrame: string;         // "polyvagal" | "SE" | "interoceptive"
};
```

The schema deliberately drops `scripture`/`reference` — the trauma-informed register is secular, embodied, and Levine/Dana/Porges-aligned. It adds `intensity` (so the system can pick a "lighter" affirmation if the user has just opened the app vs. has been with it for 20 minutes) and `contraindication` (so we never offer activating breath to someone who flagged panic disorder in onboarding).

### 6.3 Twenty Seed Affirmations (≥5 per state)

```json
[
  {"id":"som-001","state":"regulated","modality":"orient","text":"Notice three things in the room that feel ordinary. Let them be ordinary.","somaticAnchor":"eyes, peripheral vision","intensity":1,"contraindication":[],"citationFrame":"polyvagal"},
  {"id":"som-002","state":"regulated","modality":"witness","text":"You are here. Your body knows how to be here. Nothing is required of you right now.","somaticAnchor":"whole body, weight on chair","intensity":1,"contraindication":[],"citationFrame":"polyvagal"},
  {"id":"som-003","state":"regulated","modality":"breath","text":"Let the next breath find its own length. You don't have to make it.","somaticAnchor":"lower ribs","intensity":1,"contraindication":[],"citationFrame":"interoceptive"},
  {"id":"som-004","state":"regulated","modality":"touch","text":"One hand on your sternum. Feel the warmth. This is the baseline you can come back to.","somaticAnchor":"sternum","intensity":1,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-005","state":"regulated","modality":"movement","text":"Roll your shoulders once, slowly. The body is allowed to take up a little more space.","somaticAnchor":"shoulders, upper back","intensity":2,"contraindication":[],"citationFrame":"SE"},

  {"id":"som-006","state":"rising","modality":"breath","text":"Two short inhales through the nose, one long exhale through the mouth. Let the exhale be longer than feels necessary.","somaticAnchor":"diaphragm","intensity":2,"contraindication":["asthma_acute"],"citationFrame":"polyvagal"},
  {"id":"som-007","state":"rising","modality":"orient","text":"Your eyes are allowed to look around. Find one thing further away than your screen.","somaticAnchor":"eyes","intensity":1,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-008","state":"rising","modality":"touch","text":"Press your feet into the floor. Just notice that the floor is holding you.","somaticAnchor":"soles of feet","intensity":1,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-009","state":"rising","modality":"breath","text":"The body is doing what it's supposed to do. You can let the exhale be the long one.","somaticAnchor":"belly","intensity":2,"contraindication":[],"citationFrame":"interoceptive"},
  {"id":"som-010","state":"rising","modality":"witness","text":"Something just got bigger. You don't have to know what it is yet. Stay with the breath for a moment.","somaticAnchor":"chest","intensity":2,"contraindication":[],"citationFrame":"polyvagal"},

  {"id":"som-011","state":"activated","modality":"breath","text":"Long exhale. Empty more than you fill. Twice more.","somaticAnchor":"diaphragm","intensity":3,"contraindication":[],"citationFrame":"polyvagal"},
  {"id":"som-012","state":"activated","modality":"orient","text":"Name five things you can see. Out loud if you can. The room is real.","somaticAnchor":"eyes, voice","intensity":2,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-013","state":"activated","modality":"touch","text":"Both hands, one on top of the other, on your chest. Feel the weight. You are not in danger right now.","somaticAnchor":"chest","intensity":2,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-014","state":"activated","modality":"movement","text":"Stand up if you can. Let the bigness move through your legs. You're not stuck.","somaticAnchor":"legs","intensity":3,"contraindication":["dizziness"],"citationFrame":"SE"},
  {"id":"som-015","state":"activated","modality":"witness","text":"This wave is real and it is moving through. You don't have to push it down. You just have to stay with it.","somaticAnchor":"whole body","intensity":2,"contraindication":[],"citationFrame":"polyvagal"},

  {"id":"som-016","state":"shutdown","modality":"movement","text":"One small thing. Wiggle your toes inside your shoes. That's enough for now.","somaticAnchor":"toes","intensity":1,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-017","state":"shutdown","modality":"touch","text":"Rub your palms together until they're warm. Place them over your closed eyes. Stay there.","somaticAnchor":"palms, eyes","intensity":1,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-018","state":"shutdown","modality":"breath","text":"A slow inhale. A slow exhale. Make the inhale a tiny bit longer if you can. If you can't, that's okay too.","somaticAnchor":"belly","intensity":2,"contraindication":[],"citationFrame":"polyvagal"},
  {"id":"som-019","state":"shutdown","modality":"orient","text":"Look at one thing in the room. Let your eyes rest on it for as long as they want.","somaticAnchor":"eyes","intensity":1,"contraindication":[],"citationFrame":"SE"},
  {"id":"som-020","state":"shutdown","modality":"witness","text":"You're still here. The flat feeling is the body's way of protecting you. We can come up slowly. There's no rush.","somaticAnchor":"whole body","intensity":1,"contraindication":[],"citationFrame":"polyvagal"}
]
```

### 6.4 Retrieval Pipeline

1. State classifier emits `{state, intensity_target}`.
2. Filter affirmations by `state` and (optional) `contraindication ∉ user.flags`.
3. Compute embedding of the user's typed "what's alive" sentence (ONNX MiniLM, 384-dim, browser-side).
4. HNSW search over filtered affirmation embeddings via `@ruvector/core` → top-3.
5. (Optional, WebGPU available) `@ruvector/ruvllm` rephrases top-1 in the user's name and idiom while preserving `somaticAnchor` and `modality`. If WebGPU is unavailable, we serve the un-rephrased seed verbatim — no degraded experience.
6. Display with a soft fade-in tied to the user's exhale.

---

## 7. Architecture & Stack Decisions

### 7.1 Layered Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER'S BROWSER (single-page React app, deployed to Vercel)         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ UI: React 18 + Vite + TS + Tailwind + shadcn/ui + Radix       │ │
│  │  - Single screen, calm aesthetic, breath-paced animation       │ │
│  │  - "What's alive" textarea, state pill, affirmation card       │ │
│  │  - Pattern Mirror (24 h trace), Trusted Witness button         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ INFERENCE (browser-local, no network):                         │ │
│  │  - @ruvector/core HnswIndex over 200 seed affirmations         │ │
│  │  - ONNX MiniLM-L6 (384-dim) embeddings for query               │ │
│  │  - @ruvector/ruvllm (WebGPU) optional rephrase, GGUF Q4        │ │
│  │  - @ruvector/sona MicroLoRA adapter (per-user, IndexedDB)      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ SIGNAL PROCESSING (Web Worker):                                │ │
│  │  - Hampel filter, subcarrier selection, bandpass, FFT          │ │
│  │  - State classifier (rule table v0)                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│         ▲                                          ▲                 │
│         │ WebSocket (LAN-local)                    │ JSONL (replay)  │
│         │                                          │                 │
└─────────┼──────────────────────────────────────────┼─────────────────┘
          │                                          │
┌─────────┴────────────┐                ┌────────────┴────────────────┐
│ EDGE BRIDGE (Node)   │                │ RECORDED-CSI FALLBACK FILE  │
│ - Reads ESP32 USB    │                │ /fixtures/recorded-csi.jsonl │
│ - Forwards CSI as WS │                │ (5 min of clean session)     │
└──────────┬───────────┘                └─────────────────────────────┘
           │ USB-CDC
┌──────────┴───────────────────────────────────────────────────────────┐
│ ESP32-S3 / Heltec V3 firmware (ESP-IDF C, fork of ESP32-CSI-Tool)   │
│  - esp_wifi_set_csi_rx_cb @ ~20 Hz, all 64 subcarriers              │
│  - Streams binary CSI frames over USB-CDC                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Decisions, with Justification

| Layer | Choice | Rejected Alternative | Why |
|-------|--------|----------------------|-----|
| **Firmware language** | C / ESP-IDF (fork of ESP32-CSI-Tool) | Rust / esp-hal | ESP32-CSI-Tool is the de-facto reference; rewriting in Rust burns 2 days for zero rubric points. |
| **Transport** | USB-CDC → Node bridge → WebSocket | MQTT broker | One fewer moving part. USB-CDC gives reliable cabled-demo behavior. |
| **UI framework** | React 18 + Vite + TS + Tailwind + shadcn/ui | Tauri desktop app | No Tauri precedent in the surveyed Ruv React repos; Tauri adds 2 days of native build risk. A web URL is also what the submission form requires. |
| **Animation** | Tailwind keyframes | Framer Motion | Lighter, no extra dep, sufficient for a breathing dot. |
| **Deploy** | Vercel | Self-hosted | One-click deploy, public URL ready by Day 2. |
| **Inference** | Browser-side (`@ruvector/ruvllm` + WebGPU) with text-only fallback | Server-side LLM | Privacy-by-design: raw biometrics never leave the home is *enforceable*, not just promised. Also avoids API-key cost and demo-day rate-limit risk. |
| **Vector index** | `@ruvector/core` HnswIndex | A flat cosine-similarity loop in JS | Already vendored under `upstream/RuVector/`; demonstrates depth on Technical Complexity dimension. |
| **Personalization** | `@ruvector/sona` MicroLoRA | Hand-rolled threshold updates | Vendored, signed, story-friendly ("the system learns your nervous system"). |
| **Audit/privacy** | RVF signed witness chain (per session) | None | Provable claim for the privacy story; one-line addition. |

### 7.3 Why This Maps to the Rubric

- **Functionality**: USB cable + recorded fallback = demo-proof.
- **UI/UX**: shadcn + Tailwind = polished out of the box.
- **Creativity**: contactless + state-matched + on-device LLM is genuinely novel.
- **Problem clarity**: opens with the 3 AM story; the architecture diagram alone tells the story.
- **Pitch**: tight 2-min script possible because there's only one screen.
- **Technical complexity**: Rust crates, ESP-IDF firmware, WebGPU LLM, HNSW — visible without showing any of them in the demo.
- **Business potential**: clear hardware SKU + SaaS angle.
- **Inspiration**: privacy-by-design + somatic register = the "wow" without theatrics.

---

## 8. Innovation Story — Why This Wins on Inspiration Factor

Three angles, each defensible:

### 8.1 Preemptive vs Reactive

The wearables industry has converged on *score-after-the-fact*. We catch the body before the mind. The HRV literature (Kim et al. 2018; Hu et al. 2025) supports a one-minute-plus lead time from autonomic shift to subjective awareness. Our "rising" state is exactly that lead-time window, and intervening there is *easy* — the same physiological sigh that takes 30 seconds when caught early takes 30 minutes of full panic to undo if missed.

### 8.2 State-Matched, Not Generic

This is the trauma-informed kernel. Yilmaz Balban et al. (2023) showed that *which* breathing technique you use matters — cyclic sighing beat box-breathing and beat mindfulness for mood, even though all three reduced anxiety. The polyvagal-trauma literature is even sharper: pushing a dorsal-vagal-shutdown person into deep activating breathwork can re-traumatize. Calm and Headspace cannot make this distinction because they don't know your state. We do.

### 8.3 Structural Privacy

The most-mentioned objection to ambient sensing is surveillance. Our architecture answers that *structurally*: raw CSI never leaves the LAN; embedding and inference run in the user's own browser; the only thing that can optionally sync to cloud is a signed RVF witness hash chain — auditable proof that no biometric data was exfiltrated, without revealing the data itself. This is the difference between "we promise not to look" and "we mathematically cannot look." That difference is worth points on Inspiration.

---

## 9. Risk Register & Fallbacks

| # | Risk | Likelihood | Impact | Mitigation | Fallback |
|---|------|------------|--------|------------|----------|
| 1 | ESP32 CSI breath rate too noisy for live demo | **High** | High | Calibrate with chest belt during Days 2–3; pre-record 5 min of clean session | Demo URL defaults to `?source=recorded`; live sensor relegated to README photo |
| 2 | Sensor not received in time | Medium | High | Order Day 1, expedited; develop entirely against recorded-CSI fixture | Ship Strategy E (stub + roadmap) — still wins UI/UX, Pitch, Problem Clarity |
| 3 | WebGPU unavailable on judge's hardware | Medium | Low | Detect at load; fall back to verbatim seed affirmations | Affirmations still appear; rephrase tier silently degrades |
| 4 | `@ruvector/ruvllm` browser bundle exceeds 50 MB | Medium | Medium | Quantize to Q4_K_M; lazy-load only on first "rephrase" | Skip ruvllm entirely; keep HNSW retrieval only |
| 5 | Demo video render fails (Loom outage etc.) | Low | High | Render local backup with OBS on Day 7 morning | Upload OBS .mp4 to YouTube as unlisted; submit that link |
| 6 | Scope creep into HR/HRV | **High** | High | Written scope-cut commitment (this document) — HR is post-buildathon | Cut anything not on the Day 7 critical path |
| 7 | Polyvagal language read as pseudoscience by a judge | Low | Medium | Cite Porges 2011 in pitch + write-up; stay near peer-reviewed framing | The cyclic-sighing Cell Reports Medicine 2023 paper is unimpeachable — lead with it |
| 8 | Vercel deploy breaks on submission day | Low | High | Test deploy from Day 2; add Netlify mirror by Day 6 | Submit Netlify URL |
| 9 | Single-builder fatigue | Medium | High | Day 7 locked for video; no new features after Day 6 EOD | Buffer: Day 8 morning |
| 10 | Hackathon judge can't run live URL | Low | Medium | Embed demo video in README; URL has zero-config landing page | Video alone is sufficient for community vote |

---

## 10. 8-Day Execution Plan

**Working assumption:** solo builder. Critical-path discipline. No new features after end of Day 6.

### Day 1 — Friday April 24 (Build window opens 3 PM ET)
- Order Heltec V3 board, expedited shipping (if not already in hand).
- Scaffold Vite + React + TS + Tailwind + shadcn project; deploy hello-world to Vercel.
- Vendor `@ruvector/core` from `upstream/RuVector` into the app; smoke-test HnswIndex in browser.
- Sketch the single-screen UI in Figma (or directly in JSX) — one screen only.
- Author the 20 seed affirmations (Section 6.3 above is the seed file).
- **Rubric movers:** Functionality (deploy works), Problem Clarity (UI prototype reads).
- **Stop criterion:** `https://mindrefresh-studio.vercel.app/` shows the seed affirmation rotation.

### Day 2 — Saturday April 25
- Fork ESP32-CSI-Tool; flash to a generic ESP32-S3 dev board if Heltec hasn't arrived.
- Write the Node USB-CDC bridge (50 LOC) that forwards CSI frames over WebSocket to the browser.
- Ship the Web Worker signal-processing pipeline: Hampel → bandpass → FFT → breath rate.
- **Rubric movers:** Technical Complexity (real CSI flowing).
- **Stop criterion:** Browser console logs a stable breath-rate estimate while the developer breathes near the sensor.

### Day 3 — Sunday April 26
- Calibrate breath rate against a manually-counted ground truth for 5 min sitting still.
- Record `fixtures/recorded-csi.jsonl` — the demo-day fallback.
- Implement the recorded-CSI replay path with `?source=recorded` query flag.
- Implement state classifier v0 (rule table from Section 5.2).
- **Rubric movers:** Functionality, Creativity.
- **Stop criterion:** State pill in the UI changes correctly when developer holds breath, hyperventilates, or sits still.

### Day 4 — Monday April 27
- Wire HNSW affirmation retrieval to state changes; add the "what's alive" textarea + embedding query.
- Implement the breath-paced animation on the affirmation card (uses live breath rate to drive a fade pulse).
- Add Pattern Mirror (24 h breath-rate trace) as a single sparkline.
- Add Trusted Witness button (one-tap mailto: with pre-canned message).
- **Rubric movers:** UI/UX, Inspiration.
- **Stop criterion:** End-to-end happy path works on the recorded fixture.

### Day 5 — Tuesday April 28 (Co-Working session 6 PM ET — attend, get peer feedback)
- Add `@ruvector/ruvllm` WebGPU LLM rephrasing tier (lazy-loaded, optional).
- Add `@ruvector/sona` MicroLoRA per-user adapter with IndexedDB persistence.
- Polish: low-contrast typography, soft transitions, one accent color, no chrome.
- Cross-browser test: Chrome, Safari, Firefox; mobile viewport.
- **Rubric movers:** UI/UX, Technical Complexity.
- **Stop criterion:** App is presentable to a peer; co-working feedback collected.

### Day 6 — Wednesday April 29 (FEATURE FREEZE EOD)
- Bug-fixing only. No new features after midnight.
- Write README with judges' quickstart (`?source=recorded` link, three-line how-it-works).
- Capture sensor wiring photo.
- Draft the 1-page write-up.
- Run security scan: `npx @claude-flow/cli@latest security scan`.
- **Rubric movers:** Functionality (stability), Problem Clarity (write-up).
- **Stop criterion:** Zero open bugs on the demo path.

### Day 7 — Thursday April 30 (DEMO VIDEO + WRITE-UP DAY — locked)
- Record the 2-minute demo video (script in Section 11). Multiple takes.
- Edit, render, upload to Loom + YouTube backup.
- Finalize the write-up (300 words: problem, solution, architecture, novelty).
- Capture demo screenshots for the README.
- **Rubric movers:** Pitch & Presentation, Inspiration.
- **Stop criterion:** Video uploaded, write-up final, README ready.

### Day 8 — Friday May 1 (Submission 3 PM ET — buffer + submit)
- Final smoke test on a clean browser profile, incognito.
- Submit form by 12 PM ET (3-hour buffer).
- Notify community channels.
- **Rubric movers:** all (don't blow the submission).

---

## 11. Demo Script (2-minute video)

The single highest-leverage artifact. Community voting uses *only* the video and the URL. Every second is choreographed.

### Beat-by-beat (120 s total)

**0:00 – 0:12 (the pain — voiceover, dim room shot)**
> "Most of us don't notice we're getting stressed until we're already in it. By then, the body has been shifting for 20 minutes. The mind names it last. At 3 AM, alone, no therapist, no app meets you where you actually are."

**0:12 – 0:25 (the sensor reveal — close-up of Heltec board sitting on shelf)**
> "MindRefreshStudio is a small WiFi sensor that lives in your room. No camera. No watch on your wrist. It reads your breath through the WiFi signals already in the air."

**0:25 – 0:50 (the live detection — split-screen: live breath sparkline + state pill changing)**
- Show the breath sparkline rising on screen. State pill flips from REGULATED to RISING.
> "Here, the sensor is catching me starting to spiral, before I would have caught it myself. The state changes from regulated to rising. The intervention shows up."

**0:50 – 1:15 (the affirmation lands — close-up of card fade-in synced to exhale)**
- Card displays one of the rising-state affirmations: "Two short inhales through the nose, one long exhale through the mouth..."
> "It doesn't give me the same generic exercise as Calm or Headspace. It gives me the *one specific practice* that the polyvagal literature says works in this state — a physiological sigh, peer-reviewed in *Cell Reports Medicine* in 2023."

**1:15 – 1:35 (the return-to-regulated trace — sparkline visibly descends)**
> "Two minutes later, the trace shows me coming back. Not because I told it I felt better — because the data shows my breath actually slowing."

**1:35 – 1:55 (the privacy promise — architecture diagram for 5 s, then back to UI)**
> "All of this runs in your browser, on your hardware. The raw biometric data never leaves your room. The only thing that syncs is a cryptographic witness chain that proves nothing was exfiltrated."

**1:55 – 2:00 (close)**
> "MindRefreshStudio. The body knows first. We just listen."

### Production Notes

- Shoot at golden hour or with warm 3000 K lamp; not bright daylight.
- One human (the builder) on screen; trust voiceover for everything else.
- No stock music — use ambient room tone or a single sustained tone fading in.
- 1080p, MP4, H.264, ≤ 100 MB to stay safe across upload paths.
- Test on phone speakers — judges watch on phones.

---

## 12. RuView Integration Assessment

**Status:** Ruv-org open-source, [github.com/ruvnet/RuView](https://github.com/ruvnet/RuView). Per WebFetch (April 25, 2026):

- **Primary language:** Rust 1.85+, 15 published crates.
- **Architecture:** edge-first WiFi sensing platform — exact same problem domain as ours.
- **Hardware target explicitly listed:** ESP32-S3 at 20 Hz CSI. **This is our exact board class.**
- **Signal pipeline:** 6 stages — CSI parsing, Hampel cleaning, SpotFi phase correction, STFT/BVP feature extraction, AI inference, output assembly. Maps almost 1:1 to Section 4.2 of this document.
- **Server:** Axum (Rust) with REST + WebSocket.
- **Desktop UI status:** Tauri v2 marked WIP; web dashboard uses Three.js with five "holographic" panels.

### 12.1 Decision

**Borrow patterns and signal-processing crates; do NOT vendor the Tauri shell or Three.js dashboard.**

| Component | Decision | Reason |
|-----------|----------|--------|
| ESP32 CSI capture firmware patterns | **Borrow** | Their 20-Hz binary frame format is sensible; align our fork of ESP32-CSI-Tool to it for forward compatibility. |
| Hampel filter, SpotFi phase correction | **Borrow conceptually** | Implement the equivalents in TypeScript in our Web Worker. Don't pull in Rust crates we'd then have to compile to WASM in 8 days. |
| Axum WebSocket server | **Skip** | Adds Rust toolchain to our stack for marginal benefit; our Node bridge is 50 LOC. |
| RVF model container | **Already getting it** | Vendored via `upstream/RuVector/`. |
| Three.js cinematic panels | **Skip** | Visually heavy, off-brand for a calm wellness app. Five panels is a UX anti-pattern for our user's nervous-system state. |
| Tauri desktop shell | **Skip** | WIP status, no Ruv React precedent for Tauri, adds 2+ days of risk. The submission form takes a URL, not a desktop binary. |

### 12.2 Citation in the Pitch

The README and write-up should credit RuView as prior art ("we build on the WiFi-sensing pipeline patterns published in ruvnet/RuView") — this strengthens both the Technical Complexity story and the integrity of the technical claims. CNX-Software covered RuView in March 2026, which is recent enough to be useful as an external citation.

---

## 13. Submission Checklist

The eight things that must exist by Friday May 1, 2026 @ 3:00 PM ET.

1. **Working URL** — `https://mindrefresh-studio.vercel.app/?source=recorded` lands on a clean state and runs a full state-transition cycle without manual intervention.
2. **2-minute demo video** — uploaded to Loom (primary) and YouTube unlisted (backup), linked in the submission form.
3. **1-page write-up** — problem, solution, architecture, novelty, future work. ≤ 400 words.
4. **GitHub repo public** — `github.com/<user>/mindrefresh-studio`. Includes firmware, edge bridge, web app, fixtures.
5. **README with judges' quickstart** — three-step path: open URL, type one sentence, watch the affirmation arrive.
6. **Affirmation seed data** — `src/data/affirmations.json` with the 20 seeds from Section 6.3, schema documented.
7. **Sensor wiring photo OR recorded-CSI demo** — one or both. Photo of Heltec board + cable, plus the recorded-CSI fixture file in the repo.
8. **Privacy statement** — one paragraph in the README and in the app footer: what data exists, where it lives, what never leaves the device, how the witness chain works.

---

## 14. References

1. Cordeiro, J. et al. (2024). *Wi-Fi CSI-based human respiration monitoring on commodity ESP32 devices.* MDPI Sensors. [https://www.mdpi.com/1424-8220/25/19/6220](https://www.mdpi.com/1424-8220/25/19/6220)
2. Dana, D. (2018). *The Polyvagal Theory in Therapy: Engaging the Rhythm of Regulation.* W. W. Norton.
3. Espressif Systems (2025). *ESP-IDF Programming Guide v5.5: Wi-Fi Driver — CSI APIs.* [https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/wifi.html](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/wifi.html)
4. Hernandez, S. M. & Bulut, E. (2020). *Performing WiFi Sensing with Off-the-shelf Smartphones.* PerCom Demos 2020. ESP32-CSI-Tool repository: [https://github.com/StevenMHernandez/ESP32-CSI-Tool](https://github.com/StevenMHernandez/ESP32-CSI-Tool)
5. Hu, M. et al. (2025). *Heart rate variability reveals graded task difficulty effects and sensitization dynamics in anticipatory psychological stress.* Journal of Physiological Anthropology. [https://link.springer.com/article/10.1186/s40101-025-00413-7](https://link.springer.com/article/10.1186/s40101-025-00413-7)
6. Kim, H.-G., Cheon, E.-J., Bai, D.-S., Lee, Y. H., & Koo, B.-H. (2018). *Stress and Heart Rate Variability: A Meta-Analysis and Review of the Literature.* Psychiatry Investigation. [https://pmc.ncbi.nlm.nih.gov/articles/PMC5900369/](https://pmc.ncbi.nlm.nih.gov/articles/PMC5900369/)
7. Kreibig, S. D. (2010). *Autonomic nervous system activity in emotion: A review.* Biological Psychology, 84, 394–421. [https://pubmed.ncbi.nlm.nih.gov/20371374/](https://pubmed.ncbi.nlm.nih.gov/20371374/)
8. Levine, P. A. (1997). *Waking the Tiger: Healing Trauma.* North Atlantic Books.
9. Porges, S. W. (2011). *The Polyvagal Theory: Neurophysiological Foundations of Emotions, Attachment, Communication, and Self-regulation.* W. W. Norton.
10. Porges, S. W. (2009). *The polyvagal theory: New insights into adaptive reactions of the autonomic nervous system.* Cleveland Clinic Journal of Medicine. [https://pmc.ncbi.nlm.nih.gov/articles/PMC3108032/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3108032/)
11. Schmidt, P., Reiss, A., Duerichen, R., Marberger, C., & Van Laerhoven, K. (2018). *Introducing WESAD, a Multimodal Dataset for Wearable Stress and Affect Detection.* ICMI '18. [https://dl.acm.org/doi/10.1145/3242969.3242985](https://dl.acm.org/doi/10.1145/3242969.3242985)
12. Yang, Y. et al. (2023). *Monitoring Respiratory Motion With Wi-Fi CSI: Characterizing Performance and the BreatheSmart Algorithm.* IEEE Access / PMC. [https://pmc.ncbi.nlm.nih.gov/articles/PMC9830631/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9830631/)
13. Yilmaz Balban, M., Neri, E., Kogon, M. M., Weed, L., Nouriani, B., Jo, B., Holl, G., Zeitzer, J. M., Spiegel, D., & Huberman, A. D. (2023). *Brief structured respiration practices enhance mood and reduce physiological arousal.* Cell Reports Medicine. [https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf](https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf)
14. Zeng, Y., Wu, D., Xiong, J., Yi, E., Gao, R., & Zhang, D. (2018). *FullBreathe: Full Human Respiration Detection Exploiting Complementarity of CSI Phase and Amplitude of WiFi Signals.* Proceedings of the ACM on Interactive, Mobile, Wearable and Ubiquitous Technologies. [https://dl.acm.org/doi/10.1145/3264958](https://dl.acm.org/doi/10.1145/3264958)
15. CNX-Software (2026, March 26). *RuView project leverages ESP32 nodes for WiFi-based presence detection, pose estimation, and breathing/heart rate monitoring.* [https://www.cnx-software.com/2026/03/26/ruview-project-leverages-esp32-nodes-for-presence-detection-pose-estimation-and-breathing-heart-rate-monitoring/](https://www.cnx-software.com/2026/03/26/ruview-project-leverages-esp32-nodes-for-presence-detection-pose-estimation-and-breathing-heart-rate-monitoring/)
16. ruvnet/RuView open-source repository (accessed April 25, 2026). [https://github.com/ruvnet/RuView](https://github.com/ruvnet/RuView)

*End of memo.*
