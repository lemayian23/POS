# Web POS

A production-oriented web-based Point of Sale system built with TypeScript, Fastify, Prisma, and PostgreSQL.

## Technology Stack

- TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- Zod
- JWT authentication
- HttpOnly refresh-token cookies
- bcrypt password hashing
- Vitest

## Project Structure

- `client/` - Frontend application
- `database/` - Database-related project resources
- `prisma/` - Prisma schema and database migrations
- `server/` - Server-related resources
- `src/` - Application source code
- `tests/` - Automated tests

## Requirements

- Node.js
- npm
- PostgreSQL 15 or newer

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Configure the PostgreSQL connection and application secrets in `.env`.
4. Run `npx prisma generate`.
5. Run `npx prisma migrate dev`.

## Development

Run `npm run dev` to start the development server.

## Testing

- `npm test` - Run the test suite
- `npm run typecheck` - Run TypeScript type checking
- `npm run build` - Build the application

## Environment Variables

Environment variables are documented in `.env.example`. Never commit `.env` or real secrets to version control.

## Database Migrations

Prisma migrations are stored in `prisma/migrations/` and are tracked in version control. Generated Prisma client files under `src/generated/prisma/` are excluded from version control.

## Authentication

The application includes password hashing, JWT access tokens, refresh-token rotation, HttpOnly cookies, user activation checks, and rate limiting.

## Project Status

The project is under active development. Features and architecture are being implemented incrementally with automated tests and production-oriented engineering practices.
