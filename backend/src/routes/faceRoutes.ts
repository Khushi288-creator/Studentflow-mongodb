import express from 'express'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { StudentFace } from '../models/StudentFace'
import { User } from '../models/User'
import { StudentProfile } from '../models/StudentProfile'
import { asyncHandler } from '../utils/asyncHandler'

const router = express.Router()

const registerSchema = z.object({
  studentId: z.string().min(1),
  faceDescriptor: z.array(z.number()).length(128),
  photoUrl: z.string().min(1),
  studentName: z.string().min(1).optional(),
  classId: z.string().optional().nullable(),
})

router.post(
  '/faces/register',
  authenticateJWT,
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid payload' })
      return
    }

    const { studentId, faceDescriptor, photoUrl, studentName, classId } = parsed.data

    const user = await User.findOne({ _id: studentId, role: 'student' }).lean()
    if (!user) {
      res.status(404).json({ message: 'Student not found' })
      return
    }

    const studentProfile = await StudentProfile.findOne({ userId: studentId }).lean()

    const resolvedName = studentName ?? user.name
    const resolvedClass = classId ?? studentProfile?.className ?? null
    const resolvedPhoto = photoUrl.startsWith('data:') || photoUrl.startsWith('/')
      ? photoUrl
      : studentProfile?.photoUrl ?? photoUrl

    const face = await StudentFace.findOneAndUpdate(
      { studentId },
      {
        studentId,
        studentName: resolvedName,
        classId: resolvedClass,
        faceDescriptor,
        photoUrl: resolvedPhoto,
      },
      { upsert: true, new: true, runValidators: true },
    )

    res.status(201).json({
      face: {
        studentId: face.studentId,
        studentName: face.studentName,
        classId: face.classId,
        photoUrl: face.photoUrl,
        updatedAt: face.updatedAt,
      },
    })
  }),
)

router.get(
  '/faces/all',
  authenticateJWT,
  requireRole(['admin', 'teacher']),
  asyncHandler(async (_req, res) => {
    const faces = await StudentFace.find().sort({ studentName: 1 }).lean()
    res.json({
      faces: faces.map((f) => ({
        studentId: f.studentId,
        studentName: f.studentName,
        classId: f.classId,
        faceDescriptor: f.faceDescriptor,
        photoUrl: f.photoUrl,
      })),
    })
  }),
)

router.get(
  '/faces/student/:studentId',
  authenticateJWT,
  requireRole(['admin', 'teacher']),
  asyncHandler(async (req, res) => {
    const studentId = req.params.studentId as string
    const face = await StudentFace.findOne({ studentId }).lean()
    if (!face) {
      res.status(404).json({ message: 'Face not registered for this student' })
      return
    }
    res.json({
      face: {
        studentId: face.studentId,
        studentName: face.studentName,
        classId: face.classId,
        photoUrl: face.photoUrl,
        hasDescriptor: face.faceDescriptor.length === 128,
      },
    })
  }),
)

export default router
