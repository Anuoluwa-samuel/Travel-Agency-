"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. Same-origin, so no baseURL is needed. */
export const authClient = createAuthClient({
  // The sign-in form handles `twoFactorRedirect` itself so it can keep the `next` path.
  plugins: [twoFactorClient()],
});
