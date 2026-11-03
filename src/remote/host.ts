// What the plugin needs from a remote host (docs/spec.md → Check, Fork).
// Host-neutral; one adapter per host. Pure: no Obsidian runtime imports.

/** One HTTP GET. `main.ts` wraps `requestUrl`; tests pass fixtures. */
export type HttpGet = (url: string, headers: Record<string, string>) => Promise<{ status: number; json: unknown }>;

export interface Head {
	/** The branch actually tracked (the default branch when the source has none). */
	branch: string;
	commit: string;
	tree: string;
}

export interface Tree {
	/** Repo-relative path → blob SHA, files only. */
	files: Map<string, string>;
	/** The host returned only part of the tree. */
	truncated: boolean;
}

export type ChangeStatus = 'added' | 'modified' | 'removed' | 'renamed';

export interface Change {
	path: string;
	status: ChangeStatus;
	/** For `renamed`: the old path. */
	from: string | null;
}

export interface Changes {
	changes: Change[];
	/** The host listed only some of the changed files. */
	truncated: boolean;
}

export type RemoteErrorKind = 'not-found' | 'rate-limited' | 'http' | 'bad-response';

export class RemoteError extends Error {
	readonly kind: RemoteErrorKind;
	readonly status: number | null;

	constructor(kind: RemoteErrorKind, message: string, status: number | null = null) {
		super(message);
		this.name = 'RemoteError';
		this.kind = kind;
		this.status = status;
	}
}

export interface RemoteHost {
	head(repo: string, branch: string | null): Promise<Head>;
	tree(repo: string, tree: string): Promise<Tree>;
	/** Files changed from `base` to `head`; `null` when `base` isn't an ancestor of `head` (unknown, or history rewritten). */
	changes(repo: string, base: string, head: string): Promise<Changes | null>;
	/** A blob's content as UTF-8 text. */
	blob(repo: string, sha: string): Promise<string>;
}
