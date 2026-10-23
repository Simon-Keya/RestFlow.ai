import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "@/lib/constants/storage-keys";
import { routes } from "@/lib/routes";

/** Default shop until a real "which shops can this user access" endpoint exists (see lib/routes and features/auth/hooks/use-login for the same note). */
const DEFAULT_SHOP_ID = "1";

export default async function RootPage() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  redirect(token ? routes.dashboard(DEFAULT_SHOP_ID) : routes.login());
}
