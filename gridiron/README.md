# Gridiron Dynasty

A pro football game with a full franchise mode. It runs in the browser on a Chromebook, a laptop or a phone. There's nothing to install and no build step needed to play.

The league, teams and players are all made up.

## Play it

- **Chromebook / computer:** open `index.html` in Chrome.
- **Phone:** host this folder (GitHub Pages works), open it, then use *Add to Home Screen*. It runs full-screen and offline after the first load.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrow keys | Drag on the left half of the screen |
| Sprint | Shift | Hold SPRINT |
| Snap / juke / dive / kick | Space | ACTION button |
| Throw to a receiver | 1–5 | Tap the receiver or a colored button |
| Throw it away | T | THROW AWAY |
| Switch defender | E | SWITCH |
| Pause | Esc | ❚❚ |

## Features

- **On-field engine:** 11-on-11 with blocking, pass rush and sacks. Defenders play man and zone coverage, and passes can be caught, broken up or intercepted. Ball carriers can juke and break tackles. Includes field goals with a kick meter, punts, overtime and a two-minute hurry-up.
- **Playbook:** 13 offensive plays (runs, quick game, deep shots, play-action, screen, Hail Mary) and 8 defenses (Cover 2/3/4, Cover 1, blitzes, run stop, prevent). Every play card has route art, and an "Ask coach" button picks for you.
- **Shortcuts:** sim a single drive or the rest of the game, or sim the CPU's possessions so you only play offense.
- **Franchise:** 32 teams in 2 conferences and 8 divisions. A 17-game schedule, then 14-team playoffs ending in the Grand Bowl.
- **Players:** ratings and potential, development traits (Normal / Star / Superstar), injuries, and season and career stats. Awards are MVP, OPOY, DPOY and ROY.
- **Offseason:** aging and progression, retirements, re-signing, three days of free agency, and a 7-round draft with scouting ranges.
- **Team management:** trades for players and draft picks, with AI that values each piece, a $255M salary cap, and a depth chart.
- **Saves:** 3 save slots stored in the browser. Export/import lets you move a franchise between devices.

## Code

`src/` holds the source. `node build.js` regenerates `index.html` and `dist/gridiron-artifact.html`.

- `data.js`: teams, names, player generation, ratings
- `franchise.js`: league, schedule, standings, playoffs, offseason, trades, draft, saves
- `sim.js`: game rules and the statistical sim used for CPU games
- `game.js`: the playable on-field engine and renderer
- `ui.js`: menus, franchise hub, play calling, input
