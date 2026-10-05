# Starter updates

How a fix made in the starter reaches the products already cloned from it, and how the
starter records its releases so that is possible.

Code: `CHANGELOG.md`, `.starter.json` (written by `pnpm init-project`, see
[new-project.md](new-project.md)).

## In the starter: every product-facing change gets a changelog entry

Add the entry in the same change, under `## [Unreleased]` at the top of `CHANGELOG.md`
(create the heading if it is not there). Put anything a running product should take
even if it skips the rest (security, billing, data loss) under **Apply to existing
products**, with what an installation must do before deploying it.

To release, rename `[Unreleased]` to the next version and date: a breaking change bumps
the major, a feature the minor, a fix the patch. `init-project` reads the first versioned
heading, so a clone records the latest release, never unreleased work. Tag the release
commit `v<version>` so products can diff against it.

## In a product: `.starter.json` says where it started

```json
{
  "repository": "https://github.com/arnauddsj/quickstart-saas.git",
  "version": "2.3.0",
  "commit": "0f75cbc…"
}
```

To see what the starter changed since:

```bash
git remote add starter "$(node -p 'require("./.starter.json").repository')"   # once
git fetch starter
FROM=$(node -p 'require("./.starter.json").commit')
git log --oneline "$FROM"..starter/master                 # commits since the clone
git diff "$FROM" starter/master -- CHANGELOG.md            # what they mean
```

Read the changelog entries first, then take what applies:

- **Pick commits, not the branch.** `git cherry-pick <sha>` for each commit the entry
  names. A product has renamed the reference feature, edited `brand.ts` and rewritten
  its docs, so merging `starter/master` whole conflicts everywhere. Merge only while the
  product has barely diverged from the starter.
- **Expect conflicts in the files the product owns.** Resolve them toward the product
  (brand, plans, renamed entities) and toward the starter for everything else.
- **Follow the entry's deployment note** before deploying, such as setting a new
  required variable.
- **Run every gate** before deploying: typecheck, lint, unit, integration and E2E. A
  starter commit was only proved against the starter.

Then set `version` and `commit` in `.starter.json` to the release you caught up to, in the
same commit as the last pick, so the next update starts from there. Skipped entries stay
visible in the next `git log`; note in the commit body which ones were skipped on
purpose.
