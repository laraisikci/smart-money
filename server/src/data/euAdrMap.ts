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

// Major/significant shareholding notifications — investors must notify the regulator when
// their voting-rights stake crosses 3%, 5%, 10%+ thresholds (EU Transparency Directive /
// national equivalents: WpHG §33 in Germany, DTR5 in the UK). Real, free, publicly disclosed —
// but none of these four regulators expose it as a structured feed. Checked directly: CNMV's
// tool is a per-company HTML form (needs a NIF, no "recent filings" list); France's actual
// threshold-crossing declarations live in AMF's BDIF database, a separate system from AMF's own
// open info-financiere.gouv.fr API (that one only covers issuer-side disclosures — annual
// reports, buybacks — not investor-side threshold crossings); BaFin's MVP portal is a
// name-search tool with no public read API; the UK's TR-1 notifications are disseminated
// through commercial RIS providers (RNS etc.), not hosted by the FCA at all. These are direct
// links to each regulator's own search tool rather than a live feed.
export const MAJOR_HOLDINGS_LINKS: EuropeanRegulatorLink[] = [
  {
    country: 'Spain',
    regulator: 'CNMV',
    description: 'Participaciones Significativas — investor notifications crossing 3%, 5%, 10%+ voting-rights thresholds',
    url: 'https://www.cnmv.es/portal/consultas/derechosvoto/ps_ac_ini?lang=en',
  },
  {
    country: 'France',
    regulator: 'AMF (BDIF)',
    description: 'Déclarations de franchissement de seuils — threshold-crossing declarations (3%, 5%, 10%+) via the BDIF database',
    url: 'https://bdif.amf-france.org/en_US/Recherche-avancee',
  },
  {
    country: 'Germany',
    regulator: 'BaFin',
    description: 'Stimmrechtsmitteilungen — voting-rights notifications under §33 WpHG crossing 3%, 5%, 10%+ thresholds',
    url: 'https://www.bafin.de/EN/unternehmen-maerkte/mvp-portal/stimmrechtsmitteilungen/stimmrechtsmitteilungen_node_en.html',
  },
  {
    country: 'United Kingdom',
    regulator: 'FCA',
    description: 'TR-1 major shareholding notifications under DTR5, crossing 3%, 5%, 10%+ voting rights (published via each company\'s chosen RIS, not hosted by the FCA)',
    url: 'https://www.fca.org.uk/markets/primary-markets/regulatory-disclosures/shareholding-notification-disclosure',
  },
];

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
