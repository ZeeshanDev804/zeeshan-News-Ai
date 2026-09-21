const DEFAULT_TIMEZONE = "UTC";

const SUPPORTED_PLATFORMS = new Set([
  "website",
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram",
  "facebook",
  "x",
]);

const REGION_TIMEZONES = {
  worldwide: "UTC",

  uk: "Europe/London",
  "united kingdom": "Europe/London",

  usa: "America/New_York",
  us: "America/New_York",
  "united states": "America/New_York",

  europe: "Europe/Berlin",

  germany: "Europe/Berlin",
  france: "Europe/Paris",
  italy: "Europe/Rome",
  spain: "Europe/Madrid",

  "middle east": "Asia/Dubai",
  uae: "Asia/Dubai",
  dubai: "Asia/Dubai",
  saudi: "Asia/Riyadh",
  qatar: "Asia/Qatar",

  pakistan: "Asia/Karachi",
};

const DEFAULT_PUBLISH_WINDOWS = {
  website: {
    startHour: 7,
    endHour: 23,
  },

  youtube: {
    startHour: 9,
    endHour: 22,
  },

  youtube_shorts: {
    startHour: 9,
    endHour: 23,
  },

  tiktok: {
    startHour: 9,
    endHour: 23,
  },

  instagram: {
    startHour: 9,
    endHour: 23,
  },

  facebook: {
    startHour: 8,
    endHour: 22,
  },

  x: {
    startHour: 7,
    endHour: 23,
  },
};

function normalizeText(value, maxLength = 500) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}

function normalizePlatform(value) {
  const platform = String(
    value || "website"
  )
    .trim()
    .toLowerCase();

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(
      `Unsupported publishing platform: ${platform}`
    );
  }

  return platform;
}

function normalizeRegion(value) {
  return String(
    value || "worldwide"
  )
    .trim()
    .toLowerCase();
}

function resolveTimezone(region, timezone) {
  const explicit = normalizeText(
    timezone,
    100
  );

  if (explicit) {
    try {
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone: explicit,
        }
      );

      return explicit;
    } catch {
      throw new Error(
        `Invalid timezone: ${explicit}`
      );
    }
  }

  return (
    REGION_TIMEZONES[
      normalizeRegion(region)
    ] || DEFAULT_TIMEZONE
  );
}

function getDateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,

      year: "numeric",
      month: "2-digit",
      day: "2-digit",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      hourCycle: "h23",

      weekday: "short",
    }
  );

  const parts = formatter.formatToParts(
    date
  );

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return {
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day),
    hour: Number(result.hour),
    minute: Number(result.minute),
    second: Number(result.second),
    weekday: result.weekday,
  };
}

function getTimezoneOffsetMinutes(
  date,
  timezone
) {
  const parts = getDateParts(
    date,
    timezone
  );

  const utcRepresentation = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return (
    (utcRepresentation -
      date.getTime()) /
    60000
  );
}

function zonedDateToUTC(
  {
    year,
    month,
    day,
    hour,
    minute = 0,
    second = 0,
  },
  timezone
) {
  const approximate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    )
  );

  const offset = getTimezoneOffsetMinutes(
    approximate,
    timezone
  );

  return new Date(
    approximate.getTime() -
      offset * 60000
  );
}

function addDays(dateParts, days) {
  const base = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day
    )
  );

  base.setUTCDate(
    base.getUTCDate() + days
  );

  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function isHourInsideWindow(hour, window) {
  return (
    hour >= window.startHour &&
    hour <= window.endHour
  );
}

function getPublishWindow(
  platform,
  customWindow
) {
  if (
    customWindow &&
    Number.isInteger(
      customWindow.startHour
    ) &&
    Number.isInteger(
      customWindow.endHour
    )
  ) {
    const startHour = Math.min(
      23,
      Math.max(
        0,
        customWindow.startHour
      )
    );

    const endHour = Math.min(
      23,
      Math.max(
        0,
        customWindow.endHour
      )
    );

    return {
      startHour,
      endHour:
        endHour < startHour
          ? startHour
          : endHour,
    };
  }

  return (
    DEFAULT_PUBLISH_WINDOWS[
      platform
    ] ||
    DEFAULT_PUBLISH_WINDOWS.website
  );
}

function createScheduleCandidate(
  dateParts,
  hour,
  minute,
  timezone
) {
  return zonedDateToUTC(
    {
      year: dateParts.year,
      month: dateParts.month,
      day: dateParts.day,
      hour,
      minute,
      second: 0,
    },
    timezone
  );
}

function getNextWindowDate({
  fromDate,
  timezone,
  platform,
  publishWindow,
}) {
  const window = getPublishWindow(
    platform,
    publishWindow
  );

  let current = new Date(fromDate);

  for (
    let dayOffset = 0;
    dayOffset < 8;
    dayOffset++
  ) {
    const parts = getDateParts(
      current,
      timezone
    );

    const startCandidate =
      createScheduleCandidate(
        parts,
        window.startHour,
        0,
        timezone
      );

    const endCandidate =
      createScheduleCandidate(
        parts,
        window.endHour,
        59,
        timezone
      );

    if (current <= startCandidate) {
      return startCandidate;
    }

    if (
      current >= startCandidate &&
      current <= endCandidate
    ) {
      return current;
    }

    const next = addDays(
      parts,
      1
    );

    const nextCandidate =
      createScheduleCandidate(
        next,
        window.startHour,
        0,
        timezone
      );

    if (nextCandidate > current) {
      current = nextCandidate;
    } else {
      current = new Date(
        current.getTime() +
          24 * 60 * 60 * 1000
      );
    }
  }

  return new Date(current);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeScheduledTime({
  scheduledFor,
  platform,
  region,
  timezone,
  publishWindow,
}) {
  const requested =
    normalizeDate(scheduledFor);

  if (!requested) {
    return calculateNextPublishTime({
      fromDate: new Date(),
      platform,
      region,
      timezone,
      publishWindow,
    });
  }

  const safeTimezone =
    resolveTimezone(
      region,
      timezone
    );

  const window =
    getPublishWindow(
      platform,
      publishWindow
    );

  const local =
    getLocalTime(
      requested,
      safeTimezone
    );

  if (
    isHourInsideWindow(
      local.hour,
      window
    )
  ) {
    return {
      success: true,
      publishAt:
        requested.toISOString(),
      platform,
      region:
        normalizeRegion(region),
      timezone:
        safeTimezone,
      localTime: local,
      window,
      adjusted: false,
    };
  }

  return calculateNextPublishTime({
    fromDate: requested,
    platform,
    region,
    timezone: safeTimezone,
    publishWindow,
  });
}

export function getRegionTimezone(region) {
  return resolveTimezone(region);
}

export function getSupportedRegions() {
  return Object.keys(
    REGION_TIMEZONES
  );
}

export function getSupportedPlatforms() {
  return Array.from(
    SUPPORTED_PLATFORMS
  );
}

export function getDefaultPublishWindow(
  platform
) {
  const normalized =
    normalizePlatform(platform);

  return {
    ...getPublishWindow(
      normalized
    ),
  };
}

export function getLocalTime(
  date,
  timezone
) {
  const safeTimezone =
    resolveTimezone(
      "worldwide",
      timezone
    );

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw new Error(
      "Invalid date"
    );
  }

  const parts =
    getDateParts(
      parsedDate,
      safeTimezone
    );

  return {
    timezone: safeTimezone,

    year: parts.year,
    month: parts.month,
    day: parts.day,

    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,

    weekday: parts.weekday,
  };
}

export function isWithinPublishWindow({
  date = new Date(),
  platform = "website",
  region = "worldwide",
  timezone = null,
  publishWindow = null,
} = {}) {
  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  const safeTimezone =
    resolveTimezone(
      region,
      timezone
    );

  const window =
    getPublishWindow(
      normalizedPlatform,
      publishWindow
    );

  const local =
    getLocalTime(
      date,
      safeTimezone
    );

  return {
    allowed:
      isHourInsideWindow(
        local.hour,
        window
      ),

    timezone:
      safeTimezone,

    localTime:
      local,

    window,
  };
}

export function calculateNextPublishTime({
  fromDate = new Date(),
  platform = "website",
  region = "worldwide",
  timezone = null,
  publishWindow = null,
} = {}) {
  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  const safeTimezone =
    resolveTimezone(
      region,
      timezone
    );

  const sourceDate =
    normalizeDate(
      fromDate
    );

  if (!sourceDate) {
    throw new Error(
      "Invalid fromDate"
    );
  }

  const next =
    getNextWindowDate({
      fromDate: sourceDate,
      timezone:
        safeTimezone,
      platform:
        normalizedPlatform,
      publishWindow,
    });

  return {
    success: true,

    publishAt:
      next.toISOString(),

    platform:
      normalizedPlatform,

    region:
      normalizeRegion(
        region
      ),

    timezone:
      safeTimezone,

    localTime:
      getLocalTime(
        next,
        safeTimezone
      ),

    window:
      getPublishWindow(
        normalizedPlatform,
        publishWindow
      ),
  };
}

export function createPublishingSchedule({
  contentId = null,
  title = "",
  platform = "website",
  region = "worldwide",
  timezone = null,
  scheduledFor = null,
  publishWindow = null,
  autoPublish = false,
} = {}) {
  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  const normalizedRegion =
    normalizeRegion(
      region
    );

  const safeTimezone =
    resolveTimezone(
      normalizedRegion,
      timezone
    );

  const now = new Date();

  const schedule =
    normalizeScheduledTime({
      scheduledFor,
      platform:
        normalizedPlatform,
      region:
        normalizedRegion,
      timezone:
        safeTimezone,
      publishWindow,
    });

  const publishAt =
    new Date(
      schedule.publishAt
    );

  return {
    success: true,

    contentId,

    title:
      normalizeText(
        title,
        1000
      ),

    platform:
      normalizedPlatform,

    region:
      normalizedRegion,

    timezone:
      safeTimezone,

    scheduledFor:
      publishAt.toISOString(),

    localScheduledFor:
      getLocalTime(
        publishAt,
        safeTimezone
      ),

    autoPublish:
      Boolean(
        autoPublish
      ),

    status:
      autoPublish
        ? "scheduled"
        : "ceo_approval",

    scheduleAdjusted:
      Boolean(
        schedule.adjusted
      ),

    createdAt:
      now.toISOString(),
  };
}

export function getRegionalPublishingPlan({
  platform = "website",
  regions = [
    "uk",
    "usa",
    "europe",
    "middle east",
  ],
  fromDate = new Date(),
} = {}) {
  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  const uniqueRegions =
    Array.from(
      new Set(
        Array.isArray(regions)
          ? regions
              .map(
                (region) =>
                  normalizeRegion(
                    region
                  )
              )
              .filter(Boolean)
          : []
      )
    );

  return uniqueRegions.map(
    (region) => {
      const timezone =
        resolveTimezone(
          region
        );

      const schedule =
        calculateNextPublishTime({
          fromDate,
          platform:
            normalizedPlatform,
          region,
          timezone,
        });

      return {
        region,
        timezone,
        platform:
          normalizedPlatform,
        publishAt:
          schedule.publishAt,
        localTime:
          schedule.localTime,
      };
    }
  );
}

export function getSchedulerStatus() {
  return {
    enabled: true,

    supportedPlatforms:
      getSupportedPlatforms(),

    supportedRegions:
      getSupportedRegions(),

    defaultWindows:
      Object.fromEntries(
        Object.entries(
          DEFAULT_PUBLISH_WINDOWS
        ).map(
          ([platform, window]) => [
            platform,
            {
              ...window,
            },
          ]
        )
      ),

    generatedAt:
      new Date().toISOString(),
  };
}