// What the plugin stores in data.json (docs/spec.md → Source, State).
// Pure: no Obsidian runtime imports, so tests run under plain Node.

import { canonicalRepoUrl } from './repo-url.ts';
import { isRecord, isSha, repoPath, str } from '../util/validate.ts';

export const DATA_VERSION = 1;

/** A remote repo the user follows. Config. */
export interface Source {
	/** Canonical repo URL; the source's key. */
	url: string;
	/** Branch to track; `null`: the remote's default branch. */
	branch: string | null;
	/** Folder prefixes ending in `/`. Empty: the whole repo. */
	include: string[];
	/** Repo-relative file paths reported on whenever they change. */
	watch: string[];
	/** Vault folder for forks from this source; `null`: `forkFolder`. */
	folder: string | null;
}

/** Per-source cache. Safe to delete. */
export interface SourceState {
	seenCommit: string | null;
	checkedAt: string | null;
	/** Watched path → blob SHA last acknowledged. */
	watched: Record<string, string>;
}

export interface PublicTxtData {
	version: number;
	/** Default vault folder for forks; `''`: the vault root. */
	forkFolder: string;
	/** Vault folder holding the bare clones (docs/spec.md → Remote host). */
	remotesFolder: string;
	/** The git executable; `git`: whatever is on PATH. */
	gitPath: string;
	sources: Source[];
	/** Keyed by `Source.url`. */
	state: Record<string, SourceState>;
}

export const DEFAULT_DATA: PublicTxtData = {
	version: DATA_VERSION,
	forkFolder: '',
	remotesFolder: 'remotes',
	gitPath: 'git',
	sources: [],
	state: {},
};

/** Vault-relative folder without surrounding slashes, or `null`. */
function vaultFolder(v: unknown): string | null {
	return str(v)?.replace(/^\/+|\/+$/g, '') ?? null;
}

function uniq(xs: string[]): string[] {
	return [...new Set(xs)];
}

function paths(v: unknown, folder: boolean): string[] {
	if (!Array.isArray(v)) return [];
	const out = v
		.map(repoPath)
		.filter((p): p is string => p !== null)
		.map((p) => (folder && !p.endsWith('/') ? `${p}/` : p));
	return uniq(out);
}

/** One source, or `null` if its URL isn't a repo. */
export function normalizeSource(v: unknown): Source | null {
	if (!isRecord(v)) return null;
	const url = typeof v.url === 'string' ? canonicalRepoUrl(v.url) : null;
	if (!url) return null;
	const folder = vaultFolder(v.folder);
	return {
		url,
		branch: str(v.branch),
		include: paths(v.include, true),
		watch: paths(v.watch, false),
		folder: folder || null,
	};
}

function normalizeState(v: unknown): SourceState {
	const r = isRecord(v) ? v : {};
	const watched: Record<string, string> = {};
	if (isRecord(r.watched)) {
		for (const [k, blob] of Object.entries(r.watched)) {
			const p = repoPath(k);
			if (p && isSha(blob)) watched[p] = blob;
		}
	}
	return {
		seenCommit: isSha(r.seenCommit) ? r.seenCommit : null,
		checkedAt: str(r.checkedAt),
		watched,
	};
}

/** Anything loaded from data.json → valid data. Never throws. */
export function normalizeData(v: unknown): PublicTxtData {
	const r = isRecord(v) ? v : {};
	const sources: Source[] = [];
	const seen = new Set<string>();
	for (const s of Array.isArray(r.sources) ? r.sources : []) {
		const src = normalizeSource(s);
		if (src && !seen.has(src.url)) {
			seen.add(src.url);
			sources.push(src);
		}
	}

	// State for sources no longer followed is dropped; keys re-canonicalised.
	const state: Record<string, SourceState> = {};
	if (isRecord(r.state)) {
		for (const [k, st] of Object.entries(r.state)) {
			const url = canonicalRepoUrl(k);
			if (url && seen.has(url) && !state[url]) state[url] = normalizeState(st);
		}
	}

	const forkFolder = vaultFolder(r.forkFolder) ?? DEFAULT_DATA.forkFolder;
	const remotesFolder = vaultFolder(r.remotesFolder) || DEFAULT_DATA.remotesFolder;
	const gitPath = str(r.gitPath) ?? DEFAULT_DATA.gitPath;
	return { version: DATA_VERSION, forkFolder, remotesFolder, gitPath, sources, state };
}
