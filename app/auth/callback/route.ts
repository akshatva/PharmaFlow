import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseRouteHandlerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/onboarding", requestUrl.origin));
}
