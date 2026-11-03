# PublicTxt — Intent

Why this plugin exists and the decisions behind its shape. What it does is in `spec.md`, names
in `naming.md`.

## Why

PublicTxt's v1 aim is to "pull selected pages from other people's PublicTxt repos into a local
aggregate view" (publictext `README.md`, Roadmap). `obsidian-publictxt-facets` is the browsing
half and stays offline by design. This plugin is the pulling half: it talks to remote repos and
writes into the vault, only when the user asks.

## First use case

1. Follow a few remote repos.
2. See what changed in them since I last looked.
3. Fork a page I want: copy it into a folder I choose, with where it came from in its front
   matter.
4. Next check, see which of my forks have changed upstream.

## Decisions

- **The fork records its own provenance.** Source repo, path, branch, commit and blob live in
  the forked note's front matter. The list of forks is *derived* by scanning the vault, never
  stored separately: one source of truth, and moving, renaming or deleting a fork needs no
  bookkeeping. Fork provenance is an authored fact (it can't be recomputed), so storing it
  doesn't break publictext ADR-0003 (no derived data on disk).
- **Config and state are separate.** Sources (what I follow) are config. Last-seen commits and
  acknowledged blobs are state: a cache, safe to delete, at worst everything shows as new.
- **Change detection by git blob SHA.** The blob SHA of a file is content-addressed and the same
  on every host. Storing it at fork time also keeps the merge base, which a later
  "update my fork" (three-way merge) or "propose back upstream" needs.
- **No git binary.** `isDesktopOnly` is false, so no Node, no `git` CLI (publictext ADR-0004 is
  for the .NET side). Remotes are read over HTTPS through a host adapter; GitHub first. The
  schema stays host-neutral: only the adapter knows GitHub.
- **Follow whole repos, narrow locally** (publictext ADR-0005). A source fetches the whole repo's
  tree; `include` prefixes and `watch` paths filter it on this side.
- **Folder selection reuses the manifest's convention**: repo-relative folder prefixes ending in
  `/` (as `types` and `ignore` in `publictxt.yaml`), not a new glob grammar. Tag filters need
  file contents, so they wait.

## Open questions

1. **Where sources live.** v1: plugin data (`data.json`). Alternative: the vault's
   `publictxt.yaml` `follows`, which makes the follow list public text (ADR-0005 wants that) and
   syncs with the repo. Field names match `follows` so a move is mechanical. `watch` and state
   stay private either way.
2. **Front matter prefix.** `fork_*` (see `spec.md`). `upstream_*` is the git word, `source_*`
   collides with the spec's open `source_repo` (§5), which means "repo this doc lives in".
3. **Canonical repo URL** (publictext spec §13 q2). We need one now, as the key for sources and
   forks. v0 rule in `spec.md`; propose it upstream.
4. **Auth.** Unauthenticated GitHub API allows 60 requests an hour, about 30 sources at two
   calls each. A token is needed for private repos and higher limits; where to keep it safely
   is open.
5. **Local edits to a fork.** Detecting them needs a hash of the body without the `fork_*` keys.
   Deferred until "update my fork" is built.

## Proposed changes to the publictext spec

Not authoritative there yet; raise when this settles.

- Reserve `fork_repo`, `fork_path`, `fork_branch`, `fork_commit`, `fork_blob`, `fork_date`
  (§5), as authored provenance.
- `follows` entries gain `branch` (default: the remote's default branch) and `include` (folder
  prefixes): the first, simplest piece of the open filter grammar (§13 q1).
- A v0 canonical repo URL (§13 q2).
