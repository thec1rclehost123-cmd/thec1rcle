export const PHONE_NUMBER_INPUT_ERROR =
  'Enter a valid phone number with country code, like +91 98765 43210.';

export type PhoneCountry = {
  iso2: string;
  name: string;
  dialCode: string;
  localDigits: number;
  example: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso2: 'IN', name: 'India', dialCode: '+91', localDigits: 10, example: '98765 43210' },
  { iso2: 'US', name: 'United States', dialCode: '+1', localDigits: 10, example: '555 123 4567' },
  { iso2: 'CA', name: 'Canada', dialCode: '+1', localDigits: 10, example: '416 555 0199' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44', localDigits: 10, example: '7400 123456' },
  {
    iso2: 'AE',
    name: 'United Arab Emirates',
    dialCode: '+971',
    localDigits: 9,
    example: '50 123 4567',
  },
  { iso2: 'SG', name: 'Singapore', dialCode: '+65', localDigits: 8, example: '8123 4567' },
  { iso2: 'AU', name: 'Australia', dialCode: '+61', localDigits: 9, example: '412 345 678' },
  { iso2: 'DE', name: 'Germany', dialCode: '+49', localDigits: 10, example: '1512 345678' },
  { iso2: 'FR', name: 'France', dialCode: '+33', localDigits: 9, example: '6 12 34 56 78' },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export function getLocalPhoneDigits(value: string, country: PhoneCountry = DEFAULT_PHONE_COUNTRY) {
  const trimmed = value.trim();
  const digits = digitsOnly(trimmed);
  const countryDigits = digitsOnly(country.dialCode);

  if (digits.startsWith(countryDigits) && digits.length > country.localDigits) {
    return digits.slice(countryDigits.length);
  }

  return digits;
}

export function normalizePhoneNumber(value: string, country: PhoneCountry = DEFAULT_PHONE_COUNTRY) {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return '';

  return `${country.dialCode}${getLocalPhoneDigits(value, country)}`;
}

export function getPhoneNumberInputError(
  value: string,
  country: PhoneCountry = DEFAULT_PHONE_COUNTRY,
) {
  const digits = getLocalPhoneDigits(value, country);

  if (!value.trim()) {
    return 'Enter your phone number.';
  }

  if (digits.length < country.localDigits) {
    return `Enter a ${country.localDigits}-digit phone number for ${country.name}.`;
  }

  if (digits.length > country.localDigits) {
    return `That number is too long for ${country.name}. Enter ${country.localDigits} digits after ${country.dialCode}.`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(value, country))) {
    return PHONE_NUMBER_INPUT_ERROR;
  }

  return null;
}
