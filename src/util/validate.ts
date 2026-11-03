// Small checks for untrusted values (data.json, front matter, git output). Pure.

const SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/** A full git object ID: SHA-1 (40 hex) or SHA-256 (64 hex), lower-case. */
export function isSha(v: unknown): v is string {
	return typeof v === 'string' && SHA.test(v);
}

export function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A non-blank string, trimmed; otherwise `null`. */
export function str(v: unknown): string | null {
	return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Repo-relative path: no leading `/`, no `.`/`..` segments; otherwise `null`. */
export function repoPath(v: unknown): string | null {
	const s = str(v)?.replace(/^\/+/, '');
	if (!s) return null;
	return s.split('/').some((p) => p === '.' || p === '..') ? null : s;
}
