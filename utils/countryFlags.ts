/**
 * Converts ISO 3166-1 alpha-2 country code to flag emoji
 * @param countryCode - Two letter country code (e.g., "US", "ES", "EC")
 * @returns Flag emoji string or empty string if invalid code
 */
export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  // Convert country code to uppercase and get flag emoji
  const code = countryCode.toUpperCase();
  
  // Flag emojis are created by combining regional indicator symbols
  // Each letter A-Z corresponds to Unicode codepoints U+1F1E6 to U+1F1FF
  const codePoints = code
    .split('')
    .map(char => 0x1F1E6 + char.charCodeAt(0) - 'A'.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

/**
 * Gets country name from country code (optional, for tooltips or accessibility)
 * This is a basic implementation with common countries
 */
export function getCountryName(countryCode: string | null | undefined): string {
  if (!countryCode) return '';
  
  const countryNames: Record<string, string> = {
    'US': 'United States',
    'CA': 'Canada',
    'MX': 'Mexico',
    'ES': 'Spain',
    'FR': 'France',
    'DE': 'Germany',
    'IT': 'Italy',
    'UK': 'United Kingdom',
    'GB': 'United Kingdom',
    'BR': 'Brazil',
    'AR': 'Argentina',
    'CL': 'Chile',
    'PE': 'Peru',
    'CO': 'Colombia',
    'EC': 'Ecuador',
    'VE': 'Venezuela',
    'UY': 'Uruguay',
    'PY': 'Paraguay',
    'BO': 'Bolivia',
    'AU': 'Australia',
    'NZ': 'New Zealand',
    'JP': 'Japan',
    'CN': 'China',
    'KR': 'South Korea',
    'IN': 'India',
    'RU': 'Russia',
    'ZA': 'South Africa',
    'EG': 'Egypt',
    'MA': 'Morocco',
    'NG': 'Nigeria',
    'KE': 'Kenya',
    'ET': 'Ethiopia',
    'GH': 'Ghana',
    'TZ': 'Tanzania',
    'UG': 'Uganda',
    'ZW': 'Zimbabwe',
    'BW': 'Botswana',
    'ZM': 'Zambia',
    'MW': 'Malawi',
    'MZ': 'Mozambique',
    'AO': 'Angola',
    'NA': 'Namibia',
    'SZ': 'Eswatini',
    'LS': 'Lesotho'
  };
  
  return countryNames[countryCode.toUpperCase()] || countryCode.toUpperCase();
}