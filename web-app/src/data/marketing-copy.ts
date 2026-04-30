/**
 * Marketing copy for the public landing page (MarketingLanding.tsx).
 *
 * All numerical claims and named users on this page are illustrative for the buildathon submission
 * and will be replaced or removed before any public, post-buildathon launch. Specifically: the
 * "Tuesday, 2:42 PM" mockup, the "8 min" / "$9" / "76M U.S. adults" / "2,400+ on the waitlist"
 * lines, and the Maya R. / Daniel K. testimonials are not derived from validated user data.
 * (See ADR-014 §"Copy and statistical claims".)
 */

export interface MarketingCopy {
  banner: { eyebrow: string; ctaLabel: string };
  nav: { brand: string; links: { label: string; href: string }[]; ctaLabel: string; ctaHref: string };
  hero: { eyebrow: string; titleA: string; titleEm: string; subhead: string; primaryCta: string; secondaryCta: string; proofText: string; privacyPill: string };
  heroSteps: { eyebrow: string; steps: { num: string; title: string; body: string }[] };
  manifesto: { headline: string };
  heroMockup: { badgeLabel: string; headlineA: string; headlineEm: string; headlineB: string; body: string; stats: { num: string; label: string }[]; slides: { caption: string; titleA: string; titleEm: string; titleB: string; img: string; alt: string }[] };
  stats: { num: string; desc: string }[];
  problem: { eyebrow: string; titleA: string; titleEm: string; lead: string; cards: { tag: string; titleA: string; titleEm: string; body: string; stat: string }[]; callout: { textA: string; textEm: string; sub: string } };
  how: { titleA: string; titleEm: string; lead: string; steps: { num: string; title: string; body: string; iconRow: string }[]; flowTitleA: string; flowTitleEm: string; flowSteps: { num: string; title: string; body: string }[] };
  demo: { eyebrow: string; titleA: string; titleEm: string; body: string[]; bullets: { titleA: string; bodyA: string }[]; card: { tagLabel: string; tagText: string; messageA: string; messageEm: string; practiceName: string; practiceMeta: string; ctaLabel: string; footerInfo: string } };
  vs: { eyebrow: string; titleA: string; titleEm: string; lead: string; them: { label: string; titleA: string; titleEm: string; sub: string; bullets: string[] }; us: { label: string; titleA: string; titleEm: string; sub: string; bullets: string[] }; pullA: string; pullEm: string };
  testimonials: { eyebrow: string; titleA: string; titleEm: string; lead: string; cards: { quote: string; name: string; meta: string }[] };
  isnt: { eyebrow: string; titleA: string; titleEm: string; body: string; items: { label: string; title: string; body: string }[] };
  finalCta: { titleA: string; titleEm: string; titleB: string; body: string; ctaLabel: string; checks: string[] };
  footer: { brand: string; links: { label: string; href: string }[]; copyright: string };
}

export const marketingCopy: MarketingCopy = {
  banner: {
    eyebrow: "✦ Early access is open — ",
    ctaLabel: "Reserve your spot →",
  },

  nav: {
    brand: "MindRefresh",
    links: [
      { label: "The problem", href: "#problem" },
      { label: "How it works", href: "#how" },
      { label: "Why us", href: "#why" },
      { label: "Early access", href: "#cta" },
    ],
    ctaLabel: "Join waitlist →",
    ctaHref: "#cta",
  },

  hero: {
    eyebrow: "Nervous-system intelligence for the home",
    titleA: "Catch the crash ",
    titleEm: "before it catches you.",
    subhead:
      "Your body shifts 8 minutes before your mind notices. A sensor on your shelf reads the room — breath, heart rhythm, motion — and sends a 60-second reset before the crash lands.",
    primaryCta: "Join the waitlist →",
    secondaryCta: "See how it works",
    proofText: "2,400+ on the waitlist · early units shipping fall",
    privacyPill: "Local processing. Your data never leaves your home.",
  },

  heroSteps: {
    eyebrow: "PRIVATE BY DESIGN",
    steps: [
      {
        num: "1.",
        title: "Signals sensed",
        body: "Breath, heart, motion, and ambient signals — in real time.",
      },
      {
        num: "2.",
        title: "Patterns recognized",
        body: "Subtle shifts compared to your personal baseline.",
      },
      {
        num: "3.",
        title: "State shift detected",
        body: "Stress, overload, or shutdown — before you feel it.",
      },
      {
        num: "4.",
        title: "Support delivered",
        body: "The right intervention for the moment you're in.",
      },
    ],
  },

  manifesto: {
    headline: "Learn your patterns before they become burnout.",
  },

  heroMockup: {
    badgeLabel: "READING THE ROOM · LIVE",
    headlineA: "Tuesday, 2:42 PM. ",
    headlineEm: "You don't feel stressed yet.",
    headlineB: " Your body has been escalating for four minutes.",
    body: "Breath rate has shortened from 14 to 18 per minute. Postural stillness is rising. Cardiac micro-motion is climbing. The sensor caught it before you did — and it's already cued the right 60-second response.",
    stats: [
      { num: "8min", label: "Lead time before peak" },
      { num: "$9", label: "One sensor, whole household" },
      { num: "0", label: "Things to wear or charge" },
    ],
    slides: [
      {
        caption: "Reduced recovery detected overnight",
        titleA: "Last night ",
        titleEm: "changed",
        titleB: " today.",
        img: "/marketing/01-late-night-clean.png",
        alt: "Woman working late at night, 1:42am",
      },
      {
        caption: "Breath shortening · recovery load increasing",
        titleA: "Your body shifted ",
        titleEm: "before",
        titleB: " your mind noticed.",
        img: "/marketing/02-the-shift-clean.png",
        alt: "Same woman the next afternoon, frozen posture",
      },
      {
        caption: "60-second reset activated",
        titleA: "A small interruption ",
        titleEm: "before",
        titleB: " overwhelm fully lands.",
        img: "/marketing/03-recovery-mode-clean.png",
        alt: "Woman near window, hand holding mug, eyes closed",
      },
    ],
  },

  stats: [
    {
      num: "8–12min",
      desc: "The window between your body shifting and your mind catching up",
    },
    {
      num: "76M",
      desc: "U.S. adults whose recovery time has been cut short by chronic activation",
    },
    {
      num: "$9",
      desc: "One sensor for the whole household — no per-person rings or watches",
    },
  ],

  problem: {
    eyebrow: "The problem",
    titleA: "By the time you feel it, ",
    titleEm: "it's already a crash.",
    lead: "The body shifts before the mind notices. Most tools wait for the verdict. We work in the eight minutes you didn't know you had.",
    cards: [
      {
        tag: "⚠ The body",
        titleA: "Your nervous system ",
        titleEm: "knew first.",
        body: "Breath shortens. Shoulders lock. Posture stills. Heart rate climbs minutes later. By the time you feel the wave, your body has been escalating for eight to twelve minutes — and the rest of the day is going to pay for it.",
        stat: "8–12 minutes between body shift and conscious awareness",
      },
      {
        tag: "⚠ The wearable",
        titleA: "A score for the day ",
        titleEm: "you already had.",
        body: "Oura tells you tomorrow morning. Apple Watch summarizes State of Mind hours later. Both read heart rate, which lags. Both come off in the shower or die on the charger. Neither catches the moment that still belongs to you.",
        stat: "Reactive by design — measures what happened, not what's happening",
      },
    ],
    callout: {
      textA: "You don't need another graph. You need to ",
      textEm: "not crash",
      sub: "That's the whole product.",
    },
  },

  how: {
    titleA: "Plug it in. ",
    titleEm: "Don't think about it again.",
    lead: "Three minutes to set up. No app to learn. No watch to charge. The sensor sits on a shelf and reads the room.",
    steps: [
      {
        num: "1.",
        title: "Plug in the sensor.",
        body: "USB-C, anywhere in your living room or bedroom. It calibrates in two minutes by sensing the ambient signals already in your home — no camera, no microphone, no image of the room.",
        iconRow: "USB-C · 4 min setup",
      },
      {
        num: "2.",
        title: "Live your day.",
        body: "The sensor reads breath rate, cardiac micro-motion, postural stillness, and movement cadence — fused into a single nervous-system state estimate, updated every few seconds, processed locally.",
        iconRow: "4 signals · always on · local",
      },
      {
        num: "3.",
        title: "Right thing, at the right time.",
        body: "When the signals shift, a 60-second guided response arrives — paced to the specific state you're in. Not a score. Not tomorrow's report. A real intervention, inside the window.",
        iconRow: "60s response · matched to state",
      },
    ],
    flowTitleA: "From signal to ",
    flowTitleEm: "support",
    flowSteps: [
      {
        num: "1.",
        title: "Signals sensed",
        body: "Breath, heart activity, micro-motion, and environmental changes are detected in real time.",
      },
      {
        num: "2.",
        title: "Patterns recognized",
        body: "Advanced algorithms identify subtle shifts and compare them to your personal baseline.",
      },
      {
        num: "3.",
        title: "State shift detected",
        body: "The system recognizes when your body is moving toward stress, overload, or shutdown — before you consciously feel it.",
      },
      {
        num: "4.",
        title: "Support delivered",
        body: "MindRefresh prepares the right intervention for your current state and the moment you're in.",
      },
    ],
  },

  demo: {
    eyebrow: "In the moment",
    titleA: "A response, ",
    titleEm: "not a dashboard.",
    body: [
      "When the signals shift, you don't need another graph. You need a short, specific thing to do — paced to the state you're actually in.",
      "Each response is a 60-second protocol matched to the detected pattern. Plain language. No score. No streak to keep.",
    ],
    bullets: [
      {
        titleA: "Catches every state, not just stress.",
        bodyA: " Activation, shutdown, dysregulated rest — different patterns get different responses.",
      },
      {
        titleA: "Plain language, never clinical.",
        bodyA: " No HRV scores, no recovery percentages. Just what's happening and what to try.",
      },
      {
        titleA: "Always inside the window.",
        bodyA: " The moment it detects, the response is ready — no taps, no opens, no waiting.",
      },
    ],
    card: {
      tagLabel: "CAUGHT",
      tagText: "Rising activation · 8 min before peak",
      messageA: "Breath shortened over the last four minutes. Shoulders haven't moved. ",
      messageEm: "Sixty-second reset — two inhales, one long exhale.",
      practiceName: "Physiological sigh",
      practiceMeta: "60s · 5 rounds · breath protocol",
      ctaLabel: "Begin →",
      footerInfo: "Local inference · no cloud · no subscription",
    },
  },

  vs: {
    eyebrow: "Vs. your ring or watch",
    titleA: "A wrist sees one signal, late. ",
    titleEm: "We read four, in real time.",
    lead: "Oura and Apple Watch are real, useful technology. They measure differently than we do — and that difference is the whole product.",
    them: {
      label: "Oura · Apple Watch",
      titleA: "The day you ",
      titleEm: "had",
      sub: "PPG heart rate, smoothed and scored later",
      bullets: [
        "Heart rate as the primary signal — which lags 2–4 minutes",
        "Breath rate inferred only during sleep, from HRV",
        "State of Mind / Daytime Stress: summaries surfaced hours later",
        "Comes off in the shower, dies on the charger",
        "$300–$400 per person, plus monthly subscription",
        "Cloud-processed — your raw biometric data leaves the device",
      ],
    },
    us: {
      label: "MindRefresh",
      titleA: "The day you're ",
      titleEm: "having",
      sub: "Four signals fused, in real time, in the room",
      bullets: [
        "Breath rate as the leading signal — shifts 30–90 seconds in",
        "Continuous breath sensing while you're awake, at the desk, on the couch",
        "State detected and a 60-second response inside the window",
        "Always on — sits on a shelf, no battery, no straps",
        "$9 once for a whole household, no subscription",
        "Local inference — raw signals never leave the sensor",
      ],
    },
    pullA: "Identity-theft services tell you after you've been robbed. Wearables tell you after you've crashed. ",
    pullEm: "We work before.",
  },

  testimonials: {
    eyebrow: "Real users · early access",
    titleA: "From depleted afternoons to ",
    titleEm: "days that hold.",
    lead: "Early users tell us what they noticed wasn't a feature — it was the absence of the crash.",
    cards: [
      {
        quote:
          "I didn't feel stressed. The graph said I was already on my way. The thing caught it eight minutes before I would have crashed — and the day kept going. That's never happened before.",
        name: "Maya R.",
        meta: "Early user · Oakland, CA",
      },
      {
        quote:
          "My ring told me I was stressed at 4pm. This thing met me at 11am, when I could still do something about it. By the end of the week I'd stopped checking the wearable.",
        name: "Daniel K.",
        meta: "Early user · Brooklyn, NY",
      },
    ],
  },

  isnt: {
    eyebrow: "Here's what it isn't",
    titleA: "Not another ",
    titleEm: "thing on your plate.",
    body: "Not another app to open. Not another dashboard to read. Not another score to chase. The sensor sits on a shelf and the response arrives at the moment. If you can plug in a USB-C cable, you can use it. That's it.",
    items: [
      {
        label: "✕ Not",
        title: "A wearable",
        body: "No ring, no watch, no chest strap. Nothing on your body, nothing to charge.",
      },
      {
        label: "✕ Not",
        title: "A score-tracker",
        body: "No HRV percentage, no readiness number, no streaks. Mirrors, not verdicts.",
      },
      {
        label: "✕ Not",
        title: "A medical device",
        body: "A wellness companion. We don't diagnose. We catch the moment and meet it.",
      },
    ],
  },

  finalCta: {
    titleA: "Catch the day ",
    titleEm: "before",
    titleB: " it catches you.",
    body: "Early access ships this fall. Reserve your sensor today — we'll reach out the moment yours is ready.",
    ctaLabel: "Join the waitlist →",
    checks: ["No app to download", "$9 one-time, no subscription", "Cancel anytime"],
  },

  footer: {
    brand: "MindRefresh",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Contact", href: "mailto:hello@mindrefresh.example" },
    ],
    copyright: "© 2026 MindRefresh",
  },
};
