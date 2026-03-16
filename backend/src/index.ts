import 'dotenv/config';

// App Insights must be initialized before all other imports
// Only activates when APPLICATIONINSIGHTS_CONNECTION_STRING is set (i.e. in Azure)
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const appInsights = require('applicationinsights');
  appInsights
    .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectConsole(true, true)
    .setSendLiveMetrics(true)
    .start();
  console.log('Azure App Insights initialized.');
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import eventsRouter from './routes/events';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists for SQLite file
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Read build version written by CI (absent in local dev — graceful fallback)
interface VersionInfo { sha: string; buildTime: string; version: string; }
let versionInfo: VersionInfo | null = null;
try {
  const versionPath = path.join(__dirname, '../version.json');
  versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
} catch {
  // Running locally without a CI-generated version.json
}

const app = express();
const PORT = process.env.PORT ?? 3000;

// Global rate limiter — 120 requests per minute per IP across all routes.
// Per-route limiters in events.ts add finer-grained caps on top of this.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// API key middleware — all routes except /health require X-API-Key.
// Set API_SECRET_KEY in App Service config (and mobile .env).
// Skipped when API_SECRET_KEY is not configured (local dev without .env).
const API_SECRET_KEY = process.env.API_SECRET_KEY;
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_SECRET_KEY) { next(); return; }
  if (req.headers['x-api-key'] === API_SECRET_KEY) { next(); return; }
  res.status(401).json({ error: 'Unauthorized' });
}

app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(globalLimiter);

app.use('/', requireApiKey, eventsRouter);

// /health is intentionally unauthenticated (used by Azure, smoke tests, uptime monitors)
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  timestamp: Date.now(),
  ...(versionInfo ?? {}),
}));

app.post('/session', requireApiKey, (_req, res) => res.json({ sessionId: uuid() }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
