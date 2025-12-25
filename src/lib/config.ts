export const ENV = {
  APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL ?? "",
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  VERCEL_ENV: process.env.VERCEL_ENV ?? undefined,
} as const;

export const isProd =
  ENV.VERCEL_ENV === "production" || ENV.NODE_ENV === "production";
export const isDev =
  ENV.VERCEL_ENV === "development" || ENV.NODE_ENV === "development";

export function assertEnv() {
  if (process.env.CI === "true") {
    return;
  }

  const requiredKeys: (keyof typeof ENV)[] = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
  ];

  const missing = requiredKeys.filter((key) => {
    const value = ENV[key];
    return typeof value === "string" && value.trim() === "";
  });

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}
