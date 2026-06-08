import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'

import "dotenv/config";

import authRoutes from './routes/authRoutes'
import courseRoutes from './routes/courseRoutes'
import assignmentRoutes from './routes/assignmentRoutes'
import attendanceRoutes from './routes/attendanceRoutes'
import dashboardRoutes from './routes/dashboardRoutes'
import resultsRoutes from './routes/resultsRoutes'
import feeRoutes from './routes/feeRoutes'
import eventRoutes from './routes/eventRoutes'
import profileRoutes from './routes/profileRoutes'
import notificationRoutes from './routes/notificationRoutes'
import contactRoutes from './routes/contactRoutes'
import adminRoutes from './routes/adminRoutes'
import reportRoutes from './routes/reportRoutes'
import timetableRoutes from './routes/timetableRoutes'
import holidayRoutes from './routes/holidayRoutes'
import achievementRoutes from './routes/achievementRoutes'
import salaryRoutes from './routes/salaryRoutes'
import skillHubRoutes from './routes/skillHubRoutes'
import assistantRoutes from './routes/assistantRoutes'
import parentRoutes from './routes/parentRoutes'
import faceRoutes from './routes/faceRoutes'
import faceAttendanceRoutes from './routes/faceAttendanceRoutes'

export const app = express();

// Middleware must be registered BEFORE routes and before exporting.
app.use(helmet())
app.use(
  cors({
    origin: true,
    credentials: false,
  }),
)
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Uploads served as static.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.get('/', (_req, res) => res.send('Backend is working'))
app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api', authRoutes)
app.use('/api', courseRoutes)
app.use('/api', assignmentRoutes)
app.use('/api', attendanceRoutes)
app.use('/api', dashboardRoutes)
app.use('/api', resultsRoutes)
app.use('/api', feeRoutes)
app.use('/api', eventRoutes)
app.use('/api', profileRoutes)
app.use('/api', notificationRoutes)
app.use('/api', contactRoutes)
app.use('/api', adminRoutes)
app.use('/api', reportRoutes)
app.use('/api', timetableRoutes)
app.use('/api', holidayRoutes)
app.use('/api', achievementRoutes)
app.use('/api', salaryRoutes)
app.use('/api', skillHubRoutes)
app.use('/api', assistantRoutes)
app.use('/api', parentRoutes)
app.use('/api', faceRoutes)
app.use('/api', faceAttendanceRoutes)

// Basic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[error]', err)
  const dev = process.env.NODE_ENV !== 'production'
  res.status(500).json({
    message: 'Internal server error',
    error: dev ? err?.message ?? String(err) : undefined,
    stack: dev ? err?.stack : undefined,
  })
})

export default app

