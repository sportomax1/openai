export const config = { runtime: 'edge' };

// ============================================================
//  SUPABASE CRUD API — query any table in your Supabase DB
// ============================================================

const _ts = () => new Date().toISOString();
const log = {
  info:  (...a) => console.log(  `[${_ts()}] ℹ️  INFO `, ...a),
  ok:    (...a) => console.log(  `[${_ts()}] ✅  OK   `, ...a),
  warn:  (...a) => console.warn( `[${_ts()}] ⚠️  WARN `, ...a),
  error: (...a) => console.error(`[${_ts()}] ❌  ERROR`, ...a),
  debug: (...a) => console.log(  `[${_ts()}] 🐛  DEBUG`, ...a),
};

export default async function handler(req) {
  const rid = crypto.randomUUID().slice(0, 8);
  log.info(`[${rid}] ── SUPABASE CRUD REQUEST ──`);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log.error(`[${rid}] Missing Supabase credentials`);
      return new Response(JSON.stringify({
        ok: false,
        error: 'Supabase credentials not configured (SUPABASE_URL, SUPABASE_ANON_KEY)',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action, table, query, data, id, limit = 50, offset = 0 } = body;

    log.debug(`[${rid}] Action: ${action}  Table: ${table}`);

    // ── LIST ALL TABLES ──
    if (action === 'LIST_TABLES') {
      log.info(`[${rid}] Listing tables via information schema`);
      
      // Query Supabase information_schema using the REST API
      const url = `${supabaseUrl}/rest/v1/information_schema.tables?select=table_name&table_schema=eq.public&order=table_name.asc`;
      
      log.debug(`[${rid}] Fetching: ${url}`);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/json',
          'apikey': supabaseKey,  // Some endpoints require apikey header
        },
      });
      
      if (!res.ok) {
        const errText = await res.text();
        log.warn(`[${rid}] information_schema query failed (${res.status}), trying alternate method`);
        
        // Fallback: return empty list with instructions
        return new Response(JSON.stringify({
          ok: true,
          tables: [],
          message: 'To see your tables, use the Data browser manually or configure SUPABASE_TABLES environment variable',
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      try {
        const tables = await res.json();
        const tableNames = Array.isArray(tables) ? tables.map(t => t.table_name).filter(Boolean) : [];
        log.ok(`[${rid}] Found ${tableNames.length} tables`);
        return new Response(JSON.stringify({ ok: true, tables: tableNames }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (parseErr) {
        log.error(`[${rid}] Parse error:`, parseErr.message);
        return new Response(JSON.stringify({ ok: true, tables: [] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // ── SEARCH / READ ──
    if (action === 'READ' || action === 'SEARCH') {
      if (!table) throw new Error('table required');
      
      // Build query string
      let queryStr = `${supabaseUrl}/rest/v1/${table}?select=*`;
      
      // Add WHERE clause if provided
      if (query) {
        Object.keys(query).forEach(key => {
          const val = query[key];
          if (typeof val === 'string') {
            queryStr += `&${key}=ilike.*${val}*`;  // case-insensitive contains
          } else {
            queryStr += `&${key}=eq.${val}`;
          }
        });
      }
      
      // Add limit/offset for pagination
      queryStr += `&limit=${limit}&offset=${offset}`;
      
      log.info(`[${rid}] READ ${table} with query:`, query);
      const res = await fetch(queryStr, {
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Accept': 'application/json' },
      });
      
      if (!res.ok) {
        const err = await res.text();
        log.error(`[${rid}] Query failed:`, err);
        return new Response(JSON.stringify({ ok: false, error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      
      const rows = await res.json();
      log.ok(`[${rid}] Found ${rows.length} rows`);
      return new Response(JSON.stringify({ ok: true, rows, count: rows.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── CREATE ──
    if (action === 'CREATE') {
      if (!table || !data) throw new Error('table and data required');
      
      log.info(`[${rid}] CREATE in ${table}:`, JSON.stringify(data).slice(0, 200));
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const err = await res.text();
        log.error(`[${rid}] Create failed:`, err);
        return new Response(JSON.stringify({ ok: false, error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      
      const created = await res.json();
      log.ok(`[${rid}] Created ${created.length} row(s)`);
      return new Response(JSON.stringify({ ok: true, rows: created }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── UPDATE ──
    if (action === 'UPDATE') {
      if (!table || !id || !data) throw new Error('table, id, and data required');
      
      log.info(`[${rid}] UPDATE ${table} id=${id}:`, JSON.stringify(data).slice(0, 200));
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const err = await res.text();
        log.error(`[${rid}] Update failed:`, err);
        return new Response(JSON.stringify({ ok: false, error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      
      const updated = await res.json();
      log.ok(`[${rid}] Updated ${updated.length} row(s)`);
      return new Response(JSON.stringify({ ok: true, rows: updated }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── DELETE ──
    if (action === 'DELETE') {
      if (!table || !id) throw new Error('table and id required');
      
      log.info(`[${rid}] DELETE from ${table} id=${id}`);
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation',
        },
      });
      
      if (!res.ok) {
        const err = await res.text();
        log.error(`[${rid}] Delete failed:`, err);
        return new Response(JSON.stringify({ ok: false, error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      
      const deleted = await res.json();
      log.ok(`[${rid}] Deleted ${deleted.length} row(s)`);
      return new Response(JSON.stringify({ ok: true, rows: deleted }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    log.error(`[${rid}] Exception:`, err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
