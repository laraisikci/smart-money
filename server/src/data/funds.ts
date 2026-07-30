// CIKs verified against data.sec.gov/submissions — each has recent 13F-HR filings under this
// exact entity name. Some funds file 13F under a specific subsidiary rather than the public
// parent brand (e.g. Fidelity files as "FMR LLC", not "Fidelity"); noted below.
export interface FundDef {
  name: string;
  slug: string;
  cik: string;
  filerName: string;
}

export const FUNDS: FundDef[] = [
  { name: 'Berkshire Hathaway', slug: 'BRK', cik: '1067983', filerName: 'BERKSHIRE HATHAWAY INC' },
  { name: 'ARK Invest', slug: 'ARK', cik: '1697748', filerName: 'ARK Investment Management LLC' },
  { name: 'Bridgewater Associates', slug: 'BW', cik: '1350694', filerName: 'Bridgewater Associates, LP' },
  { name: 'Renaissance Technologies', slug: 'RENAISS', cik: '1037389', filerName: 'RENAISSANCE TECHNOLOGIES LLC' },
  { name: 'Soros Fund Management', slug: 'SOROS', cik: '1029160', filerName: 'SOROS FUND MANAGEMENT LLC' },
  { name: 'BlackRock', slug: 'BLK', cik: '1364742', filerName: 'BlackRock Finance, Inc.' },
  { name: 'Vanguard', slug: 'VANG', cik: '102909', filerName: 'VANGUARD GROUP INC' },
  { name: 'State Street', slug: 'STT', cik: '93751', filerName: 'STATE STREET CORP' },
  { name: 'Fidelity', slug: 'FID', cik: '315066', filerName: 'FMR LLC' },
  { name: 'Invesco', slug: 'IVZ', cik: '914208', filerName: 'Invesco Ltd.' },
];

export const FUND_MAP: Record<string, FundDef> = Object.fromEntries(
  FUNDS.map((f) => [f.slug, f]),
);
