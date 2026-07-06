import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { useModalClose } from '../../hooks/useModalClose'

type Teacher = { id: string; name: string; subject?: string }
type SalaryRow = {
  id: string; teacherName: string; teacherId: string
  month: number; monthName: string; year: number
  baseSalary: number; hra: number; bonus: number
  leaveDeduction: number; latePenalty: number; netSalary: number
  status: string; paidAt: string | null
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

function G({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 backdrop-blur-sm p-5 ${className}`}>{children}</div>
}

function Field({ label, value, onChange, type = 'number', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-slate-100 outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors" />
    </label>
  )
}

// ── Salary Slip Modal ──────────────────────────────────────────────────────
function SlipModal({ s, onClose }: { s: SalaryRow; onClose: () => void }) {
  useModalClose(true, onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/40 dark:bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white dark:bg-[#0f172a] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Salary Slip</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/5 p-4 space-y-1 text-sm mb-4">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Teacher</span><span className="font-semibold text-slate-900 dark:text-white">{s.teacherName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Period</span><span className="text-slate-700 dark:text-slate-200">{s.monthName} {s.year}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Status</span>
            <span className={s.status === 'paid' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {s.status === 'paid' ? '✓ Paid' : '⏳ Pending'}
            </span>
          </div>
          {s.paidAt && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Paid On</span><span className="text-slate-700 dark:text-slate-200">{s.paidAt}</span></div>}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/5 p-4 space-y-2 text-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Earnings</div>
          <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Base Salary</span><span className="text-slate-900 dark:text-white">₹{s.baseSalary.toLocaleString('en-IN')}</span></div>
          {s.hra > 0 && <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">HRA</span><span className="text-emerald-400">+₹{s.hra.toLocaleString('en-IN')}</span></div>}
          {s.bonus > 0 && <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Bonus</span><span className="text-emerald-400">+₹{s.bonus.toLocaleString('en-IN')}</span></div>}

          {(s.leaveDeduction > 0 || s.latePenalty > 0) && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase mt-3 mb-2">Deductions</div>
              {s.leaveDeduction > 0 && <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Leave Deduction</span><span className="text-rose-400">-₹{s.leaveDeduction.toLocaleString('en-IN')}</span></div>}
              {s.latePenalty > 0 && <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Late Penalty</span><span className="text-rose-400">-₹{s.latePenalty.toLocaleString('en-IN')}</span></div>}
            </>
          )}

          <div className="border-t border-white/10 mt-3 pt-3 flex justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-200">Net Salary</span>
            <span className="text-xl font-bold text-indigo-300">₹{s.netSalary.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <button type="button" onClick={onClose}
          className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminSalary() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'create' | 'records'>('create')
  const [slip, setSlip] = useState<SalaryRow | null>(null)

  // Filters
  const [fMonth, setFMonth] = useState('all')
  const [fYear, setFYear] = useState('all')
  const [fStatus, setFStatus] = useState('all')

  // Form
  const [teacherId, setTeacherId] = useState('')
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [base, setBase] = useState('')
  const [hra, setHra] = useState('0')
  const [bonus, setBonus] = useState('0')
  const [leave, setLeave] = useState('0')
  const [late, setLate] = useState('0')
  const [formMsg, setFormMsg] = useState('')
  const [formErr, setFormErr] = useState('')

  const net = Math.max(0, (Number(base) || 0) + (Number(hra) || 0) + (Number(bonus) || 0) - (Number(leave) || 0) - (Number(late) || 0))

  const teachersQuery = useQuery({
    queryKey: ['teachersList'],
    queryFn: async () => (await http.get('/teachers')).data as { teachers: Teacher[] },
  })
  const teachers = teachersQuery.data?.teachers ?? []

  const salaryQuery = useQuery({
    queryKey: ['adminSalary', fMonth, fYear, fStatus],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (fMonth !== 'all') params.month = fMonth
      if (fYear !== 'all') params.year = fYear
      if (fStatus !== 'all') params.status = fStatus
      return (await http.get('/admin/salary', { params })).data as { salaries: SalaryRow[] }
    },
  })
  const salaries = salaryQuery.data?.salaries ?? []

  // Stats
  const totalPaid = salaries.filter(s => s.status === 'paid').reduce((a, s) => a + s.netSalary, 0)
  const totalPending = salaries.filter(s => s.status === 'pending').reduce((a, s) => a + s.netSalary, 0)
  const pendingCount = salaries.filter(s => s.status === 'pending').length

  const createMutation = useMutation({
    mutationFn: async () => (await http.post('/admin/salary', {
      teacherId, month: Number(month), year: Number(year),
      baseSalary: Number(base), hra: Number(hra) || 0,
      bonus: Number(bonus) || 0, leaveDeduction: Number(leave) || 0, latePenalty: Number(late) || 0,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSalary'] })
      setBase(''); setHra('0'); setBonus('0'); setLeave('0'); setLate('0'); setTeacherId('')
      setFormMsg('✓ Salary record created. Teacher notified.')
      setFormErr('')
      setTimeout(() => setFormMsg(''), 4000)
    },
    onError: (e: any) => { setFormErr(e?.response?.data?.message ?? 'Failed'); setFormMsg('') },
  })

  const payMutation = useMutation({
    mutationFn: async (id: string) => (await http.post(`/admin/salary/${id}/pay`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSalary'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await http.delete(`/admin/salary/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSalary'] }),
  })

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#020617] text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-200 dark:border-white/8 bg-white/3 backdrop-blur-sm px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-lg shadow-indigo-500/25">💼</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Salary Management</h1>
            <p className="text-xs text-slate-400 mt-0.5">Manage teacher salaries, track payments, generate slips</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: 'from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-600/20 dark:to-teal-600/20 dark:border-emerald-500/20', text: 'text-emerald-300' },
            { label: 'Pending Salary', value: `₹${totalPending.toLocaleString('en-IN')}`, color: 'from-amber-50 to-orange-50 border-amber-200 dark:from-amber-600/20 dark:to-orange-600/20 dark:border-amber-500/20', text: 'text-amber-300' },
            { label: 'Teachers Pending', value: pendingCount, color: 'from-rose-50 to-pink-50 border-rose-200 dark:from-rose-600/20 dark:to-pink-600/20 dark:border-rose-500/20', text: 'text-rose-300' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border bg-gradient-to-br dark:bg-gray-900 ${s.color} p-4 transition-all hover:scale-[1.02]`}>
              <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-1 w-fit">
          {([
            { key: 'create', label: '➕ Create Salary' },
            { key: 'records', label: '📋 All Records' },
          ] as const).map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Create Tab ── */}
        {tab === 'create' && (
          <G>
            <div className="text-sm font-semibold text-slate-200 mb-1">Create Salary Record</div>
            <div className="text-xs text-slate-500 mb-4">Net = Base + HRA + Bonus − Leave Deduction − Late Penalty</div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Teacher *</span>
                <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-slate-100 outline-none focus:border-indigo-500">
                  <option value="">Select teacher...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}{t.subject ? ` — ${t.subject}` : ''}</option>)}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Month *</span>
                <select value={month} onChange={e => setMonth(e.target.value)}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-slate-100 outline-none focus:border-indigo-500">
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Year *</span>
                <select value={year} onChange={e => setYear(e.target.value)}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-slate-100 outline-none focus:border-indigo-500">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>

              <Field label="Base Salary (₹) *" value={base} onChange={setBase} placeholder="e.g. 30000" />
              <Field label="HRA (₹)" value={hra} onChange={setHra} placeholder="0" />
              <Field label="Bonus (₹)" value={bonus} onChange={setBonus} placeholder="0" />
              <Field label="Leave Deduction (₹)" value={leave} onChange={setLeave} placeholder="0" />
              <Field label="Late Penalty (₹)" value={late} onChange={setLate} placeholder="0" />

              {/* Net preview */}
              <div className="flex flex-col justify-end">
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
                  <div className="text-xs text-slate-400 mb-0.5">Net Salary</div>
                  <div className="text-xl font-bold text-indigo-300">₹{net.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button type="button"
                disabled={!teacherId || !base || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition-all shadow-lg shadow-indigo-500/20">
                {createMutation.isPending ? 'Creating...' : '💼 Create Salary Record'}
              </button>
              {formMsg && <span className="text-xs text-emerald-400">{formMsg}</span>}
              {formErr && <span className="text-xs text-rose-400">{formErr}</span>}
            </div>
          </G>
        )}

        {/* ── Records Tab ── */}
        {tab === 'records' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <select value={fMonth} onChange={e => setFMonth(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-xs text-slate-200 outline-none focus:border-indigo-500">
                <option value="all">All Months</option>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={fYear} onChange={e => setFYear(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-xs text-slate-200 outline-none focus:border-indigo-500">
                <option value="all">All Years</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-xs text-slate-200 outline-none focus:border-indigo-500">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
              <span className="ml-auto text-xs text-slate-500">{salaries.length} records</span>
            </div>

            <G className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-white/8">
                      {['Teacher', 'Period', 'Base', 'Allowances', 'Deductions', 'Net Salary', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salaryQuery.isLoading && <tr><td colSpan={8} className="px-4 py-4 text-sm text-slate-500">Loading...</td></tr>}
                    {salaries.map(s => (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{s.teacherName}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{s.monthName} {s.year}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">₹{s.baseSalary.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-emerald-400 text-xs">
                          {s.hra + s.bonus > 0 ? `+₹${(s.hra + s.bonus).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-rose-400 text-xs">
                          {s.leaveDeduction + s.latePenalty > 0 ? `-₹${(s.leaveDeduction + s.latePenalty).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-300">₹{s.netSalary.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          {s.status === 'paid'
                            ? <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">✓ Paid</span>
                            : <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">⏳ Pending</span>
                          }
                        </td>
                        <td className="px-4 py-3 flex gap-1.5">
                          <button type="button" onClick={() => setSlip(s)}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            Slip
                          </button>
                          {s.status === 'pending' && (
                            <button type="button" disabled={payMutation.isPending}
                              onClick={() => payMutation.mutate(s.id)}
                              className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 transition-all">
                              Pay
                            </button>
                          )}
                          <button type="button" disabled={deleteMutation.isPending}
                            onClick={() => { if (confirm('Delete this salary record?')) deleteMutation.mutate(s.id) }}
                            className="rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors">
                            Del
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!salaryQuery.isLoading && salaries.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">No salary records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </G>
          </div>
        )}

      </div>

      {slip && <SlipModal s={slip} onClose={() => setSlip(null)} />}
    </div>
  )
}
