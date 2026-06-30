import { cn } from '../ui/cn'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type DayStatus = 'present' | 'absent' | 'none'

function statusForDate(
  dateStr: string,
  byDate: Map<string, 'present' | 'absent'>,
): DayStatus {
  return byDate.get(dateStr) ?? 'none'
}

export default function AttendanceCalendar({
  year,
  month,
  records,
  onMonthChange,
}: {
  year: number
  month: number
  records: { date: string; status: 'present' | 'absent' }[]
  onMonthChange?: (year: number, month: number) => void
}) {
  const byDate = new Map(records.map((r) => [r.date, r.status]))
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startPad = first.getDay()
  const monthLabel = first.toLocaleString('default', { month: 'long', year: 'numeric' })

  const prev = () => {
    const d = new Date(year, month - 1, 1)
    onMonthChange?.(d.getFullYear(), d.getMonth())
  }
  const next = () => {
    const d = new Date(year, month + 1, 1)
    onMonthChange?.(d.getFullYear(), d.getMonth())
  }

  const cells: { key: string; label: string; status: DayStatus }[] = []
  for (let i = 0; i < startPad; i++) {
    cells.push({ key: `pad-${i}`, label: '', status: 'none' })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({
      key: dateStr,
      label: String(day),
      status: statusForDate(dateStr, byDate),
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          className="rounded-xl px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{monthLabel}</div>
        <button
          type="button"
          onClick={next}
          className="rounded-xl px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className={cn(
              'flex aspect-square items-center justify-center rounded-xl text-xs font-medium',
              !cell.label && 'invisible',
              cell.status === 'present' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
              cell.status === 'absent' && 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
              cell.status === 'none' && cell.label && 'bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400',
            )}
            title={cell.label ? `${cell.key}: ${cell.status}` : undefined}
          >
            {cell.label}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-800" /> Present
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-rose-200 dark:bg-rose-800" /> Absent
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-slate-100 dark:bg-slate-800" /> No record
        </span>
      </div>
    </div>
  )
}
