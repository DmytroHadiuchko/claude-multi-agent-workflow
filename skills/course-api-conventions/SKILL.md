---
name: course-api-conventions
description: Conventions of the course Express API (routes, validation, error shape, data access, tests). Use when reviewing, writing or testing code in course-api/, or when asked whether a route or test follows the project's rules.
---

# Course API conventions

The source of truth is `course-api/CLAUDE.md`; this skill restates it as a checklist
you can apply line by line. If the two ever disagree, `CLAUDE.md` wins.

## Layout

- `server.js` creates the app, mounts routers, and only calls `listen` when run directly,
  so tests import the app without opening a port.
- `routes/<resource>.js` — one Express router per resource, mounted in `server.js`
  under its base path (`/users`, `/health`).
- `db/store.js` — the only place that holds state. Routes call its helpers
  (`listUsers`, `getUser`, `createUser`, `updateUser`, `reset`) and never keep data themselves.

## Route rules

1. Validate input in the route, before touching the store.
2. Bad input → `400`; record not found → `404`; created → `201`.
3. Every error body is JSON `{ "error": "message" }` — no plain text, no other keys.
4. Path ids arrive as strings; convert with `Number(req.params.id)` before calling the store.
5. Return early on errors (`return res.status(...).json(...)`) so a handler never sends twice.

Things worth flagging in review:

- a status code that contradicts rule 2 (e.g. `200` on create, `500` for bad input);
- a non-numeric id (`/users/abc`) silently turning into `NaN` and producing `404`
  instead of `400` — say which one the route does, and whether that is intended;
- validation that checks presence but not type (`name: 123`, `email: ""`, `name: "   "`);
- a route mutating an object returned by the store outside a store helper.

## Test rules

Tests live in `course-api/tests/*.test.js` and use Node's built-in runner plus supertest:

```js
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');
const store = require('../db/store');

test.beforeEach(() => store.reset());

test('POST /users returns 400 when email is missing', async () => {
  const res = await request(app).post('/users').send({ name: 'Grace Hopper' });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'name and email are required' });
});
```

- One behaviour per test; the title says method, path, input and expected status.
- Always `store.reset()` in `beforeEach` — the store is shared module state.
- Assert the status **and** the body shape; for errors assert `{ error }`.
- Cover the negative paths (400, 404) and boundaries (empty string, missing field,
  non-numeric id), not only the happy path.

## Commands

Run from `course-api/`: `npm test`, `npm run lint`.
