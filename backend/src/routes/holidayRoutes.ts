import express from 'express'
import { z } from 'zod'
import { Holiday } from '../models/Holiday'
import { User } from '../models/User'
import { Notice } from '../models/Notice'
import { leanDoc, leanDocs } from '../utils/mongoHelpers'
import { authenticateJWT, requireRole } from '../middleware/auth'

const router = express.Router()

const schema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
})

// GET — all roles can view
router.get('/holidays', authenticateJWT, async (_req, res) => {
  const holidays = await Holiday.find().sort({ date: 1 }).lean()
  res.json({ holidays: leanDocs(holidays) })
})

// Admin: create
router.post('/holidays', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const created = await Holiday.create(parsed.data)
    const holiday = leanDoc(created.toObject())

    const students = await User.find({ role: 'student' }).select('_id').lean()
    if (students.length) {
      await Notice.insertMany(
        students.map((s) => ({
          title: `Holiday: ${parsed.data.name}`,
          description: `${parsed.data.name} on ${parsed.data.date}`,
          type: 'holiday',
          userId: s._id,
        })),
      )
    }
    res.status(201).json({ holiday })
  } catch (err: any) {
    console.error('[POST /holidays]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to create holiday' })
  }
})

// Admin: edit
router.put('/holidays/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const parsed = schema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
    const updated = await Holiday.findOneAndUpdate({ _id: id }, parsed.data, { new: true }).lean()
    if (!updated) throw new Error('Holiday not found')
    res.json({ holiday: leanDoc(updated) })
  } catch (err: any) {
    console.error('[PUT /holidays/:id]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to update holiday' })
  }
})

// Admin: delete
router.delete('/holidays/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const deleted = await Holiday.findOneAndDelete({ _id: id })
    if (!deleted) throw new Error('Holiday not found')
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /holidays/:id]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to delete holiday' })
  }
})

export default router
