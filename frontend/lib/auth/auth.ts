import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

/**
 * Database pool for Better Auth - Using a pool is more robust for Next.js
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

/**
 * Better Auth Configuration
 */
export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for development
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'sales_rep',
        input: false, // Don't allow user to set this
      },
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET || 'a-very-secret-key-for-development-only-123',
  trustedOrigins: [
    'http://localhost:3001',
    'http://localhost:3005', // Backend API
  ],
})

// Export Session type that includes both session and user data
export type Session = typeof auth.$Infer.Session
