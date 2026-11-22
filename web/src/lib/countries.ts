/** Display names for the team codes used on cards. */
export const COUNTRY_NAMES: Record<string, string> = {
  IND: 'India',
  AUS: 'Australia',
  NZ: 'New Zealand',
  ENG: 'England',
  SA: 'South Africa',
  SL: 'Sri Lanka',
  BAN: 'Bangladesh',
  AFG: 'Afghanistan',
  WI: 'West Indies',
  PAK: 'Pakistan',
}

export function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code
}
