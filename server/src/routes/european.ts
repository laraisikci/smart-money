import { Router } from 'express';
import { EUROPEAN_REGULATOR_LINKS, MAJOR_HOLDINGS_LINKS } from '../data/euAdrMap.js';

export function europeanRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      data: EUROPEAN_REGULATOR_LINKS,
      majorHoldings: MAJOR_HOLDINGS_LINKS,
      note:
        'CNMV and Euronext publish PDMR insider disclosures as individual filings, not a ' +
        'structured feed — these are direct links to each regulator so you can check manually. ' +
        'ASML, SAP, Novo Nordisk, TotalEnergies, Novartis, Shell, HSBC, Deutsche Bank, ING and ' +
        'AB InBev also file Form 4 with the SEC (they have US listings) and appear in /api/insiders.',
      majorHoldingsNote:
        'Major/significant shareholding notifications (3%, 5%, 10%+ threshold crossings) are ' +
        'real and free, but none of these four regulators publish them as a structured feed — ' +
        "checked directly, including France's own open data API, which turned out to cover only " +
        'issuer-side disclosures, not investor threshold crossings. Direct links to each ' +
        "regulator's own search tool instead of a live feed.",
    });
  });

  return router;
}
