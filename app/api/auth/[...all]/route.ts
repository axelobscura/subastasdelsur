import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth endpoints: email verification links, password reset links, sign-out, session.
// Sign-up over HTTP is disabled; registration goes through app/registro/actions.ts.
export const { GET, POST } = toNextJsHandler(auth);
