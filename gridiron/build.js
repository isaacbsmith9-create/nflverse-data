// Builds two single-file versions of the game:
//  - index.html            : standalone page (open locally, or host on GitHub Pages; installable as an app)
//  - dist/gridiron-artifact.html : body-only version for publishing as a claude.ai artifact
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const files = ['data.js', 'franchise.js', 'moves.js', 'real.js', 'sim.js', 'game.js', 'plays.js', 'game3d.js', 'logos.js', 'ui.js'];
const js = files.map(src).join('\n');
// the real-NFL data ships only in the standalone index.html, never in the artifact build
const realJs = fs.existsSync(path.join(__dirname, 'src', 'nfl_data.js')) ? src('nfl_data.js') + '\n' : '';
const css = src('style.css'), body = src('body.html');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Saira+Condensed:wght@600;700;800&display=swap">';
const title = '<title>Gridiron Dynasty</title>';
const inner = `${body}\n<script>\n${js}\n</script>`;
const innerReal = `${body}\n<script>\n${realJs}${js}\n</script>`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'gridiron-artifact.html'),
  `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>\n${css}\n</style>\n${inner}\n`);
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
