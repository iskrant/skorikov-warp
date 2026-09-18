// Simulate a returning visitor whose browser still has the previous gallery.js.
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

(async () => {
    const oldScript = execFileSync('git', ['show', '38f2281:themes/gallery/static/js/gallery.js'], { encoding: 'utf8' });
    const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
    try {
        const page = await browser.newPage();
        let legacyRequested = false;
        await page.route('**/mc.yandex.ru/**', route => route.abort());
        await page.route('**/js/gallery.js', route => {
            legacyRequested = true;
            return route.fulfill({ contentType: 'application/javascript', body: oldScript });
        });
        await page.goto(process.env.SITE_URL || 'http://gallery.skorikov.su/');
        await page.locator('.gallery-item').first().click();
        if (process.env.REPRODUCE_OLD === '1') {
            await page.waitForURL('**/images/**');
            assert.equal(legacyRequested, true);
            console.log('REPRODUCED: stale JS navigates to the original image');
        } else {
            assert.equal(legacyRequested, false, 'HTML must not request the cacheable legacy URL');
            assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'false');
            assert.equal(new URL(page.url()).pathname, '/');
            const scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src));
            assert.ok(scripts.some(src => /\/js\/gallery\.[a-f0-9]{64}\.js$/.test(src)));
            console.log('PASS: stale legacy JS is bypassed; click opens modal without navigation');
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
