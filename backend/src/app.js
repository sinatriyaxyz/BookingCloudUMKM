import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import meRouter from './routes/me.js';
import profileRouter from './routes/profile.js';
import publicRouter from './routes/public.js';
import servicesRouter from './routes/services.js';
import operatingHoursRouter from './routes/operatingHours.js';
import holidaysRouter from './routes/holidays.js';
import bookingsRouter from './routes/bookings.js';
import dashboardRouter from './routes/dashboard.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api', meRouter);
app.use('/api', profileRouter);
app.use('/api', servicesRouter);
app.use('/api', operatingHoursRouter);
app.use('/api', holidaysRouter);
app.use('/api', bookingsRouter);
app.use('/api', dashboardRouter);
app.use('/api/public', publicRouter);

app.use(errorHandler);

export default app;
