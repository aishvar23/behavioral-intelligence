import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { v4 as uuid } from 'uuid';
import eventsRouter from './routes/events';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists for SQLite file
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(cors());
app.use(express.json());

app.use('/', eventsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.post('/session', (_req, res) => res.json({ sessionId: uuid() }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
