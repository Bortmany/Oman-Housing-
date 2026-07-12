import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale detection + /en//ar prefixing. Role-based access control lives in
// the (admin)/(app) route-group layouts, not here.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
