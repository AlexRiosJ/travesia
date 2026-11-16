function parseDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null

  const date = new Date(`${dateKey}T12:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey
    ? null
    : date
}

export function getStayDateKeys(startDate, endDate) {
  const current = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  if (!current || !end || current > end) return []

  const dates = []
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

export function getDailyPlanEntries(stop) {
  const dailyPlans =
    stop.dailyPlans && typeof stop.dailyPlans === 'object'
      ? stop.dailyPlans
      : {}

  return getStayDateKeys(stop.startDate, stop.endDate).flatMap((date) => {
    const plan = typeof dailyPlans[date] === 'string' ? dailyPlans[date].trim() : ''
    return plan ? [{ date, plan }] : []
  })
}
