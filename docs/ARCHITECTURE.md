# Architecture

React + TypeScript + Vite, installable PWA (vite-plugin-pwa, offline precache). Data lives in IndexedDB via Dexie.

```
src/
  data/
    types.ts      data model (all records carry sync fields)
    db.ts         Dexie schema
    repo.ts       Repository: the only code that reads/writes storage
    hooks.ts      live React hooks over the repository
    defaults.ts   default categories (stable ids)
  domain/
    budget.ts     pure budget math (month summary, goal progress) + tests
  screens/        Home, Transactions, Savings, More (recurring, summary, budgets, backup), editors
  components/     Icon set, sheets/dialogs, charts
  lib/            formatting (₪, Hebrew months), CSV export / file sharing
```

## Budget rules

- Amounts are integer agorot.
- Free budget for variable spending = income − fixed expenses − reserved savings.
- Reserved savings (current/future month) = for each goal, the larger of its monthly plan and what was actually deposited this month. Past months use actual deposits only.
- Left = free budget − variable spending.

## Recurring items

`Recurring` templates are copied into a month as ordinary transactions (with `recurringId`) the first time that month is reached (`ensureMonth`, only up to the current month). `MonthMeta.appliedRecurring` records what was added, so a deleted instance is never re-added and editing one month never touches the template. Future months show a computed forecast instead, so template edits still apply to them.

## Ready for accounts, cloud backup, sync and a shared budget

- Every record has a UUID `id`, `householdId`, `createdAt`, `updatedAt` and soft-delete `deletedAt`.
- A shared budget with a partner = one household with several members. `Repository` is constructed with a `householdId`.
- A sync service can push records whose `updatedAt` is newer than the last sync and pull remote changes (last-write-wins per record). Soft deletes propagate deletions.
- Screens only use `Repository` / hooks, so adding a remote backend (e.g. Supabase, Firebase) does not change the UI.
