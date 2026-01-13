import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth Client
 *
 * Provides hooks for authentication:
 * - useSession() - Get current session
 * - signIn.email() - Sign in with email/password
 * - signUp.email() - Sign up with email/password
 * - signOut() - Sign out
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
})

export const { useSession, signIn, signUp, signOut } = authClient
