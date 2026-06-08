import express from 'express'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { z } from 'zod'
import { Notice } from '../models/Notice'
import { FeeStructure } from '../models/FeeStructure'
import { StudentProfile } from '../models/StudentProfile'
import { StudentEnrollment } from '../models/StudentEnrollment'
import { Course } from '../models/Course'
import { Fee } from '../models/Fee'
import { Teacher } from '../models/Teacher'
import { User } from '../models/User'
import { leanDoc } from '../utils/mongoHelpers'

const router = express.Router()

async function notifyStudent(userId: string, title: string, description: string) {
  await Notice.create({ title, description, type: 'fee', userId })
}

function computeStatus(paidAmount: number, totalAmount: number): 'paid' | 'pending' | 'overdue' {
  if (paidAmount >= totalAmount) return 'paid'
  if (paidAmount > 0) return 'overdue'
  return 'pending'
}

const structureSchema = z.object({
  className: z.string().min(1, 'Class is required'),
  feeType: z.enum(['tuition', 'exam', 'transport']),
  amount: z.number().int().positive('Amount must be positive'),
  dueDate: z.string().optional(),
})

router.post('/admin/fees/structure', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    console.log('[POST /admin/fees/structure] body:', JSON.stringify(req.body))
    const parsed = structureSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { className, feeType, amount, dueDate } = parsed.data

    const structure = await FeeStructure.create({
      className,
      feeType,
      amount,
      dueDate: dueDate || null,
    })

    const profiles = await StudentProfile.find({ className }).select('userId').lean()

    if (profiles.length === 0) {
      return res.status(201).json({
        structure: leanDoc(structure.toObject()),
        assigned: 0,
        message: 'Structure saved. No students found in this class yet.',
      })
    }

    let assigned = 0
    for (const profile of profiles) {
      let enrollment = await StudentEnrollment.findOne({ userId: profile.userId }).lean()
      if (!enrollment) {
        const course = await Course.findOne().lean()
        if (!course) continue
        const created = await StudentEnrollment.create({
          userId: profile.userId,
          courseId: course._id,
          phone: 'NA',
        })
        enrollment = created.toObject()
      }

      await Fee.create({
        studentId: enrollment._id,
        amount,
        paidAmount: 0,
        status: 'pending',
        className,
        feeType,
        dueDate: dueDate || null,
        description: `${feeType.charAt(0).toUpperCase() + feeType.slice(1)} Fee`,
      })

      await notifyStudent(
        profile.userId,
        `📋 New Fee: ${feeType.charAt(0).toUpperCase() + feeType.slice(1)}`,
        `A ${feeType} fee of ₹${amount} has been assigned for Class ${className}${dueDate ? `. Due: ${dueDate}` : ''}.`,
      )
      assigned++
    }

    res.status(201).json({ structure: leanDoc(structure.toObject()), assigned })
  } catch (err: any) {
    console.error('[POST /admin/fees/structure]', err?.message, err?.stack)
    res.status(500).json({ message: err?.message ?? 'Failed to create fee structure' })
  }
})

router.get('/admin/fees/structures', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  try {
    const structures = await FeeStructure.find().sort({ createdAt: -1 }).lean()
    res.json({ structures: structures.map((s) => leanDoc(s)) })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

router.get('/admin/fees', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const { className: classFilter, status: statusFilter } = req.query as Record<string, string>

    const filter: Record<string, unknown> = {}
    if (classFilter && classFilter !== 'all') filter.className = classFilter
    if (statusFilter && statusFilter !== 'all') filter.status = statusFilter

    const fees = await Fee.find(filter).sort({ createdAt: -1 }).lean()
    const enrollmentIds = [...new Set(fees.map((f) => f.studentId))]
    const enrollments = await StudentEnrollment.find({ _id: { $in: enrollmentIds } }).lean()
    const enrollmentById = new Map(enrollments.map((e) => [e._id, e]))
    const userIds = [...new Set(enrollments.map((e) => e.userId))]
    const courseIds = [...new Set(enrollments.map((e) => e.courseId))]
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
    const courses = await Course.find({ _id: { $in: courseIds } }).select('name').lean()
    const userNameById = new Map(users.map((u) => [u._id, u.name]))
    const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

    res.json({
      fees: fees.map((f) => {
        const enrollment = enrollmentById.get(f.studentId)
        const studentName = enrollment ? (userNameById.get(enrollment.userId) ?? '') : ''
        const courseName = enrollment ? (courseNameById.get(enrollment.courseId) ?? '') : ''
        return {
          id: f._id,
          amount: f.amount,
          paidAmount: f.paidAmount,
          pendingAmount: Math.max(0, f.amount - f.paidAmount),
          status: f.status,
          className: f.className ?? courseName,
          feeType: f.feeType,
          description: f.description ?? '',
          dueDate: f.dueDate ?? '',
          studentUserId: enrollment?.userId ?? '',
          studentName,
        }
      }),
    })
  } catch (err: any) {
    console.error('[GET /admin/fees]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

const createFeeSchema = z.object({
  studentUserId: z.string().min(1),
  amount: z.number().int().positive(),
  className: z.string().optional(),
  feeType: z.enum(['tuition', 'exam', 'transport']).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
})

router.post('/admin/fees', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    console.log('[POST /admin/fees] body:', JSON.stringify(req.body))
    const parsed = createFeeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { studentUserId, amount, className, feeType, description, dueDate } = parsed.data

    let enrollment = await StudentEnrollment.findOne({ userId: studentUserId }).lean()
    if (!enrollment) {
      const course = await Course.findOne().lean()
      if (!course) return res.status(400).json({ message: 'No courses exist yet.' })
      const created = await StudentEnrollment.create({
        userId: studentUserId,
        courseId: course._id,
        phone: 'NA',
      })
      enrollment = created.toObject()
    }

    let resolvedClass = className
    if (!resolvedClass) {
      const profile = await StudentProfile.findOne({ userId: studentUserId }).lean()
      resolvedClass = profile?.className ?? undefined
    }

    const fee = await Fee.create({
      studentId: enrollment._id,
      amount,
      paidAmount: 0,
      status: 'pending',
      className: resolvedClass || null,
      feeType: feeType || 'tuition',
      description: description || null,
      dueDate: dueDate || null,
    })

    await notifyStudent(
      studentUserId,
      'Fee Assigned',
      `A fee of ₹${amount}${resolvedClass ? ` for Class ${resolvedClass}` : ''} has been assigned.${dueDate ? ` Due: ${dueDate}` : ''}`,
    )

    res.status(201).json({ fee: { id: fee.id, amount: fee.amount, status: fee.status } })
  } catch (err: any) {
    console.error('[POST /admin/fees]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to create fee' })
  }
})

const updateFeeSchema = z.object({
  status: z.enum(['paid', 'pending', 'overdue']).optional(),
  amount: z.number().int().positive().optional(),
  paidAmount: z.number().int().min(0).optional(),
  description: z.string().optional(),
  className: z.string().optional(),
  dueDate: z.string().optional(),
})

router.put('/admin/fees/:feeId', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const feeId = req.params.feeId as string
    const parsed = updateFeeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid data' })

    const fee = await Fee.findById(feeId).lean()
    if (!fee) return res.status(404).json({ message: 'Fee not found' })

    const enrollment = await StudentEnrollment.findById(fee.studentId).select('userId').lean()
    if (!enrollment) return res.status(404).json({ message: 'Fee not found' })

    const newPaid = parsed.data.paidAmount ?? fee.paidAmount
    const newAmount = parsed.data.amount ?? fee.amount
    const autoStatus = computeStatus(newPaid, newAmount)

    const updateData: Record<string, unknown> = {
      status: parsed.data.status ?? autoStatus,
    }
    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount
    if (parsed.data.paidAmount !== undefined) updateData.paidAmount = parsed.data.paidAmount
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null
    if (parsed.data.className !== undefined) updateData.className = parsed.data.className || null
    if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate || null

    const updated = await Fee.findByIdAndUpdate(feeId, updateData, { new: true }).lean()
    if (!updated) return res.status(404).json({ message: 'Fee not found' })

    await notifyStudent(enrollment.userId, 'Fee Updated', `Your fee record has been updated by admin.`)
    res.json({
      fee: {
        id: updated._id,
        amount: updated.amount,
        paidAmount: updated.paidAmount,
        status: updated.status,
      },
    })
  } catch (err: any) {
    console.error('[PUT /admin/fees/:feeId]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to update fee' })
  }
})

router.delete('/admin/fees/:feeId', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const feeId = req.params.feeId as string
    const fee = await Fee.findById(feeId).lean()
    if (!fee) return res.status(404).json({ message: 'Fee not found' })

    const enrollment = await StudentEnrollment.findById(fee.studentId).select('userId').lean()
    if (!enrollment) return res.status(404).json({ message: 'Fee not found' })

    await Fee.findByIdAndDelete(feeId)
    await notifyStudent(enrollment.userId, 'Fee Removed', `A fee record of ₹${fee.amount} has been removed.`)
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /admin/fees/:feeId]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to delete fee' })
  }
})

router.get('/fees', authenticateJWT, async (req, res) => {
  try {
    const role = req.auth!.role
    if (role === 'student') {
      const enrollments = await StudentEnrollment.find({ userId: req.auth!.userId }).select('_id').lean()
      const ids = enrollments.map((e) => e._id)
      const fees = await Fee.find({ studentId: { $in: ids } }).sort({ createdAt: -1 }).lean()
      return res.json({
        fees: fees.map((f) => ({
          id: f._id,
          amount: f.amount,
          paidAmount: f.paidAmount,
          pendingAmount: Math.max(0, f.amount - f.paidAmount),
          status: f.status,
          className: f.className ?? '',
          feeType: f.feeType,
          description: f.description ?? '',
          dueDate: f.dueDate ?? '',
        })),
      })
    }

    if (role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
      if (!teacher) return res.json({ fees: [] })
      const courses = await Course.find({ teacherId: teacher._id }).select('_id').lean()
      const courseIds = courses.map((c) => c._id)
      const enrollments = await StudentEnrollment.find({ courseId: { $in: courseIds } }).select('_id').lean()
      const ids = enrollments.map((e) => e._id)
      const fees = await Fee.find({ studentId: { $in: ids } }).sort({ createdAt: -1 }).lean()
      return res.json({
        fees: fees.map((f) => ({
          id: f._id,
          amount: f.amount,
          paidAmount: f.paidAmount,
          status: f.status,
        })),
      })
    }

    const fees = await Fee.find().sort({ createdAt: -1 }).lean()
    return res.json({
      fees: fees.map((f) => ({
        id: f._id,
        amount: f.amount,
        paidAmount: f.paidAmount,
        status: f.status,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

const paySchema = z.object({
  feeId: z.string().min(1),
  payAmount: z.number().int().positive().optional(),
})

router.post('/fees/pay', authenticateJWT, requireRole(['student']), async (req, res) => {
  try {
    console.log('[POST /fees/pay] body:', JSON.stringify(req.body))
    const parsed = paySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const fee = await Fee.findById(parsed.data.feeId).lean()
    if (!fee) return res.status(404).json({ message: 'Fee not found' })

    const enrollment = await StudentEnrollment.findById(fee.studentId).select('userId').lean()
    if (!enrollment || enrollment.userId !== req.auth!.userId) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const pending = fee.amount - fee.paidAmount
    const paying = parsed.data.payAmount ? Math.min(parsed.data.payAmount, pending) : pending
    const newPaid = fee.paidAmount + paying
    const newStatus = computeStatus(newPaid, fee.amount)

    const updated = await Fee.findByIdAndUpdate(
      fee._id,
      { paidAmount: newPaid, status: newStatus },
      { new: true },
    ).lean()
    if (!updated) return res.status(404).json({ message: 'Fee not found' })

    await notifyStudent(
      req.auth!.userId,
      newStatus === 'paid' ? '✅ Payment Complete' : '💳 Partial Payment Received',
      `₹${paying} paid${fee.className ? ` for Class ${fee.className}` : ''}. ${newStatus === 'paid' ? 'Fully paid!' : `Remaining: ₹${fee.amount - newPaid}`}`,
    )

    res.json({
      fee: {
        id: updated._id,
        amount: updated.amount,
        paidAmount: updated.paidAmount,
        pendingAmount: fee.amount - newPaid,
        status: updated.status,
      },
    })
  } catch (err: any) {
    console.error('[POST /fees/pay]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to process payment' })
  }
})

export default router
