import express from 'express'
import { z } from 'zod'
import { Event } from '../models/Event'
import { EventRegistration } from '../models/EventRegistration'
import { User } from '../models/User'
import { Notice } from '../models/Notice'
import { authenticateJWT, requireRole } from '../middleware/auth'

const router = express.Router()

router.get('/events', authenticateJWT, async (req, res) => {
  const events = await Event.find().sort({ date: 1 }).lean()
  const registrations = await EventRegistration.find({ userId: req.auth!.userId })
    .select('eventId')
    .lean()
  const registered = new Set(registrations.map((r) => r.eventId))

  res.json({
    events: events.map((e) => ({
      id: e._id,
      title: e.title,
      date: e.date.toISOString().slice(0, 10),
      description: e.description,
      status: e.status,
      time: e.time ?? '',
      targetClass: e.targetClass,
      isRegistered: registered.has(e._id),
    })),
  })
})

router.post('/events/:eventId/register', authenticateJWT, async (req, res) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId
  await EventRegistration.findOneAndUpdate(
    { eventId, userId: req.auth!.userId },
    { $setOnInsert: {} },
    { upsert: true },
  )
  res.json({ ok: true })
})

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(['upcoming', 'completed']).default('upcoming'),
  time: z.string().optional(),
  targetClass: z.string().default('All Classes'),
})

// Admin: create event
router.post('/events', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const parsed = eventSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
  const { title, description, date, status, time, targetClass } = parsed.data

  const created = await Event.create({
    title,
    description,
    date: new Date(date),
    status,
    time: time?.trim() || null,
    targetClass,
  })
  const event = created.toObject()

  const students = await User.find({ role: 'student' }).select('_id').lean()
  const dateLabel = new Date(date).toLocaleDateString()
  const timeLabel = time?.trim() ? ` at ${time.trim()}` : ''
  const classLabel = targetClass !== 'All Classes' ? ` (${targetClass})` : ''
  if (students.length) {
    await Notice.insertMany(
      students.map((s) => ({
        title: `New Event: ${title}`,
        description: `${description} — Date: ${dateLabel}${timeLabel}${classLabel}`,
        type: 'event',
        userId: s._id,
      })),
    )
  }

  res.status(201).json({
    event: {
      id: event._id,
      title: event.title,
      date: event.date.toISOString().slice(0, 10),
      description: event.description,
      status: event.status,
      time: event.time ?? '',
      targetClass: event.targetClass,
    },
  })
})

// Admin: edit event
router.put('/events/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const id = req.params.id as string
  const parsed = eventSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
  const data: Record<string, unknown> = { ...parsed.data }
  if (data.date) data.date = new Date(data.date as string)
  if ('time' in data) data.time = (data.time as string | undefined)?.trim() || null
  const event = await Event.findOneAndUpdate({ _id: id }, data, { new: true }).lean()
  if (!event) return res.status(404).json({ message: 'Event not found' })
  res.json({
    event: {
      id: event._id,
      title: event.title,
      date: event.date.toISOString().slice(0, 10),
      description: event.description,
      status: event.status,
      time: event.time ?? '',
      targetClass: event.targetClass,
    },
  })
})

// Admin: delete event
router.delete('/events/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const id = req.params.id as string
  await Event.findOneAndDelete({ _id: id })
  res.json({ ok: true })
})

export default router
