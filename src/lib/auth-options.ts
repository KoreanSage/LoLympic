import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

// Ensure NEXTAUTH_SECRET is set in production to prevent insecure sessions
if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET environment variable is not set. This is required in production for secure session handling."
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
          username: user.username,
          countryId: user.countryId || "US",
          preferredLanguage: user.preferredLanguage || "en",
          role: user.role || "USER",
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const email = user.email;
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (!existingUser) {
          // Auto-create user from Google profile.
          // Generate a unique username in O(1) by appending random hex once the
          // plain base is taken, rather than incrementing until a free slot is
          // found (which was effectively unbounded).
          const baseUsername = email
            .split("@")[0]
            .replace(/[^a-zA-Z0-9_]/g, "_")
            .slice(0, 20);
          let username = baseUsername;
          const taken = await prisma.user.findUnique({ where: { username } });
          if (taken) {
            // 6 hex chars ≈ 16M possibilities — collision vanishingly rare.
            const suffix = Math.random().toString(16).slice(2, 8);
            username = `${baseUsername}_${suffix}`;
          }

          const newUser = await prisma.user.create({
            data: {
              email,
              username,
              displayName: user.name || username,
              avatarUrl: user.image || null,
              emailVerified: new Date(),
              countryId: null,
              preferredLanguage: "en",
            },
          });

          await prisma.account.create({
            data: {
              userId: newUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          });
        } else {
          // Link Google account if not already linked
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
          });

          if (!existingAccount) {
            // Only auto-link if the existing account has a verified email
            if (!existingUser.emailVerified) {
              return false;
            }
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }

          // Only set avatar if user has none (don't overwrite custom avatars)
          if (user.image && !existingUser.avatarUrl) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { avatarUrl: user.image },
            });
          }
        }
      }
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // On session update (e.g. after profile save), refresh from DB
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (dbUser) {
          token.username = dbUser.username;
          token.displayName = dbUser.displayName;
          token.avatarUrl = dbUser.avatarUrl;
          token.countryId = dbUser.countryId;
          token.preferredLanguage = dbUser.preferredLanguage;
          token.uiLanguage = dbUser.uiLanguage;
          token.role = dbUser.role;
          token.isBanned = dbUser.isBanned;
          token.banReason = dbUser.banReason;
          token.needsSetup = false;
        }
        return token;
      }

      if (user) {
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email ?? "" },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.username = dbUser.username;
            token.displayName = dbUser.displayName;
            token.avatarUrl = dbUser.avatarUrl;
            token.countryId = dbUser.countryId;
            token.preferredLanguage = dbUser.preferredLanguage;
            token.uiLanguage = dbUser.uiLanguage;
            token.role = dbUser.role;
            token.isBanned = dbUser.isBanned;
            token.banReason = dbUser.banReason;
            // Check if profile looks auto-generated (email prefix as username)
            const emailPrefix = (user.email || "").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
            token.needsSetup = dbUser.username === emailPrefix || dbUser.username.startsWith(emailPrefix + "_");
          }
        } else {
          token.id = user.id;
          token.username = user.username;
          token.displayName = user.name ?? undefined;
          token.avatarUrl = user.image ?? undefined;
          token.countryId = user.countryId;
          token.preferredLanguage = user.preferredLanguage;
          token.uiLanguage = user.uiLanguage;
          token.role = user.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.displayName = token.displayName;
        session.user.avatarUrl = token.avatarUrl;
        session.user.countryId = token.countryId;
        session.user.preferredLanguage = token.preferredLanguage;
        session.user.uiLanguage = token.uiLanguage;
        session.user.role = token.role as string;
        session.user.isBanned = token.isBanned ?? false;
        session.user.banReason = token.banReason as string | undefined;
        session.user.needsSetup = token.needsSetup ?? false;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,
};
