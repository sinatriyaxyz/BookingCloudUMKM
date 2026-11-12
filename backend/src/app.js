import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import meRouter from './routes/me.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api', meRouter);

app.use(errorHandler);

export default app;
