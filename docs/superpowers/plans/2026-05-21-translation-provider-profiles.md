# Translation Provider Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let OpenAI and Claude translation settings store multiple saved profiles and switch the active profile from the settings page.

**Architecture:** Store translation provider profiles in a new normalized table keyed by provider and profile name. Keep a separate active-profile pointer per provider, migrate existing single-profile settings into a default profile, and teach the worker to resolve credentials from the active profile instead of raw `settings` keys.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React, TanStack Query, i18next, SQLite migration helpers.

---

### Task 1: Add translation profile storage and migration

**Files:**
- Modify: `backend/models/setting.py`
- Create: `backend/models/translation_profile.py`
- Modify: `backend/models/__init__.py`
- Modify: `backend/core/schema_migrations.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing test**

Add a backend test that seeds legacy `translate.openai.*` and `translate.claude.*` settings, boots the migration helper, and asserts the new profile table contains one default profile per provider plus an active-profile pointer.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pytest backend/tests/test_translation_profiles.py -v`
Expected: fail because the profile model, migration, and resolver do not exist yet.

- [ ] **Step 3: Implement the storage model and migration**

Create a `translation_profiles` table with fields for provider, profile name, API key, model, base URL, and timestamps. Add active profile keys to the settings table, migrate legacy single-value settings into default profiles, and preserve old settings until the migration path is confirmed safe.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pytest backend/tests/test_translation_profiles.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/models/setting.py backend/models/translation_profile.py backend/models/__init__.py backend/core/schema_migrations.py backend/main.py backend/tests/test_translation_profiles.py
git commit -m "feat: add translation provider profiles"
```

### Task 2: Expose translation profile APIs

**Files:**
- Modify: `backend/api/settings.py`
- Modify: `backend/schemas/setting.py`

- [ ] **Step 1: Write the failing test**

Add API tests for listing provider profiles, creating/updating/deleting a profile, setting the active profile, and returning the active profile with masked secrets.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pytest backend/tests/test_settings_translation_profiles.py -v`
Expected: fail because the endpoints and schema fields do not exist yet.

- [ ] **Step 3: Implement the API**

Add endpoints for profile CRUD and active-profile selection. Keep legacy `/settings/translate` reads working by returning the active profile values in the existing shape so older frontends and worker code do not break during rollout.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pytest backend/tests/test_settings_translation_profiles.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/api/settings.py backend/schemas/setting.py backend/tests/test_settings_translation_profiles.py
git commit -m "feat: expose translation profile settings api"
```

### Task 3: Resolve worker configuration from active profiles

**Files:**
- Modify: `backend/worker/subtitle_task.py`

- [ ] **Step 1: Write the failing test**

Add a worker test that seeds two OpenAI profiles and one Claude profile, sets each provider’s active profile, and asserts the translation engine is built from the selected profile fields.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pytest backend/tests/test_translate_engine_profile_resolution.py -v`
Expected: fail because the worker still reads flat settings keys.

- [ ] **Step 3: Implement active-profile resolution**

Read the active profile for OpenAI and Claude, then pass the resolved API key, model, and base URL into the engine constructors. Keep the fallback behavior for empty profile data so older databases still run.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pytest backend/tests/test_translate_engine_profile_resolution.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/worker/subtitle_task.py backend/tests/test_translate_engine_profile_resolution.py
git commit -m "feat: resolve translation engines from active profiles"
```

### Task 4: Update the settings UI for profile switching

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/api/settings.ts`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Modify: `frontend/src/i18n/locales/en.ts`

- [ ] **Step 1: Write the failing test**

Add or extend frontend tests to verify OpenAI and Claude sections render a profile selector, allow switching active profiles, and preserve the currently edited profile values.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runInBand` or the repo’s existing frontend test command.
Expected: fail because the selector and profile-backed API calls do not exist yet.

- [ ] **Step 3: Implement the UI**

Replace the single OpenAI/Claude input groups with a profile picker plus editable fields for the selected profile. Add create/save/delete actions, keep the save flow local to the active provider, and ensure profile changes sync through TanStack Query.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/api/settings.ts frontend/src/i18n/locales/zh.ts frontend/src/i18n/locales/en.ts frontend/tests/*
git commit -m "feat: switch translation settings by profile"
```

### Task 5: Verify end-to-end behavior and clean up temporary tests

**Files:**
- Remove: any temporary backend or frontend test files created only for implementation verification

- [ ] **Step 1: Run the relevant test suite**

Run the backend settings/worker tests and the frontend build or test command used in this repo.

- [ ] **Step 2: Remove temporary test files**

Delete any ad hoc test files created only for the implementation session.

- [ ] **Step 3: Re-run verification**

Run the same commands again to confirm the cleanup did not change behavior.

- [ ] **Step 4: Commit cleanup if needed**

```bash
git add -A
git commit -m "chore: finalize translation profile rollout"
```
