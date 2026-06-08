import React, { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import FaceAttendancePanel from '../../components/attendance/FaceAttendancePanel'

// ── Types ──────────────────────────────────────────────────────────────────
type Child = { id: string; name: string; className: string | null; photoUrl: string | null; gender: string | null }
type DashData = {
  child: Child | null
  attendance: { total: number; present: number; percentage: number }
  fees: { total: number; paid: number; pending: number }
  assignments: { id: string; title: string; courseName: string; dueDate: string; submitted: boolean }[]
  results: { id: string; courseName: string; marks: number; grade: string }[]
  achievements: { id: string; title: string; type: string; rank: string | null; date: string | null }[]
  activityEnrollments: { id: string; activityName: string; icon: string; scheduleDays: string; fees: number; paymentStatus: string }[]
  events: { id: string; title: string; date: string }[]
  holidays: { id: string; name: string; date: string }[]
  performance: { id: string; subject: string; marks: number; examName: string }[]
  alerts: { type: string; message: string }[]
}
type Meeting = { id: string; date: string; time: string; status: string; note: string | null; teacherName: string | null }
type Teacher = { id: string; name: string; subject: string | null }
type ChatMsg = { id: string; senderId: string; text: string; createdAt: string }

// ── Helpers ────────────────────────────────────────────────────────────────
function HoverCard({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-5 transition-all duration-200
        hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-500/10 hover:border-pink-500/20 hover:bg-slate-50 dark:hover:bg-white/8
        ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'amber' | 'red' | 'indigo' | 'pink' }) {
  const map = {
    green: 'bg-emerald-500/20 text-emerald-300',
    amber: 'bg-amber-500/20 text-amber-300',
    red: 'bg-rose-500/20 text-rose-300',
    indigo: 'bg-indigo-500/20 text-indigo-300',
    pink: 'bg-pink-500/20 text-pink-300',
  }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[color]}`}>{children}</span>
}

function SectionTitle({ icon, title, extra }: { icon: string; title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
      {extra}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ParentDashboard() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'overview' | 'meetings' | 'chat'>('overview')
  const [chatTeacherId, setChatTeacherId] = useState('')
  const [chatMsg, setChatMsg] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [savedNote, setSavedNote] = useState(() => localStorage.getItem('parent_note') ?? '')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const dashQ = useQuery({
    queryKey: ['parentDashboard'],
    queryFn: async () => (await http.get('/parents/dashboard')).data as DashData,
  })

  const meetingsQ = useQuery({
    queryKey: ['parentMeetings'],
    queryFn: async () => (await http.get('/parent-meetings')).data as { meetings: Meeting[] },
    enabled: tab === 'meetings',
  })

  const teachersQ = useQuery({
    queryKey: ['parentTeachersList'],
    queryFn: async () => (await http.get('/parents/teachers')).data as { teachers: Teacher[] },
    enabled: tab === 'chat',
  })

  const chatQ = useQuery({
    queryKey: ['parentChat', chatTeacherId],
    queryFn: async () => (await http.get(`/parent-messages/${chatTeacherId}`)).data as { messages: ChatMsg[] },
    enabled: !!chatTeacherId && tab === 'chat',
    refetchInterval: 4000,
  })

  const meetingStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await http.patch(`/parent-meetings/${id}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parentMeetings'] }),
  })

  const sendMsgMut = useMutation({
    mutationFn: async () => (await http.post('/parent-messages', { teacherId: chatTeacherId, text: chatMsg.trim() })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['parentChat', chatTeacherId] }); setChatMsg('') },
  })

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatQ.data])

  const d = dashQ.data
  const meetings = meetingsQ.data?.meetings ?? []
  const teachers = teachersQ.data?.teachers ?? []
  const messages = chatQ.data?.messages ?? []
  const pendingMeetings = meetings.filter(m => m.status === 'pending').length

  const selectedTeacher = teachers.find(t => t.id === chatTeacherId)

  if (dashQ.isLoading) return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#020617] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
        <div className="text-slate-400 text-sm">Loading dashboard...</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#020617] text-slate-900 dark:text-white">
      {/* ── Header ── */}
      <div className="border-b border-slate-200 dark:border-slate-200 dark:border-white/8 bg-white dark:bg-white/80 dark:bg-white/3 px-6 py-4 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-lg shadow-lg shadow-pink-500/25">👨‍👩‍👧</div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Parent Dashboard</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {d?.child ? `${d.child.name}${d.child.className ? ` · Class ${d.child.className}` : ''}` : 'No child linked'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-1">
              {([
                { key: 'overview', label: '📊 Overview' },
                { key: 'meetings', label: `📅 Meetings${pendingMeetings > 0 ? ` (${pendingMeetings})` : ''}` },
                { key: 'chat', label: '💬 Chat' },
              ] as const).map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    tab === t.key
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* ── Alerts ── */}
        {d?.alerts && d.alerts.length > 0 && (
          <div className="space-y-2">
            {d.alerts.map((a, i) => (
              <div key={i} className={`rounded-2xl border px-5 py-3 flex items-center gap-3 animate-pulse-once ${
                a.type === 'warning' ? 'border-amber-500/40 bg-amber-500/10' :
                a.type === 'danger'  ? 'border-rose-500/40 bg-rose-500/10' :
                'border-indigo-500/40 bg-indigo-500/10'
              }`}>
                <span className="text-base font-semibold text-slate-900 dark:text-white">{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {!d?.child && (
          <div className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
            <div className="text-5xl mb-4">👨‍👩‍👧</div>
            <div className="text-slate-400 text-sm">No student linked to your account yet.</div>
            <div className="text-slate-500 text-xs mt-1">Please contact the school admin.</div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && d?.child && (
          <>
            {/* Row 1 — Child + Attendance + Fees */}
            <div className="grid gap-4 sm:grid-cols-3">

              {/* Child Profile Card */}
              <HoverCard className="flex flex-col items-center text-center gap-3 bg-gradient-to-br from-pink-500/10 to-rose-500/5 border-pink-500/20">
                {d.child.photoUrl
                  ? <img src={d.child.photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover border-2 border-pink-500/40 shadow-lg shadow-pink-500/20" />
                  : <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-pink-500/30">
                      {d.child.name[0]}
                    </div>
                }
                <div>
                  <div className="font-bold text-white text-base">{d.child.name}</div>
                  {d.child.className && <div className="text-xs text-pink-300 mt-0.5 font-medium">Class {d.child.className}</div>}
                  {d.child.gender && <div className="text-xs text-slate-500 mt-0.5">{d.child.gender}</div>}
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Badge color="pink">👨‍👩‍👧 My Child</Badge>
                  {d.child.className && <Badge color="indigo">📚 Class {d.child.className}</Badge>}
                </div>
              </HoverCard>

              {/* Attendance Card */}
              <HoverCard className={d.attendance.percentage < 75 ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}>
                <SectionTitle icon="📋" title="Attendance" />
                <div className={`text-5xl font-black mb-1 ${d.attendance.percentage < 75 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {d.attendance.percentage}%
                </div>
                <div className="text-xs text-slate-400 mb-3">{d.attendance.present} / {d.attendance.total} days present</div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${d.attendance.percentage < 75 ? 'bg-gradient-to-r from-rose-500 to-red-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                    style={{ width: `${d.attendance.percentage}%` }}
                  />
                </div>
                {d.attendance.percentage < 75 && (
                  <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300 font-medium">
                    ⚠ Below 75% — attendance improvement needed
                  </div>
                )}
                {d.attendance.percentage >= 75 && (
                  <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300 font-medium">
                    ✓ Good attendance — keep it up!
                  </div>
                )}
              </HoverCard>

              {/* Fees Card */}
              <HoverCard className={d.fees.pending > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}>
                <SectionTitle icon="💰" title="Fees Status" />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{d.fees.total.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Paid</span>
                    <span className="font-bold text-emerald-400">₹{d.fees.paid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Pending</span>
                    <span className={`font-black text-lg ${d.fees.pending > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                      ₹{d.fees.pending.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                {d.fees.pending > 0 && (
                  <button type="button"
                    onClick={() => alert('Demo: In production, this would open a payment gateway.\n\nAmount due: ₹' + d.fees.pending.toLocaleString('en-IN'))}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-xs font-bold text-white hover:from-amber-400 hover:to-orange-400 transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02]">
                    💳 Pay Now (Demo)
                  </button>
                )}
              </HoverCard>
            </div>

            <FaceAttendancePanel
              studentId={d.child.id}
              title="Face Recognition Attendance"
              subtitle="Updates automatically when your child is scanned at school"
              pollMs={8000}
            />

            {/* Performance Graph */}
            {d.performance.length > 0 ? (
              <HoverCard>
                <SectionTitle icon="📊" title="Performance Graph" extra={
                  <span className="text-xs text-slate-500">{d.performance[0]?.examName}</span>
                } />
                {/* Weak subject highlight */}
                {(() => {
                  const weak = d.performance.filter(p => p.marks < 40)
                  return weak.length > 0 ? (
                    <div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
                      ⚠ Weak subjects: {weak.map(w => w.subject).join(', ')} — needs attention
                    </div>
                  ) : null
                })()}
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.performance} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                      formatter={(v: any) => [`${v} marks`, 'Score']}
                    />
                    <Bar dataKey="marks" fill="url(#perfGrad)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </HoverCard>
            ) : (
              <HoverCard className="text-center py-8">
                <div className="text-3xl mb-2">📊</div>
                <div className="text-xs text-slate-500">No performance data yet. Admin/teacher will add marks.</div>
              </HoverCard>
            )}

            {/* Assignments + Results */}
            <div className="grid gap-4 sm:grid-cols-2">
              <HoverCard>
                <SectionTitle icon="📚" title="Assignments" extra={
                  <Badge color={d.assignments.filter(a => !a.submitted).length > 0 ? 'amber' : 'green'}>
                    {d.assignments.filter(a => !a.submitted).length} pending
                  </Badge>
                } />
                {d.assignments.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-4">No assignments yet.</p>
                  : <div className="space-y-2">
                      {d.assignments.slice(0, 6).map(a => (
                        <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/3 rounded-lg px-1 transition-colors">
                          <div>
                            <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{a.title}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{a.courseName} · Due: {a.dueDate}</div>
                          </div>
                          <Badge color={a.submitted ? 'green' : 'amber'}>
                            {a.submitted ? '✓ Done' : '⏳ Pending'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                }
              </HoverCard>

              <HoverCard>
                <SectionTitle icon="🏆" title="Results" />
                {d.results.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-4">No results yet.</p>
                  : <div className="space-y-2">
                      {d.results.slice(0, 6).map(r => (
                        <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/3 rounded-lg px-1 transition-colors">
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{r.courseName}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{r.marks}</span>
                            <Badge color={r.grade === 'A' || r.grade === 'A+' ? 'green' : r.grade === 'B' ? 'indigo' : 'amber'}>
                              {r.grade}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </HoverCard>
            </div>

            {/* Achievements + Skill Hub */}
            <div className="grid gap-4 sm:grid-cols-2">
              <HoverCard>
                <SectionTitle icon="🏅" title="Achievements" />
                {d.achievements.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-4">No achievements yet.</p>
                  : <div className="space-y-2">
                      {d.achievements.map(a => (
                        <div key={a.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                          <span className="text-xl">🏆</span>
                          <div>
                            <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{a.title}</div>
                            <div className="text-[10px] text-slate-500">{a.type}{a.rank ? ` · Rank: ${a.rank}` : ''}{a.date ? ` · ${a.date}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </HoverCard>

              <HoverCard>
                <SectionTitle icon="🎯" title="Skill Hub Activities" />
                {d.activityEnrollments.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-4">Not enrolled in any activity.</p>
                  : <div className="space-y-2">
                      {d.activityEnrollments.map(a => (
                        <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{a.icon}</span>
                            <div>
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{a.activityName}</div>
                              <div className="text-[10px] text-slate-500">{a.scheduleDays} · ₹{a.fees}/mo</div>
                            </div>
                          </div>
                          <Badge color={a.paymentStatus === 'paid' ? 'green' : 'amber'}>{a.paymentStatus}</Badge>
                        </div>
                      ))}
                    </div>
                }
              </HoverCard>
            </div>

            {/* Events + Holidays */}
            <div className="grid gap-4 sm:grid-cols-2">
              <HoverCard>
                <SectionTitle icon="🎉" title="Upcoming Events" />
                {d.events.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-4">No upcoming events.</p>
                  : <div className="space-y-2">
                      {d.events.map(e => (
                        <div key={e.id} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                          <span className="text-xs text-slate-700 dark:text-slate-200">{e.title}</span>
                          <span className="text-[10px] text-slate-500">{e.date}</span>
                        </div>
                      ))}
                    </div>
                }
              </HoverCard>

              <HoverCard>
                <SectionTitle icon="🏖" title="Holidays" />
                {d.holidays.length === 0
                  ? <p className="text-xs text-slate-500 text-center py-4">No holidays listed.</p>
                  : <div className="space-y-2">
                      {d.holidays.map(h => (
                        <div key={h.id} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                          <span className="text-xs text-slate-700 dark:text-slate-200">{h.name}</span>
                          <span className="text-[10px] text-slate-500">{h.date}</span>
                        </div>
                      ))}
                    </div>
                }
              </HoverCard>
            </div>

            {/* Parent Notes + School Contact */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Parent Notes */}
              <HoverCard>
                <SectionTitle icon="📝" title="My Notes" extra={
                  <button type="button" onClick={() => { setNote(savedNote); setShowNote(true) }}
                    className="text-xs text-pink-400 hover:text-pink-300 font-semibold">Edit</button>
                } />
                {savedNote
                  ? <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{savedNote}</p>
                  : <p className="text-xs text-slate-500">No notes yet. Click Edit to add notes about your child.</p>
                }
              </HoverCard>

              {/* School Contact */}
              <HoverCard className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-indigo-500/20">
                <SectionTitle icon="📞" title="School Contact" />
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span>🏫</span><span>StudentFlow School</span></div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span>📱</span><span>+91 98765 43210</span></div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span>📧</span><span>admin@studentflow.edu</span></div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span>🕐</span><span>Mon–Sat, 8 AM – 4 PM</span></div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span>🚨</span><span className="text-rose-300 font-semibold">Emergency: +91 99999 00000</span></div>
                </div>
              </HoverCard>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MEETINGS TAB
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'meetings' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-200 dark:border-white/8 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">📅 Parent-Teacher Meetings</div>
                  <div className="text-xs text-slate-400 mt-0.5">Accept or reject meeting requests from teachers</div>
                </div>
                {pendingMeetings > 0 && (
                  <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300">
                    {pendingMeetings} pending
                  </span>
                )}
              </div>
              {meetingsQ.isLoading ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500">Loading meetings...</div>
              ) : meetings.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="text-3xl mb-2">📅</div>
                  <div className="text-sm text-slate-500">No meetings scheduled yet.</div>
                  <div className="text-xs text-slate-600 mt-1">Teachers will schedule meetings here.</div>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {meetings.map(m => (
                    <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 text-lg">
                          👨‍🏫
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{m.teacherName ?? 'Teacher'}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            📅 {m.date} · 🕒 {m.time}
                            {m.note && <span className="ml-2 text-slate-500">· {m.note}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                          m.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' :
                          m.status === 'rejected' ? 'bg-rose-500/15 text-rose-300 ring-rose-500/30' :
                          'bg-amber-500/15 text-amber-300 ring-amber-500/30'
                        }`}>{m.status}</span>
                        {m.status === 'pending' && (
                          <>
                            <button type="button" disabled={meetingStatusMut.isPending}
                              onClick={() => meetingStatusMut.mutate({ id: m.id, status: 'accepted' })}
                              className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 hover:scale-105 transition-all">
                              ✓ Accept
                            </button>
                            <button type="button" disabled={meetingStatusMut.isPending}
                              onClick={() => meetingStatusMut.mutate({ id: m.id, status: 'rejected' })}
                              className="rounded-xl bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 hover:scale-105 transition-all">
                              ✕ Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CHAT TAB
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'chat' && (
          <div className="grid gap-4 sm:grid-cols-3" style={{ height: 520 }}>
            {/* Teacher list */}
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-200 dark:border-white/8">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Teachers</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Select to start chat</div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {teachersQ.isLoading && <p className="text-xs text-slate-500 p-2">Loading...</p>}
                {!teachersQ.isLoading && teachers.length === 0 && (
                  <p className="text-xs text-slate-500 p-2">No teachers found.</p>
                )}
                {teachers.map(t => (
                  <button key={t.id} type="button" onClick={() => setChatTeacherId(t.id)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-all hover:scale-[1.01] ${
                      chatTeacherId === t.id
                        ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/10 border border-pink-500/30 text-pink-300'
                        : 'text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {t.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{t.name}</div>
                        {t.subject && <div className="text-[10px] text-slate-500 truncate">{t.subject}</div>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat window */}
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 flex flex-col overflow-hidden">
              {!chatTeacherId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="text-4xl mb-3">💬</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Select a teacher to start chatting</div>
                  <div className="text-xs text-slate-600 mt-1">Messages are private between you and the teacher</div>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-200 dark:border-white/8 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">
                      {selectedTeacher?.name[0] ?? '?'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{selectedTeacher?.name}</div>
                      {selectedTeacher?.subject && <div className="text-[10px] text-slate-500">{selectedTeacher.subject}</div>}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {chatQ.isLoading && <p className="text-xs text-slate-500 text-center">Loading messages...</p>}
                    {!chatQ.isLoading && messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="text-3xl mb-2">👋</div>
                        <div className="text-xs text-slate-500">No messages yet. Say hello!</div>
                      </div>
                    )}
                    {messages.map((m) => {
                      const isMe = m.senderId !== chatTeacherId
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            isMe
                              ? 'bg-gradient-to-br from-pink-600 to-rose-600 text-white rounded-br-sm shadow-md shadow-pink-500/20'
                              : 'border border-slate-200 dark:border-white/8 bg-white/5 text-slate-200 rounded-bl-sm'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-slate-200 dark:border-white/8 px-3 py-3">
                    <div className="flex gap-2">
                      <input
                        value={chatMsg}
                        onChange={e => setChatMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && chatMsg.trim() && !sendMsgMut.isPending) sendMsgMut.mutate() }}
                        placeholder="Type a message..."
                        className="flex-1 h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-pink-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                      />
                      <button type="button"
                        disabled={!chatMsg.trim() || sendMsgMut.isPending}
                        onClick={() => sendMsgMut.mutate()}
                        className="h-10 w-10 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 flex items-center justify-center text-white font-bold hover:from-pink-500 hover:to-rose-500 disabled:opacity-40 transition-all hover:scale-105 shadow-md shadow-pink-500/20">
                        ↑
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Parent Notes Modal ── */}
      {showNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/40 dark:bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowNote(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white dark:bg-[#0f172a] p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">📝 My Notes</h2>
              <button onClick={() => setShowNote(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={6}
              placeholder="Write notes about your child — homework reminders, health notes, etc."
              className="w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
            <div className="flex gap-2 mt-4">
              <button type="button"
                onClick={() => { localStorage.setItem('parent_note', note); setSavedNote(note); setShowNote(false) }}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 py-2.5 text-sm font-semibold text-white hover:from-pink-500 hover:to-rose-500 transition-all">
                Save Note
              </button>
              <button type="button" onClick={() => setShowNote(false)}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
