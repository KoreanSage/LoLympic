import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

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
          // Auto-create user from Google profile
          const baseUsername = email
            .split("@")[0]
            .replace(/[^a-zA-Z0-9_]/g, "_");
          let username = baseUsername;
          let counter = 1;
          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}_${counter}`;
            counter++;
          }

          const newUser = await prisma.user.create({
            data: {
              email,
              username,
              displayName: user.name || username,
              avatarUrl: user.image || null,
              emailVerified: new Date(),
              countryId: "US",
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

          // Update avatar
          if (user.image && user.image !== existingUser.avatarUrl) {
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
          token.role = dbUser.role;
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
            token.role = dbUser.role;
            // Check if profile looks auto-generated (email prefix as username)
            const emailPrefix = (user.email || "").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
            token.needsSetup = dbUser.username === emailPrefix || dbUser.username.startsWith(emailPrefix + "_");
          }
        } else {
          token.id = user.id;
          token.username = (user as any).username;
          token.displayName = (user as any).name;
          token.avatarUrl = (user as any).image;
          token.countryId = (user as any).countryId;
          token.preferredLanguage = (user as any).preferredLanguage;
          token.role = (user as any).role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).displayName = token.displayName;
        (session.user as any).avatarUrl = token.avatarUrl;
        (session.user as any).countryId = token.countryId;
        (session.user as any).preferredLanguage = token.preferredLanguage;
        (session.user as any).role = token.role;
        (session.user as any).needsSetup = token.needsSetup ?? false;
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
