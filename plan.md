
# Merry-Go Improvement Plan

## 🚀 Performance (6 items)

### P1 — Image caching: drop manual cache
- Remove `imageCache.ts`
- Use `expo-image` with `cachePolicy="disk"`
- Benefits:
  - Removes hash collision risk
  - Avoids race conditions
  - Reduces ~80 LOC

**Effort:** Low [done]

---

### P2 — DB calls async safety
- `quick-sqlite` blocks JS thread
- Wrap heavy calls in `runAsync` or migrate to `expo-sqlite`

**Effort:** Medium

---

### P3 — FlatList key stability
- Replace `item.id` with:
  `${sourceName}-${item.url}`
- Prevents flickering on re-render

**Effort:** Low [done]

---

### P4 — downloads map rebuild optimization
- Memoize `downloadsByChapter`
- Rebuild only when array reference changes

**Effort:** Low

---

### P5 — Cache image ratios
- Cache `RNImage.getSize` results using a Map

**Effort:** Low

---

### P6 — Plugin execution caching
- Cache compiled plugins in memory using:
  - `pluginId + mtime`

**Effort:** Medium

---

## 🎨 UI / UX Improvements (7 items)

### U1 — Chapter navigation
- Implement prev/next buttons in reader

**Effort:** Medium

---

### U2 — Read state indicator
- Mark chapter as read on open
- UI:
  - Left border color
  - Dimmed title

**Effort:** Low[done]

---

### U3 — Library long-press actions
- Replace delete modal with action sheet:
  - Open
  - Move
  - Remove
  - Download all

**Effort:** Medium

---

### U4 — Better empty states
- Add CTA buttons

**Effort:** Low

---

### U5 — History thumbnails
- Add 48×64 cover images

**Effort:** Medium

---

### U6 — Skeleton loading
- Replace spinner with placeholder cards

**Effort:** Medium

---

### U7 — Open downloaded chapters
- Navigate to reader instead of alert

**Effort:** Low[done]

---

## 🛠 Refactoring & Maintainability (6 items)

### R1 — Split db.ts
- Split into domain modules

**Effort:** Low

---

### R2 — Decouple components from DB
- Components → Stores only

**Effort:** Low

---

### R3 — Fix circular dependency
- Use event bus or move logic into store

**Effort:** Medium

---

### R4 — Notification init duplication
- Ensure single initialization point

**Effort:** Low

---

### R5 — Improve type safety
- Replace `any` with proper types

**Effort:** Medium

---

### R6 — Fix typo file
- Remove `fomatDateString.ts` [done]

**Effort:** Low

---

## ✨ New Features (7 items)

### F1 — Global search
- Search across all sources

**Effort:** High

---

### F2 — Chapter progress bar
- Show reading progress

**Effort:** Medium

---

### F3 — Library update checker
- Background polling

**Effort:** High

---

### F4 — Double-tap zoom (webtoon mode)
- Add zoom support

**Effort:** Medium

---

### F5 — Backup / Restore
- Export/import JSON

**Effort:** Medium

---

### F6 — AniList integration
- OAuth + sync progress

**Effort:** High

---

### F7 — Source filter UI
- Add tag picker UI

**Effort:** Medium

---

## 🔌 Plugin System Overhaul (6 items)

### PL1 — Plugin build system
- TypeScript + esbuild

**Effort:** High

---

### PL2 — Plugin SDK
- Create shared SDK package

**Effort:** High

---

### PL3 — Integrity check
- SHA-256 verification

**Effort:** Low

---

### PL4 — HTML parser in sandbox
- Add cheerio or equivalent

**Effort:** Medium

---

### PL5 — Version enforcement
- Validate app & API versions

**Effort:** Low

---

### PL6 — Plugin updates UI
- Add update badges + button

**Effort:** Medium




 plan:That's 32 concrete items across 5 areas. Here's how I'd prioritize the order of attack:



**Start immediately (low effort, high payoff):**

- R6 — delete the typo re-export file before it causes a real bug [done]

- P1 — remove imageCache.ts entirely, expo-image handles it already [done]

- P3 — fix FlatList key stability to kill the infinite-scroll flicker [done]

- U2 — read state on chapter cards; the DB already tracks it, just not shown [done]

- U7 — wire the open button in Downloads; the reader already handles offline pages[done]

- PL5 — minAppVersion enforcement is 5 lines of semver comparison



**Medium sprint (the most visible improvements):**

- U1 — prev/next chapter in the reader; this is the biggest UX gap right now

- U3 — replace the long-press delete modal with an action sheet

- U6 — skeleton loading on source screen

- PL6 — update badges on installed plugins

- R1/R2 — split db.ts and clean up the store/component boundary



**Bigger projects to plan separately:**

- PL1+PL2 — the TypeScript plugins repo + SDK is a full setup day but transforms the plugin developer experience completely. The key insight is that esbuild compiles a TypeScript plugin to a ~5kb self-contained JS file in under 100ms, and the sandbox already handles CommonJS exports

- F1 — global search; the fan-out logic is straightforward but the merged results UI needs design thought

- F3 — library update checker; needs careful throttling so it doesn't hammer sources on every app open
