import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

function getFirstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getRequestOrigin(request: Request, requestUrl: URL) {
  const forwardedHost = getFirstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = getFirstForwardedValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost ?? request.headers.get("host");

  if (!host) {
    return requestUrl.origin;
  }

  const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }

  return nextPath;
}

function buildSignInRedirect(origin: string, message: string) {
  const redirectUrl = new URL("/sign-in", origin);
  redirectUrl.searchParams.set("message", message);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = getRequestOrigin(request, requestUrl);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const authError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  if (authError) {
    return buildSignInRedirect(
      origin,
      "This verification link is invalid or expired. Request a fresh email and try again.",
    );
  }

  const supabase = await createSupabaseRouteHandlerClient();

  if (code) {
    const { error } = await supabase.auth
      .exchangeCodeForSession(code)
      .catch((exchangeError: unknown) => ({
        error: exchangeError instanceof Error ? exchangeError : new Error("Auth exchange failed"),
      }));

    if (error) {
      return buildSignInRedirect(
        origin,
        "This verification link is invalid or expired. Request a fresh email and try again.",
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    }).catch((verifyError: unknown) => ({
      error: verifyError instanceof Error ? verifyError : new Error("Auth verification failed"),
    }));

    if (error) {
      return buildSignInRedirect(
        origin,
        "This verification link is invalid or expired. Request a fresh email and try again.",
      );
    }
  } else {
    return buildSignInRedirect(
      origin,
      "We could not complete sign-in from that link. Request a fresh email and try again.",
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildSignInRedirect(
      origin,
      "Your session could not be restored after verification. Please sign in again.",
    );
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership) {
    return NextResponse.redirect(new URL(nextPath || "/dashboard", origin));
  }

  return NextResponse.redirect(new URL("/onboarding", origin));
}
