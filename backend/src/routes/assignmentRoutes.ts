import express from 'express'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { submissionUpload, materialsUpload } from '../utils/upload'
import { StudentEnrollment } from '../models/StudentEnrollment'
import { Course } from '../models/Course'
import { Assignment } from '../models/Assignment'
import { Teacher } from '../models/Teacher'
import { StudentProfile } from '../models/StudentProfile'
import { Notice } from '../models/Notice'
import { AssignmentMaterial } from '../models/AssignmentMaterial'
import { Submission } from '../models/Submission'
import { Result } from '../models/Result'
import { User } from '../models/User'
import { leanDoc } from '../utils/mongoHelpers'

const router = express.Router()

router.get('/assignments', authenticateJWT, async (req, res) => {
  const role = req.auth!.role
  const courseId = (req.query.courseId as string | undefined) ?? undefined
  const now = new Date()

  if (role === 'student') {
    const enrollments = await StudentEnrollment.find({ userId: req.auth!.userId })
      .select('courseId')
      .lean()
    void enrollments

    const allCourses = await Course.find().select('_id').lean()
    const allCourseIds = allCourses.map((c) => c._id)

    const filter = courseId ? { courseId } : { courseId: { $in: allCourseIds } }
    const assignments = await Assignment.find(filter).sort({ dueDate: 1 }).lean()
    const courseIds = [...new Set(assignments.map((a) => a.courseId))]
    const courses = await Course.find({ _id: { $in: courseIds } }).select('name').lean()
    const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

    return res.json({
      assignments: assignments.map((a) => ({
        ...leanDoc(a),
        courseName: courseNameById.get(a.courseId),
        dueDate: new Date(a.dueDate).toISOString().slice(0, 10),
      })),
    })
  }

  if (role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
    if (!teacher) return res.json({ assignments: [] })
    const courses = await Course.find({ teacherId: teacher._id }).select('_id').lean()
    const courseIds = courses.map((c) => c._id)
    const filter = courseId ? { courseId } : { courseId: { $in: courseIds } }
    const assignments = await Assignment.find(filter).sort({ dueDate: 1 }).lean()
    return res.json({ assignments: assignments.map((a) => leanDoc(a)) })
  }

  const filter = courseId ? { courseId } : {}
  const assignments = await Assignment.find(filter).sort({ dueDate: 1 }).lean()

  void now
  return res.json({ assignments: assignments.map((a) => leanDoc(a)) })
})

const createAssignmentSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().min(5),
  dueDate: z.string().min(1),
  className: z.string().optional(),
})

router.post('/assignments', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  try {
    const parsed = createAssignmentSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { courseId, title, description, dueDate, className } = parsed.data

    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
    if (!teacher) return res.status(403).json({ message: 'Teacher profile missing' })

    const course = await Course.findOne({ _id: courseId, teacherId: teacher._id })
      .select('name')
      .lean()
    if (!course) return res.status(403).json({ message: 'Not allowed for this course' })

    const assignment = await Assignment.create({
      courseId,
      title,
      description,
      dueDate: new Date(dueDate),
    })

    const enrollments = await StudentEnrollment.find({ courseId }).select('userId').lean()
    let targetUserIds: string[] = enrollments.map((e) => e.userId)

    if (className) {
      const profiles = await StudentProfile.find({
        userId: { $in: targetUserIds },
        className,
      })
        .select('userId')
        .lean()
      const classUserIds = new Set(profiles.map((p) => p.userId))

      const allClassProfiles = await StudentProfile.find({ className }).select('userId').lean()
      const allClassUserIds = allClassProfiles.map((p) => p.userId)

      targetUserIds = [...new Set([...classUserIds, ...allClassUserIds])]
    }

    for (const userId of targetUserIds) {
      await Notice.create({
        title: `New Assignment: ${title}`,
        description: `Your teacher posted a new assignment in ${course.name}${className ? ` for Class ${className}` : ''}. Due: ${dueDate}`,
        type: 'assignment',
        userId,
      })
    }

    res.status(201).json({ assignment: leanDoc(assignment.toObject()) })
  } catch (err) {
    console.error('[POST /assignments]', err)
    res.status(500).json({ message: 'Failed to create assignment' })
  }
})

router.get('/assignments/:assignmentId/materials', authenticateJWT, async (req, res) => {
  const assignmentId = Array.isArray(req.params.assignmentId)
    ? req.params.assignmentId[0]
    : req.params.assignmentId
  const materials = await AssignmentMaterial.find({ assignmentId }).sort({ createdAt: 1 }).lean()
  res.json({ materials: materials.map((m) => ({ id: m._id, fileUrl: m.fileUrl })) })
})

router.get('/assignments/my-submissions', authenticateJWT, requireRole(['student']), async (req, res) => {
  const enrollments = await StudentEnrollment.find({ userId: req.auth!.userId }).select('_id').lean()
  const studentIds = enrollments.map((e) => e._id)
  const submissions = await Submission.find({ studentId: { $in: studentIds } })
    .select('assignmentId')
    .lean()
  res.json({ submittedIds: submissions.map((s) => s.assignmentId) })
})

router.get('/assignments/:assignmentId/submissions', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  const assignmentId = req.params.assignmentId as string

  const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
  if (!teacher) return res.status(403).json({ message: 'Teacher profile missing' })

  const assignment = await Assignment.findById(assignmentId).lean()
  if (!assignment) return res.status(404).json({ message: 'Assignment not found' })

  const course = await Course.findById(assignment.courseId).select('name teacherId').lean()
  if (!course || course.teacherId !== teacher._id) {
    return res.status(403).json({ message: 'Not your assignment' })
  }

  const submissions = await Submission.find({ assignmentId }).sort({ createdAt: -1 }).lean()
  const enrollmentIds = [...new Set(submissions.map((s) => s.studentId))]
  const enrollments = await StudentEnrollment.find({ _id: { $in: enrollmentIds } }).lean()
  const enrollmentById = new Map(enrollments.map((e) => [e._id, e]))
  const userIds = [...new Set(enrollments.map((e) => e.userId))]
  const courseIds = [...new Set(enrollments.map((e) => e.courseId))]
  const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
  const courses = await Course.find({ _id: { $in: courseIds } }).select('name').lean()
  const userNameById = new Map(users.map((u) => [u._id, u.name]))
  const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

  return res.json({
    submissions: submissions.map((s) => {
      const enrollment = enrollmentById.get(s.studentId)
      return {
        id: s._id,
        studentName: enrollment ? (userNameById.get(enrollment.userId) ?? '') : '',
        subject: enrollment ? (courseNameById.get(enrollment.courseId) ?? '') : '',
        fileUrl: s.fileUrl,
        marks: s.marks,
        submittedAt: s.createdAt,
      }
    }),
  })
})

router.post(
  '/assignments/:assignmentId/submit',
  authenticateJWT,
  requireRole(['student']),
  submissionUpload.single('file'),
  async (req, res) => {
    const assignmentId = Array.isArray(req.params.assignmentId)
      ? req.params.assignmentId[0]
      : req.params.assignmentId
    const file = req.file
    if (!file) return res.status(400).json({ message: 'Missing file' })

    const assignment = await Assignment.findById(assignmentId).select('courseId').lean()
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' })

    let enrollment = await StudentEnrollment.findOne({
      userId: req.auth!.userId,
      courseId: assignment.courseId,
    }).lean()
    if (!enrollment) {
      const created = await StudentEnrollment.create({
        userId: req.auth!.userId,
        courseId: assignment.courseId,
        phone: 'NA',
      })
      enrollment = created.toObject()
    }

    const submission = await Submission.create({
      assignmentId,
      studentId: enrollment._id,
      fileUrl: `/uploads/submissions/${file.filename}`,
    })

    const marks = 55 + Math.floor(Math.random() * 40)
    const grade =
      marks >= 90
        ? 'A+'
        : marks >= 80
          ? 'A'
          : marks >= 70
            ? 'B'
            : marks >= 60
              ? 'C'
              : marks >= 50
                ? 'D'
                : 'F'

    await Submission.findByIdAndUpdate(submission.id, { marks })

    await Result.findOneAndUpdate(
      { studentId: enrollment._id, courseId: assignment.courseId },
      { $set: { marks, grade }, $setOnInsert: { studentId: enrollment._id, courseId: assignment.courseId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    await Notice.create({
      title: `Result Declared`,
      description: `Your assignment has been graded. Marks: ${marks}, Grade: ${grade}.`,
      type: 'result',
      userId: req.auth!.userId,
    })

    const assignmentWithCourse = await Assignment.findById(assignmentId).lean()
    const studentUser = await User.findById(req.auth!.userId).select('name').lean()
    if (assignmentWithCourse) {
      const course = await Course.findById(assignmentWithCourse.courseId).lean()
      const teacher = course ? await Teacher.findById(course.teacherId).select('userId').lean() : null
      if (teacher) {
        await Notice.create({
          title: `Assignment Submitted`,
          description: `${studentUser?.name ?? 'A student'} submitted "${assignmentWithCourse.title}" in ${course!.name}.`,
          type: 'assignment',
          userId: teacher.userId,
        })
      }
    }

    res.status(201).json({ submission: { ...leanDoc(submission.toObject()), marks } })
  },
)

router.post(
  '/assignments/:assignmentId/materials',
  authenticateJWT,
  requireRole(['teacher']),
  materialsUpload.single('file'),
  async (req, res) => {
    const assignmentId = Array.isArray(req.params.assignmentId)
      ? req.params.assignmentId[0]
      : req.params.assignmentId
    const file = req.file
    if (!file) return res.status(400).json({ message: 'Missing file' })

    const assignment = await Assignment.findById(assignmentId).select('courseId').lean()
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' })

    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
    if (!teacher) return res.status(403).json({ message: 'Teacher profile missing' })

    const course = await Course.findOne({ _id: assignment.courseId, teacherId: teacher._id })
      .select('_id')
      .lean()
    if (!course) return res.status(403).json({ message: 'Not allowed for this course' })

    const material = await AssignmentMaterial.create({
      assignmentId,
      fileUrl: `/uploads/materials/${file.filename}`,
    })

    res.status(201).json({ material: leanDoc(material.toObject()) })
  },
)

export default router
