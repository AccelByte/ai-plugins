# AGS Matchmaking Skill

Covers the full AGS Matchmaking lifecycle — ruleset authoring, match pool configuration, SDK integration, region routing, backfill design, debugging with X-Ray, and symptom-driven diagnosis.

Invoke with `/ags-matchmaking` in Claude Code.

---

## Workflow

| Step | Subskill | What it does |
|---|---|---|
| 0 | `ask` | Conceptual questions — what matchmaking is, how the ticket lifecycle works, which approach to use |
| 1 | `ruleset` | Author and tune the ruleset JSON (alliance, matching_rule, flexing_rule, role-based, rebalance) |
| 2 | `pool` | Configure the match pool (session template, expiration, latency method, backfill flags) |
| 3 | `integrate` | Wire the SDK — QoS measurement, ticket submission, match notification, session join (Unreal/Unity) |
| 4 | `region` | Configure region routing — latency method, QoS integration, preferred-region restriction |
| 5 | `backfill` | Design the backfill strategy — auto vs manual, proposal lifecycle, server-side integration |
| 6 | `debug` | Use X-Ray to trace ticket stalls, failed matches, and wait-time spikes |
| — | `doctor` | Read-only diagnosis — symptom → likely cause → subskill that owns the fix |

Steps 1–5 run roughly in order. `ask`, `debug`, and `doctor` can run at any phase.

---

## Subskills

| File | Phase | Purpose |
|---|---|---|
| `subskills/ask.md` | any | Conceptual Q&A |
| `subskills/ruleset.md` | design/build | Ruleset authoring and tuning |
| `subskills/pool.md` | design/build | Match pool configuration |
| `subskills/integrate.md` | build | SDK integration (Unreal / Unity) |
| `subskills/region.md` | build | Region routing and QoS |
| `subskills/backfill.md` | build/operate | Backfill strategy and server integration |
| `subskills/debug.md` | operate | X-Ray debugging |
| `subskills/doctor.md` | operate | Read-only diagnosis |

---

## References

| File | Contents |
|---|---|
| `references/overview.md` | Architecture, ticket lifecycle, ruleset schema, pool fields, region routing, Extend hooks, SDK calls, limits |
| `references/faq.md` | Common questions about scope, rule design, wait times, backfill, custom match functions, local vs prod |
| `references/glossary.md` | All matchmaking terms |

---

## Directory structure

```
ags-matchmaking/
├── SKILL.md                    — router
├── README.md                   — this file
├── BLURB.md                    — marketplace description
├── subskills/
│   ├── ask.md                  — conceptual Q&A
│   ├── ruleset.md              — ruleset authoring
│   ├── pool.md                 — pool configuration
│   ├── integrate.md            — SDK integration
│   ├── region.md               — region routing
│   ├── backfill.md             — backfill design
│   ├── debug.md                — X-Ray debugging
│   └── doctor.md               — diagnosis
└── references/
    ├── overview.md             — architecture reference
    ├── faq.md                  — common questions
    └── glossary.md             — terms
```

---

## Notes

- Native matchmaking (no Extend) covers distance/exact matching, role-based composition, flexing, rebalancing, and region-latency selection.
- Custom match logic (MakeMatches, BackfillMatches, EnrichTicket, ValidateTicket, GetStatCodes) requires `/ags-extend` — Extend Override pattern.
- X-Ray (Admin Portal → Matchmaking → X-Ray) is the primary debugging tool. Always go there before tuning rulesets.
- Post-match flow (game session creation, AMS server allocation) is out of scope for this skill — see `/ags integrate` or `/ags-ams`.
