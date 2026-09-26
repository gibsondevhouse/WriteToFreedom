# Milestone Plan Workflow Template

This document explains the folder structure under [docs/000-template/](000-template/commit-goal/slug.md) and how to copy it when starting a new milestone plan or adding a stage to an existing one. `docs/000-beta-milestone-plan/` is the reference example — read this alongside it.

---

## 1. Template Structure

```text
docs/000-template/
  commit-goal/
    slug.md
  commit-objectives/
    000-NNN-slug/
      000-NNN-slug.md
      prompts/
        000-NNNa-slug.md
```

Each piece maps to a part of a milestone plan:

| Template path | Copies to | Purpose |
| --- | --- | --- |
| `commit-goal/slug.md` | `{plan-folder}/Commit-goal/{descriptive-slug}.md` | The coding-agent brief: overall product direction and requirements for the whole plan. One per plan. |
| `commit-objectives/000-NNN-slug/000-NNN-slug.md` | `{plan-folder}/commit-objectives/000-NNN-{slug}/000-NNN-{slug}.md` | The spec for one delivery stage: what it covers, its data model, acceptance criteria, and scope boundaries. |
| `commit-objectives/000-NNN-slug/prompts/000-NNNa-slug.md` | `{plan-folder}/commit-objectives/000-NNN-{slug}/prompts/000-NNNa-{slug}.md` | The actual prompt text handed to the coding agent to execute that stage. Left empty until work on the stage begins. |

A plan also has a `000-tracker.md` at its root for logging milestone/objective progress. It is not templated — create it fresh per plan.

---

## 2. Naming Tokens

- **`NNN`** — the zero-padded stage number within the plan (`001`, `002`, `003`, …). Stages are ordered and later stages may declare earlier ones as prerequisites.
- **`slug`** — a short kebab-case name for the stage's feature area (e.g. `collections`, `multi-novel-foundation`). Use the same slug in the folder name, the stage file name, and the prompt file name.
- **`a`** in `000-NNNa-slug.md` — a letter suffix for the prompt revision. Start with `a`; if a stage needs to be re-prompted with materially different instructions, add `b`, `c`, etc. rather than overwriting history.

---

## 3. Copying the Template

### Starting a new stage in an existing plan

1. Duplicate `docs/000-template/commit-objectives/000-NNN-slug/` into `{plan-folder}/commit-objectives/`.
2. Rename the folder, the stage `.md` file, and the prompt `.md` file, replacing `NNN` with the next stage number and `slug` with the stage's feature name.
3. Fill in the stage file following the section pattern below.
4. Leave the `prompts/000-NNNa-slug.md` file empty until the stage is ready to hand to a coding agent, then write the actual prompt there.

### Starting a new plan

1. Create the plan folder (e.g. `docs/000-beta-milestone-plan/`) with an empty `000-tracker.md`.
2. Copy `docs/000-template/commit-goal/slug.md` into `{plan-folder}/Commit-goal/{descriptive-slug}.md` and write the coding-agent brief.
3. Repeat the "starting a new stage" steps above for each stage, starting at `001`.

---

## 4. Stage File Section Pattern

Every stage `.md` file follows this shape (see [000-004-collections.md](000-beta-milestone-plan/commit-objectives/000-004-collections/000-004-collections.md) for a complete example):

```text
# 000-NNN — [Title]

> **Delivery slice [X]** from the coding-agent brief.
> Requires [prior stage numbers] to be complete.

---

## 1. [Section Title]
...

## N. Acceptance Criteria (Stage NNN)
...

## N+1. Scope Boundaries
...
```

- The header block always states the delivery slice letter and which prior stages must already be complete (omit the "Requires" line only for a plan's first stage).
- The body sections between the header and the acceptance criteria are stage-specific — add as many as the feature needs.
- The stage file always ends with **Acceptance Criteria** (numbered, verifiable conditions plus the test commands to run) followed by **Scope Boundaries** (a bulleted list of what is explicitly deferred, pointing to the stage that will cover it).
