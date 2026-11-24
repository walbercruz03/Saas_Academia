const { Pool } = require("pg");
const path = require("path");

const isExplicitSqlite = process.env.DB_CLIENT === "sqlite" || process.env.USE_SQLITE === "true";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

let useSqlite = isExplicitSqlite || !hasDatabaseUrl;
let sqliteDb = null;

function getSqliteDb() {
  if (!sqliteDb) {
    const sqlite3 = require("sqlite3").verbose();
    const dbPath = path.resolve(__dirname, "..", "database.sqlite");
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error("Erro ao conectar ao SQLite:", err.message);
      else console.log("Conectado ao banco de dados SQLite.");
    });
  }
  return sqliteDb;
}

let pool = null;
if (!useSqlite) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  pool.query("SELECT 1")
    .then(() => {
      console.log("Conectado ao banco de dados PostgreSQL.");
    })
    .catch((err) => {
      console.warn("PostgreSQL indisponível (" + err.message + "). Ativando fallback para SQLite local.");
      useSqlite = true;
      getSqliteDb();
    });
} else {
  getSqliteDb();
}

function traduzirSql(sql) {
  let s = String(sql)
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, "SERIAL PRIMARY KEY")
    .replace(/\bDATETIME\b/gi, "TIMESTAMP")
    .replace(/\bBLOB\b/gi, "BYTEA")
    .replace(/datetime\(\s*'now'\s*(?:,\s*[^')]+'[^')]*')*\s*\)/gi, "CURRENT_TIMESTAMP")
    .replace(/date\(\s*'now'\s*(?:,\s*[^')]+'[^')]*')*\s*\)/gi, "CURRENT_DATE")
    .replace(/datetime\(\s*([^(),]+?)\s*\)/gi, "($1)::timestamp")
    .replace(/date\(\s*([^(),]+?)\s*\)/gi, "($1)::date");

  // Compatibilidade básica com consultas a sqlite_master
  if (/sqlite_master/i.test(s)) {
    s = s
      .replace(/\bsqlite_master\b/gi, "information_schema.tables")
      .replace(/\bname\b/gi, "table_name")
      .replace(/type\s*=\s*'table'\s+AND\s+/gi, "table_schema = 'public' AND table_type = 'BASE TABLE' AND ")
      .replace(/WHERE\s+type\s*=\s*'table'/gi, "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  }

  let idx = 0, sq = false, dq = false, out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !dq) { sq = !sq; out += c; }
    else if (c === "\"" && !sq) { dq = !dq; out += c; }
    else if (c === "?" && !sq && !dq) { out += "$" + (++idx); }
    else { out += c; }
  }
  return out.trim();
}

function args(params, cb) {
  if (typeof params === "function") return { v: [], cb: params };
  return { v: Array.isArray(params) ? params : params !== undefined ? [params] : [], cb: typeof cb === "function" ? cb : null };
}

let fila = Promise.resolve();
const runQueue = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p; };

const db = {
  pool,
  get isSqlite() { return useSqlite; },
  serialize(fn) {
    if (useSqlite) {
      getSqliteDb().serialize(fn);
    } else {
      if (typeof fn === "function") fn();
    }
  },
  run(sql, params, callback) {
    const { v, cb } = args(params, callback);
    if (useSqlite) {
      getSqliteDb().run(sql, v, function (err) {
        if (cb) cb.call(this, err);
      });
      return this;
    }

    let q = traduzirSql(sql);
    const isIns = /^\s*INSERT\s+INTO\b/i.test(q);
    const hasRet = /\bRETURNING\b/i.test(q);
    if (isIns && !hasRet) q = q.replace(/;?\s*$/, " RETURNING id");
    runQueue(async () => {
      try {
        const r = await pool.query(q, v);
        const ctx = { lastID: r.rows?.[0]?.id ?? null, changes: r.rowCount ?? 0 };
        if (cb) cb.call(ctx, null);
      } catch (err) {
        if (isIns && !hasRet && /column "id" does not exist/i.test(err.message)) {
          try {
            const r2 = await pool.query(traduzirSql(sql), v);
            const ctx2 = { lastID: null, changes: r2.rowCount ?? 0 };
            if (cb) cb.call(ctx2, null);
            return;
          } catch (e2) {
            if (cb) cb.call({ lastID: null, changes: 0 }, e2);
            else console.error("Erro SQL (run):", e2.message);
            return;
          }
        }
        if (cb) cb.call({ lastID: null, changes: 0 }, err);
        else console.error("Erro SQL (run):", err.message);
      }
    });
    return this;
  },
  get(sql, params, callback) {
    const { v, cb } = args(params, callback);
    if (useSqlite) {
      getSqliteDb().get(sql, v, cb);
      return this;
    }
    runQueue(async () => {
      try { const r = await pool.query(traduzirSql(sql), v); if (cb) cb(null, r.rows[0]); }
      catch (err) { if (cb) cb(err, undefined); else console.error("Erro SQL (get):", err.message); }
    });
    return this;
  },
  all(sql, params, callback) {
    const { v, cb } = args(params, callback);
    if (useSqlite) {
      getSqliteDb().all(sql, v, cb);
      return this;
    }
    runQueue(async () => {
      try { const r = await pool.query(traduzirSql(sql), v); if (cb) cb(null, r.rows || []); }
      catch (err) { if (cb) cb(err, []); else console.error("Erro SQL (all):", err.message); }
    });
    return this;
  },
};

module.exports = db;
