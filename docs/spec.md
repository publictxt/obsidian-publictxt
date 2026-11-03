# PublicTxt — Spec

What the plugin does. Why in `intent.md`, names in `naming.md`. Draft: nothing released.

## Data

`data.json` holds `{ version, forkFolder, sources, state }`. `forkFolder` is the default vault
folder for forks (`''`: the vault root).

## Source

A remote repo the user follows. Stored in plugin data under `sources`.

| Field | Type | Rule |
|---|---|---|
| `url` | string | Canonical repo URL (below). Unique; the source's key |
| `branch` | string \| null | Branch to track. `null`: the remote's default branch |
| `include` | string[] | Folder prefixes ending in `/`, repo-relative. Empty: the whole repo. Narrows "what's new" only |
| `watch` | string[] | Repo-relative file paths to report on whenever they change, even outside `include` |
| `folder` | string \| null | Default vault folder for forks from this source. `null`: the plugin's default |

Normalising (`normalizeData`): unknown keys dropped, invalid sources dropped, `url` made
canonical, duplicates by `url` dropped (first wins), `include` given a trailing `/`, leading `/`
stripped from paths, paths with `.` or `..` segments dropped, lists deduped.

### Canonical repo URL (v0)

`https://<host>/<owner>/<repo>`: scheme and host lower-cased, `.git` suffix, trailing `/`,
query and fragment dropped. `git@host:owner/repo.git` becomes the HTTPS form. Owner and repo
keep their case (hosts differ on case sensitivity). Anything else is invalid.

## State

A cache, per source `url`. Safe to delete. State for a source no longer followed is dropped.

| Field | Meaning |
|---|---|
| `seenCommit` | Head commit at the last check the user acknowledged. `null`: never checked |
| `checkedAt` | ISO datetime of the last check |
| `watched` | `path → blob SHA` last acknowledged, per watched path |

## Fork provenance (front matter)

Written into a forked note's front matter, flat so Obsidian Properties can show and edit them.
Remote front matter is kept; these keys are added or overwritten.

| Key | Value |
|---|---|
| `fork_repo` | Canonical repo URL |
| `fork_path` | Repo-relative path of the file forked |
| `fork_branch` | Branch it was forked from |
| `fork_commit` | Head commit SHA at fork time |
| `fork_blob` | Git blob SHA of the file at fork time: the change marker and merge base |
| `fork_date` | ISO datetime of the fork, with offset |

A note is a fork when `fork_repo`, `fork_path` and `fork_blob` are valid; the rest are optional
when reading. The list of forks is derived by scanning the vault (`intent.md`).

## Check

Per source, against the tracked branch's head:

1. Fetch the head commit and the recursive tree (`path → blob SHA`).
2. **What's new**: files changed between `seenCommit` and head, within `include`. If
   `seenCommit` is null, missing upstream (force-push) or the diff is truncated: list every file
   in `include` as new, and say why.
3. **Watched**: each `watch` path whose blob differs from `watched[path]`, or that is gone.
4. **Forks**: each fork of this source whose `fork_path` blob at head differs from `fork_blob`,
   or that is gone.

Acknowledging moves `seenCommit` and `watched` forward. Forks are acknowledged only by updating
them (later slice), since their state is their front matter.

## Fork

User picks a file from a check (or the source's tree) and a target folder (source `folder`, else
the default). The plugin fetches the blob, writes `<folder>/<file name>`, then adds the
provenance keys. A name clash asks; it never overwrites.

## Build order

1. Schema: data types, `normalizeData`, canonical URL, fork provenance read/write. Pure, tested.
2. GitHub adapter: head, tree, compare, blob, via `requestUrl`. Fixture-tested.
3. Sources settings: add, edit, remove.
4. Check view: what's new, watched, forks.
5. Fork command.
6. Later: update a fork (three-way merge on `fork_blob`), propose upstream, auth, tag filters.
