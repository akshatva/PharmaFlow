import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import { getAlertsSnapshotForOrganization, formatAlertDate } from "@/lib/alerts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const secure = String(process.env.SMTP_SECURE ?? "").trim() === "true" || port === 465;

  if (!host || !Number.isFinite(port) || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    secure,
  };
}

function buildDigestHtml({
  organizationName,
  lowStockRows,
  nearExpiryRows,
}: {
  organizationName: string;
  lowStockRows: Awaited<ReturnType<typeof getAlertsSnapshotForOrganization>>["lowStockRows"];
  nearExpiryRows: Awaited<ReturnType<typeof getAlertsSnapshotForOrganization>>["nearExpiryRows"];
}) {
  const lowStockHtml = lowStockRows.length
    ? `<ul>${lowStockRows
        .map(
          (row) =>
            `<li><strong>${row.medicineName}</strong> - batch ${row.batchNumber} - quantity ${row.quantity}</li>`,
        )
        .join("")}</ul>`
    : "<p>No low stock items today.</p>";

  const nearExpiryHtml = nearExpiryRows.length
    ? `<ul>${nearExpiryRows
        .map(
          (row) =>
            `<li><strong>${row.medicineName}</strong> - batch ${row.batchNumber} - expires ${formatAlertDate(row.expiryDate)}</li>`,
        )
        .join("")}</ul>`
    : "<p>No near-expiry items today.</p>";

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">PharmaFlow Daily Alerts Digest</h2>
      <p style="margin-top: 0;">Organization: <strong>${organizationName}</strong></p>
      <h3>Low stock items</h3>
      ${lowStockHtml}
      <h3>Near expiry items</h3>
      ${nearExpiryHtml}
    </div>
  `;
}

function buildDigestText({
  organizationName,
  lowStockRows,
  nearExpiryRows,
}: {
  organizationName: string;
  lowStockRows: Awaited<ReturnType<typeof getAlertsSnapshotForOrganization>>["lowStockRows"];
  nearExpiryRows: Awaited<ReturnType<typeof getAlertsSnapshotForOrganization>>["nearExpiryRows"];
}) {
  const lowStockText = lowStockRows.length
    ? lowStockRows
        .map((row) => `- ${row.medicineName} | batch ${row.batchNumber} | quantity ${row.quantity}`)
        .join("\n")
    : "No low stock items today.";

  const nearExpiryText = nearExpiryRows.length
    ? nearExpiryRows
        .map(
          (row) =>
            `- ${row.medicineName} | batch ${row.batchNumber} | expires ${formatAlertDate(row.expiryDate)}`,
        )
        .join("\n")
    : "No near-expiry items today.";

  return `PharmaFlow Daily Alerts Digest

Organization: ${organizationName}

Low stock items
${lowStockText}

Near expiry items
${nearExpiryText}
`;
}

export async function POST() {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    return NextResponse.json(
      {
        error:
          "Email sender is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
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
        .select("email, alerts_email_enabled")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (membershipError || !membership) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to resolve your organization: ${membershipError?.message ?? "No membership found."}`
            : "Unable to resolve your organization.",
      },
      { status: 400 },
    );
  }

  if (profileError) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to load your profile: ${profileError.message}`
            : "Unable to load your profile.",
      },
      { status: 400 },
    );
  }

  if (profile && profile.alerts_email_enabled === false) {
    return NextResponse.json(
      { error: "Alerts email is disabled for your profile." },
      { status: 400 },
    );
  }

  const recipientEmail = profile?.email ?? user.email;

  if (!recipientEmail) {
    return NextResponse.json(
      { error: "No destination email was found for your account." },
      { status: 400 },
    );
  }

  const snapshot = await getAlertsSnapshotForOrganization(
    supabase,
    membership.organization_id,
  );

  if (snapshot.dataError) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to load alerts digest data: ${snapshot.dataError.message}`
            : "Unable to load alerts digest data.",
      },
      { status: 500 },
    );
  }

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;
  const organizationName = organization?.name ?? "Your organization";

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: smtpConfig.from,
      to: recipientEmail,
      subject: `PharmaFlow Alerts Digest - ${organizationName}`,
      html: buildDigestHtml({
        organizationName,
        lowStockRows: snapshot.lowStockRows,
        nearExpiryRows: snapshot.nearExpiryRows,
      }),
      text: buildDigestText({
        organizationName,
        lowStockRows: snapshot.lowStockRows,
        nearExpiryRows: snapshot.nearExpiryRows,
      }),
    });
  } catch (error) {
    console.error("Unable to send alerts digest", error);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? `Unable to send alerts digest: ${error.message}`
            : "Unable to send alerts digest.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: `Alerts digest sent to ${recipientEmail}.`,
  });
}
