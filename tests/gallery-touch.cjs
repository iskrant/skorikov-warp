const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await page.route('**/mc.yandex.ru/**', route => route.abort());
        await page.goto('http://gallery.skorikov.su/');
        const item = page.locator('.gallery-item').first();
        await item.tap();
        await page.locator('#lightbox-image').evaluate(img => img.decode());
        // Find a backdrop point outside both the image and the close button.
        const point = await page.evaluate(() => {
            for (let y = 60; y < innerHeight; y += 20) {
                for (let x = 5; x < innerWidth; x += 20) {
                    if (document.elementFromPoint(x, y)?.id === 'lightbox') return { x, y };
                }
            }
            throw new Error('No backdrop point');
        });
        await page.touchscreen.tap(point.x, point.y);
        await page.waitForTimeout(500);
        assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'true');
        await item.tap(); // A separate deliberate touch must still work immediately.
        assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'false');

        for (const deltaY of [0, 120, -120]) {
            const cancelled = await page.evaluate(deltaY => {
                const box = document.getElementById('lightbox');
                const touch = y => new Touch({ identifier: 1, target: box, clientX: 5, clientY: y });
                box.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch(200)] }));
                if (deltaY) box.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(200 + deltaY)] }));
                const end = new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [touch(200 + deltaY)] });
                box.dispatchEvent(end);
                return end.defaultPrevented;
            }, deltaY);
            assert.equal(cancelled, true, 'Handled touch must cancel the subsequent compatibility click');
            assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'true');
            assert.equal(new URL(page.url()).pathname, '/');
            await item.tap();
        }
        console.log('PASS mobile backdrop tap, vertical swipes, compatibility-click cancellation and reopening');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
