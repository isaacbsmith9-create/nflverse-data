# College Gridiron Dynasty

The college football version of [Gridiron Dynasty](../gridiron/). It runs in the browser on a Chromebook, a laptop or a phone, with nothing to install.

- **All 138 FBS schools** in their 2026 conferences (SEC, Big Ten, Big 12, ACC, Pac-12, American, Mountain West, Sun Belt, C-USA, MAC, independents), with school colors, nicknames, stadiums and current head coaches.
- **Real 2026 rosters** (about 78 players per school) and the real 2026 schedule for season one. Player ratings are this game's own model; see below.
- **Dynasty mode** with class years, redshirts, NIL, the transfer portal, recruiting, a Top 25 poll, conference title games, the 12-team College Football Playoff, bowls, the Heisman, a coaching carousel and your own job security.

Unofficial fan project. It is not affiliated with or endorsed by the NCAA, any conference, school or player. Team emblems are generic block letters made for this game. Ratings, NIL values, budgets and draft projections are estimates. Every high-school recruit is a fictional, generated player.

## Play it

- **Chromebook / computer:** open `index.html` in Chrome.
- **Phone:** host this folder (GitHub Pages works), open it, then use *Add to Home Screen*.

Controls are the same as Gridiron Dynasty: WASD/arrows to move, Shift to sprint, Space to snap/juke/dive/kick, 1–5 to throw, P audible, H hot routes, E switch, Esc pause. On a phone, drag on the left half and use the on-screen buttons.

## Dynasty

| Phase | What happens |
|---|---|
| Regular season | 12 games over 14 weeks with a rivalry week. Weekly Top 25. Recruit every week. |
| Postseason | Conference championships (top 2 in each conference), then the 12-team playoff: the 5 highest-ranked conference champions plus 7 at-large teams, seeded by ranking, with byes for seeds 1–4. Teams with 6+ wins go to bowls. Heisman voting. |
| Recap | Champion, Heisman finalists, awards, All-America team. |
| Departures | Seniors graduate. Juniors and seniors with high draft grades declare for the NFL Draft (you can pitch some to return). Players who saw 4 or fewer games keep a year (redshirt). Some players think about the portal; pay their NIL ask to keep them. The coaching carousel turns, your job security updates, and you may get job offers or get fired. |
| Transfer portal | Three portal days. Make NIL offers; other schools bid too. Players weigh money vs. their ask, chance to start, prestige and distance from home. |
| Signing Day | Your commits sign, class rankings come out, walk-ons fill out rosters, and everyone develops for next season. |

**NIL.** Every school has a yearly NIL budget (collective plus revenue share). Blue bloods and the SEC/Big Ten get the most and winning grows it. Each player has an estimated NIL value from this game's own formula (rating, position, school market, stars). Players paid well below their value are more likely to transfer.

**Recruiting.** About 1,800 fictional prospects per class. You get 60 hours a week: put up to 35 recruits on your board, set hours, offer scholarships (required to commit), promise NIL and schedule official visits to home games (a win and a rivalry game help). Each recruit cares about two things (prestige, playing time, closeness to home, NIL, title contention, coach stability), and your school gets a grade on each.

**College rules.** Overtime starts at the opponent's 25 with alternating possessions; teams must go for two after a touchdown in the 2nd OT, and from the 3rd OT it's a two-point shootout. No two-minute warning, no ties, home-field advantage, touchbacks to the 25.

**Kept from Gridiron Dynasty:** the live 3D engine, playbook maker, Wildcat, read options and RPOs (plus college additions: pistol zone read, inverted veer, triple option, air raid concepts), trick plays, timeouts and the two-minute drill, penalties, lineup and depth chart, offense-only mode, records (now with program records and a Ring of Honor).

## Data and ratings

`tools/build_cfb_data.py` builds `src/cfb_data.js` from ESPN's public college football JSON (teams, rosters, player stats, recruiting grades, power index and schedules). Run `python3 tools/build_cfb_data.py --offline` to rebuild from the cached responses.

Ratings are this game's own model. Within each position, players are ranked on per-game production (2026 plus half-weighted 2025), games played, recruiting grade, class year and team strength, then mapped onto a 45–99 scale. Offensive linemen are rated on team talent, recruiting grade, seniority and their team's rushing and sacks-allowed numbers. No ratings come from any video game or recruiting service.

## Code

The build reads the shared engine straight from `../gridiron/src`, so gameplay fixes there carry over. College code lives in `src/`:

- `cfb_core.js`: schools, class years, NIL model, league creation from the real data
- `cfb_rules.js`: college overtime and game rules on top of the shared sim
- `cfb_season.js`: schedules, rivalries, Top 25, conference title games, playoff, bowls, awards
- `cfb_recruit.js`, `cfb_portal.js`, `cfb_offseason.js`: recruiting, transfer portal, offseason and coaching carousel
- `cfb_store.js`: compressed saves (a league holds about 11,000 players)
- `cfb_look.js`, `cfb_plays.js`: emblems, home end zones, band and student section, college plays
- `cfb_ui.js`, `cfb_ui2.js`: menus, hub tabs and actions

`node build.js` writes `index.html` and `dist/cfb-dynasty-artifact.html`.

### Tests

```
node tests/lzw_test.js          # save compressor round trip
node tests/rules_test.js        # overtime, no ties, redshirts, firing / job offers
node tests/dynasty_test.js 4    # 4 full simulated seasons with checks
node tests/perf_test.js         # browser timings
THREE_JS=/path/to/three.min.js node tests/ui_test.js out/   # Playwright click-through with screenshots
```
