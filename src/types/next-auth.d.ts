import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      countryId?: string | null;
      preferredLanguage?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      uiLanguage?: string | null;
      isBanned?: boolean;
      banReason?: string;
      needsSetup?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username?: string;
    role?: string;
    countryId?: string;
    preferredLanguage?: string;
    uiLanguage?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    countryId?: string | null;
    preferredLanguage?: string | null;
    uiLanguage?: string | null;
    role?: string;
    isBanned?: boolean;
    banReason?: string | null;
    needsSetup?: boolean;
  }
}
