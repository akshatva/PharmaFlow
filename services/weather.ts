export type OrganizationLocation = {
  city?: string | null;
  state?: string | null;
  district?: string | null;
  country?: string | null;
  pincode?: string | null;
};

export type LocalWeatherSnapshot = {
  locationName: string;
  temperatureC: number | null;
  relativeHumidity: number | null;
  weatherCode: number | null;
  conditionLabel: string;
  summary: string;
  isHot: boolean;
  isCold: boolean;
  isHumid: boolean;
  isRainy: boolean;
};

export const REQUIRED_WEATHER_LOCATION_FIELDS = ["city", "state", "country"] as const;

type GeocodingResult = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type ForecastResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
  };
};

const COUNTRY_CODE_LOOKUP: Record<string, string> = {
  india: "IN",
  "united states": "US",
  usa: "US",
  canada: "CA",
  "united kingdom": "GB",
  uk: "GB",
  australia: "AU",
};

function buildGeocodeSearchTerms(location: OrganizationLocation) {
  const city = location.city?.trim();
  const state = location.state?.trim();
  const country = location.country?.trim();
  const pincode = location.pincode?.trim();

  const terms = [city, [city, state].filter(Boolean).join(" "), [city, country].filter(Boolean).join(" ")]
    .map((term) => term?.trim())
    .filter(Boolean) as string[];

  if (!terms.length && pincode) {
    return [pincode];
  }

  return [...new Set(terms)];
}

function getCountryCode(country: string | null | undefined) {
  if (!country) {
    return null;
  }

  return COUNTRY_CODE_LOOKUP[country.trim().toLowerCase()] ?? null;
}

function roundWeatherValue(value: number | null) {
  return value === null ? null : Number(value.toFixed(1));
}

function getWeatherConditionLabel(weatherCode: number | null) {
  if (weatherCode === null) {
    return "Unknown";
  }

  if ([0, 1].includes(weatherCode)) {
    return "Clear";
  }

  if ([2, 3].includes(weatherCode)) {
    return "Cloudy";
  }

  if ([45, 48].includes(weatherCode)) {
    return "Fog";
  }

  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
      weatherCode,
    )
  ) {
    return "Rain";
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return "Snow";
  }

  return "Mixed";
}

function isRainyWeatherCode(weatherCode: number | null) {
  return weatherCode !== null &&
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode);
}

export function getMissingWeatherLocationFields(
  location: OrganizationLocation | null | undefined,
) {
  if (!location) {
    return [...REQUIRED_WEATHER_LOCATION_FIELDS];
  }

  return REQUIRED_WEATHER_LOCATION_FIELDS.filter((field) => {
    const value = location[field];
    return typeof value !== "string" || !value.trim();
  });
}

export function formatWeatherLocationInput(
  location: OrganizationLocation | null | undefined,
) {
  if (!location) {
    return "Not set";
  }

  const parts = [location.city, location.state, location.country]
    .map((value) => value?.trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "Not set";
}

export async function getLocalWeatherSnapshot(
  location: OrganizationLocation | null | undefined,
): Promise<LocalWeatherSnapshot | null> {
  if (!location) {
    console.info("[pharmaflow-weather] skipped: no organization location");
    return null;
  }

  const geocodeTerms = buildGeocodeSearchTerms(location);
  const countryCode = getCountryCode(location.country);

  if (!geocodeTerms.length) {
    console.info("[pharmaflow-weather] skipped: location fields empty", { location });
    return null;
  }

  try {
    let bestMatch: GeocodingResult | null = null;
    let geocodeUrlUsed: string | null = null;

    for (const term of geocodeTerms) {
      const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geocodeUrl.searchParams.set("name", term);
      geocodeUrl.searchParams.set("count", "1");
      geocodeUrl.searchParams.set("language", "en");
      geocodeUrl.searchParams.set("format", "json");

      if (countryCode) {
        geocodeUrl.searchParams.set("countryCode", countryCode);
      }

      geocodeUrlUsed = geocodeUrl.toString();
      console.info("[pharmaflow-weather] geocode request", {
        url: geocodeUrlUsed,
      });

      const geocodeResponse = await fetch(geocodeUrlUsed, {
        cache: "no-store",
      });

      if (!geocodeResponse.ok) {
        console.info("[pharmaflow-weather] geocode failed", {
          status: geocodeResponse.status,
          url: geocodeUrlUsed,
        });
        continue;
      }

      const geocodePayload = (await geocodeResponse.json()) as GeocodingResponse;
      bestMatch = geocodePayload.results?.[0] ?? null;

      console.info("[pharmaflow-weather] geocode response", {
        url: geocodeUrlUsed,
        found: Boolean(bestMatch),
        resultCount: geocodePayload.results?.length ?? 0,
        name: bestMatch?.name ?? null,
        admin1: bestMatch?.admin1 ?? null,
        country: bestMatch?.country ?? null,
        latitude: bestMatch?.latitude ?? null,
        longitude: bestMatch?.longitude ?? null,
      });

      if (bestMatch) {
        break;
      }
    }

    if (!bestMatch) {
      console.info("[pharmaflow-weather] skipped: no geocode match", {
        location,
        geocodeTerms,
      });
      return null;
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(bestMatch.latitude));
    forecastUrl.searchParams.set("longitude", String(bestMatch.longitude));
    forecastUrl.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,weather_code",
    );
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("forecast_days", "1");

    console.info("[pharmaflow-weather] forecast request", {
      url: forecastUrl.toString(),
      locationName: bestMatch.name,
      latitude: bestMatch.latitude,
      longitude: bestMatch.longitude,
    });

    const forecastResponse = await fetch(forecastUrl.toString(), {
      cache: "no-store",
    });

    if (!forecastResponse.ok) {
      console.info("[pharmaflow-weather] forecast failed", {
        status: forecastResponse.status,
        url: forecastUrl.toString(),
      });
      return null;
    }

    const forecastPayload = (await forecastResponse.json()) as ForecastResponse;
    const current = forecastPayload.current;

    if (!current) {
      return null;
    }

    const temperatureC =
      typeof current.temperature_2m === "number"
        ? roundWeatherValue(current.temperature_2m)
        : null;
    const relativeHumidity =
      typeof current.relative_humidity_2m === "number"
        ? roundWeatherValue(current.relative_humidity_2m)
        : null;
    const weatherCode =
      typeof current.weather_code === "number" ? current.weather_code : null;
    const conditionLabel = getWeatherConditionLabel(weatherCode);
    const locationName = [bestMatch.name, bestMatch.admin1 ?? location.state, bestMatch.country]
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");

    const summaryParts = [
      temperatureC !== null ? `${temperatureC}°C` : null,
      conditionLabel,
      relativeHumidity !== null ? `${relativeHumidity}% humidity` : null,
    ].filter(Boolean);

    const fallbackLocationLabel = [
      location.city?.trim(),
      location.state?.trim(),
      location.country?.trim(),
      location.pincode?.trim(),
    ]
      .filter(Boolean)
      .join(", ");

    const snapshot = {
      locationName: locationName || fallbackLocationLabel,
      temperatureC,
      relativeHumidity,
      weatherCode,
      conditionLabel,
      summary: summaryParts.join(" · "),
      isHot: temperatureC !== null && temperatureC >= 32,
      isCold: temperatureC !== null && temperatureC <= 18,
      isHumid: relativeHumidity !== null && relativeHumidity >= 80,
      isRainy: isRainyWeatherCode(weatherCode),
    };

    console.info("[pharmaflow-weather] weather snapshot", snapshot);

    return snapshot;
  } catch (error) {
    console.error("[pharmaflow-weather] unexpected failure", error);
    return null;
  }
}
