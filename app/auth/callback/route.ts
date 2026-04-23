import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }

  return nextPath;
}

function buildSignInRedirect(requestUrl: URL, message: string) {
  const redirectUrl = new URL("/sign-in", requestUrl.origin);
  redirectUrl.searchParams.set("message", message);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const authError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  if (authError) {
    return buildSignInRedirect(
      requestUrl,
      "This verification link is invalid or expired. Request a fresh email and try again.",
    );
  }

  const supabase = await createSupabaseRouteHandlerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return buildSignInRedirect(
        requestUrl,
        "This verification link is invalid or expired. Request a fresh email and try again.",
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      return buildSignInRedirect(
        requestUrl,
        "This verification link is invalid or expired. Request a fresh email and try again.",
      );
    }
  } else {
    return buildSignInRedirect(
      requestUrl,
      "We could not complete sign-in from that link. Request a fresh email and try again.",
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildSignInRedirect(
      requestUrl,
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
    return NextResponse.redirect(new URL(nextPath || "/dashboard", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/onboarding", requestUrl.origin));
}
