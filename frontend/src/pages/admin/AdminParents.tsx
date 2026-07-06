import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { useModalClose } from '../../hooks/useModalClose'

type Parent = {
  id: string; name: string; email: string; phone: string | null; uniqueId: string | null
  photoUrl: string | null; studentId: string | null; studentName: string | null; profileId: string | null
}
type Student = { id: string; name: string; className: string | null }

function G({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-5 ${className}`}>{children}</div>
}

const emptyForm = { name: '', email: '', phone: '', password: '', studentId: '' }

export default function AdminParents() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'none' | 'create' | 'edit'>('none')
  const [editParent, setEditParent] = useState<Parent | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [photo, setPhoto] = useState<File | null>(null)
  const [err, setErr] = useState('')

  useModalClose(modal !== 'none', () => { setModal('none'); setErr('') })

  const { data, isLoading } = useQuery({
    queryKey: ['adminParents'],
    queryFn: async () => (await http.get('/admin/parents')).data as { parents: Parent[]; students: Student[] },
  })

  const parents = data?.parents ?? []
  const students = data?.students ?? []

  const createMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (form.name) fd.append('name', form.name)
      if (form.phone) fd.append('phone', form.phone)
      if (form.password) fd.append('password', form.password)
      if (form.studentId) fd.append('studentId', form.studentId)
      if (photo) fd.append('photo', photo)
      return (await http.post('/admin/parents', fd)).data
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['adminParents'] })
      setModal('none'); setForm({ ...emptyForm }); setPhoto(null); setErr('')
      alert(`✅ Parent created!\nLogin ID: ${d.parent.uniqueId}\nPassword: (as set)`)
    },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Failed'),
  })

  const editMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (form.name) fd.append('name', form.name)
      if (form.phone) fd.append('phone', form.phone)
      if (form.studentId !== undefined) fd.append('studentId', form.studentId)
      if (photo) fd.append('photo', photo)
      return (await http.put(`/admin/parents/${editParent!.id}`, fd)).data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminParents'] }); setModal('none'); setEditParent(null); setErr('') },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => (await http.delete(`/admin/parents/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminParents'] }),
  })

  const openCreate = () => { setForm({ ...emptyForm }); setPhoto(null); setErr(''); setModal('create') }
  const openEdit = (p: Parent) => {
    setEditParent(p)
    setForm({ name: p.name, email: p.email, phone: p.phone ?? '', password: '', studentId: p.studentId ?? '' })
    setPhoto(null); setErr(''); setModal('edit')
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#020617] text-slate-900 dark:text-white">
      <div className="border-b border-slate-200 dark:border-white/8 bg-white dark:bg-white/3 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-lg shadow-lg">👨‍👩‍👧</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Parent Management</h1>
              <p className="text-xs text-slate-400 mt-0.5">Add parents and link them to students</p>
            </div>
          </div>
          <button type="button" onClick={openCreate}
            className="rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-2 text-sm font-semibold text-white hover:from-pink-500 hover:to-rose-500 shadow-md">
            + Add Parent
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Parents', value: parents.length, color: 'from-pink-50 to-rose-50 border-pink-200 dark:from-pink-600/20 dark:to-rose-600/20 dark:border-pink-500/20', text: 'text-pink-600 dark:text-pink-300' },
            { label: 'Linked to Student', value: parents.filter(p => p.studentId).length, color: 'from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-600/20 dark:to-teal-600/20 dark:border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-300' },
            { label: 'Not Linked', value: parents.filter(p => !p.studentId).length, color: 'from-amber-50 to-orange-50 border-amber-200 dark:from-amber-600/20 dark:to-orange-600/20 dark:border-amber-500/20', text: 'text-amber-600 dark:text-amber-300' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border bg-gradient-to-br dark:bg-gray-900 ${s.color} p-4`}>
              <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <G className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-white/8">
                  {['Photo', 'Name', 'Login ID', 'Phone', 'Linked Student', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="px-4 py-4 text-sm text-slate-500">Loading...</td></tr>}
                {parents.map(p => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      {p.photoUrl
                        ? <img src={p.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover border border-white/10" />
                        : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">{p.name[0]}</div>
                      }
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-pink-500/20 px-2.5 py-0.5 text-xs font-bold text-pink-300 font-mono">
                        {p.uniqueId ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.studentName
                        ? <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">{p.studentName}</span>
                        : <span className="text-slate-500 text-xs">Not linked</span>
                      }
                    </td>
                    <td className="px-4 py-3 flex gap-1.5">
                      <button type="button" onClick={() => openEdit(p)}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">Edit</button>
                      <button type="button" disabled={deleteMut.isPending}
                        onClick={() => { if (confirm(`Delete ${p.name}?`)) deleteMut.mutate(p.id) }}
                        className="rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/10">Del</button>
                    </td>
                  </tr>
                ))}
                {!isLoading && parents.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No parents added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </G>
      </div>

      {/* Modal */}
      {modal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/40 dark:bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => { setModal('none'); setErr('') }}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white dark:bg-[#0f172a] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{modal === 'create' ? '+ Add Parent' : '✏️ Edit Parent'}</h2>
              <button onClick={() => { setModal('none'); setErr('') }} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            {err && <div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{err}</div>}

            {modal === 'create' && (
              <div className="mb-3 rounded-xl bg-pink-500/10 border border-pink-500/20 px-3 py-2 text-xs text-pink-300">
                🪪 Login ID will be auto-generated as <strong>PAR001</strong>, <strong>PAR002</strong>, etc.
              </div>
            )}

            <div className="grid gap-3 mb-5">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Full Name *</span>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Ramesh Sharma"
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-pink-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
              {modal === 'create' && (
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Password *</span>
                  <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters"
                    className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-pink-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                </label>
              )}
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Phone</span>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit number"
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 text-sm text-white outline-none focus:border-pink-500 placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Link to Student</span>
                <select value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}
                  className="h-10 rounded-xl border border-white/10 bg-white dark:bg-[#0f172a] px-3 text-sm text-white outline-none focus:border-pink-500">
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.className ? ` (Class ${s.className})` : ''}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Photo (optional)</span>
                <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] ?? null)}
                  className="h-10 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 px-3 py-2 text-xs text-slate-400 outline-none file:mr-2 file:rounded-lg file:border-0 file:bg-pink-500/20 file:px-2 file:py-1 file:text-xs file:text-pink-300" />
              </label>
            </div>

            <div className="flex gap-2">
              <button type="button"
                disabled={modal === 'create' ? createMut.isPending : editMut.isPending}
                onClick={() => modal === 'create' ? createMut.mutate() : editMut.mutate()}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 py-2.5 text-sm font-semibold text-white hover:from-pink-500 hover:to-rose-500 disabled:opacity-40 transition-all shadow-lg">
                {modal === 'create' ? (createMut.isPending ? 'Creating...' : 'Create Parent') : (editMut.isPending ? 'Saving...' : 'Save Changes')}
              </button>
              <button type="button" onClick={() => { setModal('none'); setErr('') }}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
