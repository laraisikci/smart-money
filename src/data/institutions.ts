import type { InstitutionalPosition } from '@/types';

export const INSTITUTIONAL_POSITIONS: InstitutionalPosition[] = [
  // Berkshire Hathaway
  {
    id: 'inst1', fundName: 'Berkshire Hathaway', fundSlug: 'BRK', ticker: 'SAP',
    companyName: 'SAP SE', action: 'new', shares: 2_400_000, marketValue: 428_400_000,
    pctChange: 100, filingDate: '2026-05-15', quarter: 'Q1 2026',
  },
  {
    id: 'inst2', fundName: 'Berkshire Hathaway', fundSlug: 'BRK', ticker: 'SHEL',
    companyName: 'Shell plc', action: 'increased', shares: 8_500_000, marketValue: 245_650_000,
    pctChange: 34, filingDate: '2026-05-15', quarter: 'Q1 2026',
  },
  {
    id: 'inst3', fundName: 'Berkshire Hathaway', fundSlug: 'BRK', ticker: 'TTE',
    companyName: 'TotalEnergies SE', action: 'new', shares: 3_100_000, marketValue: 193_440_000,
    pctChange: 100, filingDate: '2026-05-15', quarter: 'Q1 2026',
  },
  {
    id: 'inst4', fundName: 'Berkshire Hathaway', fundSlug: 'BRK', ticker: 'AAPL',
    companyName: 'Apple Inc.', action: 'decreased', shares: 780_000_000, marketValue: 178_230_000_000,
    pctChange: -13, filingDate: '2026-05-15', quarter: 'Q1 2026',
  },

  // ARK Invest
  {
    id: 'inst5', fundName: 'ARK Invest', fundSlug: 'ARK', ticker: 'ASML',
    companyName: 'ASML Holding', action: 'increased', shares: 420_000, marketValue: 299_280_000,
    pctChange: 28, filingDate: '2026-05-14', quarter: 'Q1 2026',
  },
  {
    id: 'inst6', fundName: 'ARK Invest', fundSlug: 'ARK', ticker: 'NOVO',
    companyName: 'Novo Nordisk', action: 'new', shares: 1_800_000, marketValue: 224_640_000,
    pctChange: 100, filingDate: '2026-05-14', quarter: 'Q1 2026',
  },
  {
    id: 'inst7', fundName: 'ARK Invest', fundSlug: 'ARK', ticker: 'NVDA',
    companyName: 'NVIDIA Corp.', action: 'increased', shares: 2_100_000, marketValue: 269_640_000,
    pctChange: 15, filingDate: '2026-05-14', quarter: 'Q1 2026',
  },
  {
    id: 'inst8', fundName: 'ARK Invest', fundSlug: 'ARK', ticker: 'ROG',
    companyName: 'Roche Holding', action: 'new', shares: 320_000, marketValue: 92_480_000,
    pctChange: 100, filingDate: '2026-05-14', quarter: 'Q1 2026',
  },

  // Bridgewater Associates
  {
    id: 'inst9', fundName: 'Bridgewater Associates', fundSlug: 'BW', ticker: 'BNP',
    companyName: 'BNP Paribas', action: 'new', shares: 5_200_000, marketValue: 303_160_000,
    pctChange: 100, filingDate: '2026-05-13', quarter: 'Q1 2026',
  },
  {
    id: 'inst10', fundName: 'Bridgewater Associates', fundSlug: 'BW', ticker: 'INGA',
    companyName: 'ING Groep', action: 'increased', shares: 8_800_000, marketValue: 124_960_000,
    pctChange: 42, filingDate: '2026-05-13', quarter: 'Q1 2026',
  },
  {
    id: 'inst11', fundName: 'Bridgewater Associates', fundSlug: 'BW', ticker: 'JPM',
    companyName: 'JPMorgan Chase', action: 'decreased', shares: 1_200_000, marketValue: 237_600_000,
    pctChange: -22, filingDate: '2026-05-13', quarter: 'Q1 2026',
  },
  {
    id: 'inst12', fundName: 'Bridgewater Associates', fundSlug: 'BW', ticker: 'XOM',
    companyName: 'Exxon Mobil', action: 'exited', shares: 0, marketValue: 0,
    pctChange: -100, filingDate: '2026-05-13', quarter: 'Q1 2026',
  },

  // Renaissance Technologies
  {
    id: 'inst13', fundName: 'Renaissance Technologies', fundSlug: 'RENAISS', ticker: 'ASML',
    companyName: 'ASML Holding', action: 'increased', shares: 680_000, marketValue: 484_320_000,
    pctChange: 51, filingDate: '2026-05-12', quarter: 'Q1 2026',
  },
  {
    id: 'inst14', fundName: 'Renaissance Technologies', fundSlug: 'RENAISS', ticker: 'MC',
    companyName: 'LVMH Moet Hennessy', action: 'new', shares: 420_000, marketValue: 269_640_000,
    pctChange: 100, filingDate: '2026-05-12', quarter: 'Q1 2026',
  },
  {
    id: 'inst15', fundName: 'Renaissance Technologies', fundSlug: 'RENAISS', ticker: 'AIR',
    companyName: 'Airbus SE', action: 'increased', shares: 1_900_000, marketValue: 271_130_000,
    pctChange: 18, filingDate: '2026-05-12', quarter: 'Q1 2026',
  },
  {
    id: 'inst16', fundName: 'Renaissance Technologies', fundSlug: 'RENAISS', ticker: 'ABI',
    companyName: 'Anheuser-Busch InBev', action: 'decreased', shares: 3_200_000, marketValue: 185_600_000,
    pctChange: -30, filingDate: '2026-05-12', quarter: 'Q1 2026',
  },

  // Soros Fund Management
  {
    id: 'inst17', fundName: 'Soros Fund Management', fundSlug: 'SOROS', ticker: 'NOVO',
    companyName: 'Novo Nordisk', action: 'increased', shares: 1_200_000, marketValue: 149_760_000,
    pctChange: 67, filingDate: '2026-05-11', quarter: 'Q1 2026',
  },
  {
    id: 'inst18', fundName: 'Soros Fund Management', fundSlug: 'SOROS', ticker: 'OR',
    companyName: "L'Oreal SA", action: 'new', shares: 380_000, marketValue: 156_560_000,
    pctChange: 100, filingDate: '2026-05-11', quarter: 'Q1 2026',
  },
  {
    id: 'inst19', fundName: 'Soros Fund Management', fundSlug: 'SOROS', ticker: 'DBK',
    companyName: 'Deutsche Bank', action: 'increased', shares: 4_500_000, marketValue: 57_600_000,
    pctChange: 80, filingDate: '2026-05-11', quarter: 'Q1 2026',
  },
  {
    id: 'inst20', fundName: 'Soros Fund Management', fundSlug: 'SOROS', ticker: 'CAT',
    companyName: 'Caterpillar Inc.', action: 'exited', shares: 0, marketValue: 0,
    pctChange: -100, filingDate: '2026-05-11', quarter: 'Q1 2026',
  },

  // BlackRock
  {
    id: 'inst21', fundName: 'BlackRock', fundSlug: 'BLK', ticker: 'ASML',
    companyName: 'ASML Holding', action: 'increased', shares: 12_500_000, marketValue: 8_905_000_000,
    pctChange: 8, filingDate: '2026-05-10', quarter: 'Q1 2026',
  },
  {
    id: 'inst22', fundName: 'BlackRock', fundSlug: 'BLK', ticker: 'SAP',
    companyName: 'SAP SE', action: 'increased', shares: 9_800_000, marketValue: 1_749_300_000,
    pctChange: 12, filingDate: '2026-05-10', quarter: 'Q1 2026',
  },
  {
    id: 'inst23', fundName: 'BlackRock', fundSlug: 'BLK', ticker: 'NOVO',
    companyName: 'Novo Nordisk', action: 'increased', shares: 15_200_000, marketValue: 1_896_960_000,
    pctChange: 6, filingDate: '2026-05-10', quarter: 'Q1 2026',
  },
  {
    id: 'inst24', fundName: 'BlackRock', fundSlug: 'BLK', ticker: 'NESN',
    companyName: 'Nestle SA', action: 'decreased', shares: 22_000_000, marketValue: 1_947_000_000,
    pctChange: -4, filingDate: '2026-05-10', quarter: 'Q1 2026',
  },

  // Vanguard
  {
    id: 'inst25', fundName: 'Vanguard', fundSlug: 'VANG', ticker: 'SHEL',
    companyName: 'Shell plc', action: 'increased', shares: 18_000_000, marketValue: 520_200_000,
    pctChange: 5, filingDate: '2026-05-09', quarter: 'Q1 2026',
  },
  {
    id: 'inst26', fundName: 'Vanguard', fundSlug: 'VANG', ticker: 'HSBA',
    companyName: 'HSBC Holdings', action: 'increased', shares: 14_500_000, marketValue: 614_850_000,
    pctChange: 7, filingDate: '2026-05-09', quarter: 'Q1 2026',
  },
  {
    id: 'inst27', fundName: 'Vanguard', fundSlug: 'VANG', ticker: 'ASML',
    companyName: 'ASML Holding', action: 'increased', shares: 10_200_000, marketValue: 7_266_480_000,
    pctChange: 9, filingDate: '2026-05-09', quarter: 'Q1 2026',
  },

  // State Street
  {
    id: 'inst28', fundName: 'State Street', fundSlug: 'STT', ticker: 'NVS',
    companyName: 'Novartis AG', action: 'increased', shares: 8_400_000, marketValue: 824_880_000,
    pctChange: 11, filingDate: '2026-05-08', quarter: 'Q1 2026',
  },
  {
    id: 'inst29', fundName: 'State Street', fundSlug: 'STT', ticker: 'MC',
    companyName: 'LVMH Moet Hennessy', action: 'increased', shares: 3_200_000, marketValue: 2_054_400_000,
    pctChange: 14, filingDate: '2026-05-08', quarter: 'Q1 2026',
  },

  // Fidelity
  {
    id: 'inst30', fundName: 'Fidelity', fundSlug: 'FID', ticker: 'SAP',
    companyName: 'SAP SE', action: 'increased', shares: 6_700_000, marketValue: 1_195_950_000,
    pctChange: 16, filingDate: '2026-05-07', quarter: 'Q1 2026',
  },
  {
    id: 'inst31', fundName: 'Fidelity', fundSlug: 'FID', ticker: 'AIR',
    companyName: 'Airbus SE', action: 'new', shares: 2_800_000, marketValue: 399_560_000,
    pctChange: 100, filingDate: '2026-05-07', quarter: 'Q1 2026',
  },

  // Invesco
  {
    id: 'inst32', fundName: 'Invesco', fundSlug: 'IVZ', ticker: 'NOVO',
    companyName: 'Novo Nordisk', action: 'increased', shares: 4_200_000, marketValue: 524_160_000,
    pctChange: 23, filingDate: '2026-05-06', quarter: 'Q1 2026',
  },
  {
    id: 'inst33', fundName: 'Invesco', fundSlug: 'IVZ', ticker: 'TTE',
    companyName: 'TotalEnergies SE', action: 'increased', shares: 5_500_000, marketValue: 343_200_000,
    pctChange: 19, filingDate: '2026-05-06', quarter: 'Q1 2026',
  },
  {
    id: 'inst34', fundName: 'Invesco', fundSlug: 'IVZ', ticker: 'ORX',
    companyName: 'Ørsted', action: 'new', shares: 8_800_000, marketValue: 282_480_000,
    pctChange: 100, filingDate: '2026-05-06', quarter: 'Q1 2026',
  },
];

export const FUNDS = [
  { name: 'Berkshire Hathaway', slug: 'BRK', color: '#3b82f6' },
  { name: 'ARK Invest', slug: 'ARK', color: '#ec4899' },
  { name: 'Bridgewater Associates', slug: 'BW', color: '#06b6d4' },
  { name: 'Renaissance Technologies', slug: 'RENAISS', color: '#8b5cf6' },
  { name: 'Soros Fund Management', slug: 'SOROS', color: '#f59e0b' },
  { name: 'BlackRock', slug: 'BLK', color: '#0ea5e9' },
  { name: 'Vanguard', slug: 'VANG', color: '#ef4444' },
  { name: 'State Street', slug: 'STT', color: '#10b981' },
  { name: 'Fidelity', slug: 'FID', color: '#6366f1' },
  { name: 'Invesco', slug: 'IVZ', color: '#f97316' },
];

export const FUND_MAP = Object.fromEntries(FUNDS.map((f) => [f.slug, f]));
