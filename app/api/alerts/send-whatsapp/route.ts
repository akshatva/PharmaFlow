import twilio from "twilio";
import { NextResponse } from "next/server";

import { getAlertsSnapshotForOrganization, formatAlertDate } from "@/lib/alerts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTwilioErrorDetails,
  getTwilioWhatsAppConfig,
  maskWhatsAppAddress,
  normalizeWhatsAppAddress,
} from "@/lib/whatsapp";

export const runtime = "nodejs";

function buildWhatsAppAlertMessage({
  organizationName,
  lowStockRows,
  nearExpiryRows,
  urgentReorderRows,
}: {
  organizationName: string;
  lowStockRows: Awaited<ReturnType<typeof getAlertsSnapshotForOrganization>>["lowStockRows"];
  nearExpiryRows: Awaited<ReturnType<typeof getAlertsSnapshotForOrganization>>["nearExpiryRows"];
  urgentReorderRows: Awaited<ReturnType<typeof getAlertsSnapshotForOrganization>>["urgentReorderRows"];
}) {
  const sections = [`PharmaFlow Alerts`, organizationName];

  sections.push(
    lowStockRows.length
      ? `Low stock:\n${lowStockRows
          .slice(0, 5)
          .map((row) => `- ${row.medicineName} (${row.quantity} left)`)
          .join("\n")}`
      : "Low stock:\n- None today",
  );

  sections.push(
    nearExpiryRows.length
      ? `Expiring soon:\n${nearExpiryRows
          .slice(0, 5)
          .map(
            (row) =>
              `- ${row.medicineName} (${formatAlertDate(row.expiryDate)})`,
          )
          .join("\n")}`
      : "Expiring soon:\n- None today",
  );

  sections.push(
    urgentReorderRows.length
      ? `Reorder urgently:\n${urgentReorderRows
          .slice(0, 5)
          .map(
            (row) =>
              `- ${row.medicineName} (${row.currentStock} left, ${row.daysOfStockLeft.toFixed(1)} days cover)`,
          )
          .join("\n")}`
      : "Reorder urgently:\n- None today",
  );

  return sections.join("\n\n");
}

async function resolveWhatsAppRequestContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("organization_id, organizations(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("phone_number, whatsapp_enabled")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (membershipError || !membership) {
    return {
      errorResponse: NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "development"
              ? `Unable to resolve your organization: ${membershipError?.message ?? "No membership found."}`
              : "Unable to resolve your organization.",
        },
        { status: 400 },
      ),
    };
  }

  if (profileError) {
    console.error("Unable to load WhatsApp profile settings", profileError);

    return {
      errorResponse: NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to load your profile: ${profileError.message}`
            : "Unable to load your profile.",
      },
      { status: 400 },
    ),
    };
  }

  if (!profile?.whatsapp_enabled) {
    return {
      errorResponse: NextResponse.json(
        { error: "WhatsApp alerts are disabled for your profile." },
        { status: 400 },
      ),
    };
  }

  if (!profile.phone_number) {
    return {
      errorResponse: NextResponse.json(
        { error: "No WhatsApp phone number is configured for your profile." },
        { status: 400 },
      ),
    };
  }

  return {
    supabase,
    membership,
    profile,
    errorResponse: null,
  };
}

async function sendWhatsAppMessage({
  body,
  rawTo,
}: {
  body: string;
  rawTo: string;
}) {
  const { config, missingVars } = getTwilioWhatsAppConfig();

  if (!config) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: `WhatsApp sender is not configured. Missing: ${missingVars.join(", ")}.`,
        },
        { status: 500 },
      ),
    };
  }

  const normalizedFrom = normalizeWhatsAppAddress(config.whatsappFrom);
  if (!normalizedFrom.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: `TWILIO_WHATSAPP_FROM is invalid: ${normalizedFrom.error}`,
        },
        { status: 500 },
      ),
    };
  }

  const normalizedTo = normalizeWhatsAppAddress(rawTo);
  if (!normalizedTo.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: `Recipient phone number is invalid: ${normalizedTo.error}`,
        },
        { status: 400 },
      ),
    };
  }

  console.info("[twilio-whatsapp-send]", {
    from: normalizedFrom.address,
    to: maskWhatsAppAddress(normalizedTo.address),
  });

  const client = twilio(config.accountSid, config.authToken);

  try {
    const message = await client.messages.create({
      from: normalizedFrom.address,
      to: normalizedTo.address,
      body,
    });

    console.info("[twilio-whatsapp-success]", {
      sid: message.sid,
      status: message.status,
      to: maskWhatsAppAddress(normalizedTo.address),
    });

    return {
      ok: true as const,
      sid: message.sid,
      status: message.status,
      to: normalizedTo.address,
    };
  } catch (error) {
    const details = getTwilioErrorDetails(error);

    console.error("[twilio-whatsapp-error]", details);

    return {
      ok: false as const,
      response: NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to send WhatsApp alerts: ${details.message}`
            : "Unable to send WhatsApp alerts.",
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
    ),
    };
  }
}

export async function POST() {
  const context = await resolveWhatsAppRequestContext();

  if (context.errorResponse) {
    return context.errorResponse;
  }

  const { supabase, membership, profile } = context;

  const snapshot = await getAlertsSnapshotForOrganization(
    supabase,
    membership.organization_id,
  );

  if (snapshot.dataError) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to load WhatsApp alert data: ${snapshot.dataError.message}`
            : "Unable to load WhatsApp alert data.",
      },
      { status: 500 },
    );
  }

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;
  const organizationName = organization?.name ?? "Your organization";

  const messageBody = buildWhatsAppAlertMessage({
    organizationName,
    lowStockRows: snapshot.lowStockRows,
    nearExpiryRows: snapshot.nearExpiryRows,
    urgentReorderRows: snapshot.urgentReorderRows,
  });

  const sendResult = await sendWhatsAppMessage({
    body: messageBody,
    rawTo: profile.phone_number,
  });

  if (!sendResult.ok) {
    return sendResult.response;
  }

  return NextResponse.json({
    success: true,
    message: `WhatsApp alerts sent successfully to ${maskWhatsAppAddress(sendResult.to)}.`,
    sid: sendResult.sid,
    status: sendResult.status,
  });
}
