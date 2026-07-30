import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { insidersRouter } from './routes/insiders.js';
import { institutionsRouter } from './routes/institutions.js';
import { marketsRouter } from './routes/markets.js';
import { europeanRouter } from './routes/european.js';
import { congressRouter } from './routes/congress.js';

const PORT = Number(process.env.PORT ?? 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/insiders', insidersRouter());
app.use('/api/institutions', institutionsRouter());
app.use('/api/markets', marketsRouter());
app.use('/api/european', europeanRouter());
app.use('/api/congress', congressRouter());

app.listen(PORT, () => {
  console.log(`smart-money-server listening on :${PORT} (CORS origin: ${CORS_ORIGIN})`);
});
