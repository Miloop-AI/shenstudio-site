import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, fillTemplate, renderNav, renderLatest, renderSchedule, renderShows, renderShorts, renderConnect, seoHead } from '../scripts/lib/render.mjs';

const latest = { id: 'abc', url: 'https://www.youtube.com/watch?v=abc', title: '涨了10倍<不敢卖>"?', thumb: 't', thumbLarge: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
  duration: '25:48', date: '11月6日', views: '5,958 次观看', ep: 6, showKey: 'finance', showName: '财经脱口秀', description: '第一段 & 更多' };
const model = {
  subscribeUrl: 'https://www.youtube.com/@dadaomedia?sub_confirmation=1',
  latest,
  shows: [
    { key: 'finance', name: '财经脱口秀', eyebrow: '北美财经干货', sub: '退休精算', url: 'https://www.youtube.com/playlist?list=PA', total: 6,
      cards: [{ ...latest, id: 'k', url: 'https://www.youtube.com/watch?v=k', title: '401k', ep: 5 }], filler: null,
      airing: { label: '每周五', value: '18:30', note: '下一期 11月13日 · 美西时间' } },
    { key: 'cwei', name: '硅谷C位', eyebrow: 'AI 与科技访谈', sub: '', url: 'https://www.youtube.com/playlist?list=PB', total: 2,
      cards: [{ ...latest, id: 'w', ep: 2 }, { ...latest, id: 'o', ep: 1 }],
      filler: { when: '敬请期待', note: '订阅频道，上线即通知', ep: 3 },
      airing: { label: '最新一期', value: '11月1日', note: 'AI 与科技访谈 · 第2期' } },
  ],
  shorts: { name: '短视频', eyebrow: '一分钟看懂', url: 'https://www.youtube.com/@dadaomedia/shorts',
    cards: [{ id: 's1', url: 'https://www.youtube.com/shorts/s1', title: 'Roth?', thumb: 'st', views: '163 次观看' }] },
};
const config = { siteName: '大道传媒 Shen Studio', description: '描述', host: { name: '沈琛琛', alternateName: 'Cici Shen' },
  channel: { handle: '@dadaomedia' }, email: 'chenchenshentv@gmail.com',
  collab: { eyebrow: '商务合作', heading: '品牌合作 · 嘉宾邀约', text: '欢迎来信。' },
  platforms: [{ name: 'YouTube', handle: '@dadaomedia', url: 'https://www.youtube.com/@dadaomedia', icon: 'youtube' },
    { name: '小红书', handle: '沈琛琛cici', icon: 'xiaohongshu', wide: true }] };
const icons = { youtube: 'M1 1h22', xiaohongshu: 'M2 2h20' };

test('esc escapes HTML special characters', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('fillTemplate replaces placeholders and refuses unknown ones', () => {
  assert.equal(fillTemplate('<p>{{A}} {{B_C}}</p>', { A: '1', B_C: '$&2' }), '<p>1 $&2</p>');
  assert.throws(() => fillTemplate('{{MISSING}}', {}), /\{\{MISSING\}\}/);
});

test('renderNav links every show and the fixed sections', () => {
  const html = renderNav(model, config);
  for (const href of ['#latest', '#finance', '#cwei', '#shorts', '#about', '#connect']) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(html.includes('关于沈琛琛'));
});

test('renderLatest builds a click-to-load player with escaped srcdoc and escaped title', () => {
  const html = renderLatest(latest, model);
  assert.match(html, /<iframe class="player"[^>]* srcdoc="[^"<]*youtube-nocookie\.com\/embed\/abc\?autoplay=1/);
  assert.ok(!/srcdoc="[^"]*</.test(html), 'srcdoc attribute contains no raw <');
  assert.ok(html.includes('涨了10倍&lt;不敢卖&gt;&quot;?'));
  assert.ok(html.includes('财经脱口秀 · 第6期'));
  assert.ok(html.includes('第一段 &amp; 更多'));
  assert.ok(html.includes(model.subscribeUrl));
});

test('renderSchedule shows one cell per show plus the subscribe cell', () => {
  const html = renderSchedule(model);
  assert.ok(html.includes('<strong>18:30</strong>') && html.includes('下一期 11月13日 · 美西时间'));
  assert.ok(html.includes('<span>最新一期</span><strong>11月1日</strong>') && html.includes('AI 与科技访谈 · 第2期'));
  assert.ok(!html.includes('不定期'));
  assert.ok(html.includes('订阅并打开小铃铛'));
});

test('renderShows writes cards, the 全部 link and a card-sized next-episode tile', () => {
  const html = renderShows(model);
  assert.ok(html.includes('id="finance"') && html.includes('id="cwei"'));
  assert.ok(html.includes('全部 6 期 →') && html.includes('全部 2 期 →'));
  assert.ok(html.includes('第5期 · 11月6日 · 5,958 次观看'));
  assert.equal((html.match(/class="card card-next"/g) || []).length, 1);
  assert.ok(html.includes('<span class="next-when">敬请期待</span>'));
  assert.ok(html.includes('硅谷C位 · 第3期'));
});

test('renderShorts writes vertical cards and returns nothing when there are none', () => {
  assert.ok(renderShorts(model).includes('href="https://www.youtube.com/shorts/s1"'));
  assert.equal(renderShorts({ ...model, shorts: { ...model.shorts, cards: [] } }), '');
});

test('renderConnect links platforms that have a URL and shows the others as text', () => {
  const html = renderConnect(config, icons);
  assert.ok(html.includes('<a class="tile" href="https://www.youtube.com/@dadaomedia">'));
  assert.ok(html.includes('<div class="tile">') && html.includes('沈琛琛cici'));
  assert.ok(html.includes('class="wide"'));
  assert.ok(html.includes('mailto:chenchenshentv@gmail.com'));
  assert.throws(() => renderConnect({ ...config, platforms: [{ name: 'X', handle: 'x', icon: 'nope' }] }, icons), /icons\.json has no icon "nope"/);
});

test('seoHead is noindex without SITE_URL and canonical with it', () => {
  assert.ok(seoHead(config, {}).includes('<meta name="robots" content="noindex, nofollow">'));
  const live = seoHead(config, { siteUrl: 'https://example.com', assetBase: 'https://example.com' });
  assert.ok(live.includes('<link rel="canonical" href="https://example.com/">'));
  assert.ok(live.includes('content="https://example.com/og.jpg"'));
  assert.ok(live.includes('"sameAs":["https://www.youtube.com/@dadaomedia"]'));
});
