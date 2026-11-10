import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, firstParagraph, parseDuration, formatDuration, formatViews, formatDate, nextWeekly } from '../scripts/lib/format.mjs';

test('cleanTitle keeps the part before the first ｜ or | and drops hashtags', () => {
  assert.equal(cleanTitle('当AI接管工厂和代码：普通人未来10年最大的危机与出路｜硅谷C位'), '当AI接管工厂和代码：普通人未来10年最大的危机与出路');
  assert.equal(cleanTitle('特斯拉飞车现场炸裂，为什么华尔街不买账？|《硅谷C位》EP1 | 沈琛琛'), '特斯拉飞车现场炸裂，为什么华尔街不买账？');
  assert.equal(cleanTitle('401K一次性全转成Roth可以吗？ #财经脱口秀 #硅谷华人#在美华人'), '401K一次性全转成Roth可以吗？');
  assert.equal(cleanTitle('｜沈琛琛'), '沈琛琛');
  assert.equal(cleanTitle('退休不是看你有多少钱，而是看你需要多少钱💰'), '退休不是看你有多少钱，而是看你需要多少钱💰');
});

test('firstParagraph returns the first prose paragraph, joins Chinese lines without spaces, cuts long text', () => {
  const desc = '在硅谷辛勤打拼20年，\n坐拥$1000万美元身家。\n\n本期《财经脱口秀》……\n\n00:00 开场';
  assert.equal(firstParagraph(desc), '在硅谷辛勤打拼20年，坐拥$1000万美元身家。');
  assert.equal(firstParagraph('#财经脱口秀 #退休\n\n真正的第一段'), '真正的第一段');
  assert.equal(firstParagraph('https://example.com\n\nSecond line\nof English'), 'Second line of English');
  assert.equal(firstParagraph(''), '');
  assert.equal(firstParagraph('一'.repeat(200), 10), '一'.repeat(10) + '…');
});

test('parseDuration and formatDuration', () => {
  assert.equal(parseDuration('PT25M48S'), 1548);
  assert.equal(parseDuration('PT8M19S'), 499);
  assert.equal(parseDuration('PT1H2M3S'), 3723);
  assert.equal(parseDuration('P0D'), 0);
  assert.equal(parseDuration('nonsense'), 0);
  assert.equal(formatDuration(1548), '25:48');
  assert.equal(formatDuration(499), '8:19');
  assert.equal(formatDuration(3723), '1:02:03');
  assert.equal(formatDuration(45), '0:45');
});

test('formatViews switches to 万 from 10,000', () => {
  assert.equal(formatViews(163), '163 次观看');
  assert.equal(formatViews('5958'), '5,958 次观看');
  assert.equal(formatViews(31234), '3.1万次观看');
  assert.equal(formatViews(20000), '2万次观看');
  assert.equal(formatViews(48049), '4.8万次观看');
});

test('formatDate shows Pacific dates and adds the year only when it differs', () => {
  const now = new Date('2026-11-09T20:00:00Z');
  assert.equal(formatDate('2026-11-02T02:00:33Z', now), '11月1日');   // 18:00 PST on Nov 1
  assert.equal(formatDate('2026-10-31T03:00:00Z', now), '10月30日');  // 20:00 PDT on Oct 30
  assert.equal(formatDate('2025-12-31T20:00:00Z', now), '2025年12月31日');
});

test('nextWeekly finds the next Friday 18:30 Pacific', () => {
  assert.equal(nextWeekly(5, '18:30', new Date('2026-11-09T20:00:00Z')), '11月13日'); // Monday noon
  assert.equal(nextWeekly(5, '18:30', new Date('2026-11-14T01:00:00Z')), '今天');     // Friday 17:00
  assert.equal(nextWeekly(5, '18:30', new Date('2026-11-14T03:00:00Z')), '11月20日'); // Friday 19:00
  assert.equal(nextWeekly(5, '18:30', new Date('2026-12-28T20:00:00Z')), '1月1日');   // across New Year
});
