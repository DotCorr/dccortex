/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Authentication utilities
 */

import { compare, hash } from 'bcryptjs';
import { getServerSession, Session } from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { prisma } from './prisma';
import { LEGACY_ROLE_PERMISSIONS, type Permission } from './permissions';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(password, hashedPassword);
}

function buildProviders(): NextAuthOptions['providers'] {
  const list: NextAuthOptions['providers'] = [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ]
  const gId = process.env.GOOGLE_CLIENT_ID
  const gSecret = process.env.GOOGLE_CLIENT_SECRET
  if (gId && gSecret) {
    list.push(GoogleProvider({
      clientId: gId,
      clientSecret: gSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    }))
  } else {
    console.warn('[auth] Google OAuth skipped: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing')
  }
  const ghId = process.env.GITHUB_CLIENT_ID
  const ghSecret = process.env.GITHUB_CLIENT_SECRET
  if (ghId && ghSecret) {
    list.push(GitHubProvider({
      clientId: ghId,
      clientSecret: ghSecret,
      authorization: {
        params: {},
      },
    }))
  } else {
    console.warn('[auth] GitHub OAuth skipped: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET missing')
  }
  return list
}

export const authOptions: NextAuthOptions = {
  get providers() {
    return buildProviders()
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth sign in - create or update user
      if (account?.provider === 'google' || account?.provider === 'github') {
        if (user.email) {
          try {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
            })

            if (!existingUser) {
              // Create new user from OAuth
              await prisma.user.create({
                data: {
                  email: user.email,
                  name: user.name || user.email.split('@')[0],
                  passwordHash: '', // OAuth users don't have passwords
                },
              })
            }
            // Store user ID in user object for JWT callback
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email },
            })
            if (dbUser) {
              user.id = dbUser.id
            }
          } catch (error) {
            console.error('[NextAuth] signIn callback error (OAuth create/find user):', error)
            return false
          }
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      // Initial sign in - user object is available (OAuth or credentials)
      if (user) {
        // For OAuth, user.id should be set by signIn callback
        // For credentials, user.id is already set
        if (user.id) {
          token.id = user.id
          token.email = user.email || token.email
        } else if (user.email) {
          // Fallback: fetch from database if user.id not set
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email },
            })
            if (dbUser) {
              token.id = dbUser.id
              token.email = dbUser.email
            }
          } catch (error) {
            // Silent error handling
          }
        }
      }
      
      // ALWAYS ensure token has ID and email - fetch from DB if missing
      if (!token.id && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.email = dbUser.email
          }
        } catch (error) {
          // Silent error handling
        }
      }
      
      // Store provider info for OAuth
      if (account) {
        token.provider = account.provider
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Always ensure user.id is set - critical for API routes
        if (token.id) {
          session.user.id = token.id as string
        } else if (token.email) {
          // Fallback: fetch user ID from database if not in token
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: token.email as string },
            })
            if (dbUser) {
              session.user.id = dbUser.id
              // Update token for next request
              token.id = dbUser.id
            }
          } catch (error) {
            // Silent error handling
          }
        }
        // Ensure email is set
        if (token.email) {
          session.user.email = token.email as string
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_URL?.startsWith('https://')
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Secure must be true for HTTPS (Cloudflare Tunnel uses HTTPS)
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') || false,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production',
}

// --- No-code RBAC helpers (used by tasks 02, 03, 08) ---

export async function getCurrentUser(session?: Session | null) {
  const s = session ?? (await getServerSession(authOptions));
  if (!s?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: s.user.id },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export async function getUserRoles(orgId: string, session?: Session | null) {
  const user = await getCurrentUser(session);
  if (!user) return [];
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: user.id },
    },
    include: { roleRef: true },
  });
  if (!member) return [];
  if (member.roleRef) {
    return [{ id: member.roleRef.id, name: member.roleRef.name, permissions: member.roleRef.permissions as string[] }];
  }
  const legacy = LEGACY_ROLE_PERMISSIONS[member.role] ?? [];
  return [{ id: member.role, name: member.role, permissions: legacy }];
}

export async function hasPermission(
  orgId: string,
  permission: Permission | string,
  session?: Session | null
): Promise<boolean> {
  const user = await getCurrentUser(session);
  if (!user) return false;
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: user.id },
    },
    include: { roleRef: true },
  });
  if (!member) return false;
  const permissions: string[] = member.roleRef
    ? (member.roleRef.permissions as string[])
    : LEGACY_ROLE_PERMISSIONS[member.role] ?? [];
  return permissions.includes(permission);
}

