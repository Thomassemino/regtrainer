import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: "CLIENTE" | "ADMIN";
      sessionId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "CLIENTE" | "ADMIN";
    sessionId?: string;
  }
}