// GitHub adapter over the REST API (docs/spec.md → Build order 2). Pure.

import {
	RemoteError,
	type Change,
	type ChangeStatus,
	type Changes,
	type Head,
	type HttpGet,
	type RemoteHost,
	type Tree,
} from './host.ts';

const API = 'https://api.github.com';
/** GitHub's cap on files in one compare response. */
export const COMPARE_FILE_CAP = 300;

const STATUS: Record<string, ChangeStatus> = {
	added: 'added',
	modified: 'modified',
	changed: 'modified',
	removed: 'removed',
	renamed: 'renamed',
	copied: 'added',
};

type Json = Record<string, unknown>;

function isJson(v: unknown): v is Json {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function get(v: unknown, ...keys: string[]): unknown {
	let cur = v;
	for (const k of keys) cur = isJson(cur) ? cur[k] : undefined;
	return cur;
}

function need(v: unknown, what: string): string {
	if (typeof v !== 'string' || !v) throw new RemoteError('bad-response', `GitHub response has no ${what}`);
	return v;
}

/** `https://github.com/owner/repo` → `owner/repo`, or `null` for another host. */
export function githubRepo(url: string): string | null {
	const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(url);
	return m ? `${m[1] ?? ''}/${m[2] ?? ''}` : null;
}

function enc(ref: string): string {
	return ref.split('/').map(encodeURIComponent).join('/');
}

/** base64 (GitHub wraps lines) → UTF-8 text. */
export function decodeBase64(b64: string): string {
	const bin = atob(b64.replace(/\s/g, ''));
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder('utf-8').decode(bytes);
}

export class GitHubHost implements RemoteHost {
	private readonly http: HttpGet;
	private readonly token: string | null;

	constructor(http: HttpGet, token: string | null = null) {
		this.http = http;
		this.token = token;
	}

	private async json(path: string, notFoundOk = false): Promise<unknown> {
		const headers: Record<string, string> = {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		};
		if (this.token) headers.Authorization = `Bearer ${this.token}`;
		const { status, json } = await this.http(`${API}${path}`, headers);
		if (status >= 200 && status < 300) return json;
		if (status === 404) {
			if (notFoundOk) return null;
			throw new RemoteError('not-found', `Not found on GitHub: ${path}`, status);
		}
		const msg = get(json, 'message');
		if (status === 429 || (status === 403 && typeof msg === 'string' && /rate limit/i.test(msg))) {
			throw new RemoteError('rate-limited', 'GitHub rate limit reached', status);
		}
		throw new RemoteError('http', `GitHub returned ${status}${typeof msg === 'string' ? `: ${msg}` : ''}`, status);
	}

	private repo(url: string): string {
		const r = githubRepo(url);
		if (!r) throw new RemoteError('bad-response', `Not a GitHub repo: ${url}`);
		return r;
	}

	async head(url: string, branch: string | null): Promise<Head> {
		const repo = this.repo(url);
		const name = branch ?? need(get(await this.json(`/repos/${repo}`), 'default_branch'), 'default branch');
		const b = await this.json(`/repos/${repo}/branches/${enc(name)}`);
		return {
			branch: name,
			commit: need(get(b, 'commit', 'sha'), 'commit'),
			tree: need(get(b, 'commit', 'commit', 'tree', 'sha'), 'tree'),
		};
	}

	async tree(url: string, tree: string): Promise<Tree> {
		const t = await this.json(`/repos/${this.repo(url)}/git/trees/${tree}?recursive=1`);
		const entries = get(t, 'tree');
		if (!Array.isArray(entries)) throw new RemoteError('bad-response', 'GitHub tree has no entries');
		const files = new Map<string, string>();
		for (const e of entries) {
			const path = get(e, 'path');
			const sha = get(e, 'sha');
			if (get(e, 'type') === 'blob' && typeof path === 'string' && typeof sha === 'string') files.set(path, sha);
		}
		return { files, truncated: get(t, 'truncated') === true };
	}

	async changes(url: string, base: string, head: string): Promise<Changes | null> {
		const c = await this.json(`/repos/${this.repo(url)}/compare/${base}...${head}`, true);
		if (c === null) return null;
		const status = get(c, 'status');
		if (status !== 'ahead' && status !== 'identical') return null;
		const files = get(c, 'files');
		const list = Array.isArray(files) ? files : [];
		const changes: Change[] = [];
		for (const f of list) {
			const path = get(f, 'filename');
			const s = STATUS[String(get(f, 'status'))];
			if (typeof path !== 'string' || !s) continue;
			const from = get(f, 'previous_filename');
			changes.push({ path, status: s, from: s === 'renamed' && typeof from === 'string' ? from : null });
		}
		return { changes, truncated: list.length >= COMPARE_FILE_CAP };
	}

	async blob(url: string, sha: string): Promise<string> {
		const b = await this.json(`/repos/${this.repo(url)}/git/blobs/${sha}`);
		if (get(b, 'encoding') !== 'base64') throw new RemoteError('bad-response', 'GitHub blob is not base64');
		return decodeBase64(need(get(b, 'content'), 'blob content'));
	}
}

/** The adapter for a canonical repo URL, or `null` if its host isn't supported yet. */
export function hostFor(url: string, http: HttpGet, token: string | null = null): RemoteHost | null {
	return githubRepo(url) ? new GitHubHost(http, token) : null;
}
