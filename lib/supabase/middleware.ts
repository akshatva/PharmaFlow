import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";

const protectedPaths = ["/onboarding", "/dashboard", "/inventory", "/sales", "/insights", "/settings"];
const authPaths = ["/sign-in", "/sign-up"];

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function matchesPath(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtectedPath = matchesPath(pathname, protectedPaths);
  const isAuthPath = matchesPath(pathname, authPaths);

  if (!user && isProtectedPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/onboarding";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
