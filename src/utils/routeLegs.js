export function buildRouteLegs(stops, origin, destination) {
  if (stops.length === 0) return []

  const legs = []
  let baseStop = stops[0]
  let baseIndex = 0

  if (origin?.lat != null && origin?.lng != null) {
    legs.push({
      id: `${origin.id}-${baseStop.id}`,
      from: origin,
      to: baseStop,
      fromIndex: -1,
      toIndex: 0,
      timelineIndex: 0,
      category: 'transfer',
      direction: 'outbound',
      date: origin.date,
      transport: origin.transport || '',
    })
  }

  stops.slice(1).forEach((stop, offset) => {
    const stopIndex = offset + 1

    if (stop.category === 'day-trip') {
      legs.push({
        id: `${baseStop.id}-${stop.id}-outbound`,
        from: baseStop,
        to: stop,
        fromIndex: baseIndex,
        toIndex: stopIndex,
        timelineIndex: stopIndex,
        category: stop.category,
        direction: 'outbound',
        date: stop.startDate,
        transport: stop.transport || '',
      })
      legs.push({
        id: `${stop.id}-${baseStop.id}-return`,
        from: stop,
        to: baseStop,
        fromIndex: stopIndex,
        toIndex: baseIndex,
        timelineIndex: stopIndex,
        category: stop.category,
        direction: 'return',
        date: stop.startDate,
        transport: stop.transport || '',
      })
      return
    }

    legs.push({
      id: `${baseStop.id}-${stop.id}`,
      from: baseStop,
      to: stop,
      fromIndex: baseIndex,
      toIndex: stopIndex,
      timelineIndex: baseIndex,
      category: stop.category,
      direction: 'outbound',
      date: stop.startDate,
      transport: stop.transport || '',
    })
    baseStop = stop
    baseIndex = stopIndex
  })

  if (destination?.lat != null && destination?.lng != null) {
    legs.push({
      id: `${baseStop.id}-${destination.id}`,
      from: baseStop,
      to: destination,
      fromIndex: baseIndex,
      toIndex: stops.length,
      timelineIndex: stops.length - 1,
      category: 'transfer',
      direction: 'outbound',
      date: destination.date,
      transport: destination.transport || '',
    })
  }

  return legs
}
