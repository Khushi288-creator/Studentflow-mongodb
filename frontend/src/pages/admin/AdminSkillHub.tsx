import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { useModalClose } from '../../hooks/useModalClose'

type Faculty = { id: string; name: string; activityId: string; salaryType: string; salaryAmount: number }
type Activity = {
  id: string; name: string; description: string; duration: string; fees: number
  scheduleDays: string; scheduleTime: string; targetClass: string; capacity: number | null
  level: string; batch: string; icon: string; faculty: Faculty | null; enrolledCount: number
}
type SalaryRow = {
  id: string; facultyName: string; activityName: string
  salaryType: string; salaryAmount: number; studentCount: number; netSalary: number
}

const ICONS = ['🎯','🥋','🎨','⚽','🎵','🏊','🏸','🎭','📚','🖥️','🎤','🏋️']
const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const CLASSES = ['All Classes','Class 4','Class 5','Class 6','Class 7','Class 8']
const LEVELS  = ['Beginner','Intermediate','Advanced']
const BATCHES = ['Morning','Evening']

const emptyForm = {
  name:'', description:'', duration:'', fees:'' as string | number,
  scheduleDays:'', scheduleTime:'', targetClass:'All Classes',
  capacity:'', level:'Beginner', batch:'Morning', icon:'🎯',
}
const emptyFaculty = { name:'', activityId:'', salaryType:'fixed' as 'fixed'|'per_student', salaryAmount:0 }

function G({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-5 ${className}`}>{children}</div>
}

export default function AdminSkillHub() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'activities'|'faculty'|'salary'>('activities')

  const [actModal, setActModal] = useState<'none'|'create'|'edit'>('none')
  const [editAct, setEditAct] = useState<Activity|null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [actErr, setActErr] = useState('')

  const [facModal, setFacModal] = useState(false)
  const [facForm, setFacForm] = useState({ ...emptyFaculty })
  const [facErr, setFacErr] = useState('')

  const [enrollActId, setEnrollActId] = useState<string|null>(null)

  useModalClose(actModal !== 'none', () => { setActModal('none'); setActErr('') })
  useModalClose(facModal, () => { setFacModal(false); setFacErr('') })

  const activitiesQ = useQuery({
    queryKey: ['skillActivities'],
    queryFn: async () => (await http.get('/skill-hub/activities')).data as { activities: Activity[] },
  })
  const facultyQ = useQuery({
    queryKey: ['skillFaculty'],
    queryFn: async () => (await http.get('/skill-hub/faculty')).data as { faculty: any[] },
    enabled: tab === 'faculty',
  })
  const salaryQ = useQuery({
    queryKey: ['skillSalary'],
    queryFn: async () => (await http.get('/skill-hub/salary')).data as { report: SalaryRow[] },
    enabled: tab === 'salary',
  })
  const enrollQ = useQuery({
    queryKey: ['skillEnroll', enrollActId],
    queryFn: async () => (await http.get(`/skill-hub/activities/${enrollActId}/enrollments`)).data as { enrollments: any[] },
    enabled: !!enrollActId,
  })

  const createAct = useMutation({
    mutationFn: async () => (await http.post('/skill-hub/activities', {
      ...form,
      fees: Number(form.fees),
      capacity: form.capacity ? Number(form.capacity) : null,
      scheduleDays: selectedDays.join(','),
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skillActivities'] }); setActModal('none'); setForm({ ...emptyForm }); setSelectedDays([]); setActErr('') },
    onError: (e: any) => setActErr(e?.response?.data?.message ?? 'Failed'),
  })

  const editActMut = useMutation({
    mutationFn: async () => (await http.put(`/skill-hub/activities/${editAct!.id}`, {
      ...form, fees: Number(form.fees),
      capacity: form.capacity ? Number(form.capacity) : null,
      scheduleDays: selectedDays.join(','),
    })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skillActivities'] }); setActModal('none'); setEditAct(null); setActErr('') },
    onError: (e: any) => setActErr(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteAct = useMutation({
    mutationFn: async (id: string) => (await http.delete(`/skill-hub/activities/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skillActivities'] }),
  })

  const createFac = useMutation({
    mutationFn: async () => (await http.post('/skill-hub/faculty', { ...facForm, salaryAmount: Number(facForm.salaryAmount) })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skillFaculty'] }); qc.invalidateQueries({ queryKey: ['skillActivities'] }); setFacModal(false); setFacForm({ ...emptyFaculty }); setFacErr('') },
    onError: (e: any) => setFacErr(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteFac = useMutation({
    mutationFn: async (id: string) => (await http.delete(`/skill-hub/faculty/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skillFaculty'] }); qc.invalidateQueries({ queryKey: ['skillActivities'] }) },
  })

  const openCreate = () => { setForm({ ...emptyForm }); setSelectedDays([]); setActErr(''); setActModal('create') }
  const openEdit = (a: Activity) => {
    setEditAct(a)
    setForm({ name: a.name, description: a.description, duration: a.duration, fees: a.fees,
      scheduleDays: a.scheduleDays, scheduleTime: a.scheduleTime, targetClass: a.targetClass,
      capacity: a.capacity ? String(a.capacity) : '', level: a.level, batch: a.batch, icon: a.icon })
    setSelectedDays(a.scheduleDays ? a.scheduleDays.split(',') : [])
    setActErr(''); setActModal('edit')
  }
  const toggleDay = (d: string) => setSelectedDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])

  const activities  = activitiesQ.data?.activities ?? []
  const faculty     = facultyQ.data?.faculty ?? []
  const salary      = salaryQ.data?.report ?? []
  const enrollments = enrollQ.data?.enrollments ?? []

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#020617] text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/8 bg-white dark:bg-white/3 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-lg shadow-indigo-500/25">🎯</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Skill Hub</h1>
              <p className="text-xs text-slate-400 mt-0.5">Manage extra activities, faculty &amp; salary</p>
            </div>
          </div>
          <div className="flex gap-2">
            {tab === 'activities' && (
              <button type="button" onClick={openCreate}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/20">
                + Add Activity
              </button>
            )}
            {tab === 'faculty' && (
              <button type="button" onClick={() => { setFacForm({ ...emptyFaculty }); setFacErr(''); setFacModal(true) }}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:from-violet-500 hover:to-purple-500 shadow-md">
                + Add Faculty
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Activities', value: activities.length, color: 'from-indigo-50 to-purple-50 border-indigo-200 dark:from-indigo-600/20 dark:to-purple-600/20 dark:border-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-300' },
            { label: 'Total Enrolled', value: activities.reduce((a, x) => a + x.enrolledCount, 0), color: 'from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-600/20 dark:to-teal-600/20 dark:border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-300' },
            { label: 'Faculty Members', value: faculty.length, color: 'from-violet-50 to-pink-50 border-violet-200 dark:from-violet-600/20 dark:to-pink-600/20 dark:border-violet-500/20', text: 'text-violet-600 dark:text-violet-300' },
            
            ].map(s => (           
              <div key={s.label} className={`rounded-2xl border bg-gradient-to-br dark:bg-gray-900 ${s.color} p-4 transition-all hover:scale-[1.02]`}>
              <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
        </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-1 w-fit">
          {([
            { key: 'activities', label: '🎯 Activities' },
            { key: 'faculty',    label: '👨‍🏫 Faculty' },
            { key: 'salary',     label: '💰 Salary' },
          ] as const).map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Activities Tab ── */}
        {tab === 'activities' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activitiesQ.isLoading && <p className="text-sm text-slate-500">Loading...</p>}
            {activities.map(a => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-5 flex flex-col gap-3 hover:bg-slate-100 dark:hover:bg-white/8 transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{a.icon}</span>
                    <div>
                      <div className="font-semibold text-white text-sm">{a.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{a.level} · {a.batch}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300 shrink-0">
                    {a.enrolledCount} enrolled
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{a.description}</p>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {a.faculty && <div>👨‍🏫 {a.faculty.name}</div>}
                  <div>📅 {a.scheduleDays}{a.scheduleTime ? ` · 🕒 ${a.scheduleTime}` : ''}</div>
                  <div>⏱ {a.duration}</div>
                  {a.targetClass !== 'All Classes' && <div>🎓 {a.targetClass}</div>}
                  {a.capacity && <div>👥 Capacity: {a.capacity}</div>}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg font-bold text-emerald-400">₹{Number(a.fees || 0).toLocaleString('en-IN')}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">/month</span></span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setEnrollActId(enrollActId === a.id ? null : a.id)}
                      className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                      👥
                    </button>
                    <button type="button" onClick={() => openEdit(a)}
                      className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                      Edit
                    </button>
                    <button type="button" disabled={deleteAct.isPending}
                      onClick={() => { if (confirm(`Delete "${a.name}"?`)) deleteAct.mutate(a.id) }}
                      className="rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/10">
                      Del
                    </button>
                  </div>
                </div>
                {enrollActId === a.id && (
                  <div className="mt-1 rounded-xl border border-slate-200 dark:border-white/8 bg-white/5 p-3">
                    <div className="text-xs font-semibold text-slate-300 mb-2">Enrolled Students</div>
                    {enrollQ.isLoading ? <p className="text-xs text-slate-500">Loading...</p>
                      : enrollments.length === 0 ? <p className="text-xs text-slate-500">No enrollments yet.</p>
                      : enrollments.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between py-1 text-xs">
                          <span className="text-slate-700 dark:text-slate-200">{e.student.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                            {e.paymentStatus}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ))}
            {!activitiesQ.isLoading && activities.length === 0 && (
              <div className="col-span-3 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                No activities yet. Click "+ Add Activity" to create one.
              </div>
            )}
          </div>
        )}

        {/* ── Faculty Tab ── */}
        {tab === 'faculty' && (
          <G className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-white/8">
                    {['Faculty Name','Activity','Salary Type','Amount','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facultyQ.isLoading && <tr><td colSpan={5} className="px-4 py-4 text-sm text-slate-500">Loading...</td></tr>}
                  {faculty.map((f: any) => (
                    <tr key={f.id} className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{f.name}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{f.activity?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${f.salaryType === 'fixed' ? 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30' : 'bg-violet-500/15 text-violet-300 ring-violet-500/30'}`}>
                          {f.salaryType === 'fixed' ? '🔒 Fixed' : '📊 Per Student'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">₹{f.salaryAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <button type="button" disabled={deleteFac.isPending}
                          onClick={() => { if (confirm(`Remove ${f.name}?`)) deleteFac.mutate(f.id) }}
                          className="rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/10">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!facultyQ.isLoading && faculty.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No faculty added yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </G>
        )}

        {/* ── Salary Tab ── */}
        {tab === 'salary' && (
          <G className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-white/8">
                    {['Faculty','Activity','Type','Rate','Students','Net Salary'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salaryQ.isLoading && <tr><td colSpan={6} className="px-4 py-4 text-sm text-slate-500">Loading...</td></tr>}
                  {salary.map(s => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{s.facultyName}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.activityName}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.salaryType === 'fixed' ? 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30' : 'bg-violet-500/15 text-violet-300 ring-violet-500/30'}`}>
                          {s.salaryType === 'fixed' ? 'Fixed' : 'Per Student'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">₹{s.salaryAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.studentCount}</td>
                      <td className="px-4 py-3 text-xl font-bold text-indigo-300">₹{s.netSalary.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {!salaryQ.isLoading && salary.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">No salary data. Add faculty first.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </G>
        )}
      </div>

      {/* ── Activity Modal ── */}
      {actModal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/40 dark:bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => { setActModal('none'); setActErr('') }}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white dark:bg-[#0f172a] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {actModal === 'create' ? '+ Add Activity' : '✏️ Edit Activity'}
              </h2>
              <button onClick={() => { setActModal('none'); setActErr('') }} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            {actErr && <div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{actErr}</div>}

            {/* Icon picker */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Icon</div>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(p => ({ ...p, icon: ic }))}
                    className={`text-xl rounded-xl p-1.5 border transition-all ${form.icon === ic ? 'border-indigo-500 bg-indigo-500/20 scale-110' : 'border-white/10 hover:border-white/30'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Basic Info</div>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Activity Name *</span>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Karate Classes"
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Description *</span>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="What students will learn..."
                  className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Duration *</span>
                <input value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} placeholder="e.g., 3 months"
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fees (₹/month) *</span>
                <input type="number" value={form.fees} onChange={e => setForm(p => ({ ...p, fees: e.target.value }))} placeholder="500" min={1}
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
            </div>

            <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Schedule</div>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Days *</span>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${selectedDays.includes(d) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-white/10 text-slate-400 hover:border-white/30'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Time (optional)</span>
                <input type="time" value={form.scheduleTime} onChange={e => setForm(p => ({ ...p, scheduleTime: e.target.value }))}
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Capacity (optional)</span>
                <input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} placeholder="e.g., 20"
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
            </div>

            <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Classification</div>
            <div className="grid gap-3 sm:grid-cols-2 mb-6">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Level</span>
                <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-indigo-500">
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Batch</span>
                <select value={form.batch} onChange={e => setForm(p => ({ ...p, batch: e.target.value }))}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-indigo-500">
                  {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Target Class</span>
                <select value={form.targetClass} onChange={e => setForm(p => ({ ...p, targetClass: e.target.value }))}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-indigo-500">
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <div className="flex gap-2">
              <button type="button"
                disabled={actModal === 'create' ? createAct.isPending : editActMut.isPending}
                onClick={() => {
                  if (!form.name.trim() || !form.description.trim() || !form.duration.trim()) {
                    setActErr('Please fill all required fields.'); return
                  }
                  if (!Number(form.fees) || Number(form.fees) <= 0) {
                    setActErr('Fees must be greater than 0.'); return
                  }
                  if (selectedDays.length === 0) {
                    setActErr('Please select at least one day.'); return
                  }
                  setActErr('')
                  actModal === 'create' ? createAct.mutate() : editActMut.mutate()
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-semibold text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition-all shadow-lg shadow-indigo-500/20">
                {actModal === 'create'
                  ? (createAct.isPending ? 'Creating...' : 'Create Activity')
                  : (editActMut.isPending ? 'Saving...' : 'Save Changes')}
              </button>
              <button type="button" onClick={() => { setActModal('none'); setActErr('') }}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Faculty Modal ── */}
      {facModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/40 dark:bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => { setFacModal(false); setFacErr('') }}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white dark:bg-[#0f172a] p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">+ Add Faculty</h2>
              <button onClick={() => { setFacModal(false); setFacErr('') }} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            {facErr && <div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{facErr}</div>}

            <div className="grid gap-3 mb-6">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Faculty Name *</span>
                <input value={facForm.name} onChange={e => setFacForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Ravi Kumar"
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Assign to Activity *</span>
                <select value={facForm.activityId} onChange={e => setFacForm(p => ({ ...p, activityId: e.target.value }))}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-indigo-500">
                  <option value="">Select activity...</option>
                  {activities.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Salary Type *</span>
                <select value={facForm.salaryType} onChange={e => setFacForm(p => ({ ...p, salaryType: e.target.value as 'fixed'|'per_student' }))}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-indigo-500">
                  <option value="fixed">🔒 Fixed</option>
                  <option value="per_student">📊 Per Student</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {facForm.salaryType === 'fixed' ? 'Fixed Amount (₹)' : 'Amount per Student (₹)'} *
                </span>
                <input type="number" value={facForm.salaryAmount} onChange={e => setFacForm(p => ({ ...p, salaryAmount: Number(e.target.value) }))} placeholder="e.g., 5000"
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
            </div>

            <div className="flex gap-2">
              <button type="button" disabled={createFac.isPending}
                onClick={() => createFac.mutate()}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 transition-all shadow-lg">
                {createFac.isPending ? 'Adding...' : 'Add Faculty'}
              </button>
              <button type="button" onClick={() => { setFacModal(false); setFacErr('') }}
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
