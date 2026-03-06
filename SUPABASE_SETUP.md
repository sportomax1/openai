# Supabase CRUD Integration Guide

## Setup

### 1. Get Supabase Credentials

- Go to https://supabase.com → your project
- Settings → API
- Copy **Project URL** and **Anon Public Key**

### 2. Set Vercel Environment Variables

In Vercel Dashboard → your project → Settings → Environment Variables, add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here   # optional but recommended for auto-discovery
SUPABASE_TABLES=table1,table2,table3                    # optional explicit list
```

- **SUPABASE_SERVICE_ROLE_KEY** (recommended): allows the backend (server-only) to auto-discover ALL public tables via `pg_tables` and perform full CRUD. Never expose this key to the frontend.
- **SUPABASE_TABLES** (optional): comma-separated list of your table names. When set, it overrides auto-discovery and is used for the table list in the UI and in the chat system prompt.

Examples:
```
SUPABASE_TABLES=users,products,orders,invoices
```

### 3. Redeploy

Trigger a redeploy in Vercel to load the new environment variables.

## Using the Data Browser

**Click the 📊 Data button** in the top-right of the chat app.

### Features:

1. **List Tables** — See all your existing Supabase tables
2. **Browse Records** — View records in each table
3. **Search** — Find records by searching any field
4. **Delete** — Remove records directly from the UI
5. **Create** — Add new records via API

## API Endpoints

All CRUD operations go through `/api/supabase`:

### List All Tables
```bash
curl -X POST https://your-app.vercel.app/api/supabase \
  -H "Content-Type: application/json" \
  -d '{ "action": "LIST_TABLES" }'
```

**Response:**
```json
{
  "ok": true,
  "tables": ["users", "products", "orders", ...]
}
```

### Read/Search Records
```bash
curl -X POST https://your-app.vercel.app/api/supabase \
  -H "Content-Type: application/json" \
  -d '{
    "action": "READ",
    "table": "users",
    "query": { "email": "john@example.com" },
    "limit": 50,
    "offset": 0
  }'
```

**Response:**
```json
{
  "ok": true,
  "rows": [{"id": 1, "email": "john@example.com", ...}],
  "count": 1
}
```

### Create Record
```bash
curl -X POST https://your-app.vercel.app/api/supabase \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CREATE",
    "table": "users",
    "data": { "name": "John Doe", "email": "john@example.com" }
  }'
```

**Response:**
```json
{
  "ok": true,
  "rows": [{"id": 123, "name": "John Doe", "email": "john@example.com"}]
}
```

### Update Record
```bash
curl -X POST https://your-app.vercel.app/api/supabase \
  -H "Content-Type: application/json" \
  -d '{
    "action": "UPDATE",
    "table": "users",
    "id": 123,
    "data": { "name": "Jane Doe", "status": "active" }
  }'
```

### Delete Record
```bash
curl -X POST https://your-app.vercel.app/api/supabase \
  -H "Content-Type: application/json" \
  -d '{
    "action": "DELETE",
    "table": "users",
    "id": 123
  }'
```

## Example Tables

If you want to create test tables, use SQL in Supabase SQL Editor:

```sql
-- Users table
create table users (
  id bigint primary key generated always as identity,
  name text not null,
  email text not null unique,
  created_at timestamp with time zone default now()
);

-- Products table
create table products (
  id bigint primary key generated always as identity,
  name text not null,
  price numeric not null,
  description text,
  created_at timestamp with time zone default now()
);

-- Orders table
create table orders (
  id bigint primary key generated always as identity,
  user_id bigint not null references users(id),
  product_id bigint not null references products(id),
  quantity int default 1,
  created_at timestamp with time zone default now()
);
```

## Enable RLS (Optional but Recommended)

```sql
alter table users enable row level security;
alter table products enable row level security;
alter table orders enable row level security;

-- Allow anonymous access
create policy "Allow anonymous access" on users for all using (true) with check (true);
create policy "Allow anonymous access" on products for all using (true) with check (true);
create policy "Allow anonymous access" on orders for all using (true) with check (true);
```

## Troubleshooting

### 404 or "table not found"
- Make sure your table name is correct (case-sensitive)
- Check that the table exists in your Supabase project

### 401 Unauthorized
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly in Vercel
- Check that your Supabase API key hasn't been regenerated

### RLS blocks access
- Enable RLS policies as shown above
- Or disable RLS temporarily: `alter table my_table disable row level security;`

Enjoy! 🍕🏀🏎️
