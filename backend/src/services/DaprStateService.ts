/**
 * Dapr State Service
 *
 * Handles caching operations using Redis via Dapr State Store.
 * Provides TTL-based caching for lead list queries and other data.
 */

import { getState, saveState, deleteState } from '../lib/dapr';
import { logger } from '../lib/logger';
import { config } from '../lib/config';

/**
 * Cache key prefix
 */
const CACHE_PREFIX = 'cache';

/**
 * Default TTL (time to live) in seconds - 5 minutes
 */
const DEFAULT_TTL_SECONDS = config.redis.cacheTTL;

/**
 * Generate cache key
 */
function generateCacheKey(namespace: string, key: string): string {
  return `${CACHE_PREFIX}:${namespace}:${key}`;
}

/**
 * Generate hash for object (for cache keys)
 */
function hashObject(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

/**
 * Get cached value
 *
 * @param namespace - Cache namespace (e.g., 'leads:list')
 * @param key - Cache key
 * @returns Cached value or null if not found/expired
 */
export async function getCached<T>(
  namespace: string,
  key: string
): Promise<T | null> {
  if (!config.features.cache) {
    return null;
  }

  const cacheKey = generateCacheKey(namespace, key);

  try {
    const cached = await getState<T>(cacheKey);

    if (cached) {
      logger.debug(
        {
          namespace,
          key,
          cacheKey,
        },
        'Cache hit'
      );
      return cached;
    }

    logger.debug(
      {
        namespace,
        key,
        cacheKey,
      },
      'Cache miss'
    );

    return null;
  } catch (error) {
    logger.warn(
      {
        error,
        namespace,
        key,
      },
      'Cache get failed, continuing without cache'
    );
    return null;
  }
}

/**
 * Set cached value with TTL
 *
 * @param namespace - Cache namespace
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttlSeconds - TTL in seconds (default: 5 minutes)
 */
export async function setCached<T>(
  namespace: string,
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  if (!config.features.cache) {
    return;
  }

  const cacheKey = generateCacheKey(namespace, key);

  try {
    await saveState(cacheKey, value, {
      ttlInSeconds: ttlSeconds.toString(),
    });

    logger.debug(
      {
        namespace,
        key,
        cacheKey,
        ttlSeconds,
      },
      'Cache set'
    );
  } catch (error) {
    logger.warn(
      {
        error,
        namespace,
        key,
      },
      'Cache set failed, continuing without cache'
    );
  }
}

/**
 * Invalidate (delete) cached value
 *
 * @param namespace - Cache namespace
 * @param key - Cache key
 */
export async function invalidateCached(
  namespace: string,
  key: string
): Promise<void> {
  if (!config.features.cache) {
    return;
  }

  const cacheKey = generateCacheKey(namespace, key);

  try {
    await deleteState(cacheKey);

    logger.debug(
      {
        namespace,
        key,
        cacheKey,
      },
      'Cache invalidated'
    );
  } catch (error) {
    logger.warn(
      {
        error,
        namespace,
        key,
      },
      'Cache invalidation failed'
    );
  }
}

/**
 * Invalidate all cached values in a namespace (pattern-based)
 *
 * Note: This is a best-effort operation. Redis scan is not supported
 * via Dapr State Store, so we invalidate known keys.
 *
 * @param namespace - Cache namespace
 * @param keys - Array of known keys to invalidate
 */
export async function invalidateNamespace(
  namespace: string,
  keys: string[]
): Promise<void> {
  if (!config.features.cache) {
    return;
  }

  try {
    await Promise.all(
      keys.map((key) => invalidateCached(namespace, key))
    );

    logger.debug(
      {
        namespace,
        count: keys.length,
      },
      'Namespace invalidated'
    );
  } catch (error) {
    logger.warn(
      {
        error,
        namespace,
      },
      'Namespace invalidation failed'
    );
  }
}

/**
 * Get or compute cached value
 * If value is in cache, return it. Otherwise, compute it, cache it, and return it.
 *
 * @param namespace - Cache namespace
 * @param key - Cache key
 * @param computeFn - Function to compute value if not cached
 * @param ttlSeconds - TTL in seconds
 * @returns Cached or computed value
 */
export async function getOrCompute<T>(
  namespace: string,
  key: string,
  computeFn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  // Try to get from cache
  const cached = await getCached<T>(namespace, key);

  if (cached !== null) {
    return cached;
  }

  // Compute value
  const value = await computeFn();

  // Cache the result
  await setCached(namespace, key, value, ttlSeconds);

  return value;
}

/**
 * Cache namespace constants
 */
export const CacheNamespace = {
  LEAD_LIST: 'leads:list',
  LEAD_DETAIL: 'leads:detail',
  USER: 'users',
} as const;

/**
 * Generate cache key for lead list queries
 */
export function generateLeadListCacheKey(filters: Record<string, any>): string {
  return hashObject(filters);
}

/**
 * Generate cache key for lead detail
 */
export function generateLeadDetailCacheKey(leadId: string): string {
  return leadId;
}

/**
 * Invalidate all lead caches (list and detail)
 * Called when a lead is created, updated, or deleted
 */
export async function invalidateLeadCaches(leadId?: string): Promise<void> {
  try {
    // Invalidate specific lead detail cache if leadId provided
    if (leadId) {
      await invalidateCached(
        CacheNamespace.LEAD_DETAIL,
        generateLeadDetailCacheKey(leadId)
      );
    }

    // Note: For lead list cache, we can't easily invalidate all variants
    // In a production system, you would:
    // 1. Use Redis SCAN to find all keys matching pattern
    // 2. Or use a cache versioning strategy
    // 3. Or accept eventual consistency (cache expires after 5 min)

    logger.debug(
      {
        leadId,
      },
      'Lead caches invalidated'
    );
  } catch (error) {
    logger.warn(
      {
        error,
        leadId,
      },
      'Lead cache invalidation failed'
    );
  }
}
