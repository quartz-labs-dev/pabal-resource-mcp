export const GEMINI_IMAGE_MODEL_PRESETS = {
  flash: "gemini-3.1-flash-image-preview",
  pro: "gemini-3-pro-image-preview",
} as const;

export type GeminiImageModelPreference =
  keyof typeof GEMINI_IMAGE_MODEL_PRESETS;

export const GEMINI_IMAGE_MODEL_VALUES = Object.keys(
  GEMINI_IMAGE_MODEL_PRESETS
) as [GeminiImageModelPreference, ...GeminiImageModelPreference[]];

const RETRYABLE_STATUS_CODES = new Set([429, 500, 503, 504]);

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function getDefaultModelOrder(
  preference: GeminiImageModelPreference
): [string, string] {
  if (preference === "pro") {
    return [
      GEMINI_IMAGE_MODEL_PRESETS.pro,
      GEMINI_IMAGE_MODEL_PRESETS.flash,
    ];
  }
  return [
    GEMINI_IMAGE_MODEL_PRESETS.flash,
    GEMINI_IMAGE_MODEL_PRESETS.pro,
  ];
}

export function getGeminiImageModelCandidates(
  preference: GeminiImageModelPreference = "flash"
): string[] {
  const defaultOrder = getDefaultModelOrder(preference);
  const preferredModel = defaultOrder[0];
  const envModelOverride = process.env.GEMINI_IMAGE_MODEL?.trim();
  const fallbackModels = parseCsv(process.env.GEMINI_IMAGE_FALLBACK_MODELS);

  const orderedModels = [
    preferredModel,
    ...(envModelOverride ? [envModelOverride] : []),
    ...defaultOrder,
    ...fallbackModels,
  ];

  return Array.from(
    new Set(orderedModels.filter((model): model is string => Boolean(model)))
  );
}

export function getGeminiErrorMessage(error: unknown): string {
  const defaultMessage = error instanceof Error ? error.message : String(error);
  const normalizedMessage = defaultMessage.replace(/^exception\s*/i, "").trim();

  try {
    const parsed = JSON.parse(normalizedMessage);
    const apiMessage = parsed?.error?.message;
    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage.trim();
    }
  } catch {
    // Ignore parse failures; return the normalized message.
  }

  return normalizedMessage || "Unknown Gemini API error";
}

export function shouldTryNextGeminiImageModel(error: unknown): boolean {
  const status = getStatusCode(error);
  if (status && RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }

  const message = getGeminiErrorMessage(error).toLowerCase();
  return (
    message.includes("high demand") ||
    message.includes("temporarily unavailable") ||
    message.includes("try again later") ||
    message.includes("overloaded") ||
    message.includes("resource_exhausted") ||
    message.includes("unavailable")
  );
}
