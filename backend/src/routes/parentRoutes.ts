import express from 'express'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { photoUpload } from '../utils/upload'
import { User } from '../models/User'
import { ParentProfile } from '../models/ParentProfile'
import { StudentProfile } from '../models/StudentProfile'
import { StudentEnrollment } from '../models/StudentEnrollment'
import { Attendance } from '../models/Attendance'
import { Fee } from '../models/Fee'
import { Course } from '../models/Course'
import { Assignment } from '../models/Assignment'
import { Submission } from '../models/Submission'
import { Result } from '../models/Result'
import { Achievement } from '../models/Achievement'
import { ActivityEnrollment } from '../models/ActivityEnrollment'
import { Activity } from '../models/Activity'
import { Event } from '../models/Event'
import { Holiday } from '../models/Holiday'
import { Performance } from '../models/Performance'
import { Timetable } from '../models/Timetable'
import { Notice } from '../models/Notice'
import { ParentMeeting } from '../models/ParentMeeting'
import { ParentMessage } from '../models/ParentMessage'
import { Teacher } from '../models/Teacher'
import { leanDoc } from '../utils/mongoHelpers'

const router = express.Router()

async function notifyUser(userId: string, title: string, description: string, type = 'info') {
  await Notice.create({ title, description, type, userId })
}

router.get('/admin/parents', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  try {
    const parents = await User.find({ role: 'parent' }).sort({ createdAt: -1 }).lean()
    const parentProfiles = await ParentProfile.find({ userId: { $in: parents.map((p) => p._id) } }).lean()
    const profileByUserId = new Map(parentProfiles.map((p) => [p.userId, p]))

    const students = await User.find({ role: 'student' }).select('name').lean()
    const studentProfiles = await StudentProfile.find({ userId: { $in: students.map((s) => s._id) } })
      .select('userId className')
      .lean()
    const classNameByStudent = new Map(studentProfiles.map((p) => [p.userId, p.className]))
    const studentNameById = new Map(students.map((s) => [s._id, s.name]))

    res.json({
      parents: parents.map((p) => {
        const profile = profileByUserId.get(p._id)
        return {
          id: p._id,
          name: p.name,
          email: p.email,
          createdAt: p.createdAt,
          uniqueId: (p as any).uniqueId ?? (p.email.endsWith('@school.local') ? p.email.replace('@school.local', '') : null),
          phone: profile?.phone ?? null,
          photoUrl: profile?.photoUrl ?? null,
          studentId: profile?.studentId ?? null,
          profileId: profile?._id ?? null,
          studentName: profile?.studentId ? (studentNameById.get(profile.studentId) ?? null) : null,
        }
      }),
      students: students.map((s) => ({
        id: s._id,
        name: s.name,
        className: classNameByStudent.get(s._id) ?? null,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.post('/admin/parents', authenticateJWT, requireRole(['admin']),
  photoUpload.single('photo'), async (req, res) => {
    try {
      const { name, phone, password, studentId } = req.body
      if (!name || !password) return res.status(400).json({ message: 'Name and password required' })

      const count = await User.countDocuments({ role: 'parent' })
      let num = count + 1
      let uniqueId = `PAR${String(num).padStart(3, '0')}`
      while (await User.findOne({ email: `${uniqueId}@school.local` }).lean()) {
        num++
        uniqueId = `PAR${String(num).padStart(3, '0')}`
      }
      const email = `${uniqueId}@school.local`

      const hash = await bcrypt.hash(password, 12)
      const user = await User.create({ name, email, password: hash, role: 'parent', uniqueId })
      const photoUrl = req.file ? `/uploads/photos/${req.file.filename}` : null
      await ParentProfile.create({
        userId: user.id,
        phone: phone || null,
        photoUrl,
        studentId: studentId || null,
      })

      if (studentId) {
        await notifyUser(studentId, '👨‍👩‍👧 Parent Linked', `A parent account has been created and linked to your profile.`, 'info')
      }

      res.status(201).json({ parent: { id: user.id, name, uniqueId, loginId: uniqueId } })
    } catch (err: any) {
      res.status(500).json({ message: err?.message })
    }
  })

router.put('/admin/parents/:id', authenticateJWT, requireRole(['admin']),
  photoUpload.single('photo'), async (req, res) => {
    try {
      const userId = req.params.id as string
      const { name, phone, studentId } = req.body

      if (name) await User.findByIdAndUpdate(userId, { name })

      const updateData: Record<string, unknown> = {}
      if (phone !== undefined) updateData.phone = phone || null
      if (studentId !== undefined) updateData.studentId = studentId || null
      if (req.file) updateData.photoUrl = `/uploads/photos/${req.file.filename}`

      await ParentProfile.findOneAndUpdate(
        { userId },
        { $set: updateData, $setOnInsert: { userId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )

      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ message: err?.message })
    }
  })

router.delete('/admin/parents/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id as string)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.get('/parents/me', authenticateJWT, requireRole(['parent']), async (req, res) => {
  try {
    const userId = req.auth!.userId
    const parent = await User.findById(userId).lean()
    const parentProfile = await ParentProfile.findOne({ userId }).lean()

    if (!parentProfile?.studentId) {
      return res.json({
        parent: { id: parent!._id, name: parent!.name, email: parent!.email },
        child: null,
      })
    }

    const studentId = parentProfile.studentId
    const child = await User.findById(studentId).lean()
    const childProfile = child ? await StudentProfile.findOne({ userId: child._id }).lean() : null

    res.json({
      parent: {
        id: parent!._id,
        name: parent!.name,
        email: parent!.email,
        phone: parentProfile.phone,
        photoUrl: parentProfile.photoUrl,
        profileId: parentProfile._id,
      },
      child: child
        ? {
            id: child._id,
            name: child.name,
            className: childProfile?.className ?? null,
            photoUrl: childProfile?.photoUrl ?? null,
            gender: childProfile?.gender ?? null,
          }
        : null,
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.get('/parents/dashboard', authenticateJWT, requireRole(['parent']), async (req, res) => {
  try {
    const userId = req.auth!.userId
    const profile = await ParentProfile.findOne({ userId }).lean()
    if (!profile?.studentId) return res.json({ child: null })

    const studentUserId = profile.studentId

    const child = await User.findById(studentUserId).lean()
    const childProfile = await StudentProfile.findOne({ userId: studentUserId }).lean()

    const enrollments = await StudentEnrollment.find({ userId: studentUserId })
      .select('_id courseId')
      .lean()
    const enrollmentIds = enrollments.map((e) => e._id)
    const courseIds = enrollments.map((e) => e.courseId)

    const attendance = await Attendance.find({ studentId: { $in: enrollmentIds } })
      .select('status')
      .lean()
    const totalAtt = attendance.length
    const presentAtt = attendance.filter((a) => a.status === 'present').length
    const attendancePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0

    const fees = await Fee.find({ studentId: { $in: enrollmentIds } })
      .select('amount paidAmount status feeType dueDate')
      .lean()
    const totalFees = fees.reduce((a, f) => a + f.amount, 0)
    const paidFees = fees.reduce((a, f) => a + f.paidAmount, 0)
    const pendingFees = totalFees - paidFees

    const allCourses = await Course.find().select('_id').lean()
    const assignments = await Assignment.find({ courseId: { $in: allCourses.map((c) => c._id) } })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean()
    const assignmentCourseIds = [...new Set(assignments.map((a) => a.courseId))]
    const assignmentCourses = await Course.find({ _id: { $in: assignmentCourseIds } }).select('name').lean()
    const courseNameById = new Map(assignmentCourses.map((c) => [c._id, c.name]))

    const submissions = await Submission.find({ studentId: { $in: enrollmentIds } })
      .select('assignmentId')
      .lean()
    const submittedIds = new Set(submissions.map((s) => s.assignmentId))

    const results = await Result.find({ studentId: { $in: enrollmentIds } })
      .sort({ createdAt: -1 })
      .lean()
    const resultCourseIds = [...new Set(results.map((r) => r.courseId))]
    const resultCourses = await Course.find({ _id: { $in: resultCourseIds } }).select('name').lean()
    const resultCourseNameById = new Map(resultCourses.map((c) => [c._id, c.name]))

    const achievements = await Achievement.find({ studentId: studentUserId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()

    const activityEnrollments = await ActivityEnrollment.find({ studentId: studentUserId }).lean()
    const activityIds = [...new Set(activityEnrollments.map((e) => e.activityId))]
    const activities = await Activity.find({ _id: { $in: activityIds } })
      .select('name icon scheduleDays fees')
      .lean()
    const activityById = new Map(activities.map((a) => [a._id, a]))

    const events = await Event.find({ date: { $gte: new Date() } })
      .sort({ date: 1 })
      .limit(5)
      .select('title date description')
      .lean()

    const holidays = await Holiday.find().sort({ date: 1 }).limit(5).lean()

    const performance = await Performance.find({ studentId: studentUserId })
      .sort({ createdAt: -1 })
      .lean()

    const timetable = await Timetable.find({ class: childProfile?.className ?? '' })
      .sort({ time: 1 })
      .lean()

    const alerts: { type: string; message: string }[] = []
    if (attendancePct < 75 && totalAtt > 0) {
      alerts.push({ type: 'warning', message: `⚠ Low attendance: ${attendancePct}% (minimum 75% required)` })
    }
    if (pendingFees > 0) {
      alerts.push({ type: 'danger', message: `🔴 Fees pending: ₹${pendingFees.toLocaleString('en-IN')}` })
    }
    const pendingAssignments = assignments.filter(
      (a) => !submittedIds.has(a._id) && new Date(a.dueDate) >= new Date(),
    )
    if (pendingAssignments.length > 0) {
      alerts.push({ type: 'info', message: `📚 ${pendingAssignments.length} assignment(s) pending submission` })
    }

    res.json({
      child: {
        id: child!._id,
        name: child!.name,
        className: childProfile?.className ?? null,
        photoUrl: childProfile?.photoUrl ?? null,
        gender: childProfile?.gender ?? null,
      },
      attendance: { total: totalAtt, present: presentAtt, percentage: attendancePct },
      fees: { total: totalFees, paid: paidFees, pending: pendingFees, records: fees.map((f) => leanDoc(f)) },
      assignments: assignments.map((a) => ({
        id: a._id,
        title: a.title,
        courseName: courseNameById.get(a.courseId),
        dueDate: new Date(a.dueDate).toISOString().slice(0, 10),
        submitted: submittedIds.has(a._id),
      })),
      results: results.map((r) => ({
        id: r._id,
        courseName: resultCourseNameById.get(r.courseId),
        marks: r.marks,
        grade: r.grade,
      })),
      achievements: achievements.map((a) => leanDoc(a)),
      activityEnrollments: activityEnrollments.map((e) => {
        const activity = activityById.get(e.activityId)
        return {
          id: e._id,
          activityName: activity?.name ?? '',
          icon: activity?.icon ?? '',
          scheduleDays: activity?.scheduleDays ?? '',
          fees: activity?.fees ?? 0,
          paymentStatus: e.paymentStatus,
        }
      }),
      events: events.map((e) => ({
        id: e._id,
        title: e.title,
        description: e.description,
        date: new Date(e.date).toISOString().slice(0, 10),
      })),
      holidays: holidays.map((h) => leanDoc(h)),
      performance: performance.map((p) => leanDoc(p)),
      timetable: timetable.map((t) => leanDoc(t)),
      alerts,
    })
  } catch (err: any) {
    console.error('[GET /parents/dashboard]', err?.message)
    res.status(500).json({ message: err?.message })
  }
})

router.get('/parent-meetings', authenticateJWT, async (req, res) => {
  try {
    const { userId, role } = req.auth!
    let meetings

    if (role === 'parent') {
      const profile = await ParentProfile.findOne({ userId }).lean()
      if (!profile) return res.json({ meetings: [] })
      meetings = await ParentMeeting.find({ parentId: profile._id }).sort({ createdAt: -1 }).lean()
      const teacherIds = [...new Set(meetings.map((m) => m.teacherId))]
      const teachers = await User.find({ _id: { $in: teacherIds } }).select('name').lean()
      const teacherNameById = new Map(teachers.map((t) => [t._id, t.name]))
      return res.json({
        meetings: meetings.map((m) => ({
          id: m._id,
          date: m.date,
          time: m.time,
          status: m.status,
          note: m.note,
          teacherName: teacherNameById.get(m.teacherId) ?? null,
          parentName: null,
          studentId: m.studentId,
        })),
      })
    }

    if (role === 'teacher') {
      meetings = await ParentMeeting.find({ teacherId: userId }).sort({ createdAt: -1 }).lean()
      const parentProfileIds = [...new Set(meetings.map((m) => m.parentId))]
      const parentProfiles = await ParentProfile.find({ _id: { $in: parentProfileIds } }).lean()
      const parentUserIds = [...new Set(parentProfiles.map((p) => p.userId))]
      const parentUsers = await User.find({ _id: { $in: parentUserIds } }).select('name').lean()
      const parentProfileById = new Map(parentProfiles.map((p) => [p._id, p]))
      const parentNameByUserId = new Map(parentUsers.map((u) => [u._id, u.name]))

      return res.json({
        meetings: meetings.map((m) => {
          const pp = parentProfileById.get(m.parentId)
          return {
            id: m._id,
            date: m.date,
            time: m.time,
            status: m.status,
            note: m.note,
            teacherName: null,
            parentName: pp ? (parentNameByUserId.get(pp.userId) ?? null) : null,
            studentId: m.studentId,
          }
        }),
      })
    }

    meetings = await ParentMeeting.find().sort({ createdAt: -1 }).lean()
    const teacherIds = [...new Set(meetings.map((m) => m.teacherId))]
    const parentProfileIds = [...new Set(meetings.map((m) => m.parentId))]
    const teachers = await User.find({ _id: { $in: teacherIds } }).select('name').lean()
    const parentProfiles = await ParentProfile.find({ _id: { $in: parentProfileIds } }).lean()
    const parentUserIds = [...new Set(parentProfiles.map((p) => p.userId))]
    const parentUsers = await User.find({ _id: { $in: parentUserIds } }).select('name').lean()
    const teacherNameById = new Map(teachers.map((t) => [t._id, t.name]))
    const parentProfileById = new Map(parentProfiles.map((p) => [p._id, p]))
    const parentNameByUserId = new Map(parentUsers.map((u) => [u._id, u.name]))

    res.json({
      meetings: meetings.map((m) => {
        const pp = parentProfileById.get(m.parentId)
        return {
          id: m._id,
          date: m.date,
          time: m.time,
          status: m.status,
          note: m.note,
          teacherName: teacherNameById.get(m.teacherId) ?? null,
          parentName: pp ? (parentNameByUserId.get(pp.userId) ?? null) : null,
          studentId: m.studentId,
        }
      }),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.post('/parent-meetings', authenticateJWT, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { parentId, studentId, date, time, note } = req.body
    if (!parentId || !studentId || !date || !time) {
      return res.status(400).json({ message: 'parentId, studentId, date, time required' })
    }

    const meeting = await ParentMeeting.create({
      parentId,
      teacherId: req.auth!.userId,
      studentId,
      date,
      time,
      note: note || null,
    })

    const profile = await ParentProfile.findById(parentId).lean()
    if (profile) {
      await notifyUser(
        profile.userId,
        '📅 Meeting Scheduled',
        `A parent-teacher meeting has been scheduled on ${date} at ${time}.`,
        'meeting',
      )
    }

    res.status(201).json({ meeting: leanDoc(meeting.toObject()) })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.patch('/parent-meetings/:id', authenticateJWT, requireRole(['parent']), async (req, res) => {
  try {
    const { status } = req.body
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const meeting = await ParentMeeting.findByIdAndUpdate(
      req.params.id as string,
      { status },
      { new: true },
    ).lean()
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' })

    await notifyUser(
      meeting.teacherId,
      `📅 Meeting ${status}`,
      `Parent has ${status} the meeting scheduled on ${meeting.date}.`,
      'meeting',
    )
    res.json({ meeting: leanDoc(meeting) })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.get('/performance', authenticateJWT, async (req, res) => {
  try {
    const { userId, role } = req.auth!
    let studentUserId = req.query.studentId as string | undefined

    if (role === 'parent') {
      const profile = await ParentProfile.findOne({ userId }).lean()
      studentUserId = profile?.studentId ?? undefined
    }

    if (!studentUserId) return res.json({ performance: [] })

    const performance = await Performance.find({ studentId: studentUserId })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ performance: performance.map((p) => leanDoc(p)) })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.post('/performance', authenticateJWT, requireRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { studentId, subject, marks, examName } = req.body
    if (!studentId || !subject || marks === undefined || !examName) {
      return res.status(400).json({ message: 'studentId, subject, marks, examName required' })
    }
    const perf = await Performance.create({
      studentId,
      subject,
      marks: Number(marks),
      examName,
    })
    const parentProfile = await ParentProfile.findOne({ studentId }).lean()
    if (parentProfile) {
      await notifyUser(
        parentProfile.userId,
        '📊 New Result Added',
        `${examName}: ${subject} — ${marks} marks`,
        'result',
      )
    }
    res.status(201).json({ performance: leanDoc(perf.toObject()) })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.get('/parent-messages/:teacherId', authenticateJWT, async (req, res) => {
  try {
    const { userId, role } = req.auth!
    const teacherId = req.params.teacherId as string

    let parentId: string | null = null
    if (role === 'parent') {
      const profile = await ParentProfile.findOne({ userId }).lean()
      parentId = profile?._id ?? null
    } else {
      parentId = req.query.parentId as string
    }

    if (!parentId) return res.json({ messages: [] })

    const messages = await ParentMessage.find({ parentId, teacherId }).sort({ createdAt: 1 }).lean()
    res.json({ messages: messages.map((m) => leanDoc(m)) })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.post('/parent-messages', authenticateJWT, async (req, res) => {
  try {
    const { userId, role } = req.auth!
    const { teacherId, text, parentId: bodyParentId } = req.body
    if (!teacherId || !text) return res.status(400).json({ message: 'teacherId and text required' })

    let parentId = bodyParentId
    if (role === 'parent') {
      const profile = await ParentProfile.findOne({ userId }).lean()
      parentId = profile?._id
    }
    if (!parentId) return res.status(400).json({ message: 'parentId required' })

    const msg = await ParentMessage.create({
      parentId,
      teacherId,
      senderId: userId,
      text,
    })

    if (role === 'parent') {
      await notifyUser(teacherId, '💬 New Message from Parent', text.slice(0, 80), 'message')
    } else {
      const profile = await ParentProfile.findById(parentId).lean()
      if (profile) {
        await notifyUser(profile.userId, '💬 New Message from Teacher', text.slice(0, 80), 'message')
      }
    }

    res.status(201).json({ message: leanDoc(msg.toObject()) })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.get('/parents/list', authenticateJWT, requireRole(['teacher', 'admin']), async (_req, res) => {
  try {
    const parents = await User.find({ role: 'parent' }).lean()
    const parentProfiles = await ParentProfile.find({ userId: { $in: parents.map((p) => p._id) } }).lean()
    const profileByUserId = new Map(parentProfiles.map((p) => [p.userId, p]))
    const students = await User.find({ role: 'student' }).select('name').lean()
    const studentNameById = new Map(students.map((s) => [s._id, s.name]))

    res.json({
      parents: parents.map((p) => {
        const profile = profileByUserId.get(p._id)
        return {
          id: p._id,
          name: p.name,
          profileId: profile?._id,
          studentId: profile?.studentId,
          studentName: profile?.studentId ? (studentNameById.get(profile.studentId) ?? null) : null,
        }
      }),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

router.get('/parents/teachers', authenticateJWT, requireRole(['parent']), async (_req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).select('name').sort({ name: 1 }).lean()
    const teacherProfiles = await Teacher.find({ userId: { $in: teachers.map((t) => t._id) } })
      .select('userId subject')
      .lean()
    const subjectByUserId = new Map(teacherProfiles.map((t) => [t.userId, t.subject]))

    res.json({
      teachers: teachers.map((t) => ({
        id: t._id,
        name: t.name,
        subject: subjectByUserId.get(t._id) ?? null,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message })
  }
})

export default router
