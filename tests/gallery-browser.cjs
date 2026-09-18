// Run after Hugo build: NODE_PATH=<playwright install>/node_modules node tests/gallery-browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium',
        headless: true,
        args: ['--no-sandbox', '--no-proxy-server'],
    });
    try {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/mc.yandex.ru/**', route => route.abort());
        const base = process.env.SITE_URL || 'https://gallery.skorikov.su';
        await page.goto(`${base}/en/`);
        const html = await page.content();
        assert.match(html, /<!-- release: commit=[a-f0-9]{40}(?:-dirty)? built_at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z -->/);
        assert.equal(await page.locator('.lang-link').getAttribute('href'), '/');
        assert.match(await page.locator('.gallery-item img').first().getAttribute('alt'), /^Painting /);
        assert.equal(await page.locator('link[hreflang="ru-ru"]').getAttribute('href'), 'https://skorikov.su/');
        assert.equal(await page.locator('link[hreflang="en-us"]').getAttribute('href'), 'https://skorikov.su/en/');
        assert.equal(await page.title(), 'Igor Skorikov - Gallery');
        for (const img of await page.locator('.gallery-item img').all()) {
            assert.ok(Number(await img.getAttribute('width')) > 0);
            assert.ok(Number(await img.getAttribute('height')) > 0);
        }
        console.log('PASS language links, SEO, translations, thumbnail dimensions');

        const item = page.locator('.gallery-item').nth(20);
        await item.focus();
        const scrollBefore = await page.evaluate(() => window.scrollY);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'false');
        assert.equal(await page.evaluate(() => document.activeElement.className), 'lightbox-close');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.className), 'lightbox-close');
        const src = await page.locator('#lightbox-image').getAttribute('src');
        await page.keyboard.press('ArrowRight');
        assert.notEqual(await page.locator('#lightbox-image').getAttribute('src'), src);
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#lightbox-image').getAttribute('src'), src);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'true');
        assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore) <= 1);
        assert.equal(await item.evaluate(el => el === document.activeElement), true);
        console.log('PASS keyboard open/navigation/close, focus trap, scroll restoration');

        await page.keyboard.press('Enter');
        await page.locator('#lightbox-image').evaluate(img => img.decode());
        await page.setViewportSize({ width: 390, height: 640 });
        await page.waitForTimeout(100);
        const box = await page.locator('#lightbox-image').boundingBox();
        assert.ok(box.width <= 390 && box.height <= 576);
        await page.locator('.lightbox-close').click();
        assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'true');
        console.log('PASS cached image resize and close button on mobile viewport');

        await item.focus();
        await page.keyboard.press('Enter');
        await page.evaluate(() => {
            const img = document.getElementById('lightbox-image');
            const send = (type, points, ended = []) => {
                const touch = ([identifier, clientX, clientY]) => new Touch({ identifier, target: img, clientX, clientY });
                img.dispatchEvent(new TouchEvent(type, {
                    bubbles: true, cancelable: true,
                    touches: points.map(touch), changedTouches: ended.map(touch),
                }));
            };
            send('touchstart', [[1, 100, 200], [2, 200, 200]]);
            send('touchmove', [[1, 50, 200], [2, 250, 200]]);
            send('touchend', [], [[1, 50, 200], [2, 250, 200]]);
            send('touchstart', [[1, 100, 200]]);
            send('touchmove', [[1, 150, 200]]);
            send('touchend', [], [[1, 150, 200]]);
        });
        assert.equal(await page.locator('#lightbox-image').evaluate(img => img.style.transform), 'scale(2) translate(25px, 0px)');
        const zoomedSrc = await page.locator('#lightbox-image').getAttribute('src');
        await page.locator('#lightbox-image').dispatchEvent('click');
        assert.equal(await page.locator('#lightbox-image').getAttribute('src'), zoomedSrc);
        await page.keyboard.press('Escape');
        console.log('PASS pinch/pan displacement and no accidental navigation while zoomed');

        await page.locator('.lang-link').click();
        assert.match(await page.locator('.gallery-item img').first().getAttribute('alt'), /^Картина /);
        assert.equal(await page.locator('.lang-link').getAttribute('href'), '/en/');
        assert.deepEqual(errors, []);
        console.log('PASS Russian return route and no JavaScript exceptions');

        const plain = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled: false });
        const plainPage = await plain.newPage();
        await plainPage.route('**/mc.yandex.ru/**', route => route.abort());
        await plainPage.goto(base);
        const href = await plainPage.locator('.gallery-item').first().getAttribute('href');
        await plainPage.locator('.gallery-item').first().click();
        assert.equal(new URL(plainPage.url()).pathname, href);
        console.log('PASS full image remains accessible without JavaScript');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
