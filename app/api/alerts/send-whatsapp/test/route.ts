import twilio from "twilio";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTwilioErrorDetails,
  getTwilioWhatsAppConfig,
  maskWhatsAppAddress,
  normalizeWhatsAppAddress,
} from "@/lib/whatsapp";

export const runtime = "nodejs";

// WhatsApp sandbox checklist:
// 1. Activate the Twilio WhatsApp Sandbox.
// 2. Join it by sending `join <sandbox code>` to the Twilio sandbox WhatsApp number.
// 3. Use WhatsApp E.164 numbers like `whatsapp:+14155238886` and `whatsapp:+919876543210`.
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "WhatsApp test route is only available in development." },
      { status: 403 },
    );
  }

  const { config, missingVars } = getTwilioWhatsAppConfig();

  if (!config) {
    return NextResponse.json(
      {
        error: `WhatsApp sender is not configured. Missing: ${missingVars.join(", ")}.`,
      },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("phone_number")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to load profile for WhatsApp test: ${profileError.message}`
            : "Unable to load profile for WhatsApp test.",
      },
      { status: 400 },
    );
  }

  if (!profile?.phone_number) {
    return NextResponse.json(
      { error: "No phone_number is configured on your profile." },
      { status: 400 },
    );
  }

  const normalizedFrom = normalizeWhatsAppAddress(config.whatsappFrom);
  const normalizedTo = normalizeWhatsAppAddress(profile.phone_number);

  if (!normalizedFrom.ok) {
    return NextResponse.json(
      {
        error: `TWILIO_WHATSAPP_FROM is invalid: ${normalizedFrom.error}`,
      },
      { status: 500 },
    );
  }

  if (!normalizedTo.ok) {
    return NextResponse.json(
      {
        error: `Profile phone number is invalid: ${normalizedTo.error}`,
      },
      { status: 400 },
    );
  }

  console.info("[twilio-whatsapp-test]", {
    from: normalizedFrom.address,
    to: maskWhatsAppAddress(normalizedTo.address),
  });

  const client = twilio(config.accountSid, config.authToken);

  try {
    const message = await client.messages.create({
      from: normalizedFrom.address,
      to: normalizedTo.address,
      body: "PharmaFlow WhatsApp test message. Your Twilio WhatsApp setup is working.",
    });

    console.info("[twilio-whatsapp-test-success]", {
      sid: message.sid,
      status: message.status,
    });

    return NextResponse.json({
      success: true,
      message: "WhatsApp test message sent successfully.",
      sid: message.sid,
      status: message.status,
    });
  } catch (error) {
    const details = getTwilioErrorDetails(error);

    console.error("[twilio-whatsapp-test-error]", details);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to send WhatsApp test message: ${details.message}`
            : "Unable to send WhatsApp test message.",
        details:
          process.env.NODE_ENV === "development"
            ? {
                code: details.code,
                status: details.status,
                moreInfo: details.moreInfo,
              }
            : undefined,
      },
      { status: 500 },
    );
  }
}
