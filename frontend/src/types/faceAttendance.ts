export type FaceAttendanceRecord = {
  id: string
  studentId: string
  studentName: string
  classId: string | null
  date: string
  time: string
  status: 'present' | 'absent'
  markedBy?: string
}

export type FaceAttendanceStats = {
  total: number
  present: number
  absent: number
  percentage: number
}

export type FaceAttendanceStudentResponse = {
  studentId: string
  stats: FaceAttendanceStats
  attendance: FaceAttendanceRecord[]
}
