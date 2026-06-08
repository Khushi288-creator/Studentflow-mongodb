import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Page } from '../../components/ui/Page'
import {
  detectFaceFromVideo,
  findBestFaceMatch,
  loadFaceModels,
  type RegisteredFace,
} from '../../lib/faceApi'

type MarkResult = {
  studentName: string
  studentId: string
  time: string
}

export default function FaceAttendanceScan() {
  const queryClient = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLockRef = useRef(false)
  const markedTodayRef = useRef<Set<string>>(new Set())

  const [modelsReady, setModelsReady] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [classFilter, setClassFilter] = useState('')
  const [lastMatch, setLastMatch] = useState<MarkResult | null>(null)
  const [recentMarks, setRecentMarks] = useState<MarkResult[]>([])
  const [scanning, setScanning] = useState(true)

  const facesQuery = useQuery({
    queryKey: ['registeredFaces'],
    queryFn: async () => {
      const res = await http.get('/faces/all')
      return res.data as { faces: RegisteredFace[] }
    },
  })

  const classes = Array.from(
    new Set((facesQuery.data?.faces ?? []).map((f) => f.classId).filter(Boolean) as string[]),
  ).sort()

  const registeredFaces = (facesQuery.data?.faces ?? []).filter(
    (f) => !classFilter || f.classId === classFilter,
  )

  const markMutation = useMutation({
    mutationFn: async (payload: { studentId: string; classId: string | null }) => {
      const res = await http.post('/attendance/mark', payload)
      return res.data as { attendance: { studentName: string; studentId: string; time: string } }
    },
    onSuccess: (data) => {
      const hit: MarkResult = {
        studentName: data.attendance.studentName,
        studentId: data.attendance.studentId,
        time: data.attendance.time,
      }
      setLastMatch(hit)
      setRecentMarks((prev) => [hit, ...prev].slice(0, 8))
      markedTodayRef.current.add(data.attendance.studentId)
      queryClient.invalidateQueries({ queryKey: ['faceAttendance'] })
    },
  })
  const markAsyncRef = useRef(markMutation.mutateAsync)
  markAsyncRef.current = markMutation.mutateAsync

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access in your browser settings.'
          : err instanceof Error
            ? err.message
            : 'Camera not available on this device.'
      setCameraError(msg)
      setCameraReady(false)
    }
  }, [])

  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => setModelsError('Failed to load face recognition models from CDN.'))
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (!scanning || !modelsReady || !cameraReady || registeredFaces.length === 0) return

    let cancelled = false
    const interval = window.setInterval(async () => {
      if (cancelled || scanLockRef.current || markMutation.isPending) return
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      scanLockRef.current = true
      try {
        const descriptor = await detectFaceFromVideo(video)
        if (!descriptor) return

        const match = findBestFaceMatch(descriptor, registeredFaces)
        if (!match) return
        if (markedTodayRef.current.has(match.face.studentId)) return

        const res = await markAsyncRef.current({
          studentId: match.face.studentId,
          classId: match.face.classId,
        })
        markedTodayRef.current.add(res.attendance.studentId)
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 409) {
          const studentId = (err as { response?: { data?: { attendance?: { studentId?: string } } } })
            ?.response?.data?.attendance?.studentId
          if (studentId) markedTodayRef.current.add(studentId)
        }
      } finally {
        scanLockRef.current = false
      }
    }, 1200)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [scanning, modelsReady, cameraReady, registeredFaces, markMutation.isPending])

  return (
    <Page
      title="Face Attendance Scanner"
      subtitle="Camera scans faces in real time and marks attendance automatically."
      actions={
        <button
          type="button"
          onClick={() => setScanning((s) => !s)}
          className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {scanning ? 'Pause Scanning' : 'Resume Scanning'}
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Live Camera" subtitle="Position face in frame — one student at a time" />
          <CardBody className="space-y-3">
            {modelsError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/30">{modelsError}</p>
            )}
            {cameraError && (
              <div className="space-y-2">
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/30">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  Retry Camera
                </button>
              </div>
            )}

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover mirror"
                style={{ transform: 'scaleX(-1)' }}
              />
              {!modelsReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
                  Loading AI models...
                </div>
              )}
              {facesQuery.isLoading && (
                <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">
                  Loading registered faces...
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
              <span className="flex items-center text-xs text-slate-500">
                {registeredFaces.length} registered face(s) in scope
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Scan Status" subtitle="Latest matches" />
          <CardBody className="space-y-4">
            {lastMatch ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Present</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{lastMatch.studentName}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Marked at {lastMatch.time}</div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Waiting for a recognized face...</p>
            )}

            {markMutation.isError && (
              <p className="text-xs text-rose-600">
                {(markMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                  'Failed to mark attendance'}
              </p>
            )}

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Recent (this session)</div>
              <ul className="space-y-1 text-sm">
                {recentMarks.length === 0 && <li className="text-slate-500">None yet</li>}
                {recentMarks.map((m) => (
                  <li key={`${m.studentId}-${m.time}`} className="flex justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-50">{m.studentName}</span>
                    <span className="text-xs text-slate-500">{m.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  )
}
