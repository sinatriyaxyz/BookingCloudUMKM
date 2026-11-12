#!/usr/bin/env node
/**
 * migrate.js — Jalankan semua .sql di db/migrations/ berurutan.
 * Catat yang sudah dijalankan di tabel `schema_migrations`.
 * Aman dijalankan lebih dari sekali (idempoten).
 */
import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../..', 'db', 'migrations');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    // Buat tabel pelacak jika belum ada
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Ambil daftar migrasi yang sudah dijalankan
    const [rows] = await conn.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    // Baca semua file .sql, urutkan secara alfabet
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[skip] ${file}`);
        continue;
      }

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');

      // Jalankan setiap statement secara terpisah
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);

      await conn.beginTransaction();
      try {
        for (const stmt of statements) {
          await conn.query(stmt);
        }
        await conn.query(
          'INSERT INTO schema_migrations (filename) VALUES (?)',
          [file]
        );
        await conn.commit();
        console.log(`[ok]   ${file}`);
      } catch (err) {
        await conn.rollback();
        throw err;
      }
    }

    console.log('Migrasi selesai.');
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});
