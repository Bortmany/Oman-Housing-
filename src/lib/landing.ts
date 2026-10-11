// Where someone lands right after signing in when they did not arrive from a
// specific page: agencies go to their workspace, admins to the admin desk,
// everyone else to their account. Pure, so it is tested without a browser.

export function landingForRole(role: string | null | undefined): "/agency" | "/admin" | "/account" {
  if (role === "AGENCY") return "/agency";
  if (role === "ADMIN") return "/admin";
  return "/account";
}
