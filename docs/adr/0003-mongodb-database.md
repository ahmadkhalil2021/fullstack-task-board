# ADR-0003: MongoDB for Database

**Status**: Accepted

**Date**: 2026-08-04

## Context
We need a database to persist boards and tasks. Options considered: MongoDB with Mongoose and PostgreSQL with Prisma.

## Decision
**MongoDB + Mongoose**

## Rationale
- **Schema flexibility**: Tasks can have varying fields without migrations. Adding an `icon` field doesn't require an `ALTER TABLE`.
- **Document model matches UI**: A Board document with an embedded array of Task IDs maps naturally to the frontend state shape. No joins needed.
- **Mongoose convenience**: Validation, middleware (cascade delete), and query building out of the box. No raw query strings.
- **MongoDB Atlas free tier**: 512MB storage, shared cluster — sufficient for a demo project. No credit card required.
- **JSON-native**: Both the database and the API speak JSON. No ORM mapping layers between document ↔ row formats.

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| PostgreSQL + Prisma | Relational integrity is overkill here. Requires schema migrations on every change. Prisma adds a binary dependency and code generation step. Better suited for apps with complex relations (users, permissions, orders). |

## Consequences
- **Easier**: Rapid schema evolution, no migrations, JSON-round-trip to client
- **Harder**: No referential integrity at DB level (mitigated by Mongoose middleware + cascade deletes in API logic). No transactions needed for this simple app.
