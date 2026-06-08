import express from 'express'
import { z } from 'zod'
import { Salary } from '../models/Salary'
import { User } from '../models/User'
import { Notice } from '../models/Notice'
import { leanDoc } from '../utils/mongoHelpers'
import { authenticateJWT, requireRole } from '../middleware/auth'

const router = express.Router()

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Admin: create salary record ───────────────────────────────────────────
const createSchema = z.object({
  teacherId:      z.string().min(1, 'Select a teacher'),
  month:          z.number().int().min(1).max(12),
  year:           z.number().int().min(2020),
  baseSalary:     z.number().int().positive('Base salary required'),
  hra:            z.number().int().min(0).default(0),
  bonus:          z.number().int().min(0).default(0),
  leaveDeduction: z.number().int().min(0).default(0),
  latePenalty:    z.number().int().min(0).default(0),
})

router.post('/admin/salary', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    console.log('[POST /admin/salary] body:', JSON.stringify(req.body))
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { teacherId, month, year, baseSalary, hra, bonus, leaveDeduction, latePenalty } = parsed.data
    const netSalary = baseSalary + hra + bonus - leaveDeduction - latePenalty

    const existing = await Salary.findOne({ teacherId, month, year }).lean()
    if (existing) return res.status(409).json({ message: `Salary for ${MONTHS[month-1]} ${year} already exists for this teacher.` })

    const teacher = await User.findById(teacherId).lean()
    if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ message: 'Teacher not found' })

    const created = await Salary.create({
      teacherId,
      month,
      year,
      baseSalary,
      hra,
      bonus,
      leaveDeduction,
      latePenalty,
      netSalary,
      status: 'pending',
    })
    const salary = leanDoc(created.toObject())

    await Notice.create({
      title: `Salary Record: ${MONTHS[month-1]} ${year}`,
      description: `Your salary of ₹${netSalary.toLocaleString('en-IN')} for ${MONTHS[month-1]} ${year} has been recorded. Status: Pending.`,
      type: 'notice',
      userId: teacherId,
    })

    res.status(201).json({ salary })
  } catch (err: any) {
    console.error('[POST /admin/salary]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to create salary record' })
  }
})

// ── Admin: list all salaries ──────────────────────────────────────────────
router.get('/admin/salary', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const { month, year, status } = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (month && month !== 'all') filter.month = Number(month)
    if (year && year !== 'all') filter.year = Number(year)
    if (status && status !== 'all') filter.status = status

    const salaries = await Salary.find(filter).sort({ year: -1, month: -1 }).lean()

    const teacherIds = [...new Set(salaries.map((s) => s.teacherId))]
    const teachers = await User.find({ _id: { $in: teacherIds } }).select('_id name').lean()
    const teacherNameById = new Map(teachers.map((t) => [t._id, t.name]))

    res.json({
      salaries: salaries.map((s) => ({
        id: s._id,
        teacherName: teacherNameById.get(s.teacherId) ?? '',
        teacherId: s.teacherId,
        month: s.month,
        monthName: MONTHS[s.month - 1],
        year: s.year,
        baseSalary: s.baseSalary,
        hra: s.hra,
        bonus: s.bonus,
        leaveDeduction: s.leaveDeduction,
        latePenalty: s.latePenalty,
        netSalary: s.netSalary,
        status: s.status,
        paidAt: s.paidAt?.toISOString().slice(0, 10) ?? null,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

// ── Admin: pay salary ─────────────────────────────────────────────────────
router.post('/admin/salary/:id/pay', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const salary = await Salary.findById(id).lean()
    if (!salary) return res.status(404).json({ message: 'Salary record not found' })
    if (salary.status === 'paid') return res.status(400).json({ message: 'Already paid' })

    const updated = await Salary.findOneAndUpdate(
      { _id: id },
      { status: 'paid', paidAt: new Date() },
      { new: true },
    ).lean()
    if (!updated) return res.status(404).json({ message: 'Salary record not found' })

    await Notice.create({
      title: `✅ Salary Paid: ${MONTHS[salary.month - 1]} ${salary.year}`,
      description: `Your salary of ₹${salary.netSalary.toLocaleString('en-IN')} for ${MONTHS[salary.month - 1]} ${salary.year} has been paid.`,
      type: 'notice',
      userId: salary.teacherId,
    })

    res.json({ salary: { id: updated._id, status: updated.status, paidAt: updated.paidAt?.toISOString().slice(0, 10) } })
  } catch (err: any) {
    console.error('[POST /admin/salary/:id/pay]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to process payment' })
  }
})

// ── Admin: delete salary record ───────────────────────────────────────────
router.delete('/admin/salary/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    await Salary.findOneAndDelete({ _id: id })
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

// ── Teacher: view own salary records ─────────────────────────────────────
router.get('/salary/me', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  try {
    const salaries = await Salary.find({ teacherId: req.auth!.userId })
      .sort({ year: -1, month: -1 })
      .lean()
    res.json({
      salaries: salaries.map((s) => ({
        id: s._id,
        month: s.month,
        monthName: MONTHS[s.month - 1],
        year: s.year,
        baseSalary: s.baseSalary,
        hra: s.hra,
        bonus: s.bonus,
        leaveDeduction: s.leaveDeduction,
        latePenalty: s.latePenalty,
        netSalary: s.netSalary,
        status: s.status,
        paidAt: s.paidAt?.toISOString().slice(0, 10) ?? null,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

export default router
