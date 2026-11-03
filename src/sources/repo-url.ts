// Canonical repo URL, v0 (docs/spec.md → Canonical repo URL). Pure.

const SCP = /^git@([^:/\s]+):([^\s]+)$/;
const SEGMENT = /^[A-Za-z0-9._-]+$/;

/** `https://<host>/<owner>/<repo>`, or `null` if `input` isn't a repo URL. */
export function canonicalRepoUrl(input: string): string | null {
	let s = input.trim();
	const scp = SCP.exec(s);
	if (scp) s = `https://${scp[1] ?? ''}/${scp[2] ?? ''}`;

	let url: URL;
	try {
		url = new URL(s);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (url.username || url.password) return null;

	const parts = url.pathname.split('/').filter(Boolean);
	if (parts.length !== 2) return null;
	const owner = parts[0] ?? '';
	const repo = (parts[1] ?? '').replace(/\.git$/i, '');
	if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) return null;

	return `https://${url.host.toLowerCase()}/${owner}/${repo}`;
}
