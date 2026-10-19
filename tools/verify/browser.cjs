// The browser the checks drive: Playwright's Chromium. In the cloud container it renders in software (SwiftShader);
// on a machine with a real GPU set CF_GPU=1 (much faster). CHROMIUM: a Chromium/Chrome binary to use instead.
const { chromium } = require('playwright');
const fs = require('fs');
const SOFT = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const GPU = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--no-sandbox'];
// (and none of the browser's own calls home: they go nowhere from the container)
const QUIET = ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--disable-sync'];
function launch() {
  const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath: exe, args: [...(process.env.CF_GPU ? GPU : SOFT), ...QUIET] });
}
// the site as served for the check (serve.cjs sets SITE)
const site = () => process.env.SITE || 'http://127.0.0.1:8002';
// (no requests off the machine: the film needs none, and the container's network refuses them anyway)
const offline = page => page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
module.exports = { launch, site, offline };
