import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPARE_FILE_CAP, GitHubHost, decodeBase64, githubRepo, hostFor } from '../src/remote/github.ts';
import { RemoteError, type HttpGet } from '../src/remote/host.ts';

const REPO = 'https://github.com/a/b';
const API = 'https://api.github.com/repos/a/b';
const C1 = '1'.repeat(40);
const C2 = '2'.repeat(40);
const T = 't'.repeat(40);

// Responses trimmed to the fields the adapter reads, shaped as GitHub's REST API returns them.
function fake(routes: Record<string, [number, unknown]>): { http: HttpGet; calls: string[]; headers: Record<string, string>[] } {
	const calls: string[] = [];
	const headers: Record<string, string>[] = [];
	const http: HttpGet = (url, h) => {
		calls.push(url);
		headers.push(h);
		const r = routes[url];
		return Promise.resolve(r ? { status: r[0], json: r[1] } : { status: 404, json: { message: 'Not Found' } });
	};
	return { http, calls, headers };
}

const branchJson = { name: 'main', commit: { sha: C2, commit: { tree: { sha: T } } } };

test('githubRepo / hostFor: GitHub only', () => {
	assert.equal(githubRepo(REPO), 'a/b');
	assert.equal(githubRepo('https://gitlab.com/a/b'), null);
	assert.equal(hostFor('https://gitlab.com/a/b', fake({}).http), null);
	assert.ok(hostFor(REPO, fake({}).http) instanceof GitHubHost);
});

test('head: default branch looked up when the source has none', async () => {
	const f = fake({ [API]: [200, { default_branch: 'main' }], [`${API}/branches/main`]: [200, branchJson] });
	assert.deepEqual(await new GitHubHost(f.http).head(REPO, null), { branch: 'main', commit: C2, tree: T });
	assert.equal(f.calls.length, 2);
});

test('head: named branch is one call, slashes kept, token sent', async () => {
	const f = fake({ [`${API}/branches/feat/x%23y`]: [200, branchJson] });
	const h = await new GitHubHost(f.http, 'tok').head(REPO, 'feat/x#y');
	assert.equal(h.branch, 'feat/x#y');
	assert.equal(f.calls.length, 1);
	assert.equal(f.headers[0]?.Authorization, 'Bearer tok');
});

test('tree: files only, truncation flagged', async () => {
	const f = fake({
		[`${API}/git/trees/${T}?recursive=1`]: [200, {
			truncated: true,
			tree: [
				{ path: 'wiki', type: 'tree', sha: 'x' },
				{ path: 'wiki/a.md', type: 'blob', sha: C1 },
				{ path: 'sub', type: 'commit', sha: 'y' },
			],
		}],
	});
	const t = await new GitHubHost(f.http).tree(REPO, T);
	assert.deepEqual([...t.files], [['wiki/a.md', C1]]);
	assert.equal(t.truncated, true);
});

test('changes: statuses mapped, renames keep the old path', async () => {
	const f = fake({
		[`${API}/compare/${C1}...${C2}`]: [200, {
			status: 'ahead',
			files: [
				{ filename: 'a.md', status: 'added' },
				{ filename: 'b.md', status: 'changed' },
				{ filename: 'c.md', status: 'removed' },
				{ filename: 'd.md', status: 'renamed', previous_filename: 'old/d.md' },
				{ filename: 'e.md', status: 'unchanged' },
			],
		}],
	});
	assert.deepEqual(await new GitHubHost(f.http).changes(REPO, C1, C2), {
		truncated: false,
		changes: [
			{ path: 'a.md', status: 'added', from: null },
			{ path: 'b.md', status: 'modified', from: null },
			{ path: 'c.md', status: 'removed', from: null },
			{ path: 'd.md', status: 'renamed', from: 'old/d.md' },
		],
	});
});

test('changes: null when base is unknown or not an ancestor', async () => {
	const host = new GitHubHost(fake({
		[`${API}/compare/${C2}...${C1}`]: [200, { status: 'behind', files: [] }],
	}).http);
	assert.equal(await host.changes(REPO, C1, C2), null); // 404
	assert.equal(await host.changes(REPO, C2, C1), null); // behind
});

test('changes: a full page is flagged truncated', async () => {
	const files = Array.from({ length: COMPARE_FILE_CAP }, (_, i) => ({ filename: `${i}.md`, status: 'added' }));
	const f = fake({ [`${API}/compare/${C1}...${C2}`]: [200, { status: 'ahead', files }] });
	assert.equal((await new GitHubHost(f.http).changes(REPO, C1, C2))?.truncated, true);
});

test('blob: base64 with line breaks decoded as UTF-8', async () => {
	const text = '# Café ✓\n';
	const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
	const wrapped = `${b64.slice(0, 6)}\n${b64.slice(6)}\n`;
	const f = fake({ [`${API}/git/blobs/${C1}`]: [200, { encoding: 'base64', content: wrapped }] });
	assert.equal(await new GitHubHost(f.http).blob(REPO, C1), text);
	assert.equal(decodeBase64(''), '');
});

test('errors: not found, rate limit, other, bad response', async () => {
	const kind = async (p: Promise<unknown>) => {
		try {
			await p;
		} catch (e) {
			assert.ok(e instanceof RemoteError);
			return e.kind;
		}
		return 'no error';
	};
	const host = new GitHubHost(fake({
		[`${API}/branches/rl`]: [403, { message: 'API rate limit exceeded for 1.2.3.4.' }],
		[`${API}/branches/forbidden`]: [403, { message: 'Resource not accessible' }],
		[`${API}/branches/odd`]: [200, { name: 'odd' }],
	}).http);
	assert.equal(await kind(host.head(REPO, 'missing')), 'not-found');
	assert.equal(await kind(host.head(REPO, 'rl')), 'rate-limited');
	assert.equal(await kind(host.head(REPO, 'forbidden')), 'http');
	assert.equal(await kind(host.head(REPO, 'odd')), 'bad-response');
});
