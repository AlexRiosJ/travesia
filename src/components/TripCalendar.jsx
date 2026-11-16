import { Button, Card, Empty, Tag } from 'antd'
import { ArrowRightOutlined, DownloadOutlined, EnterOutlined } from '@ant-design/icons'
import { buildStopLabels } from '../utils/stopLabels'
import { UI_COPY, getLocale } from '../i18n'
import { getDailyPlanEntries } from '../utils/stayDays'

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
    const dailyPlanDescription = getDailyPlanEntries(stop)
      .map(({ date, plan }) => `${date}: ${plan}`)
      .join('\n')

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
        `${stop.category === 'day-trip' ? copy.dayTrip : copy.stay} · ${stop.startDate} - ${stop.endDate}${
          dailyPlanDescription
            ? `\n${copy.dailyPlans}:\n${dailyPlanDescription}`
            : ''
        }`,
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
    <Card className="calendar-panel" role="region" aria-label={copy.calendar}
      variant="borderless" styles={{ body: { padding: 0 } }}>
      <div className="calendar-heading">
        <div>
          <h2>{copy.calendar}</h2>
          <p>{copy.calendarHint}</p>
        </div>
        <Button
          htmlType="button"
          className="calendar-export-button"
          icon={<DownloadOutlined aria-hidden="true" />}
          onClick={() => exportCalendar(stops, legs, tripTitle, copy)}
          disabled={stops.length === 0}
        >
          {copy.exportIcs}
        </Button>
      </div>

      <div className="calendar-legend" aria-label={copy.itinerary}>
        {calendarStops.map(({ stop, stopIndex }) => (
          <Tag key={stop.id} icon={
            <span
              className="calendar-legend-color"
              style={{ backgroundColor: stopColors.get(stopIndex) }}
              aria-hidden="true"
            />
          }>
            {stopLabels.get(stopIndex)} · {stop.place || copy.newStay} ·{' '}
            {stop.startDate}
          </Tag>
        ))}
      </div>

      {months.length === 0 ? (
        <Empty className="calendar-empty" image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={copy.emptyCalendar} />
      ) : (
        <div className="calendar-months">
          {months.map((month) => (
            <Card
              className="calendar-month"
              size="small"
              title={<h3>{formatMonth(month, language)}</h3>}
              styles={{ body: { padding: 0 } }}
              key={`${month.getUTCFullYear()}-${month.getUTCMonth()}`}
            >
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
                  const dailyPlans = baseEvents.flatMap(
                    ({ stop, stopIndex }) => {
                      const plan = stop.dailyPlans?.[dateKey]?.trim()
                      return plan ? [{ plan, stop, stopIndex }] : []
                    },
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
                    <div className="calendar-day" key={dateKey} data-date={dateKey}>
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
                            <Button
                              htmlType="button"
                              type="primary"
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
                              aria-pressed={stopIndex === activeStopIndex}
                              title={`${stop.place} · ${
                                stop.category === 'day-trip'
                                  ? copy.dayTrip
                                  : copy.stay
                              }`}
                              aria-label={`${stop.place || copy.newStay}, ${
                                stop.category === 'day-trip'
                                  ? copy.dayTrip
                                  : copy.stay
                              }, ${dateKey}`}
                            >
                              {showLabel
                                ? `${stopLabels.get(stopIndex)} ${stop.place || copy.newStay}`
                                : '\u00a0'}
                            </Button>
                          )
                        })}
                      </div>
                      {nestedEvents.length > 0 && (
                        <div className="calendar-nested-events">
                          {nestedEvents.map(({ stop, stopIndex }) => (
                            <Button
                              htmlType="button"
                              type="primary"
                              icon={<EnterOutlined aria-hidden="true" />}
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
                              aria-pressed={stopIndex === activeStopIndex}
                              aria-label={`${stop.place || copy.newDayTrip}, ${copy.dayTrip}, ${dateKey}, ${copy.roundTripFrom} ${baseStops.get(stopIndex)?.place ?? copy.stay}`}
                              title={`${stop.place} · ${copy.dayTrip} · ${baseStops.get(stopIndex)?.place ?? copy.stay}`}
                            >
                              <span className="calendar-nested-content">
                                <span>{stopLabels.get(stopIndex)} {stop.place || copy.newDayTrip}</span>
                                <small>
                                  {copy.roundTripFrom} {baseStops.get(stopIndex)?.place}
                                </small>
                              </span>
                            </Button>
                          ))}
                        </div>
                      )}
                      {dailyPlans.length > 0 && (
                        <div
                          className="calendar-daily-plans"
                          aria-label={copy.dailyPlans}
                        >
                          {dailyPlans.map(({ plan, stop, stopIndex }) => (
                            <Button
                              htmlType="button"
                              type="text"
                              className="calendar-daily-plan"
                              key={`${stop.id}-${dateKey}`}
                              onClick={() => onSelectStop(stopIndex)}
                              aria-label={`${copy.dailyPlanFor} ${dateKey}: ${plan}`}
                              title={plan}
                            >
                              <span
                                className="calendar-daily-plan-marker"
                                style={{
                                  backgroundColor: stopColors.get(stopIndex),
                                }}
                                aria-hidden="true"
                              />
                              <span>{plan}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                      {movements.length > 0 && (
                        <div className="calendar-movements">
                          {movements.map(({ leg, routeIndex }) => (
                            <Button
                              htmlType="button"
                              icon={<ArrowRightOutlined aria-hidden="true" />}
                              className={`calendar-movement${
                                routeIndex === activeRoute ? ' is-active' : ''
                              }`}
                              key={leg.id}
                              onClick={() => onSelectRoute(routeIndex)}
                              aria-pressed={routeIndex === activeRoute}
                              aria-label={`${copy.transfer}: ${leg.from.place} ${copy.to} ${leg.to.place}, ${dateKey}`}
                              title={`${getTransportLabel(leg.transport) ? `${getTransportLabel(leg.transport)}: ` : ''}${leg.from.place} ${copy.to} ${leg.to.place}`}
                            >
                              <span>
                                {leg.category !== 'day-trip' &&
                                  getTransportLabel(leg.transport) &&
                                  `${getTransportLabel(leg.transport)} · `}
                                {leg.from.place}{' '}
                                {leg.category === 'day-trip' ? '↔' : '→'}{' '}
                                {leg.to.place}
                              </span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  )
}

export default TripCalendar
