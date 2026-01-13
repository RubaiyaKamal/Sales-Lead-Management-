/**
 * PostgreSQL Database Connection Pool
 *
 * Provides connection pooling for Neon DB (serverless PostgreSQL).
 * Uses pg library with connection pool for efficient connection management.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';
import { logger } from './logger';
import { DatabaseError } from '../api/middleware/errorHandler';

/**
 * Database connection pool instance
 */
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 * Should be called once during application startup
 */
export function initializeDatabase(): Pool {
  if (pool) {
    return pool;
  }

  try {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl
        ? {
            rejectUnauthorized: false, // For Neon DB with self-signed certs
          }
        : false,
      min: config.database.pool.min,
      max: config.database.pool.max,
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 10000, // Fail fast if connection takes > 10 seconds
    });

    // Handle pool errors
    pool.on('error', (err: Error) => {
      logger.error({ error: err }, 'Unexpected database pool error');
    });

    // Handle pool connection
    pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    // Handle pool client acquisition
    pool.on('acquire', () => {
      logger.debug('Database client acquired from pool');
    });

    // Handle pool client release
    pool.on('remove', () => {
      logger.debug('Database client removed from pool');
    });

    logger.info(
      {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        poolMin: config.database.pool.min,
        poolMax: config.database.pool.max,
      },
      'Database connection pool initialized successfully'
    );

    return pool;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database connection pool');
    throw error;
  }
}

/**
 * Get database connection pool instance
 * Initializes pool if not already initialized
 */
export function getDatabase(): Pool {
  if (!pool) {
    return initializeDatabase();
  }
  return pool;
}

/**
 * Execute a query with automatic connection management
 *
 * @param query - SQL query string (use parameterized queries to prevent SQL injection)
 * @param params - Query parameters (optional)
 * @returns Query result
 */
export async function executeQuery<T extends QueryResultRow = any>(
  query: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const db = getDatabase();

  const startTime = Date.now();
  try {
    const result = await db.query<T>(query, params);
    const duration = Date.now() - startTime;

    logger.debug(
      {
        query: query.substring(0, 100), // Log first 100 chars of query
        params: params ? '***' : undefined, // Hide params for security
        rowCount: result.rowCount,
        duration,
      },
      'Query executed successfully'
    );

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error(
      {
        error,
        query: query.substring(0, 100),
        duration,
      },
      'Query execution failed'
    );

    throw new DatabaseError('Database query failed', {
      code: error.code,
      detail: error.detail,
    });
  }
}

/**
 * Execute a query and return first row
 *
 * @param query - SQL query string
 * @param params - Query parameters (optional)
 * @returns First row or null if no results
 */
export async function executeQueryOne<T extends QueryResultRow = any>(
  query: string,
  params?: any[]
): Promise<T | null> {
  const result = await executeQuery<T>(query, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 *
 * @param query - SQL query string
 * @param params - Query parameters (optional)
 * @returns Array of rows
 */
export async function executeQueryAll<T extends QueryResultRow = any>(
  query: string,
  params?: any[]
): Promise<T[]> {
  const result = await executeQuery<T>(query, params);
  return result.rows;
}

/**
 * Execute a transaction with automatic rollback on error
 *
 * @param callback - Transaction callback function
 * @returns Result from callback
 */
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = getDatabase();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    logger.debug('Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    logger.debug('Transaction committed');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error }, 'Transaction rolled back due to error');
    throw error;
  } finally {
    client.release();
    logger.debug('Transaction client released');
  }
}

/**
 * Check database connection health
 * Used for health check endpoints
 *
 * @returns True if database is healthy, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await executeQueryOne<{ now: Date }>(
      'SELECT NOW() as now'
    );
    return !!result;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

/**
 * Get database pool statistics
 * Useful for monitoring and debugging
 */
export function getDatabaseStats() {
  if (!pool) {
    return null;
  }

  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

/**
 * Close database connection pool
 * Should be called during graceful shutdown
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      logger.info('Database connection pool closed successfully');
      pool = null;
    } catch (error) {
      logger.error({ error }, 'Error closing database connection pool');
      throw error;
    }
  }
}

/**
 * Helper function to build WHERE clauses with dynamic filters
 *
 * @param filters - Object with filter conditions
 * @returns SQL WHERE clause and parameters
 */
export function buildWhereClause(
  filters: Record<string, any>
): { whereClause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      conditions.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, params };
}

/**
 * Helper function to build pagination LIMIT and OFFSET
 *
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns SQL LIMIT and OFFSET clause with values
 */
export function buildPaginationClause(
  page: number = 1,
  limit: number = 20
): { limitClause: string; offset: number } {
  const offset = (page - 1) * limit;
  const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

  return { limitClause, offset };
}

/**
 * Helper function to build ORDER BY clause
 *
 * @param sortBy - Column to sort by
 * @param sortOrder - Sort order (asc or desc)
 * @returns SQL ORDER BY clause
 */
export function buildOrderByClause(
  sortBy: string = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc'
): string {
  // Whitelist allowed sort columns to prevent SQL injection
  const allowedColumns = [
    'created_at',
    'updated_at',
    'name',
    'email',
    'company',
    'status',
  ];

  if (!allowedColumns.includes(sortBy)) {
    sortBy = 'created_at';
  }

  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${sortBy} ${order}`;
}
