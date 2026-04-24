const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const usePostgres = Boolean(process.env.DATABASE_URL);

let db = null;
let pool = null;

if (usePostgres) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  const dbPath = path.join(__dirname, 'diet_tracker.db');
  db = new sqlite3.Database(dbPath);
}

const tableDefinitions = {
  users: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        age INTEGER,
        gender TEXT,
        height REAL,
        weight REAL,
        goal TEXT,
        daily_calorie_goal INTEGER DEFAULT 2000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        age INTEGER,
        gender TEXT,
        height REAL,
        weight REAL,
        goal TEXT,
        daily_calorie_goal INTEGER DEFAULT 2000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  meals: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        meal_type TEXT,
        date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        meal_type TEXT,
        date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  meal_items: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS meal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER,
        food_name TEXT,
        calories INTEGER,
        protein REAL,
        carbs REAL,
        fat REAL,
        portion_size TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(meal_id) REFERENCES meals(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS meal_items (
        id SERIAL PRIMARY KEY,
        meal_id INTEGER REFERENCES meals(id),
        food_name TEXT,
        calories INTEGER,
        protein REAL,
        carbs REAL,
        fat REAL,
        portion_size TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  food_database: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS food_database (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        calories_per_100g INTEGER,
        protein_per_100g REAL,
        carbs_per_100g REAL,
        fat_per_100g REAL,
        category TEXT,
        description TEXT
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS food_database (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        calories_per_100g INTEGER,
        protein_per_100g REAL,
        carbs_per_100g REAL,
        fat_per_100g REAL,
        category TEXT,
        description TEXT
      )
    `
  },
  diet_preferences: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS diet_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        favorite_foods TEXT DEFAULT '[]',
        banned_foods TEXT DEFAULT '[]',
        diet_style TEXT DEFAULT 'balanced',
        notes TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS diet_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        favorite_foods TEXT DEFAULT '[]',
        banned_foods TEXT DEFAULT '[]',
        diet_style TEXT DEFAULT 'balanced',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  daily_summary: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS daily_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date DATE,
        total_calories INTEGER DEFAULT 0,
        total_protein REAL DEFAULT 0,
        total_carbs REAL DEFAULT 0,
        total_fat REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, date)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS daily_summary (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE,
        total_calories INTEGER DEFAULT 0,
        total_protein REAL DEFAULT 0,
        total_carbs REAL DEFAULT 0,
        total_fat REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `
  },
  health_metrics: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS health_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date DATE,
        weight REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS health_metrics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE,
        weight REAL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  ai_usage: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS ai_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        usage_date DATE NOT NULL,
        request_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, usage_date)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS ai_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        usage_date DATE NOT NULL,
        request_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, usage_date)
      )
    `
  }
};

const convertSql = (sql, params = []) => {
  if (!usePostgres) {
    return { text: sql, values: params };
  }

  let index = 0;
  const text = sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });

  return { text, values: params };
};

const run = async (sql, params = []) => {
  if (usePostgres) {
    const isInsert = /^\s*insert/i.test(sql);
    const finalSql = isInsert && !/returning\s+/i.test(sql) ? `${sql} RETURNING id` : sql;
    const { text, values } = convertSql(finalSql, params);
    const result = await pool.query(text, values);
    return { id: result.rows?.[0]?.id || null, changes: result.rowCount || 0 };
  }

  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = async (sql, params = []) => {
  if (usePostgres) {
    const { text, values } = convertSql(sql, params);
    const result = await pool.query(text, values);
    return result.rows[0];
  }

  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = async (sql, params = []) => {
  if (usePostgres) {
    const { text, values } = convertSql(sql, params);
    const result = await pool.query(text, values);
    return result.rows;
  }

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const ensureColumn = async (table, column, definition) => {
  if (usePostgres) {
    const exists = await get(
      'SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ?',
      [table, column]
    );

    if (!exists) {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
    return;
  }

  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const initializeDatabase = async () => {
  const tableOrder = ['users', 'meals', 'meal_items', 'food_database', 'diet_preferences', 'daily_summary', 'health_metrics', 'ai_usage'];

  for (const tableName of tableOrder) {
    await run(tableDefinitions[tableName][usePostgres ? 'postgres' : 'sqlite']);
  }

  await ensureColumn('users', 'email', 'TEXT');
  await ensureColumn('users', 'password_hash', 'TEXT');
};

module.exports = {
  db,
  pool,
  usePostgres,
  initializeDatabase,
  run,
  get,
  all
};
