---
description: Autosave NURA progress — analyse diff, write a conventional commit, tag it, push to origin.
allowed-tools: Bash
---

# NURA Autosave

You are running an autosave step for the NURA Cosmetics project. **Do not chat. Do not explain.** Run the commands and produce a one-line summary at the end.

The project lives at:
```
/Users/samalex/Desktop/BINTII ZAINUB/COSMETICSSS/nura-cosmetics
```

All `git` commands MUST use `git -C "/Users/samalex/Desktop/BINTII ZAINUB/COSMETICSSS/nura-cosmetics"` — do **not** rely on shell cwd.

## Procedure

1. **Detect changes.** Run:
   ```
   git -C "/Users/samalex/Desktop/BINTII ZAINUB/COSMETICSSS/nura-cosmetics" status --porcelain
   ```
   If the output is empty, print exactly `nura-autosave: no changes` and STOP. Do nothing else.

2. **Inspect the diff** (one Bash call, batched):
   ```
   git -C "<repo>" diff --stat HEAD && echo "---" && git -C "<repo>" diff --cached --stat && echo "---NEW---" && git -C "<repo>" ls-files --others --exclude-standard
   ```
   Then do ONE more call to read the actual diff (truncated):
   ```
   git -C "<repo>" diff HEAD | head -300
   ```

3. **Choose a conventional commit type** by looking at what changed:
   - new feature files / new routes / new components → `feat`
   - bug fix / failing flow restored → `fix`
   - rewriting logic without changing behaviour → `refactor`
   - styles/layout only → `style`
   - documentation / privacy notice / comments → `docs`
   - config / build / tooling / .env / scripts → `chore`
   - performance work → `perf`
   - tests → `test`

   If the diff spans multiple types, pick the dominant one. Add a scope when obvious (e.g. `feat(try-on):`).

4. **Write the commit message.** Format:
   - Subject line ≤ 72 chars, no period at end. Conventional commit style.
   - Blank line.
   - Body: 1–4 bullet points describing what actually changed (paths, behaviours). Plain English, no fluff.
   - Trailer: `Autosave: yes` so these are easy to filter later.

5. **Stage and commit** (single Bash call, HEREDOC for the message):
   ```
   git -C "<repo>" add -A && git -C "<repo>" commit -m "$(cat <<'EOF'
   <subject>

   <body>

   Autosave: yes
   EOF
   )"
   ```
   - DO NOT add a Co-Authored-By trailer for autosave commits.
   - DO NOT pass --no-verify.

6. **Tag** the new commit with a sortable timestamp:
   ```
   git -C "<repo>" tag "autosave/$(date +%Y-%m-%d-%H%M%S)"
   ```

7. **Push** branch and tag in one go:
   ```
   git -C "<repo>" push origin HEAD --follow-tags
   ```
   If push fails, print `nura-autosave: push failed — <reason>` and STOP. The commit is still saved locally; do not retry destructively.

8. **Summary.** Print exactly one line in this format and nothing else:
   ```
   nura-autosave: <short-subject> · tag=autosave/<timestamp> · pushed
   ```

## Hard rules

- Never run `git push --force` or `git reset --hard` here.
- Never skip hooks.
- Never amend or rebase. Always a new commit.
- Never commit `.env*`, `.nura-data/`, or anything inside `node_modules/`. `.gitignore` already handles this — do not override it.
- If `git status` shows files that look like secrets (`*.pem`, `.env`, `id_rsa`, `credentials.json`), STOP with `nura-autosave: refused — possible secret in tree: <file>` and do not stage.
