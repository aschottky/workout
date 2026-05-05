/** Monday-first display order; values match `Date.getDay()` (0 = Sunday … 6 = Saturday). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const WEEKDAY_SHORT: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local calendar Monday 00:00 of the week containing `d`. */
export function mondayOfWeekContaining(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Seven ISO dates Monday → Sunday for the local week containing `ref`. */
export function isoDatesMonThroughSun(ref = new Date()): string[] {
  const mon = mondayOfWeekContaining(ref)
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const t = new Date(mon)
    t.setDate(mon.getDate() + i)
    out.push(toISODate(t))
  }
  return out
}

/** Next calendar day (including `from`) whose weekday is in `weekdays`. */
export function nextDateMatchingWeekdays(weekdays: number[], from = new Date()): string {
  const set = new Set(weekdays)
  for (let i = 0; i < 370; i++) {
    const t = new Date(from)
    t.setHours(12, 0, 0, 0)
    t.setDate(from.getDate() + i)
    if (set.has(t.getDay())) return toISODate(t)
  }
  return toISODate(from)
}

/** ISO dates in the current Mon–Sun week that match `weekdays`. */
export function datesThisWeekMatching(weekdays: number[], ref = new Date()): string[] {
  const set = new Set(weekdays)
  return isoDatesMonThroughSun(ref).filter((iso) => {
    const t = new Date(`${iso}T12:00:00`)
    return set.has(t.getDay())
  })
}
