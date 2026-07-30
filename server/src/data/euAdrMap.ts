import type { EuropeanRegulatorLink } from '../types.js';

// Most EU large-caps are "foreign private issuers" that do NOT file with the SEC — they're
// exempt from Form 4 / 13F reporting and disclose insider transactions to their home regulator
// instead. Verified against SEC's company_tickers.json (2026-07-29): only the tickers below
// resolve to a real SEC filer. Everything else in our EU ticker universe (SAN, MC, OR, NESN,
// AIR, ROG, BAS, VOW3, BNP, ORX, ENEL) has no SEC CIK at all — querying Form 4/13F for them
// would silently return nothing, or worse, collide with an unrelated US-listed company that
// happens to share the ticker (SEC's "SAN" is Banco Santander, not our Sanofi).
export const EU_TO_SEC_TICKER: Record<string, string> = {
  ASML: 'ASML',
  SAP: 'SAP',
  NOVO: 'NVO',
  TTE: 'TTE',
  NVS: 'NVS',
  SHEL: 'SHEL',
  HSBA: 'HSBC',
  DBK: 'DB',
  INGA: 'ING',
  ABI: 'BUD',
  BMW: 'BMWKY',
};

export const EUROPEAN_REGULATOR_LINKS: EuropeanRegulatorLink[] = [
  {
    country: 'Spain',
    regulator: 'CNMV',
    description: 'Comisión Nacional del Mercado de Valores — PDMR insider transaction notices (NOD)',
    url: 'https://www.cnmv.es',
  },
  {
    country: 'France',
    regulator: 'AMF',
    description: "Autorité des Marchés Financiers — dirigeants' transaction disclosures",
    url: 'https://www.amf-france.org',
  },
  {
    country: 'Germany',
    regulator: 'BaFin',
    description: 'Bundesanstalt für Finanzdienstleistungsaufsicht — Directors\' Dealings (§26 WpHG)',
    url: 'https://www.bafin.de',
  },
  {
    country: 'United Kingdom',
    regulator: 'FCA',
    description: 'Financial Conduct Authority — PDMR notifications under UK MAR',
    url: 'https://www.fca.org.uk',
  },
];
