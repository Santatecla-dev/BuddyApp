const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/diveStats.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const stats = { exports: {} };
new Function('exports', 'require', 'module', compiled)(stats.exports, require, stats);
const { filterDives, summarizeDives, diveDate, formatDiveTime } = stats.exports;
const dive = (id, date, extra = {}) => ({ id, date, country: 'Spain', location: 'Reef', duration: 45, maxDepth: 20, ...extra });
const ids = values => values.map(d => d.id);
const now = new Date(2026, 8, 23);
const dives = [
  dive(1, '2025-08-12'), dive(2, '2026-08-01'), dive(3, '2026-08-31'),
  dive(4, '2026-09-01'), dive(5, '2025-01-01'), dive(6, '2025-12-31'),
  dive(7, '2026-01-01'), dive(8, '2024-12-31'), dive(9, '2027-08-01'),
  dive(10, 'invalid'),
];
assert.deepEqual(ids(filterDives(dives, 'month', now)), [2, 3]);
assert.deepEqual(ids(filterDives(dives, 'year', now)), [1, 5, 6]);
assert.equal(filterDives(dives, 'all', now).length, 10);
assert.deepEqual(ids(filterDives(dives, 'month', new Date(2026, 0, 15))), [6]);
assert.equal(filterDives([dive(1, '2024-02-29')], 'month', new Date(2024, 2, 1)).length, 1);
assert.ok(Number.isNaN(diveDate('2026-02-30').getTime()));
assert.equal(diveDate('2026-08-01').getDate(), 1);
const start = new Date(2026, 7, 1);
const end = new Date(2026, 8, 1);
assert.deepEqual(ids(filterDives([
  dive(1, new Date(start.getTime() - 1).toISOString()), dive(2, start.toISOString()),
  dive(3, new Date(end.getTime() - 1).toISOString()), dive(4, end.toISOString()),
], 'month', now)), [2, 3]);
assert.equal(formatDiveTime(45), '45 min');
assert.equal(formatDiveTime(125), '2 h 5 min');
assert.equal(formatDiveTime(0), '0 min');
assert.equal(summarizeDives([]).deepestDive, null);
assert.deepEqual(summarizeDives([]).countries, []);
const many = Array.from({ length: 10000 }, (_, i) => dive(i, new Date(2020, 0, i + 1).toISOString(), {
  duration: i, maxDepth: i % 50, country: i % 2 ? 'Spain' : 'Portugal',
}));
const before = many.map(d => d.id);
const summary = summarizeDives(many);
assert.deepEqual(ids(summary.recent), [9994, 9995, 9996, 9997, 9998, 9999]);
assert.equal(summary.longestDive.id, 9999);
assert.equal(summary.deepestDive.maxDepth, 49);
assert.equal(summary.totalMinutes, 49995000);
assert.deepEqual(summary.countries, [['Portugal', 5000], ['Spain', 5000]]);
assert.deepEqual(ids(many), before);
assert.deepEqual(summarizeDives([dive(1, '2026-01-01', { country: '__proto__' })]).countries, [['__proto__', 1]]);
console.log('Stats regression checks passed (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')');
