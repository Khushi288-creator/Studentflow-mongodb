/**
 * One-time migration: copy existing SQLite (Prisma) data into MongoDB.
 * Preserves original string IDs so face recognition studentId refs stay valid.
 *
 * Usage (from backend/):
 *   npx ts-node --transpile-only scripts/migrate-sqlite-to-mongo.ts
 *
 * Requires DATABASE_URL (SQLite) and MONGO_URI in .env
 */
import 'dotenv/config'
import connectDB from '../src/config/db'
import { prisma } from '../src/lib/prisma'
import {
  User,
  Teacher,
  StudentProfile,
  ParentProfile,
  PasswordResetToken,
  Course,
  StudentEnrollment,
  Assignment,
  AssignmentMaterial,
  Submission,
  AttendanceQrToken,
  Attendance,
  Result,
  Fee,
  FeeStructure,
  Event,
  EventRegistration,
  Notice,
  NoticeRead,
  Doubt,
  Resume,
  StudyTask,
  Timetable,
  ContactMessage,
  Holiday,
  Achievement,
  Salary,
  Activity,
  ActivityFaculty,
  ActivityEnrollment,
  ActivityAttendance,
  ActivityCertificate,
  ParentMeeting,
  ParentMessage,
  Performance,
} from '../src/models'

type Row = Record<string, unknown>

async function upsertMany<T extends { bulkWrite: (ops: unknown[]) => Promise<unknown> }>(
  model: T,
  collection: string,
  rows: Row[],
  map: (r: Row) => Row,
) {
  if (!rows.length) {
    console.log(`  skip ${collection} (empty)`)
    return
  }
  const ops = rows.map((r) => ({
    replaceOne: {
      filter: { _id: r.id },
      replacement: map(r),
      upsert: true,
    },
  }))
  await model.bulkWrite(ops)
  console.log(`  ${collection}: ${rows.length} documents`)
}

function withId(row: Row, fields: Row): Row {
  return { _id: row.id, ...fields }
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required')
    process.exit(1)
  }

  await connectDB()
  console.log('Reading from SQLite via Prisma...')

  const [
    users,
    teachers,
    studentProfiles,
    parentProfiles,
    passwordResetTokens,
    courses,
    enrollments,
    assignments,
    assignmentMaterials,
    submissions,
    attendanceQrTokens,
    attendances,
    results,
    fees,
    feeStructures,
    events,
    eventRegistrations,
    notices,
    noticeReads,
    doubts,
    resumes,
    studyTasks,
    timetables,
    contactMessages,
    holidays,
    achievements,
    salaries,
    activities,
    activityFaculties,
    activityEnrollments,
    activityAttendances,
    activityCertificates,
    parentMeetings,
    parentMessages,
    performances,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.teacher.findMany(),
    prisma.studentProfile.findMany(),
    prisma.parentProfile.findMany(),
    prisma.passwordResetToken.findMany(),
    prisma.course.findMany(),
    prisma.studentEnrollment.findMany(),
    prisma.assignment.findMany(),
    prisma.assignmentMaterial.findMany(),
    prisma.submission.findMany(),
    prisma.attendanceQrToken.findMany(),
    prisma.attendance.findMany(),
    prisma.result.findMany(),
    prisma.fee.findMany(),
    prisma.feeStructure.findMany(),
    prisma.event.findMany(),
    prisma.eventRegistration.findMany(),
    prisma.notice.findMany(),
    prisma.noticeRead.findMany(),
    prisma.doubt.findMany(),
    prisma.resume.findMany(),
    prisma.studyTask.findMany(),
    prisma.timetable.findMany(),
    prisma.contactMessage.findMany(),
    prisma.holiday.findMany(),
    prisma.achievement.findMany(),
    prisma.salary.findMany(),
    prisma.activity.findMany(),
    prisma.activityFaculty.findMany(),
    prisma.activityEnrollment.findMany(),
    prisma.activityAttendance.findMany(),
    prisma.activityCertificate.findMany(),
    prisma.parentMeeting.findMany(),
    prisma.parentMessage.findMany(),
    prisma.performance.findMany(),
  ])

  console.log('Writing to MongoDB...')

  await upsertMany(User, 'users', users as Row[], (u) =>
    withId(u, {
      uniqueId: u.uniqueId ?? null,
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      createdAt: u.createdAt,
    }),
  )

  await upsertMany(Teacher, 'teachers', teachers as Row[], (t) =>
    withId(t, {
      userId: t.userId,
      subject: t.subject,
      phone: t.phone ?? null,
      address: t.address ?? null,
      bloodType: t.bloodType ?? null,
      birthday: t.birthday ?? null,
      sex: t.sex ?? null,
      photoUrl: t.photoUrl ?? null,
      createdAt: t.createdAt,
    }),
  )

  await upsertMany(StudentProfile, 'student_profiles', studentProfiles as Row[], (p) =>
    withId(p, {
      userId: p.userId,
      gender: p.gender ?? null,
      fatherName: p.fatherName ?? null,
      motherName: p.motherName ?? null,
      dob: p.dob ?? null,
      religion: p.religion ?? null,
      fatherOccupation: p.fatherOccupation ?? null,
      address: p.address ?? null,
      className: p.className ?? null,
      phone: p.phone ?? null,
      photoUrl: p.photoUrl ?? null,
      createdAt: p.createdAt,
    }),
  )

  await upsertMany(ParentProfile, 'parent_profiles', parentProfiles as Row[], (p) =>
    withId(p, {
      userId: p.userId,
      phone: p.phone ?? null,
      photoUrl: p.photoUrl ?? null,
      studentId: p.studentId ?? null,
      createdAt: p.createdAt,
    }),
  )

  await upsertMany(PasswordResetToken, 'password_reset_tokens', passwordResetTokens as Row[], (t) =>
    withId(t, {
      userId: t.userId,
      token: t.token,
      expiresAt: t.expiresAt,
      usedAt: t.usedAt ?? null,
      createdAt: t.createdAt,
    }),
  )

  await upsertMany(Course, 'courses', courses as Row[], (c) =>
    withId(c, { name: c.name, teacherId: c.teacherId, createdAt: c.createdAt }),
  )

  await upsertMany(StudentEnrollment, 'student_enrollments', enrollments as Row[], (e) =>
    withId(e, { userId: e.userId, courseId: e.courseId, phone: e.phone, createdAt: e.createdAt }),
  )

  await upsertMany(Assignment, 'assignments', assignments as Row[], (a) =>
    withId(a, {
      courseId: a.courseId,
      title: a.title,
      description: a.description,
      dueDate: a.dueDate,
      createdAt: a.createdAt,
    }),
  )

  await upsertMany(AssignmentMaterial, 'assignment_materials', assignmentMaterials as Row[], (m) =>
    withId(m, { assignmentId: m.assignmentId, fileUrl: m.fileUrl, createdAt: m.createdAt }),
  )

  await upsertMany(Submission, 'submissions', submissions as Row[], (s) =>
    withId(s, {
      assignmentId: s.assignmentId,
      studentId: s.studentId,
      fileUrl: s.fileUrl,
      marks: s.marks ?? null,
      createdAt: s.createdAt,
    }),
  )

  await upsertMany(AttendanceQrToken, 'attendance_qr_tokens', attendanceQrTokens as Row[], (t) =>
    withId(t, {
      courseId: t.courseId,
      token: t.token,
      attendanceDate: t.attendanceDate,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
    }),
  )

  await upsertMany(Attendance, 'attendances', attendances as Row[], (a) =>
    withId(a, {
      studentId: a.studentId,
      courseId: a.courseId,
      date: a.date,
      status: a.status,
      createdAt: a.createdAt,
    }),
  )

  await upsertMany(Result, 'results', results as Row[], (r) =>
    withId(r, {
      studentId: r.studentId,
      courseId: r.courseId,
      marks: r.marks,
      grade: r.grade,
      createdAt: r.createdAt,
    }),
  )

  await upsertMany(Fee, 'fees', fees as Row[], (f) =>
    withId(f, {
      studentId: f.studentId,
      amount: f.amount,
      paidAmount: f.paidAmount,
      status: f.status,
      className: f.className ?? null,
      feeType: f.feeType,
      description: f.description ?? null,
      dueDate: f.dueDate ?? null,
      createdAt: f.createdAt,
    }),
  )

  await upsertMany(FeeStructure, 'fee_structures', feeStructures as Row[], (f) =>
    withId(f, {
      className: f.className,
      feeType: f.feeType,
      amount: f.amount,
      dueDate: f.dueDate ?? null,
      createdAt: f.createdAt,
    }),
  )

  await upsertMany(Event, 'events', events as Row[], (e) =>
    withId(e, {
      title: e.title,
      date: e.date,
      description: e.description,
      status: e.status,
      time: e.time ?? null,
      targetClass: e.targetClass,
      createdAt: e.createdAt,
    }),
  )

  await upsertMany(EventRegistration, 'event_registrations', eventRegistrations as Row[], (r) =>
    withId(r, { eventId: r.eventId, userId: r.userId, createdAt: r.createdAt }),
  )

  await upsertMany(Notice, 'notices', notices as Row[], (n) =>
    withId(n, {
      title: n.title,
      description: n.description,
      date: n.date,
      type: n.type,
      userId: n.userId ?? null,
      createdAt: n.createdAt,
    }),
  )

  await upsertMany(NoticeRead, 'notice_reads', noticeReads as Row[], (r) =>
    withId(r, { noticeId: r.noticeId, userId: r.userId, readAt: r.readAt, createdAt: r.createdAt }),
  )

  await upsertMany(Doubt, 'doubts', doubts as Row[], (d) =>
    withId(d, {
      userId: d.userId,
      studentId: d.studentId ?? null,
      subject: d.subject ?? null,
      question: d.question,
      status: d.status,
      teacherReply: d.teacherReply ?? null,
      createdAt: d.createdAt,
    }),
  )

  await upsertMany(Resume, 'resumes', resumes as Row[], (r) =>
    withId(r, { userId: r.userId, headline: r.headline, summary: r.summary, skills: r.skills }),
  )

  await upsertMany(StudyTask, 'study_tasks', studyTasks as Row[], (t) =>
    withId(t, { userId: t.userId, title: t.title, dueDate: t.dueDate, createdAt: t.createdAt }),
  )

  await upsertMany(Timetable, 'timetables', timetables as Row[], (t) =>
    withId(t, {
      type: t.type,
      class: t.class,
      subject: t.subject,
      date: t.date ?? null,
      time: t.time,
      teacherId: t.teacherId ?? null,
      createdAt: t.createdAt,
    }),
  )

  await upsertMany(ContactMessage, 'contact_messages', contactMessages as Row[], (m) =>
    withId(m, {
      userId: m.userId ?? null,
      name: m.name,
      email: m.email,
      message: m.message,
      teacherId: m.teacherId ?? null,
      category: m.category,
      senderRole: m.senderRole,
      status: m.status,
      adminReply: m.adminReply ?? null,
      createdAt: m.createdAt,
    }),
  )

  await upsertMany(Holiday, 'holidays', holidays as Row[], (h) =>
    withId(h, { name: h.name, date: h.date, createdAt: h.createdAt }),
  )

  await upsertMany(Achievement, 'achievements', achievements as Row[], (a) =>
    withId(a, {
      studentId: a.studentId,
      title: a.title,
      type: a.type,
      rank: a.rank ?? null,
      date: a.date ?? null,
      createdAt: a.createdAt,
    }),
  )

  await upsertMany(Salary, 'salaries', salaries as Row[], (s) =>
    withId(s, {
      teacherId: s.teacherId,
      month: s.month,
      year: s.year,
      baseSalary: s.baseSalary,
      hra: s.hra,
      bonus: s.bonus,
      leaveDeduction: s.leaveDeduction,
      latePenalty: s.latePenalty,
      netSalary: s.netSalary,
      status: s.status,
      paidAt: s.paidAt ?? null,
      createdAt: s.createdAt,
    }),
  )

  await upsertMany(Activity, 'activities', activities as Row[], (a) =>
    withId(a, {
      name: a.name,
      description: a.description,
      duration: a.duration,
      fees: a.fees,
      scheduleDays: a.scheduleDays,
      scheduleTime: a.scheduleTime ?? null,
      targetClass: a.targetClass,
      capacity: a.capacity ?? null,
      level: a.level,
      batch: a.batch,
      icon: a.icon,
      createdAt: a.createdAt,
    }),
  )

  await upsertMany(ActivityFaculty, 'activity_faculties', activityFaculties as Row[], (f) =>
    withId(f, {
      name: f.name,
      activityId: f.activityId,
      salaryType: f.salaryType,
      salaryAmount: f.salaryAmount,
      createdAt: f.createdAt,
    }),
  )

  await upsertMany(ActivityEnrollment, 'activity_enrollments', activityEnrollments as Row[], (e) =>
    withId(e, {
      studentId: e.studentId,
      activityId: e.activityId,
      paymentStatus: e.paymentStatus,
      rating: e.rating ?? null,
      createdAt: e.createdAt,
    }),
  )

  await upsertMany(ActivityAttendance, 'activity_attendances', activityAttendances as Row[], (a) =>
    withId(a, {
      studentId: a.studentId,
      activityId: a.activityId,
      date: a.date,
      status: a.status,
      createdAt: a.createdAt,
    }),
  )

  await upsertMany(ActivityCertificate, 'activity_certificates', activityCertificates as Row[], (c) =>
    withId(c, {
      studentId: c.studentId,
      activityId: c.activityId,
      issuedDate: c.issuedDate,
      createdAt: c.createdAt,
    }),
  )

  await upsertMany(ParentMeeting, 'parent_meetings', parentMeetings as Row[], (m) =>
    withId(m, {
      parentId: m.parentId,
      teacherId: m.teacherId,
      studentId: m.studentId,
      date: m.date,
      time: m.time,
      status: m.status,
      note: m.note ?? null,
      createdAt: m.createdAt,
    }),
  )

  await upsertMany(ParentMessage, 'parent_messages', parentMessages as Row[], (m) =>
    withId(m, {
      parentId: m.parentId,
      teacherId: m.teacherId,
      senderId: m.senderId,
      text: m.text,
      createdAt: m.createdAt,
    }),
  )

  await upsertMany(Performance, 'performances', performances as Row[], (p) =>
    withId(p, {
      studentId: p.studentId,
      subject: p.subject,
      marks: p.marks,
      examName: p.examName,
      createdAt: p.createdAt,
    }),
  )

  console.log('✅ Migration complete. StudentFace/FaceAttendance were already in MongoDB.')
}

main()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
