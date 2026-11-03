import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forkMetaProps, readForkMeta, type ForkMeta } from '../src/sources/fork-meta.ts';

const B = '0123456789abcdef0123456789abcdef01234567';
const meta: ForkMeta = {
	repo: 'https://github.com/a/b',
	path: 'wiki/x.md',
	blob: B,
	branch: 'main',
	commit: B,
	date: '2026-11-03T10:00:00+02:00',
};

test('round trip', () => {
	assert.deepEqual(readForkMeta(forkMetaProps(meta)), meta);
});

test('optional fields omitted when null', () => {
	const props = forkMetaProps({ ...meta, branch: null, commit: null, date: null });
	assert.deepEqual(Object.keys(props), ['fork_repo', 'fork_path', 'fork_blob']);
});

test('not a fork without repo, path and a valid blob', () => {
	assert.equal(readForkMeta(null), null);
	assert.equal(readForkMeta({ title: 'x' }), null);
	assert.equal(readForkMeta({ ...forkMetaProps(meta), fork_blob: 'abc' }), null);
	assert.equal(readForkMeta({ ...forkMetaProps(meta), fork_repo: 'nope' }), null);
});

test('fork_path: leading slash stripped, . and .. segments rejected', () => {
	assert.equal(readForkMeta({ ...forkMetaProps(meta), fork_path: '/wiki/x.md' })?.path, 'wiki/x.md');
	for (const p of ['../x.md', 'wiki/../x.md', './x.md']) {
		assert.equal(readForkMeta({ ...forkMetaProps(meta), fork_path: p }), null, p);
	}
});

test('repo canonicalised, bad commit dropped, unrelated keys ignored', () => {
	const m = readForkMeta({ ...forkMetaProps(meta), fork_repo: 'git@github.com:a/b.git', fork_commit: 'x', tags: ['t'] });
	assert.deepEqual(m, { ...meta, commit: null });
});
