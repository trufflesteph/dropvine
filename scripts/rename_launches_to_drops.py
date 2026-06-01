#!/usr/bin/env python3
"""
Rename `launches` → `drops` across the codebase.

Two tiers of patterns:

  TIER 1 — always safe (run on every file):
    • Supabase query builder       from('launches')           → from('drops')
                                   from('launch_products')    → from('drop_products')
                                   from('launch_subscribers') → from('drop_subscribers')
                                   from('launch_photos')      → from('drop_photos')
    • SQL/table-name identifiers   launch_products / launch_subscribers /
                                   launch_photos → drop_*
    • FK column literal            launch_id → drop_id
                                   (launch_at is preserved by construction —
                                   `_id` ≠ `_at`)

  TIER 2 — JS identifier rename, ONLY in files that don't contain UI/email
  copy (i.e. backend route handlers + library files). This protects:
    • marketing strings  ("Small-batch product launches", "The launch is the
      work", "joined a launch on Dropvine") which the user explicitly told
      us not to change
    • email template body text rendered with React Email

  Tier-2 patterns:
    • `setLaunch` / `Launch` PascalCase / camelCase identifier → set*Drop*
    • bare `launch` identifier  (not followed by _at or At) → drop
    • bare `launches` identifier (not inside an /api/launches URL) → drops

Preserves throughout:
  • launch_at  (timestamp column — different suffix from launch_id)
  • launchAt   (camelCase variable)
  • API URL path `/api/launches/publish/[token]`  (vendor email links)
  • All file names

Usage:  python3 scripts/rename_launches_to_drops.py [--dry-run]
"""

import os, re, sys, argparse

REPO = '/app'
SCAN_DIRS = ['app', 'lib', 'components']
EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.sql'}

# Never touch these — URL routing breaks if their path segments change.
BLOCKLIST_PATHS = {
    'app/api/launches/publish/[token]/route.js',
}

# Files where UI copy / email body copy lives. These get TIER 1 only.
TIER1_ONLY_PATHS = {
    # Public landing + marketing copy
    'app/page.js',
    # Auth flow with brand quotes
    'app/signup/page.js',
    'app/login/page.js',
    # Email templates — body text is rendered into the customer's inbox.
    # The container _shared.jsx has the footer ("a quieter way to launch.").
    # We keep every email template's prose untouched.
}

def is_tier1_only(rel_path: str) -> bool:
    if rel_path in TIER1_ONLY_PATHS: return True
    # Every email template renders user-facing copy.
    if rel_path.startswith('lib/email/templates/'): return True
    return False


# ---------------------------------------------------------------------------
# TIER 1 — table names + FK column. Always safe.
# ---------------------------------------------------------------------------
TIER1_PASSES = [
    # Supabase query-builder forms
    (re.compile(r"from\('launches'\)"),           "from('drops')"),
    (re.compile(r"from\('launch_products'\)"),    "from('drop_products')"),
    (re.compile(r"from\('launch_subscribers'\)"), "from('drop_subscribers')"),
    (re.compile(r"from\('launch_photos'\)"),      "from('drop_photos')"),

    # Double-quoted variants
    (re.compile(r'"launch_products"'),    '"drop_products"'),
    (re.compile(r'"launch_subscribers"'), '"drop_subscribers"'),
    (re.compile(r'"launch_photos"'),      '"drop_photos"'),

    # Bare-word forms (SQL column lists, select strings, joins, comments).
    # Bias multi-word names BEFORE the singular so they're not partially renamed.
    (re.compile(r'\blaunch_products\b'),    'drop_products'),
    (re.compile(r'\blaunch_subscribers\b'), 'drop_subscribers'),
    (re.compile(r'\blaunch_photos\b'),      'drop_photos'),

    # FK column literal.
    (re.compile(r'\blaunch_id\b'), 'drop_id'),
]


# ---------------------------------------------------------------------------
# TIER 2 — JS identifier renames.
# ---------------------------------------------------------------------------
# Order matters: do camelCase forms before the bare singular so we don't
# rename `Launch` to `Drrop` etc.
TIER2_PASSES = [
    # camelCase / PascalCase identifiers carrying the table name.
    (re.compile(r'\bsetLaunches\b'),     'setDrops'),
    (re.compile(r'\bsetLaunch\b'),       'setDrop'),
    (re.compile(r'\buseLaunches\b'),     'useDrops'),
    (re.compile(r'\buseLaunch\b'),       'useDrop'),
    (re.compile(r'\bloadLaunches\b'),    'loadDrops'),
    (re.compile(r'\bloadLaunch\b'),      'loadDrop'),
    (re.compile(r'\bfetchLaunches\b'),   'fetchDrops'),
    (re.compile(r'\bfetchLaunch\b'),     'fetchDrop'),

    # Bare `launch` / `launches` identifier (not column suffix).
    # `(?!_at)` protects `launch_at`. `(?!At)` protects `launchAt`.
    (re.compile(r'\blaunch\b(?!_at)(?!At)'), 'drop'),
]


# ---------------------------------------------------------------------------
# `launches` (plural) — replace except when inside an /api/launches/ URL.
# ---------------------------------------------------------------------------
URL_GUARD_RE = re.compile(r'(/api/launches[/\)\'\"])')
PLURAL_RE    = re.compile(r'\blaunches\b')


def apply_plural_pass(text: str) -> str:
    """Replace bare `launches` with `drops`, except inside /api/launches/ URLs."""
    out, i = [], 0
    for m in URL_GUARD_RE.finditer(text):
        out.append(PLURAL_RE.sub('drops', text[i:m.start()]))
        out.append(m.group(0))  # keep the URL chunk verbatim
        i = m.end()
    out.append(PLURAL_RE.sub('drops', text[i:]))
    return ''.join(out)


def transform(rel_path: str, text: str) -> str:
    out = text
    for pat, rep in TIER1_PASSES:
        out = pat.sub(rep, out)
    if not is_tier1_only(rel_path):
        for pat, rep in TIER2_PASSES:
            out = pat.sub(rep, out)
        out = apply_plural_pass(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    touched, tier1_only = [], []
    for sub in SCAN_DIRS:
        root = os.path.join(REPO, sub)
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.next', '.git')]
            for fn in filenames:
                if os.path.splitext(fn)[1] not in EXTENSIONS:
                    continue
                full = os.path.join(dirpath, fn)
                rel  = os.path.relpath(full, REPO)
                if rel in BLOCKLIST_PATHS:
                    continue
                with open(full, 'r', encoding='utf-8') as f:
                    original = f.read()
                renamed = transform(rel, original)
                if renamed != original:
                    touched.append(rel)
                    if is_tier1_only(rel):
                        tier1_only.append(rel)
                    if not args.dry_run:
                        with open(full, 'w', encoding='utf-8') as f:
                            f.write(renamed)

    print(f"{'Would update' if args.dry_run else 'Updated'} {len(touched)} file(s) "
          f"({len(tier1_only)} table-name-only, {len(touched) - len(tier1_only)} full):")
    for p in touched:
        tag = '  [tier-1 only]' if p in tier1_only else ''
        print(f"  {p}{tag}")


if __name__ == '__main__':
    main()
