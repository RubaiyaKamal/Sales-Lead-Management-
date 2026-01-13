import dotenv from 'dotenv';
import Joi from 'joi';
import { logger } from './logger';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration schema
 * Validates all required environment variables and provides defaults
 */
const configSchema = Joi.object({
  // Application settings
  nodeEnv: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  port: Joi.number().port().default(3005),
  apiVersion: Joi.string().default('v1'),

  // Database configuration
  database: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().port().default(5432),
    name: Joi.string().required(),
    user: Joi.string().required(),
    password: Joi.string().required(),
    ssl: Joi.boolean().default(false),
    pool: Joi.object({
      min: Joi.number().integer().min(0).default(2),
      max: Joi.number().integer().min(1).default(100),
    }),
  }).required(),

  // Redis configuration
  redis: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().port().default(6379),
    password: Joi.string().allow('').optional(),
    db: Joi.number().integer().min(0).default(0),
    cacheTTL: Joi.number().integer().min(1).default(300), // 5 minutes
  }).required(),

  // Kafka/Redpanda configuration
  kafka: Joi.object({
    brokers: Joi.string().required(),
    clientId: Joi.string().default('leadflow-backend'),
    consumerGroup: Joi.string().default('leadflow-consumers'),
    topicLeadEvents: Joi.string().default('lead-events'),
  }).required(),

  // Dapr configuration
  dapr: Joi.object({
    host: Joi.string().default('localhost'),
    httpPort: Joi.number().port().default(3500),
    grpcPort: Joi.number().port().default(50001),
    pubsubName: Joi.string().default('kafka-pubsub'),
    stateStoreName: Joi.string().default('redis-statestore'),
    secretStoreName: Joi.string().default('kubernetes-secrets'),
  }).required(),

  // Authentication (JWT/Cognito)
  auth: Joi.object({
    jwtSecret: Joi.string().required(),
    jwtIssuer: Joi.string().uri().required(),
    jwtAudience: Joi.string().required(),
    cognitoUserPoolId: Joi.string().optional(),
    cognitoRegion: Joi.string().default('us-east-1'),
  }).required(),

  // OpenAI GPT API
  ai: Joi.object({
    apiKey: Joi.string().when('features.aiQualification', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional().allow('', null),
    }),
    model: Joi.string().default('gpt-4-turbo-preview'),
    maxTokens: Joi.number().integer().min(1).default(1024),
    temperature: Joi.number().min(0).max(1).default(0.7),
  }).required(),

  // Rate limiting
  rateLimit: Joi.object({
    windowMs: Joi.number().integer().min(1000).default(3600000), // 1 hour
    maxRequests: Joi.number().integer().min(1).default(100),
  }).required(),

  // Logging
  logging: Joi.object({
    level: Joi.string()
      .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
      .default('info'),
    pretty: Joi.boolean().default(false),
  }).required(),

  // AWS configuration (optional)
  aws: Joi.object({
    region: Joi.string().default('us-east-1'),
    secretManagerSecretName: Joi.string().optional(),
  }).optional(),

  // Feature flags
  features: Joi.object({
    cache: Joi.boolean().default(true),
    aiQualification: Joi.boolean().default(true),
    rateLimiting: Joi.boolean().default(true),
  }).required(),

  // Observability
  observability: Joi.object({
    xrayTracing: Joi.boolean().default(false),
    prometheusMetrics: Joi.boolean().default(true),
    prometheusPort: Joi.number().port().default(9090),
  }).required(),

  // Security
  security: Joi.object({
    corsOrigin: Joi.string().default('http://localhost:3001'),
    encryptionKey: Joi.string().optional(),
  }).required(),
}).unknown(true);

/**
 * Load and validate configuration from environment variables
 */
function loadConfig() {
  const rawConfig = {
    nodeEnv: process.env['NODE_ENV'],
    port: process.env['PORT'] ? parseInt(process.env['PORT'], 10) : undefined,
    apiVersion: process.env['API_VERSION'],

    database: {
      host: process.env['DATABASE_HOST'],
      port: process.env['DATABASE_PORT']
        ? parseInt(process.env['DATABASE_PORT'], 10)
        : undefined,
      name: process.env['DATABASE_NAME'],
      user: process.env['DATABASE_USER'],
      password: process.env['DATABASE_PASSWORD'],
      ssl: process.env['DATABASE_SSL'] === 'true',
      pool: {
        min: process.env['DATABASE_POOL_MIN']
          ? parseInt(process.env['DATABASE_POOL_MIN'], 10)
          : undefined,
        max: process.env['DATABASE_POOL_MAX']
          ? parseInt(process.env['DATABASE_POOL_MAX'], 10)
          : undefined,
      },
    },

    redis: {
      host: process.env['REDIS_HOST'],
      port: process.env['REDIS_PORT']
        ? parseInt(process.env['REDIS_PORT'], 10)
        : undefined,
      password: process.env['REDIS_PASSWORD'],
      db: process.env['REDIS_DB'] ? parseInt(process.env['REDIS_DB'], 10) : undefined,
      cacheTTL: process.env['REDIS_CACHE_TTL']
        ? parseInt(process.env['REDIS_CACHE_TTL'], 10)
        : undefined,
    },

    kafka: {
      brokers: process.env['KAFKA_BROKERS'],
      clientId: process.env['KAFKA_CLIENT_ID'],
      consumerGroup: process.env['KAFKA_CONSUMER_GROUP'],
      topicLeadEvents: process.env['KAFKA_TOPIC_LEAD_EVENTS'],
    },

    dapr: {
      host: process.env['DAPR_HOST'],
      httpPort: process.env['DAPR_HTTP_PORT']
        ? parseInt(process.env['DAPR_HTTP_PORT'], 10)
        : undefined,
      grpcPort: process.env['DAPR_GRPC_PORT']
        ? parseInt(process.env['DAPR_GRPC_PORT'], 10)
        : undefined,
      pubsubName: process.env['DAPR_PUBSUB_NAME'],
      stateStoreName: process.env['DAPR_STATE_STORE_NAME'],
      secretStoreName: process.env['DAPR_SECRET_STORE_NAME'],
    },

    auth: {
      jwtSecret: process.env['JWT_SECRET'],
      jwtIssuer: process.env['JWT_ISSUER'],
      jwtAudience: process.env['JWT_AUDIENCE'],
      cognitoUserPoolId: process.env['COGNITO_USER_POOL_ID'],
      cognitoRegion: process.env['COGNITO_REGION'],
    },

    ai: {
      apiKey: process.env['OPENAI_API_KEY'],
      model: process.env['OPENAI_MODEL'],
      maxTokens: process.env['OPENAI_MAX_TOKENS']
        ? parseInt(process.env['OPENAI_MAX_TOKENS'], 10)
        : undefined,
      temperature: process.env['OPENAI_TEMPERATURE']
        ? parseFloat(process.env['OPENAI_TEMPERATURE'])
        : undefined,
    },

    rateLimit: {
      windowMs: process.env['RATE_LIMIT_WINDOW_MS']
        ? parseInt(process.env['RATE_LIMIT_WINDOW_MS'], 10)
        : undefined,
      maxRequests: process.env['RATE_LIMIT_MAX_REQUESTS']
        ? parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'], 10)
        : undefined,
    },

    logging: {
      level: process.env['LOG_LEVEL'],
      pretty: process.env['LOG_PRETTY'] === 'true',
    },

    aws: {
      region: process.env['AWS_REGION'],
      secretManagerSecretName: process.env['AWS_SECRET_MANAGER_SECRET_NAME'],
    },

    features: {
      cache: process.env['ENABLE_CACHE'] !== 'false',
      aiQualification: process.env['ENABLE_AI_QUALIFICATION'] !== 'false',
      rateLimiting: process.env['ENABLE_RATE_LIMITING'] !== 'false',
    },

    observability: {
      xrayTracing: process.env['ENABLE_XRAY_TRACING'] === 'true',
      prometheusMetrics: process.env['ENABLE_PROMETHEUS_METRICS'] !== 'false',
      prometheusPort: process.env['PROMETHEUS_PORT']
        ? parseInt(process.env['PROMETHEUS_PORT'], 10)
        : undefined,
    },

    security: {
      corsOrigin: process.env['CORS_ORIGIN'],
      encryptionKey: process.env['ENCRYPTION_KEY'],
    },
  };

  // Validate configuration
  const { error, value } = configSchema.validate(rawConfig, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    logger.error(
      { errors: error.details },
      'Configuration validation failed'
    );
    throw new Error(
      `Configuration validation failed: ${error.details.map((d) => d.message).join(', ')}`
    );
  }

  return value;
}

// Load and export configuration
export const config = loadConfig();

// Type for the configuration object
export type Config = typeof config;

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return config.nodeEnv === 'test';
}

// Log configuration loaded (without sensitive values)
logger.info(
  {
    environment: config.nodeEnv,
    port: config.port,
    features: config.features,
  },
  'Configuration loaded successfully'
);
