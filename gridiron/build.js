// Builds two single-file versions of the game:
//  - index.html            : standalone page (open locally, or host on GitHub Pages; installable as an app)
//  - dist/gridiron-artifact.html : body-only version for publishing as a claude.ai artifact
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const files = ['data.js', 'franchise.js', 'moves.js', 'real.js', 'sim.js', 'game.js', 'plays.js', 'extras.js', 'plays2.js', 'clock.js', 'penalties.js', 'wildcat.js', 'game3d.js', 'gl3d.js', 'logos.js', 'ui.js', 'lineup.js', 'mgmt.js', 'records.js', 'designer.js', 'sideline.js', 'runfix.js', 'presnap.js', 'weather.js', 'returns.js', 'franchise2.js', 'superstar.js', 'present.js', 'zone.js', 'modes.js', 'skillmoves.js', 'ui2.js'];
const js = files.map(src).join('\n');
// the real-NFL data ships only in the standalone index.html, never in the artifact build
const realJs = fs.existsSync(path.join(__dirname, 'src', 'nfl_data.js')) ? src('nfl_data.js') + '\n' : '';
const css = src('style.css'), body = src('body.html');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Saira+Condensed:wght@600;700;800&display=swap">';
const title = '<title>Gridiron Dynasty</title>';
const threeTag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
const inner = `${body}\n${threeTag}\n<script>\n${js}\n</script>`;
const innerReal = `${body}\n${threeTag}\n<script>\n${realJs}${js}\n</script>`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'gridiron-artifact.html'),
  `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>\n${css}\n</style>\n${inner}\n`);
fs.writeFileSync(path.join(__dirname, 'dist', 'gridiron-nfl-artifact.html'),
  `<title>Gridiron Dynasty NFL</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>\n${css}\n</style>\n${innerReal}\n`);
fs.writeFileSync(path.join(__dirname, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b1512"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
${title}
<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg" type="image/svg+xml">
${fonts}
<style>
${css}
</style></head><body>
${innerReal}
<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});</script>
</body></html>
`);
console.log('built index.html and dist/gridiron-artifact.html', Math.round(inner.length / 1024) + 'KB');
// ---------- website (GitHub Pages serves the repo's docs/ folder) ----------
{
  const site = path.join(__dirname, '..', 'docs');
  const page = (t, scripts, manifest) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b1512"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<title>${t}</title>
<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg" type="image/svg+xml">
${fonts}
<style>
${css}
</style></head><body>
${scripts}
<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});</script>
</body></html>
`;
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.webmanifest'), 'utf8'));
  for (const [dir, t, scripts, name] of [['nfl', 'Gridiron Dynasty — Pro League', innerReal, 'Gridiron Pro'], ['league', 'Gridiron Dynasty — Fictional League', inner, 'Gridiron League']]) {
    const d = path.join(site, dir); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'index.html'), page(t, scripts));
    fs.writeFileSync(path.join(d, 'manifest.webmanifest'), JSON.stringify(Object.assign({}, man, { name, short_name: name }), null, 2));
    fs.copyFileSync(path.join(__dirname, 'icon.svg'), path.join(d, 'icon.svg'));
    fs.writeFileSync(path.join(d, 'sw.js'), fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8').replace("'gridiron-v1'", `'gridiron-${dir}-v1'`));
  }
  if (!fs.existsSync(path.join(site, 'index.html')) || !fs.readFileSync(path.join(site, 'index.html'), 'utf8').includes('data-keep')) fs.copyFileSync(path.join(__dirname, 'site', 'landing.html'), path.join(site, 'index.html'));
  fs.writeFileSync(path.join(site, '.nojekyll'), '');
  console.log('built website in docs/');
}
