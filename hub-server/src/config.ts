export const PORT = parseInt(process.env.PORT || '20008', 10);
export const STATIC_ROOT = process.env.STATIC_ROOT || '/root/projects/app-hub/static';
export const HOME_URL = process.env.HOME_URL || '/openclaw/20008/';
export const STATIC_DISCOVERY_TTL_MS = parseInt(process.env.STATIC_DISCOVERY_TTL_MS || '60000', 10);
export const ROUTE_CLEANUP_INTERVAL_MS = 60_000;
export const ROUTE_CLEANUP_AGE_MS = 300_000;
