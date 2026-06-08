import express from 'express'
import { z } from 'zod'
import { Timetable } from '../models/Timetable'
import { User } from '../models/User'
import { Notice } from '../models/Notice'
import { leanDoc, leanDocs } from '../utils/mongoHelpers'
import { authenticateJWT, requireRole } from '../middleware/auth'

const router = express.Router()

const timetableSchema = z.object({
  type: z.enum(['regular', 'exam']),
  class: z.string().min(1),
  subject: z.string().min(1),
  date: z.string().optional(),
  time: z.string().min(1),
  teacherId: z.string().optional(),
})

// GET — all (teacher sees own, student sees by class, admin sees all)
router.get('/timetable', authenticateJWT, async (req, res) => {
  const type = (req.query.type as string | undefined) ?? undefined
  const filter = type ? { type } : {}
  const entries = await Timetable.find(filter).sort({ createdAt: 1 }).lean()
  res.json({ entries: leanDocs(entries) })
})

// Admin: create
router.post('/timetable', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = timetableSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const created = await Timetable.create(parsed.data)
    const entry = leanDoc(created.toObject())

    const teachers = await User.find({ role: 'teacher' }).select('_id').lean()
    const students = await User.find({ role: 'student' }).select('_id').lean()
    const recipients = [...teachers, ...students]
    if (recipients.length) {
      await Notice.insertMany(
        recipients.map((u) => ({
          title: 'Timetable Updated',
          description: `New ${parsed.data.type} timetable entry: ${parsed.data.subject} — Class ${parsed.data.class} at ${parsed.data.time}${parsed.data.date ? ' on ' + parsed.data.date : ''}`,
          type: 'timetable',
          userId: u._id,
        })),
      )
    }
    res.status(201).json({ entry })
  } catch (err: any) {
    console.error('[POST /timetable]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to create timetable entry' })
  }
})

// Admin: edit
router.put('/timetable/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const parsed = timetableSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const updated = await Timetable.findOneAndUpdate({ _id: id }, parsed.data, { new: true }).lean()
    if (!updated) throw new Error('Timetable entry not found')
    const entry = leanDoc(updated)

    const users = await User.find({ role: { $in: ['teacher', 'student'] } }).select('_id').lean()
    if (users.length) {
      await Notice.insertMany(
        users.map((u) => ({
          title: 'Timetable Updated',
          description: `Timetable changed: ${entry.subject} — Class ${entry.class} at ${entry.time}`,
          type: 'timetable',
          userId: u._id,
        })),
      )
    }
    res.json({ entry })
  } catch (err: any) {
    console.error('[PUT /timetable/:id]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to update timetable entry' })
  }
})

// Admin: delete
router.delete('/timetable/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const deleted = await Timetable.findOneAndDelete({ _id: id })
    if (!deleted) throw new Error('Timetable entry not found')
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /timetable/:id]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to delete timetable entry' })
  }
})

export default router
