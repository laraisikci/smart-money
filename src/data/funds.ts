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
