const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const env = require('../config/env');

let dbInstance = null;
let SQL = null;
let inTransaction = false;

async function getDB() {
  if (dbInstance) return dbInstance;

  SQL = await initSqlJs();
  const dbDir = path.dirname(env.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(env.DB_PATH)) {
    const fileBuffer = fs.readFileSync(env.DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run("PRAGMA foreign_keys = ON;");

  return dbInstance;
}

function saveDB() {
  if (!dbInstance || inTransaction) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  const dbDir = path.dirname(env.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  fs.writeFileSync(env.DB_PATH, buffer);
}

const db = {
  async init() {
    return await getDB();
  },

  async all(sql, params = []) {
    const database = await getDB();
    const stmt = database.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  async get(sql, params = []) {
    const database = await getDB();
    const stmt = database.prepare(sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  },

  async run(sql, params = []) {
    const database = await getDB();
    const stmt = database.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();

    const rowIdRes = database.exec("SELECT last_insert_rowid() AS id;");
    const lastID = (rowIdRes.length && rowIdRes[0].values.length) ? rowIdRes[0].values[0][0] : null;

    const changesRes = database.exec("SELECT changes() AS changes;");
    const changes = (changesRes.length && changesRes[0].values.length) ? changesRes[0].values[0][0] : 0;

    saveDB();
    return { lastID, changes };
  },

  async exec(sql) {
    const database = await getDB();
    database.run(sql);
    saveDB();
  },

  async transaction(callback) {
    const database = await getDB();
    inTransaction = true;
    database.run("BEGIN TRANSACTION;");
    try {
      const result = await callback();
      database.run("COMMIT;");
      inTransaction = false;
      saveDB();
      return result;
    } catch (err) {
      console.error("Transaction failed with inner error:", err);
      try {
        database.run("ROLLBACK;");
      } catch (rbErr) {}
      inTransaction = false;
      throw err;
    }
  },

  save() {
    saveDB();
  }
};

module.exports = db;
