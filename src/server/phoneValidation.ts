/**
 * Authoritative South African and E.164 Telephone / SIM Number Validation Utility
 * Supports:
 * - South African local format: 082 123 4567, 0711234567, etc. (normalized to +27821234567)
 * - South African international format: +27 82 123 4567, 27821234567
 * - International standard E.164: +[country_code][subscriber_number] (8 to 15 digits total)
 */

export interface PhoneValidationResult {
  valid: boolean;
  normalized?: string;
  formatted?: string;
  error?: string;
}

export function validateAndNormalizePhoneNumber(phone: string | null | undefined): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      valid: false,
      error: 'Telephone / SIM number is required.'
    };
  }

  const clean = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (clean.length < 8) {
    return {
      valid: false,
      error: 'Telephone number is too short. Minimum 9 digits required.'
    };
  }

  // 1. South African local format: 0XXXXXXXXX (10 digits starting with 0[1-9])
  if (/^0[1-9]\d{8}$/.test(clean)) {
    const normalized = `+27${clean.slice(1)}`;
    return {
      valid: true,
      normalized,
      formatted: formatDisplayPhoneNumber(normalized)
    };
  }

  // 2. South African format without leading '+': 27XXXXXXXXX (11 digits starting with 27[1-9])
  if (/^27[1-9]\d{8}$/.test(clean)) {
    const normalized = `+${clean}`;
    return {
      valid: true,
      normalized,
      formatted: formatDisplayPhoneNumber(normalized)
    };
  }

  // 3. South African international format: +27XXXXXXXXX (12 chars starting with +27[1-9])
  if (/^\+27[1-9]\d{8}$/.test(clean)) {
    return {
      valid: true,
      normalized: clean,
      formatted: formatDisplayPhoneNumber(clean)
    };
  }

  // 4. General International E.164 format: +[country_code][national_number] (7 to 15 digits)
  if (/^\+[1-9]\d{6,14}$/.test(clean)) {
    return {
      valid: true,
      normalized: clean,
      formatted: clean
    };
  }

  return {
    valid: false,
    error: 'Invalid SIM / telephone number format. Please provide a valid South African (+27XXXXXXXXX / 0XXXXXXXXX) or international E.164 number.'
  };
}

export function formatDisplayPhoneNumber(phone?: string | null): string {
  if (!phone) return 'N/A';
  const clean = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  if (clean.startsWith('+27') && clean.length === 12) {
    // Format: +27 82 123 4567
    return `+27 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  if (clean.startsWith('0') && clean.length === 10) {
    // Format: 082 123 4567
    return `0${clean.slice(1, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return phone;
}
