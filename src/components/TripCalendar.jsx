import { buildStopLabels } from '../utils/stopLabels'
import { UI_COPY, getLocale } from '../i18n'

const STOP_COLORS = [
  '#2f8177',
  '#6d63a5',
  '#c76d3b',
  '#3d78a6',
  '#a85672',
  '#6e8f3d',
  '#9b6b32',
  '#546b7a',
]
const TRANSPORT_LABELS = {
  unspecified: 'Por definir',
  walk: 'A pie',
  local: 'Transporte local',
  train: 'Tren',
  shinkansen: 'Shinkansen',
  flight: 'Avión',
  bus: 'Autobús',
  car: 'Auto',
  ferry: 'Ferry',
}

function getTransportLabel(transport) {
  if (transport === 'unspecified' || transport === 'Por definir') return ''
  return TRANSPORT_LABELS[transport] || transport || ''
}

function parseDate(date) {
  return new Date(`${date}T12:00:00Z`)
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function formatMonth(date, language) {
  const label = new Intl.DateTimeFormat(getLocale(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function getMonths(stops, legs) {
  const months = new Map()

  stops.forEach((stop) => {
    const current = parseDate(stop.startDate)
    current.setUTCDate(1)
    const end = parseDate(stop.endDate)
    end.setUTCDate(1)

    while (current <= end) {
      const key = `${current.getUTCFullYear()}-${current.getUTCMonth()}`
      months.set(key, new Date(current))
      current.setUTCMonth(current.getUTCMonth() + 1)
    }
  })

  legs.forEach((leg) => {
    const date = parseDate(leg.date)
    date.setUTCDate(1)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    months.set(key, date)
  })

  return [...months.values()].sort((first, second) => first - second)
}

function getMonthDays(month) {
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const firstDay = new Date(Date.UTC(year, monthIndex, 1, 12))
  const daysInMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0, 12),
  ).getUTCDate()
  const leadingCells = (firstDay.getUTCDay() + 6) % 7
  const cellCount = Math.ceil((leadingCells + daysInMonth) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingCells + 1
    return day > 0 && day <= daysInMonth
      ? new Date(Date.UTC(year, monthIndex, day, 12))
      : null
  })
}

function assignEventLanes(stops) {
  const laneEnds = []
  const assignments = new Map()
  const orderedStops = stops
    .map((stop, stopIndex) => ({ stop, stopIndex }))
    .filter(({ stop }) => stop.category !== 'day-trip')
    .sort(
      (first, second) =>
        first.stop.startDate.localeCompare(second.stop.startDate) ||
        first.stop.endDate.localeCompare(second.stop.endDate),
    )

  orderedStops.forEach(({ stop, stopIndex }) => {
    let lane = laneEnds.findIndex((endDate) => endDate < stop.startDate)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = stop.endDate
    assignments.set(stopIndex, lane)
  })

  return assignments
}

function assignBaseStops(stops) {
  const assignments = new Map()
  let baseStop = null

  stops.forEach((stop, stopIndex) => {
    if (stop.category === 'day-trip') {
      assignments.set(stopIndex, baseStop)
      return
    }

    baseStop = stop
  })

  return assignments
}

function assignStopColors(stops) {
  const assignments = new Map()
  let baseColor = STOP_COLORS[0]
  let baseIndex = 0

  stops.forEach((stop, stopIndex) => {
    if (stop.category !== 'day-trip') {
      baseColor = STOP_COLORS[baseIndex % STOP_COLORS.length]
      baseIndex += 1
    }

    assignments.set(stopIndex, baseColor)
  })

  return assignments
}

function escapeCalendarText(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

function toCalendarDate(date) {
  return date.replaceAll('-', '')
}

function addDay(date) {
  const nextDate = parseDate(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  return formatDateKey(nextDate)
}

function exportCalendar(stops, legs, tripTitle, copy) {
  const timestamp = new Date()
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z')
  const events = stops.flatMap((stop) => {
    return [
      'BEGIN:VEVENT',
      `UID:${stop.id}@travesia.local`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${toCalendarDate(stop.startDate)}`,
      `DTEND;VALUE=DATE:${toCalendarDate(addDay(stop.endDate))}`,
      `SUMMARY:${escapeCalendarText(
        `${stop.category === 'day-trip' ? `${copy.dayTrip}: ` : ''}${stop.place}`,
      )}`,
      `DESCRIPTION:${escapeCalendarText(
        `${stop.category === 'day-trip' ? copy.dayTrip : copy.stay} · ${stop.startDate} - ${stop.endDate}`,
      )}`,
      `CATEGORIES:${escapeCalendarText(
        stop.category === 'day-trip' ? copy.dayTrip : copy.stay,
      )}`,
      'END:VEVENT',
    ]
  })
  const transferEvents = legs
    .filter((leg) => leg.category !== 'day-trip')
    .flatMap((leg) => {
      const transport = getTransportLabel(leg.transport)

      return [
        'BEGIN:VEVENT',
        `UID:${leg.id}-transfer@travesia.local`,
        `DTSTAMP:${timestamp}`,
        `DTSTART;VALUE=DATE:${toCalendarDate(leg.date)}`,
        `DTEND;VALUE=DATE:${toCalendarDate(addDay(leg.date))}`,
        `SUMMARY:${escapeCalendarText(`${copy.transfer}${transport ? ` (${transport})` : ''}: ${leg.from.place} → ${leg.to.place}`)}`,
        `DESCRIPTION:${escapeCalendarText(`${leg.date}${transport ? ` · ${transport}` : ''}`)}`,
        `CATEGORIES:${escapeCalendarText(copy.transfer)}`,
        'END:VEVENT',
      ]
    })
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Travesia//Trip Calendar//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeCalendarText(tripTitle || copy.unnamedTrip)}`,
    ...events,
    ...transferEvents,
    'END:VCALENDAR',
    '',
  ].join('\r\n')
  const blob = new Blob([content], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const fileName =
    (tripTitle || 'viaje')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'viaje'

  link.href = url
  link.download = `${fileName}.ics`
  link.click()
  URL.revokeObjectURL(url)
}

function TripCalendar({
  stops,
  legs,
  tripTitle,
  language,
  activeStopIndex,
  activeRoute,
  onSelectStop,
  onSelectRoute,
}) {
  const copy = UI_COPY[language] ?? UI_COPY.es
  const months = getMonths(stops, legs)
  const eventLanes = assignEventLanes(stops)
  const baseStops = assignBaseStops(stops)
  const stopColors = assignStopColors(stops)
  const stopLabels = buildStopLabels(stops)
  const calendarStops = stops
    .map((stop, stopIndex) => ({ stop, stopIndex }))
    .filter(({ stop }) => stop.category !== 'day-trip')

  return (
    <section className="calendar-panel" aria-label={copy.calendar}>
      <div className="calendar-heading">
        <div>
          <h2>{copy.calendar}</h2>
          <p>{copy.calendarHint}</p>
        </div>
        <button
          type="button"
          className="calendar-export-button"
          onClick={() => exportCalendar(stops, legs, tripTitle, copy)}
          disabled={stops.length === 0}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14" />
          </svg>
          {copy.exportIcs}
        </button>
      </div>

      <div className="calendar-legend" aria-label={copy.itinerary}>
        {calendarStops.map(({ stop, stopIndex }) => (
          <span key={stop.id}>
            <i
              className="calendar-legend-color"
              style={{ backgroundColor: stopColors.get(stopIndex) }}
            />
            {stopLabels.get(stopIndex)} · {stop.place || 'Nueva estancia'} ·{' '}
            {stop.startDate}
          </span>
        ))}
      </div>

      {months.length === 0 ? (
        <p className="calendar-empty">{copy.emptyCalendar}</p>
      ) : (
        <div className="calendar-months">
          {months.map((month) => (
            <article
              className="calendar-month"
              key={`${month.getUTCFullYear()}-${month.getUTCMonth()}`}
            >
              <h3>{formatMonth(month, language)}</h3>
              <div className="calendar-grid">
                {copy.weekdays.map((weekday) => (
                  <div className="calendar-weekday" key={weekday}>
                    {weekday}
                  </div>
                ))}

                {getMonthDays(month).map((day, cellIndex) => {
                  if (!day) {
                    return (
                      <div
                        className="calendar-day calendar-day--empty"
                        key={`empty-${cellIndex}`}
                        aria-hidden="true"
                      />
                    )
                  }

                  const dateKey = formatDateKey(day)
                  const events = stops
                    .map((stop, stopIndex) => ({ stop, stopIndex }))
                    .filter(
                      ({ stop }) =>
                        dateKey >= stop.startDate && dateKey <= stop.endDate,
                    )
                  const baseEvents = events.filter(
                    ({ stop }) => stop.category !== 'day-trip',
                  )
                  const nestedEvents = events.filter(
                    ({ stop }) => stop.category === 'day-trip',
                  )
                  const movements = legs
                    .map((leg, routeIndex) => ({ leg, routeIndex }))
                    .filter(
                      ({ leg }) =>
                        leg.date === dateKey &&
                        (leg.category !== 'day-trip'
                          ? true
                          : leg.direction === 'outbound'),
                    )

                  return (
                    <div className="calendar-day" key={dateKey}>
                      <span className="calendar-day-number">
                        {day.getUTCDate()}
                      </span>
                      <div className="calendar-events">
                        {baseEvents.map(({ stop, stopIndex }) => {
                          const isStart = dateKey === stop.startDate
                          const isEnd = dateKey === stop.endDate
                          const isWeekStart = day.getUTCDay() === 1
                          const showLabel = isStart || isWeekStart

                          return (
                            <button
                              type="button"
                              className={[
                                'calendar-event',
                                isStart || isWeekStart ? 'is-start' : '',
                                isEnd || day.getUTCDay() === 0 ? 'is-end' : '',
                                stopIndex === activeStopIndex ? 'is-active' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              key={stop.id}
                              style={{
                                gridRow: eventLanes.get(stopIndex) + 1,
                                backgroundColor: stopColors.get(stopIndex),
                              }}
                              onClick={() => onSelectStop(stopIndex)}
                              title={`${stop.place} · ${
                                stop.category === 'day-trip'
                                  ? copy.dayTrip
                                  : copy.stay
                              }`}
                              aria-label={`${stop.place}, ${
                                stop.category === 'day-trip'
                                  ? copy.dayTrip
                                  : copy.stay
                              }, ${dateKey}`}
                            >
                              {showLabel
                                ? `${stopLabels.get(stopIndex)} ${stop.place || 'Nueva estancia'}`
                                : '\u00a0'}
                            </button>
                          )
                        })}
                      </div>
                      {nestedEvents.length > 0 && (
                        <div className="calendar-nested-events">
                          {nestedEvents.map(({ stop, stopIndex }) => (
                            <button
                              type="button"
                              className={[
                                'calendar-nested-event',
                                stopIndex === activeStopIndex ? 'is-active' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              key={stop.id}
                              style={{
                                backgroundColor: stopColors.get(stopIndex),
                              }}
                              onClick={() => onSelectStop(stopIndex)}
                              title={`${stop.place} · ${copy.dayTrip} · ${baseStops.get(stopIndex)?.place ?? copy.stay}`}
                            >
                              <b>↳</b>
                              <span>
                                {stopLabels.get(stopIndex)} {stop.place}
                                {!stop.place && 'Nuevo day trip'}
                              </span>
                              <small>
                                en {baseStops.get(stopIndex)?.place}
                              </small>
                            </button>
                          ))}
                        </div>
                      )}
                      {movements.length > 0 && (
                        <div className="calendar-movements">
                          {movements.map(({ leg, routeIndex }) => (
                            <button
                              type="button"
                              className={`calendar-movement${
                                routeIndex === activeRoute ? ' is-active' : ''
                              }`}
                              key={leg.id}
                              onClick={() => onSelectRoute(routeIndex)}
                              title={`${getTransportLabel(leg.transport) ? `${getTransportLabel(leg.transport)}: ` : ''}${leg.from.place} a ${leg.to.place}`}
                            >
                              <b>→</b>
                              <span>
                                {leg.category !== 'day-trip' &&
                                  getTransportLabel(leg.transport) &&
                                  `${getTransportLabel(leg.transport)} · `}
                                {leg.from.place}{' '}
                                {leg.category === 'day-trip' ? '↔' : '→'}{' '}
                                {leg.to.place}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default TripCalendar
