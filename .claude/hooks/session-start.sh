#!/bin/bash
# SessionStart hook: readies a Claude Code cloud session to build, test and lint.
# Local sessions skip it.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"

# CI runs Node 24. The cloud image defaults to 22 but ships 24 in /opt/node24.
if [ -x /opt/node24/bin/node ]; then
	export PATH="/opt/node24/bin:$PATH"
	if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
		echo 'export PATH="/opt/node24/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
	fi
fi

# Install only when the lockfile (or this script) changed since the last install.
# npm ci, not npm install: it never rewrites package-lock.json.
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
	rm -f "$hashes"
	npm ci --no-audit --no-fund
	sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes"
fi
