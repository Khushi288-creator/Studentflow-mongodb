/** Return date (YYYY-MM-DD) and time (HH:mm:ss) in IST (UTC+5:30). */
export function nowInIST(): { date: string; time: string } {
  const offset = 5.5 * 60 * 60 * 1000
  const ist = new Date(Date.now() + offset)
  const iso = ist.toISOString()
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 19),
  }
}
