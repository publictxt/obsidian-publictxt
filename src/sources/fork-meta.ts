// A fork's provenance in front matter (docs/spec.md → Fork provenance). Pure.

import { canonicalRepoUrl } from './repo-url.ts';
import { isSha, repoPath, str } from '../util/validate.ts';

export interface ForkMeta {
	repo: string;
	path: string;
	blob: string;
	branch: string | null;
	commit: string | null;
	/** ISO datetime as written. */
	date: string | null;
}

/** Front matter keys, in the order they're written. */
export const FORK_KEYS = [
	'fork_repo',
	'fork_path',
	'fork_branch',
	'fork_commit',
	'fork_blob',
	'fork_date',
] as const;

/** A note's provenance, or `null` if it isn't a valid fork. */
export function readForkMeta(fm: Record<string, unknown> | null | undefined): ForkMeta | null {
	if (!fm) return null;
	const repo = typeof fm.fork_repo === 'string' ? canonicalRepoUrl(fm.fork_repo) : null;
	const path = repoPath(fm.fork_path);
	if (!repo || !path || !isSha(fm.fork_blob)) return null;
	return {
		repo,
		path,
		blob: fm.fork_blob,
		branch: str(fm.fork_branch),
		commit: isSha(fm.fork_commit) ? fm.fork_commit : null,
		// YAML 1.1 parsers may hand back a Date; spec says use the value as written.
		date: str(fm.fork_date),
	};
}

/** The keys to merge into a note's front matter. `null` fields are omitted. */
export function forkMetaProps(m: ForkMeta): Record<string, string> {
	const out: Record<string, string> = {
		fork_repo: m.repo,
		fork_path: m.path,
	};
	if (m.branch) out.fork_branch = m.branch;
	if (m.commit) out.fork_commit = m.commit;
	out.fork_blob = m.blob;
	if (m.date) out.fork_date = m.date;
	return out;
}
