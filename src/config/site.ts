/** Absolute base URL for canonicals, sitemaps and structured data. */
export const siteUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
