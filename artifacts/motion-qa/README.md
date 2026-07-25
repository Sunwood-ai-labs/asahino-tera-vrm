# Motion integration QA — 2026-07-25

Target: `public/models/asahino-tera.vrm`

Source: corrected top-level VRMA files from
`/Users/admin/Prj/yonagi-noa-vrm/public/motions/` (not `raw-ardy/`).

## Functional checks

- All 10 motion files preloaded without console or request errors.
- GAME / IDLE / TALK tabs changed panels; arrow-key tab navigation selected IDLE.
- Every motion played on the Asahino Terra VRM and accepted range input at
  25%, 50%, and 75%.
- Pause reported `PAUSED`; switching directly from `talk-calm` to `talk-press`
  reported the new motion as `PLAYING`.
- Stop disabled the transport and returned `MOTION HALTED`.
- View reset removed the active selection, disabled the timeline, and returned
  `VIEW + MOTION RESET · READY`.
- 390 × 844 mobile pass: document `scrollWidth` equaled `clientWidth` (390px).

## Visual checks

- `all-motions-midpoint.png`: all ten motions at 50%.
- `risky-oblique-midpoint.png`: oblique 50% frames for accuse, talk-whisper,
  and talk-press.
- Individual `*-25.png`, `*-50.png`, and `*-75.png` files retain the three
  inspection points for each motion.
- No obvious hand/wrist/elbow overlap, face or torso penetration, clothing
  collision, or broken joint was observed in the captured views.

## Automated checks

```text
npm run check
  check:motions: 10/10 hashes and VRMA structure verified
  build: PASS
git diff --check: PASS
dist/motions/*.vrma: 10
reference repository git status: clean
```

External Claude team review was attempted but is not counted as QA evidence:
the required `spawnInProcessTeammate` marker was absent and the inspector
reported `TEAM_MODE_NOT_CONFIRMED`.
