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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/insiders', insidersRouter());
app.use('/api/institutions', institutionsRouter());
app.use('/api/markets', marketsRouter());
app.use('/api/european', europeanRouter());
app.use('/api/congress', congressRouter());

// Bind explicitly to 0.0.0.0 — omitting the host can resolve to an IPv6-only (`::`) socket
// depending on the container's networking, which Railway's health-check prober can't reach.
// That makes the app start and log "listening" successfully while still failing every health
// check, and Railway kills the container a few seconds later as a result.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`smart-money-server listening on 0.0.0.0:${PORT} (CORS origin: ${CORS_ORIGIN})`);
});
