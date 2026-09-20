export const COUNTRIES = Object.freeze([
  {
    code: "ES",
    name: "España",
    flag: "🇪🇸",
    primary: 0xffc400,
    accent: 0xe3342f,
  },
  {
    code: "MX",
    name: "México",
    flag: "🇲🇽",
    primary: 0x1f9d55,
    accent: 0xe3342f,
  },
  {
    code: "AR",
    name: "Argentina",
    flag: "🇦🇷",
    primary: 0x72c7f0,
    accent: 0xffffff,
  },
  {
    code: "CO",
    name: "Colombia",
    flag: "🇨🇴",
    primary: 0xffdd00,
    accent: 0x1f55a5,
  },
  {
    code: "BR",
    name: "Brasil",
    flag: "🇧🇷",
    primary: 0x22a447,
    accent: 0xffdf00,
  },
  {
    code: "US",
    name: "Estados Unidos",
    flag: "🇺🇸",
    primary: 0x3c5aa6,
    accent: 0xd94452,
  },
  {
    code: "GB",
    name: "Reino Unido",
    flag: "🇬🇧",
    primary: 0x27408b,
    accent: 0xe3342f,
  },
  {
    code: "FR",
    name: "Francia",
    flag: "🇫🇷",
    primary: 0x3156a3,
    accent: 0xe53945,
  },
  {
    code: "DE",
    name: "Alemania",
    flag: "🇩🇪",
    primary: 0x202020,
    accent: 0xffce00,
  },
  {
    code: "IT",
    name: "Italia",
    flag: "🇮🇹",
    primary: 0x2e9d5b,
    accent: 0xe4404f,
  },
  {
    code: "JP",
    name: "Japón",
    flag: "🇯🇵",
    primary: 0xffffff,
    accent: 0xe33946,
  },
  {
    code: "KR",
    name: "Corea del Sur",
    flag: "🇰🇷",
    primary: 0xf5f5f5,
    accent: 0x3156a3,
  },
] as const);

export type CountryCode = (typeof COUNTRIES)[number]["code"];
export type Country = (typeof COUNTRIES)[number];

export const DEFAULT_COUNTRY_CODE: CountryCode = "ES";

export function isCountryCode(value: unknown): value is CountryCode {
  return COUNTRIES.some((country) => country.code === value);
}

export function getCountry(code: CountryCode): Country {
  return COUNTRIES.find((country) => country.code === code) ?? COUNTRIES[0];
}
