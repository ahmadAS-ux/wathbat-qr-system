# Wathbah — Design Token Validation Log

> **Purpose:** Validate whether lightweight design token extraction is worth the effort.
> **Promotion threshold:** If 2 of the next 3 features have a positive answer to most checks, promote to kit. Otherwise refine or abandon.
> **Started:** YYYY-MM-DD

---

## How to Use This File

After Claude Code finishes a new Wathbah feature that used the token system:
1. Copy the template below
2. Fill it out honestly — don't grade favorably
3. Note specific examples where tokens helped or didn't

---

## Validation Checks

### Did tokens prevent visual drift?
- [ ] Yes — there was a moment where I would have used the wrong hex/spacing, but tokens prevented it
- [ ] Probably — code came out consistent, but I can't point at a specific saved bug
- [ ] No — code came out the same as before, tokens didn't catch anything

**Specific example:** [If yes/probably, write what would have drifted]

### Did Zone 2 stay manageable?
- [ ] Empty — no new project extensions needed for this feature
- [ ] 1–3 new entries — meaningful additions with clear reasons
- [ ] 4+ new entries — Zone 2 is bloating, every screen needs one-offs (warning sign)

**Zone 2 entries added:** [list them with reasons]

### Did Claude Code naturally reach for tokens?
- [ ] Yes — Claude Code defaulted to tokens, asked when something wasn't covered
- [ ] Mostly — Claude Code used tokens but slipped back to hardcoded values 1–2 times
- [ ] No — I had to repeatedly remind Claude Code to use tokens (sign the rule isn't sticking)

**Slips noted:** [where Claude Code skipped tokens]

### Did the bilingual case work cleanly?
- [ ] Yes — Arabic and English both rendered correctly using the same tokens
- [ ] Mostly — minor adjustments needed (which?)
- [ ] No — tokens broke or required language-specific overrides

**Bilingual notes:** [what happened]

### Did this feel cleaner than the old approach?
- [ ] Yes — the workflow felt obviously better
- [ ] Neutral — felt about the same, no clear win
- [ ] No — felt slower or more annoying than just writing hex codes

**Friction noticed:** [where tokens added work]

### Time impact
- Time to build this feature with tokens: ___ hours
- Best estimate without tokens: ___ hours
- Difference (positive or negative): ___ hours

---

## Feature Entry Template

---

## Decision Framework — When to Promote, Refine, or Abandon

After 2-3 entries, look at the pattern:

### ✅ Promote to Kit (use on next project)
- 2 of 3 features prevented visual drift
- Zone 2 stayed under 5 entries total
- Claude Code naturally used tokens with minimal reminders
- Time impact was neutral or positive

### 🔧 Refine, don't promote yet
- Some clear wins but also some friction points
- Zone 2 is bloating — naming convention or rules need tweaking
- Claude Code slipping more than expected — rules need to be more enforced

### ❌ Abandon
- 2 of 3 features felt like overhead
- No prevented drift, no quality improvement
- Time impact consistently negative
- Solution: delete `design-tokens.css`, revert UIUX_DESIGN.md section, move on

---

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| | | |