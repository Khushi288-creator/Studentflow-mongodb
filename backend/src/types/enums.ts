export const ROLES = ['student', 'teacher', 'admin', 'parent'] as const
export type Role = (typeof ROLES)[number]

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const FEE_STATUSES = ['paid', 'pending', 'overdue'] as const
export type FeeStatus = (typeof FEE_STATUSES)[number]

export const DOUBT_STATUSES = ['open', 'answered'] as const
export type DoubtStatus = (typeof DOUBT_STATUSES)[number]
