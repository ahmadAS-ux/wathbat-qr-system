const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const SAUDI_MOBILE_E164_REGEX = /^\+9665\d{8}$/;
const SAUDI_LANDLINE_E164_REGEX = /^\+966[123467]\d{8}$/;

export type PhoneCountry = "SA";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function stripVisualSeparators(value: string): string {
  return value.replace(/[\s().-]/g, "");
}

export function isValidE164Phone(value: string): boolean {
  return E164_PHONE_REGEX.test(value);
}

export function isValidSaudiPhoneE164(value: string): boolean {
  return SAUDI_MOBILE_E164_REGEX.test(value) || SAUDI_LANDLINE_E164_REGEX.test(value);
}

export function normalizePhoneToE164(input: string, defaultCountry: PhoneCountry = "SA"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = stripVisualSeparators(trimmed);

  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  }

  if (candidate.startsWith("+")) {
    candidate = `+${digitsOnly(candidate.slice(1))}`;
  } else {
    const rawDigits = digitsOnly(candidate);
    if (!rawDigits) return null;

    if (defaultCountry === "SA") {
      if (rawDigits.startsWith("966")) {
        candidate = `+${rawDigits}`;
      } else if (rawDigits.startsWith("0")) {
        candidate = `+966${rawDigits.slice(1)}`;
      } else if (/^(5|1|2|3|4|6|7)\d{8}$/.test(rawDigits)) {
        candidate = `+966${rawDigits}`;
      } else {
        candidate = `+${rawDigits}`;
      }
    } else {
      candidate = `+${rawDigits}`;
    }
  }

  if (candidate.startsWith("+9660")) {
    candidate = `+966${candidate.slice(5)}`;
  }

  return isValidE164Phone(candidate) ? candidate : null;
}

export function formatSaudiPhoneForDisplay(value: string): string {
  if (!isValidSaudiPhoneE164(value)) return value;

  const local = value.slice(4);
  return `0${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
