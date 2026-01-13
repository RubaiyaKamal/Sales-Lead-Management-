/**
 * Database Migration Framework
 *
 * Simple migration runner that executes SQL migration files in order.
 * Tracks applied migrations in a migrations table.
 */

import fs from 'fs/promises';
import path from 'path';
import { executeQuery, executeTransaction } from './database';
import { logger } from './logger';

/**
 * Migration record
 */
interface Migration {
  id: number;
  name: string;
  applied_at: Date;
}

/**
 * Migration file
 */
interface MigrationFile {
  id: number;
  filename: string;
  filepath: string;
  sql: string;
}

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await executeQuery(query);
    logger.info('Migrations tracking table created or already exists');
  } catch (error) {
    logger.error({ error }, 'Failed to create migrations tracking table');
    throw error;
  }
}

/**
 * Get list of applied migrations from database
 */
async function getAppliedMigrations(): Promise<Migration[]> {
  const query = 'SELECT id, name, applied_at FROM schema_migrations ORDER BY id';

  try {
    const result = await executeQuery<Migration>(query);
    return result.rows;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch applied migrations');
    throw error;
  }
}


/**
 * Get all migration files from migrations directory
 */
async function getMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = path.join(__dirname, '../../migrations');

  try {
    const files = await fs.readdir(migrationsDir);

    // Filter SQL files and extract migration number
    const migrationFiles = await Promise.all(
      files
        .filter((file) => file.endsWith('.sql'))
        .map(async (filename) => {
          // Extract migration ID from filename (e.g., 001_initial_schema.sql -> 1)
          const match = filename.match(/^(\d+)_/);
          if (!match) {
            throw new Error(
              `Invalid migration filename format: ${filename} (expected NNN_description.sql)`
            );
          }

          const id = parseInt(match[1]!, 10);
          const filepath = path.join(migrationsDir, filename);
          const sql = await fs.readFile(filepath, 'utf-8');

          return {
            id,
            filename,
            filepath,
            sql,
          };
        })
    );

    // Sort by migration ID
    migrationFiles.sort((a, b) => a.id - b.id);

    return migrationFiles;
  } catch (error) {
    logger.error({ error, migrationsDir }, 'Failed to read migration files');
    throw error;
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: MigrationFile): Promise<void> {
  const startTime = Date.now();

  try {
    // Execute migration SQL in a transaction
    await executeTransaction(async (client) => {
      // Execute the migration SQL
      await client.query(migration.sql);

      // Record the migration as applied
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [migration.filename]
      );
    });

    const duration = Date.now() - startTime;

    logger.info(
      {
        migration: migration.filename,
        duration,
      },
      'Migration applied successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        migration: migration.filename,
      },
      'Migration failed'
    );
    throw error;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');

    // Ensure migrations tracking table exists
    await createMigrationsTable();

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    const appliedNames = new Set(
      appliedMigrations.map((m) => m.name)
    );

    logger.info(
      { count: appliedMigrations.length },
      'Applied migrations loaded'
    );

    // Get all migration files
    const migrationFiles = await getMigrationFiles();

    logger.info(
      { count: migrationFiles.length },
      'Migration files discovered'
    );

    // Filter pending migrations
    const pendingMigrations = migrationFiles.filter(
      (m) => !appliedNames.has(m.filename)
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to apply');
      return;
    }

    logger.info(
      { count: pendingMigrations.length },
      'Pending migrations found'
    );

    // Apply each pending migration
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }

    logger.info(
      { applied: pendingMigrations.length },
      'All migrations applied successfully'
    );
  } catch (error) {
    logger.error({ error }, 'Migration process failed');
    throw error;
  }
}

/**
 * Get migration status (applied and pending)
 */
export async function getMigrationStatus(): Promise<{
  applied: Migration[];
  pending: string[];
}> {
  try {
    await createMigrationsTable();

    const appliedMigrations = await getAppliedMigrations();
    const appliedNames = new Set(
      appliedMigrations.map((m) => m.name)
    );

    const migrationFiles = await getMigrationFiles();
    const pendingMigrations = migrationFiles
      .filter((m) => !appliedNames.has(m.filename))
      .map((m) => m.filename);

    return {
      applied: appliedMigrations,
      pending: pendingMigrations,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get migration status');
    throw error;
  }
}

/**
 * CLI entry point for running migrations
 * Usage: npm run migrate
 */
if (require.main === module) {
  (async () => {
    try {
      const { initializeDatabase, closeDatabase } = require('./database');

      // Initialize database connection
      initializeDatabase();

      // Run migrations
      await runMigrations();

      // Close database connection
      await closeDatabase();

      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}
