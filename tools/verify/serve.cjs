// Serve the repo (with the import map the pages expect) for exactly as long as one command runs, then stop.
// Usage: node tools/verify/serve.cjs PORT COMMAND [ARGS...]   (the command gets SITE=http://127.0.0.1:PORT)
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '../..');
const [portS, cmd, ...args] = process.argv.slice(2);
const port = +portS;
if (!port || !cmd) { console.error('usage: node serve.cjs PORT COMMAND [ARGS...]'); process.exit(2); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const importmap = `<script type="importmap">${JSON.stringify({ imports: {
  'three': '/node_modules/three/build/three.module.js',
  'three/addons/': '/node_modules/three/examples/jsm/',
  'gsap': '/node_modules/gsap/index.js',
  'gsap/ScrollTrigger': '/node_modules/gsap/ScrollTrigger.js',
} })}</script>`;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(file);
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (ext === '.html') return res.end(data.toString().replace('<head>', '<head>' + importmap));
    res.end(data);
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log('serving', root, 'on', port, 'for:', cmd, args.join(' '));
  const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, SITE: `http://127.0.0.1:${port}` } });
  child.on('exit', code => { server.close(); process.exit(code ?? 1); });
});
