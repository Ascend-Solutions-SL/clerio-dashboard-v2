import { ENV } from './config';

const resolveVercelUrl = () => (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

export const resolveAppBaseUrl = () =>
  process.env.APP_BASE_URL ||
  ENV.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  resolveVercelUrl() ||
  'http://localhost:3000';

export const resolveAbsoluteUrl = (path: string) => {
  const baseUrl = resolveAppBaseUrl();
  return new URL(path, baseUrl).toString();
};
