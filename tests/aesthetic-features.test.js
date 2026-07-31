const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'viewer.js'), 'utf8');

test('mobile product carousel is snapped, guided, paginated, and visually clean', () => {
  assert.match(html, /id="productPagination"/);
  assert.match(html, /Swipe products/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /\.select-list::-webkit-scrollbar/);
  assert.match(css, /\.rail::after/);
  assert.match(js, /updateProductPagination/);
});

test('products have an orientation-responsive grounding shadow', () => {
  assert.match(html, /class="product-ground-shadow"/);
  assert.match(css, /--ground-shift/);
  assert.match(css, /\.product-ground-shadow/);
  assert.match(js, /--ground-shift/);
});

test('selected products have restrained game-like feedback and optional muted sound', () => {
  assert.match(html, /id="soundToggle"/);
  assert.match(js, /selectionSoundEnabled/);
  assert.match(js, /playSelectionSound/);
  assert.match(css, /\.select-item\.active::before/);
  assert.match(css, /@keyframes selectionScan/);
  assert.match(js, /select-item__swatch/);
});

test('mobile purchase dock mirrors the active product and CTA', () => {
  for (const id of ['mobilePurchaseDock', 'mobileDockName', 'mobileDockPrice', 'mobileDockAction']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /updateMobileDock/);
  assert.match(css, /\.mobile-purchase-dock\.is-visible/);
});

test('detail mode offers hotspots and fabric, print, and construction views', () => {
  assert.match(html, /id="productDetailDialog"/);
  assert.match(html, /data-detail="fabric"/);
  assert.match(html, /data-detail="print"/);
  assert.match(html, /data-detail="construction"/);
  assert.match(js, /openDetailMode/);
  assert.match(js, /renderDetailMode/);
  assert.match(css, /\.detail-hotspots/);
  assert.match(css, /\.detail-view/);
});

test('coming-soon products use a non-purchase state', () => {
  assert.match(js, /const available = p\.price != null/);
  assert.match(js, /Notify me/);
  assert.match(js, /els\.size\.disabled = !available/);
  assert.match(css, /\.purchase\.is-unavailable/);
});

test('ticker content is product-aware instead of repeated filler', () => {
  assert.match(html, /id="tickerTrack"/);
  assert.match(js, /updateTicker/);
  assert.match(js, /Worldwide shipping/);
  const staticLimitedDropCount = (html.match(/Limited drop/g) || []).length;
  assert.ok(staticLimitedDropCount <= 1, 'ticker must not repeat the old filler sequence');
});

test('mobile layout removes the dead grid area', () => {
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?main\s*\{[^}]*min-height:\s*0/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.shell\s*\{[^}]*min-height:\s*auto/);
});
