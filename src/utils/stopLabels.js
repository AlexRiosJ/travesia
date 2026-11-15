function toLetter(index) {
  let value = index
  let label = ''

  while (value > 0) {
    value -= 1
    label = String.fromCharCode(97 + (value % 26)) + label
    value = Math.floor(value / 26)
  }

  return label
}

export function buildStopLabels(stops) {
  const labels = new Map()
  let stayNumber = 0
  let childNumber = 0

  stops.forEach((stop, index) => {
    if (stop.category === 'day-trip') {
      childNumber += 1
      labels.set(index, `${stayNumber}${toLetter(childNumber)}`)
      return
    }

    stayNumber += 1
    childNumber = 0
    labels.set(index, String(stayNumber))
  })

  return labels
}
