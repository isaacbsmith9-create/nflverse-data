// Builds the college game as single-file HTML:
//  - index.html                  : standalone page (open locally or host it; installable)
//  - dist/cfb-dynasty-artifact.html : body-only version for publishing as a claude.ai artifact
// The on-field engine and shared franchise code are read straight from ../gridiron/src,
// so gameplay fixes there carry over. College-only code lives in ./src.
const fs = require('fs'), path = require('path');
const G = f => fs.readFileSync(path.join(__dirname, '..', 'gridiron', 'src', f), 'utf8');
const C = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const shared = ['data.js', 'franchise.js', 'moves.js', 'real.js', 'sim.js', 'game.js', 'plays.js', 'extras.js', 'plays2.js', 'clock.js', 'penalties.js',
  'wildcat.js', 'game3d.js', 'gl3d.js', 'logos.js', 'ui.js', 'lineup.js', 'mgmt.js', 'records.js', 'designer.js', 'sideline.js'];
const college = ['cfb_core.js', 'cfb_rules.js', 'cfb_season.js', 'cfb_recruit.js', 'cfb_portal.js', 'cfb_offseason.js', 'cfb_store.js', 'cfb_look.js', 'cfb_plays.js', 'cfb_ui.js', 'cfb_ui2.js'];
function build() {
const dataFile = fs.existsSync(path.join(__dirname, 'src', 'cfb_data.js')) ? 'cfb_data.js' : null;
if (!dataFile) { console.error('missing src/cfb_data.js (run tools/build_cfb_data.py)'); process.exit(1); }
const js = [C(dataFile), ...shared.map(G), ...college.map(C)].join('\n');
const css = G('style.css') + '\n' + C('cfb.css'), body = C('body.html');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Saira+Condensed:wght@600;700;800&display=swap">';
const title = '<title>College Gridiron Dynasty</title>';
const threeTag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
const inner = `${body}\n${threeTag}\n<script>\n${js}\n</script>`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'cfb-dynasty-artifact.html'),
  `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>\n${css}\n</style>\n${inner}\n`);
fs.writeFileSync(path.join(__dirname, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b1512"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
${title}
${fonts}
<style>
${css}
</style></head><body>
${inner}
</body></html>
`);
console.log('built cfb/index.html and cfb/dist/cfb-dynasty-artifact.html', Math.round(inner.length / 1024) + 'KB');
}
module.exports = { shared, college };
if (require.main === module) build();
