/**
 * Dapr Client Configuration (Simplified for Development)
 *
 * Provides Dapr SDK clients for:
 * - Pub/Sub (event publishing to Kafka via Redpanda)
 * - State Store (caching with Redis)
 * - Secrets (Kubernetes Secrets)
 * - Service Invocation (microservice communication)
 */

import { config } from './config';
import { logger } from './logger';

/**
 * Dapr client singleton instance
 * Used for pub/sub, state store, secrets, and service invocation
 */
let daprClient: any | null = null;

/**
 * Dapr server singleton instance
 * Used for subscribing to pub/sub events
 */
let daprServer: any | null = null;

/**
 * Initialize Dapr client
 * Should be called once during application startup
 */
export function initializeDaprClient(): any {
  if (daprClient) {
    return daprClient;
  }

  try {
    // For development, we'll use a mock client
    daprClient = {
      state: {
        save: async (_storeName: string, _items: any[]) => {
          logger.debug('Dapr state save (mock)');
        },
        get: async (_storeName: string, _key: string) => {
          logger.debug('Dapr state get (mock)');
          return null;
        },
        delete: async (_storeName: string, _key: string) => {
          logger.debug('Dapr state delete (mock)');
        }
      },
      secret: {
        get: async (_storeName: string, _secretName: string) => {
          logger.debug('Dapr secret get (mock)');
          return {};
        }
      },
      pubsub: {
        publish: async (_pubsubName: string, _topic: string, _data: any, _metadata?: any) => {
          logger.debug('Dapr pubsub publish (mock)');
        }
      },
      invoker: {
        invoke: async (_appId: string, _methodName: string, _method: string, _data?: any) => {
          logger.debug('Dapr service invocation (mock)');
          return {};
        }
      }
    };

    logger.info(
      {
        host: config.dapr.host,
        httpPort: config.dapr.httpPort,
        grpcPort: config.dapr.grpcPort,
      },
      'Dapr client initialized successfully (mock)'
    );

    return daprClient;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Dapr client');
    throw error;
  }
}

/**
 * Initialize Dapr server
 * Should be called once during application startup if subscribing to events
 */
export function initializeDaprServer(appPort?: number): any {
  if (daprServer) {
    return daprServer;
  }

  try {
    const serverPort = appPort || config.port;

    daprServer = {
      pubsub: {
        subscribe: async (_pubsubName: string, _topic: string, _handler: (data: any) => Promise<void>) => {
          logger.debug('Dapr pubsub subscribe (mock)');
        }
      },
      start: async () => {
        logger.debug('Dapr server start (mock)');
      },
      stop: async () => {
        logger.debug('Dapr server stop (mock)');
      }
    };

    logger.info(
      {
        serverPort,
        daprHost: config.dapr.host,
        daprPort: config.dapr.httpPort,
      },
      'Dapr server initialized successfully (mock)'
    );

    return daprServer;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Dapr server');
    throw error;
  }
}

/**
 * Get Dapr client instance
 * Initializes client if not already initialized
 */
export function getDaprClient(): any {
  if (!daprClient) {
    return initializeDaprClient();
  }
  return daprClient;
}

/**
 * Get Dapr server instance
 * Initializes server if not already initialized
 */
export function getDaprServer(appPort?: number): any {
  if (!daprServer) {
    return initializeDaprServer(appPort);
  }
  return daprServer;
}

/**
 * Publish event to Kafka via Dapr Pub/Sub
 *
 * @param topic - Event topic name
 * @param data - Event payload
 * @param metadata - Additional metadata
 */
export async function publishEvent(
  topic: string,
  data: any,
  metadata?: Record<string, string>
): Promise<void> {
  const client = getDaprClient();
  const pubsubName = config.dapr.pubsubName;

  try {
    await client.pubsub.publish(pubsubName, topic, data, metadata);

    logger.debug(
      {
        pubsubName,
        topic,
        dataKeys: Object.keys(data),
      },
      'Event published successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        pubsubName,
        topic,
      },
      'Failed to publish event to Dapr Pub/Sub'
    );
    throw error;
  }
}

/**
 * Save state to Redis via Dapr State Store
 *
 * @param key - State key
 * @param value - State value
 * @param metadata - Additional metadata (e.g., ttl)
 */
export async function saveState(
  key: string,
  value: any,
  metadata?: Record<string, string>
): Promise<void> {
  const client = getDaprClient();
  const stateStoreName = config.dapr.stateStoreName;

  try {
    await client.state.save(stateStoreName, [
      {
        key,
        value,
        metadata,
      },
    ]);

    logger.debug(
      {
        stateStoreName,
        key,
      },
      'State saved successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        stateStoreName,
        key,
      },
      'Failed to save state to Dapr State Store'
    );
    throw error;
  }
}

/**
 * Get state from Redis via Dapr State Store
 *
 * @param key - State key
 * @returns State value or null if not found
 */
export async function getState<T = any>(key: string): Promise<T | null> {
  const client = getDaprClient();
  const stateStoreName = config.dapr.stateStoreName;

  try {
    const result = await client.state.get(stateStoreName, key);

    logger.debug(
      {
        stateStoreName,
        key,
        found: !!result,
      },
      'State retrieved successfully'
    );

    return result || null;
  } catch (error) {
    logger.error(
      {
        error,
        stateStoreName,
        key,
      },
      'Failed to get state from Dapr State Store'
    );
    throw error;
  }
}

/**
 * Delete state from Redis via Dapr State Store
 *
 * @param key - State key
 */
export async function deleteState(key: string): Promise<void> {
  const client = getDaprClient();
  const stateStoreName = config.dapr.stateStoreName;

  try {
    await client.state.delete(stateStoreName, key);

    logger.debug(
      {
        stateStoreName,
        key,
      },
      'State deleted successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        stateStoreName,
        key,
      },
      'Failed to delete state from Dapr State Store'
    );
    throw error;
  }
}

/**
 * Get secret from Kubernetes Secrets via Dapr Secret Store
 *
 * @param secretName - Secret name
 * @param key - Secret key (optional, if secret has multiple keys)
 * @returns Secret value
 */
export async function getSecret(
  secretName: string,
  key?: string
): Promise<string> {
  const client = getDaprClient();
  const secretStoreName = config.dapr.secretStoreName;

  try {
    const result: Record<string, string> = await client.secret.get(secretStoreName, secretName);

    logger.debug(
      {
        secretStoreName,
        secretName,
      },
      'Secret retrieved successfully'
    );

    // If key is provided, return specific key value
    if (key && result) {
      return result[key] || '';
    }

    // Otherwise, return first value (for single-key secrets)
    return result ? Object.values(result)[0] || '' : '';
  } catch (error) {
    logger.error(
      {
        error,
        secretStoreName,
        secretName,
      },
      'Failed to get secret from Dapr Secret Store'
    );
    throw error;
  }
}

/**
 * Invoke another microservice via Dapr Service Invocation
 *
 * @param appId - Target service app ID
 * @param methodName - Method/endpoint name
 * @param data - Request data
 * @returns Response from target service
 */
export async function invokeService<T = any>(
  appId: string,
  methodName: string,
  data?: any
): Promise<T> {
  const client = getDaprClient();

  try {
    const result = await client.invoker.invoke(
      appId,
      methodName,
      'POST',
      data
    );

    logger.debug(
      {
        appId,
        methodName,
      },
      'Service invocation successful'
    );

    return result;
  } catch (error) {
    logger.error(
      {
        error,
        appId,
        methodName,
      },
      'Failed to invoke service via Dapr'
    );
    throw error;
  }
}

/**
 * Subscribe to Pub/Sub topic
 * Must be called before starting the Dapr server
 *
 * @param topic - Event topic name
 * @param handler - Event handler function
 */
export async function subscribeTopic(
  topic: string,
  handler: (data: any) => Promise<void>
): Promise<void> {
  const server = getDaprServer();
  const pubsubName = config.dapr.pubsubName;

  try {
    await server.pubsub.subscribe(pubsubName, topic, async (data: any) => {
      try {
        logger.debug(
          {
            pubsubName,
            topic,
            dataKeys: Object.keys(data),
          },
          'Event received from Pub/Sub'
        );

        await handler(data);
      } catch (error) {
        logger.error(
          {
            error,
            topic,
          },
          'Error handling Pub/Sub event'
        );
        throw error;
      }
    });

    logger.info(
      {
        pubsubName,
        topic,
      },
      'Subscribed to Pub/Sub topic successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        pubsubName,
        topic,
      },
      'Failed to subscribe to Pub/Sub topic'
    );
    throw error;
  }
}

/**
 * Start Dapr server (for Pub/Sub subscriptions)
 */
export async function startDaprServer(): Promise<void> {
  const server = getDaprServer();

  try {
    await server.start();
    logger.info('Dapr server started successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to start Dapr server');
    throw error;
  }
}

/**
 * Stop Dapr server
 */
export async function stopDaprServer(): Promise<void> {
  if (daprServer) {
    try {
      await daprServer.stop();
      logger.info('Dapr server stopped successfully');
      daprServer = null;
    } catch (error) {
      logger.error({ error }, 'Failed to stop Dapr server');
      throw error;
    }
  }
}

/**
 * Shutdown Dapr client and server gracefully
 */
export async function shutdownDapr(): Promise<void> {
  try {
    await stopDaprServer();
    daprClient = null;
    logger.info('Dapr client and server shut down successfully');
  } catch (error) {
    logger.error({ error }, 'Error during Dapr shutdown');
    throw error;
  }
}