type TwilioWhatsAppConfig = {
  accountSid: string;
  authToken: string;
  whatsappFrom: string;
};

type NormalizeWhatsAppAddressResult =
  | {
      ok: true;
      e164: string;
      address: string;
    }
  | {
      ok: false;
      error: string;
    };

type TwilioErrorLike = Error & {
  code?: number | string;
  status?: number;
  moreInfo?: string;
};

let hasLoggedTwilioEnvStatus = false;

function normalizePhoneValue(value: string) {
  return value.replace(/[\s()-]/g, "");
}

export function getTwilioWhatsAppConfig(): {
  config: TwilioWhatsAppConfig | null;
  missingVars: string[];
} {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim() ?? "";

  if (!hasLoggedTwilioEnvStatus) {
    console.info("[twilio-whatsapp-env]", {
      hasAccountSid: Boolean(accountSid),
      hasAuthToken: Boolean(authToken),
      hasWhatsAppFrom: Boolean(whatsappFrom),
    });
    hasLoggedTwilioEnvStatus = true;
  }

  const missingVars = [
    !accountSid ? "TWILIO_ACCOUNT_SID" : null,
    !authToken ? "TWILIO_AUTH_TOKEN" : null,
    !whatsappFrom ? "TWILIO_WHATSAPP_FROM" : null,
  ].filter((value): value is string => Boolean(value));

  if (missingVars.length) {
    return {
      config: null,
      missingVars,
    };
  }

  return {
    config: {
      accountSid,
      authToken,
      whatsappFrom,
    },
    missingVars: [],
  };
}

export function normalizeWhatsAppAddress(value: string): NormalizeWhatsAppAddressResult {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      ok: false,
      error: "Phone number is required.",
    };
  }

  const withoutPrefix = trimmedValue.startsWith("whatsapp:")
    ? trimmedValue.slice("whatsapp:".length)
    : trimmedValue;
  const normalizedPhone = normalizePhoneValue(withoutPrefix);

  if (!/^\+\d{8,15}$/.test(normalizedPhone)) {
    return {
      ok: false,
      error: "Phone number must be in E.164 format, for example +919876543210.",
    };
  }

  return {
    ok: true,
    e164: normalizedPhone,
    address: `whatsapp:${normalizedPhone}`,
  };
}

export function maskWhatsAppAddress(value: string) {
  const normalized = normalizeWhatsAppAddress(value);

  if (!normalized.ok) {
    return "invalid";
  }

  const digitsOnly = normalized.e164.slice(1);

  if (digitsOnly.length <= 4) {
    return `whatsapp:${normalized.e164}`;
  }

  return `whatsapp:+${"*".repeat(Math.max(0, digitsOnly.length - 4))}${digitsOnly.slice(-4)}`;
}

export function getTwilioErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: "Unknown Twilio error.",
      code: null,
      status: null,
      moreInfo: null,
    };
  }

  const twilioError = error as TwilioErrorLike;

  return {
    message: twilioError.message,
    code: twilioError.code ?? null,
    status: twilioError.status ?? null,
    moreInfo: twilioError.moreInfo ?? null,
  };
}
