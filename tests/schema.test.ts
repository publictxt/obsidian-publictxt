import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DATA, normalizeData } from '../src/sources/schema.ts';

const B = '0123456789abcdef0123456789abcdef01234567';

test('garbage in, defaults out', () => {
	for (const v of [undefined, null, 1, 'x', [], {}]) {
		assert.deepEqual(normalizeData(v), DEFAULT_DATA);
	}
});

test('sources: canonical, defaults filled, paths cleaned, invalid and duplicate dropped', () => {
	const d = normalizeData({
		sources: [
			{ url: 'https://github.com/a/b.git', include: ['/wiki', 'notes/', 'wiki/', '../x', 3], watch: ['/wiki/x.md', 'wiki/x.md'], extra: 1 },
			{ url: 'https://github.com/a/b', branch: 'dev' },
			{ url: 'not a url' },
			{ url: 'https://github.com/c/d', branch: ' main ', folder: '/forks/c/' },
		],
	});
	assert.deepEqual(d.sources, [
		{ url: 'https://github.com/a/b', branch: null, include: ['wiki/', 'notes/'], watch: ['wiki/x.md'], folder: null },
		{ url: 'https://github.com/c/d', branch: 'main', include: [], watch: [], folder: 'forks/c' },
	]);
});

test('state: kept for followed sources only, invalid values dropped', () => {
	const d = normalizeData({
		sources: [{ url: 'https://github.com/a/b' }],
		state: {
			'https://GITHUB.com/a/b.git': { seenCommit: B, checkedAt: '2026-11-03T10:00:00+02:00', watched: { 'x.md': B, 'y.md': 'nope' } },
			'https://github.com/gone/repo': { seenCommit: B },
		},
	});
	assert.deepEqual(d.state, {
		'https://github.com/a/b': { seenCommit: B, checkedAt: '2026-11-03T10:00:00+02:00', watched: { 'x.md': B } },
	});
});

test('forkFolder trimmed of slashes', () => {
	assert.equal(normalizeData({ forkFolder: '/Forks/' }).forkFolder, 'Forks');
});
