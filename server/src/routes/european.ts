import { Router } from 'express';
import { EUROPEAN_REGULATOR_LINKS } from '../data/euAdrMap.js';

export function europeanRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      data: EUROPEAN_REGULATOR_LINKS,
      note:
        'CNMV and Euronext publish PDMR insider disclosures as individual filings, not a ' +
        'structured feed — these are direct links to each regulator so you can check manually. ' +
        'ASML, SAP, Novo Nordisk, TotalEnergies, Novartis, Shell, HSBC, Deutsche Bank, ING and ' +
        'AB InBev also file Form 4 with the SEC (they have US listings) and appear in /api/insiders.',
    });
  });

  return router;
}
