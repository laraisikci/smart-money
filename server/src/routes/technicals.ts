import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { resolveTickerYahooSymbol } from '../lib/yahooSymbolResolver.js';
import { getTechnicals } from '../lib/technicalsFetch.js';

export function technicalsRouter(): Router {
  const router = Router();

  router.get('/:ticker', async (req, res) => {
    const symbol = req.params.ticker.toUpperCase();
    const meta = TICKERS.find((t) => t.symbol === symbol);
    if (!meta) {
      return res.status(404).json({ error: `Unknown ticker: ${symbol}` });
    }

    try {
      const yahooSymbol = await resolveTickerYahooSymbol(meta);
      if (!yahooSymbol) {
        return res.status(502).json({ error: `Could not resolve a Yahoo symbol for ${symbol}` });
      }
      const value = await getTechnicals(symbol, yahooSymbol);
      res.json({ data: value });
    } catch (err) {
      res.status(502).json({ error: 'Failed to compute technical indicators', detail: String(err) });
    }
  });

  return router;
}
