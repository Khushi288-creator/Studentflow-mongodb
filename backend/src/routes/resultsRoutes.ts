import express from 'express'
import { Result } from '../models/Result'
import { Course } from '../models/Course'
import { Teacher } from '../models/Teacher'
import { User } from '../models/User'
import { Notice } from '../models/Notice'
import { StudentEnrollment } from '../models/StudentEnrollment'
import { Submission } from '../models/Submission'
import { Assignment } from '../models/Assignment'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { z } from 'zod'

const router = express.Router()

function gradeFromMarks(marks: number) {
  if (marks >= 90) return 'A+'
  if (marks >= 80) return 'A'
  if (marks >= 70) return 'B'
  if (marks >= 60) return 'C'
  if (marks >= 50) return 'D'
  return 'F'
}

// ── Admin: list all results with student + course info ────────────────────
router.get('/admin/results', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  const results = await Result.find().sort({ createdAt: -1 }).lean()

  const courseIds = [...new Set(results.map((r) => r.courseId))]
  const studentIds = [...new Set(results.map((r) => r.studentId))]

  const courses = await Course.find({ _id: { $in: courseIds } }).select('_id name').lean()
  const enrollments = await StudentEnrollment.find({ _id: { $in: studentIds } })
    .select('_id userId')
    .lean()
  const userIds = [...new Set(enrollments.map((e) => e.userId))]
  const users = await User.find({ _id: { $in: userIds } }).select('_id name').lean()

  const courseNameById = new Map(courses.map((c) => [c._id, c.name]))
  const userIdByEnrollmentId = new Map(enrollments.map((e) => [e._id, e.userId]))
  const userNameById = new Map(users.map((u) => [u._id, u.name]))

  res.json({
    results: results.map((r) => {
      const studentUserId = userIdByEnrollmentId.get(r.studentId) ?? ''
      return {
        id: r._id,
        marks: r.marks,
        grade: r.grade,
        courseName: courseNameById.get(r.courseId) ?? '',
        studentName: userNameById.get(studentUserId) ?? '',
        studentUserId,
      }
    }),
  })
})

// ── Admin: create / update result for a student ───────────────────────────
const adminResultSchema = z.object({
  studentUserId: z.string().min(1),
  courseId: z.string().min(1),
  marks: z.number().int().min(0).max(100),
})

router.post('/admin/results', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const parsed = adminResultSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

  const { studentUserId, courseId, marks } = parsed.data
  const grade = gradeFromMarks(marks)

  let enrollment = await StudentEnrollment.findOne({ userId: studentUserId, courseId }).lean()
  if (!enrollment) {
    const created = await StudentEnrollment.create({ userId: studentUserId, courseId, phone: 'NA' })
    enrollment = created.toObject()
  }

  const result = await Result.findOneAndUpdate(
    { studentId: enrollment._id, courseId },
    { marks, grade },
    { upsert: true, new: true },
  ).lean()
  if (!result) return res.status(500).json({ message: 'Failed to save result' })

  const course = await Course.findById(courseId).select('name').lean()
  await Notice.create({
    title: 'Result Declared',
    description: `Your result for ${course?.name ?? 'a subject'} has been updated. Marks: ${marks}, Grade: ${grade}.`,
    type: 'result',
    userId: studentUserId,
  })

  res.status(201).json({ result: { id: result._id, marks: result.marks, grade: result.grade } })
})

router.get('/results', authenticateJWT, async (req, res) => {
  const role = req.auth!.role

  if (role === 'student') {
    const enrollments = await StudentEnrollment.find({ userId: req.auth!.userId })
      .select('_id courseId')
      .lean()
    const studentIds = enrollments.map((e) => e._id)

    const submissions = await Submission.find({
      studentId: { $in: studentIds },
      marks: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .lean()

    if (submissions.length) {
      const assignmentIds = [...new Set(submissions.map((s) => s.assignmentId))]
      const assignments = await Assignment.find({ _id: { $in: assignmentIds } })
        .select('_id title courseId')
        .lean()
      const courseIds = [...new Set(assignments.map((a) => a.courseId))]
      const courses = await Course.find({ _id: { $in: courseIds } }).select('_id name').lean()

      const assignmentById = new Map(assignments.map((a) => [a._id, a]))
      const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

      return res.json({
        results: submissions.map((s) => {
          const assignment = assignmentById.get(s.assignmentId)!
          return {
            id: s._id,
            courseId: assignment.courseId,
            courseName: courseNameById.get(assignment.courseId) ?? '',
            assignmentTitle: assignment.title,
            marks: s.marks,
            grade: gradeFromMarks(s.marks!),
          }
        }),
      })
    }

    return res.json({ results: [] })
  }

  // Teacher/admin: view results for courses they manage.
  if (role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
    if (!teacher) return res.json({ results: [] })
    const courses = await Course.find({ teacherId: teacher._id }).select('_id name').lean()
    const courseIds = courses.map((c) => c._id)
    const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

    const results = await Result.find({ courseId: { $in: courseIds } })
      .sort({ createdAt: -1 })
      .lean()

    return res.json({
      results: results.map((r) => ({
        id: r._id,
        courseId: r.courseId,
        courseName: courseNameById.get(r.courseId) ?? '',
        marks: r.marks,
        grade: r.grade,
      })),
    })
  }

  const results = await Result.find().sort({ createdAt: -1 }).lean()
  const courseIds = [...new Set(results.map((r) => r.courseId))]
  const courses = await Course.find({ _id: { $in: courseIds } }).select('_id name').lean()
  const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

  return res.json({
    results: results.map((r) => ({
      id: r._id,
      courseId: r.courseId,
      courseName: courseNameById.get(r.courseId) ?? '',
      marks: r.marks,
      grade: r.grade,
    })),
  })
})

export default router
