import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRepoUrl } from '../src/sources/repo-url.ts';

test('canonical form: host lower-cased, .git and trailing slash dropped, case kept', () => {
	for (const input of [
		'https://github.com/Owner/Repo',
		'https://GitHub.com/Owner/Repo.git',
		'https://github.com/Owner/Repo/',
		'https://github.com/Owner/Repo?tab=x#y',
		'  git@github.com:Owner/Repo.git ',
	]) {
		assert.equal(canonicalRepoUrl(input), 'https://github.com/Owner/Repo', input);
	}
});

test('not a repo URL', () => {
	for (const input of [
		'',
		'github.com/a/b',
		'ftp://github.com/a/b',
		'https://github.com/a',
		'https://github.com/a/b/tree/main',
		'https://user:pw@github.com/a/b',
	]) {
		assert.equal(canonicalRepoUrl(input), null, input);
	}
});
