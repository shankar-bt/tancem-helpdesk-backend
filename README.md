# Backend

Standalone REST API built with **Node.js, TypeScript, Express, PostgreSQL, Drizzle ORM, Zod, JWT and bcrypt**.
It contains no frontend code and talks to clients only over HTTP/JSON.

## Architecture

```
Route → Middleware → Controller → Service → Repository → Drizzle → PostgreSQL
```

Controllers never touch the database; only repositories import Drizzle.

```
src/
├── config/            env (Zod-validated), database (pg pool + Drizzle), auth
├── modules/
│   ├── auth/          controllers, services, repositories, routes, schemas, types
│   └── users/         controllers, services, repositories, routes, schemas, types
├── shared/            db/schema, middleware, router, services, types, utils
├── app.ts             Express app (helmet, cors, json, routes, error handlers)
└── main.ts            server bootstrap + graceful shutdown
```

## Setup

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL and the JWT secrets
npm run db:migrate          # applies the SQL in ./drizzle
npm run dev
```

`DATABASE_URL` is read from `.env`:

```
DATABASE_URL=postgresql://username:password@localhost:5432/my_database
```

Create the database first (`createdb my_database`) if it does not exist.

## Scripts

| Command               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | Start with nodemon + tsx (hot reload)                  |
| `npm run build`       | Type-check and compile to `dist/`                      |
| `npm run start`       | Run the compiled build                                 |
| `npm run db:generate` | Generate a SQL migration from the Drizzle schema       |
| `npm run db:migrate`  | Apply migrations                                       |
| `npm run db:push`     | Push the schema directly (handy in development)        |
| `npm run db:studio`   | Open Drizzle Studio                                    |
| `npm run db:seed`     | Create an admin (`ADMIN_EMAIL`, `ADMIN_PASSWORD` env)  |

## API

Base URL: `http://localhost:5000/api`. Success responses look like
`{ "success": true, "data": ..., "meta"?: ... }`, errors like
`{ "success": false, "message": "...", "errors"?: [...] }`.

| Method | Path                | Auth   | Description                                    |
| ------ | ------------------- | ------ | ---------------------------------------------- |
| GET    | `/health`           | –      | Health check                                   |
| POST   | `/auth/register`    | –      | Create account, returns user + tokens          |
| POST   | `/auth/login`       | –      | Returns user + tokens                          |
| POST   | `/auth/refresh`     | –      | Body `{ refreshToken }`, rotates the token     |
| POST   | `/auth/logout`      | –      | Body `{ refreshToken }`, revokes it            |
| GET    | `/users`            | Bearer | `?page=1&limit=10&search=` paginated list      |
| POST   | `/users`            | Admin  | Create user                                    |
| GET    | `/users/:id`        | Bearer | Get user                                       |
| PUT    | `/users/:id`        | Bearer | Admin: any user. Others: only themselves       |
| DELETE | `/users/:id`        | Admin  | Delete user (not yourself)                     |

Notes:

- The **first registered account becomes `admin`**; everyone after is `user`.
- Access tokens are short-lived JWTs (`Authorization: Bearer <token>`).
- Refresh tokens are stored hashed (SHA-256) in `refresh_tokens`, rotated on every refresh, and
  reuse of a revoked token revokes all of that user's sessions.
- Passwords are hashed with bcrypt and never returned by the API.

## Production

Set `NODE_ENV=production`, strong `JWT_*` secrets and `CORS_ORIGIN` to the frontend origin(s)
(comma separated), then `npm run build && npm run db:migrate && npm run start`.
