import { useState } from 'react'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Input, Modal, Steps } from 'antd'
import PlaceAutocomplete from './PlaceAutocomplete'

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function createStay(date) {
  return {
    id: crypto.randomUUID(),
    place: '',
    startDate: date,
    endDate: date,
    category: 'stay',
    transport: '',
    dailyPlans: {},
  }
}

function createInitialDraft(copy) {
  const date = getToday()

  return {
    title: copy.newTrip,
    origin: { place: '', date },
    destination: { place: '', date },
    stays: [createStay(date)],
  }
}

function updatePlace(record, value, selection = null) {
  const {
    lat: _lat,
    lng: _lng,
    displayName: _displayName,
    ...remainingFields
  } = record

  if (!selection) return { ...remainingFields, place: value }

  return {
    ...remainingFields,
    place: selection.displayName,
    lat: selection.lat,
    lng: selection.lng,
    displayName: selection.displayName,
  }
}

function normalizePlace(record) {
  const place = record.place.trim()
  if (Number.isFinite(record.lat) && Number.isFinite(record.lng)) {
    return {
      ...record,
      place,
      displayName: record.displayName || place,
    }
  }

  const {
    lat: _lat,
    lng: _lng,
    displayName: _displayName,
    ...remainingFields
  } = record
  return { ...remainingFields, place }
}

function validateRoute(draft, copy) {
  if (!draft.origin.place.trim() || !draft.destination.place.trim()) {
    return copy.wizardEndpointsRequired
  }

  if (!draft.origin.date || !draft.destination.date) {
    return copy.wizardEndpointDatesRequired
  }

  if (draft.destination.date < draft.origin.date) {
    return copy.wizardDestinationBeforeOrigin
  }

  return null
}

function validateStays(draft, copy) {
  if (draft.stays.length === 0) return copy.wizardStayRequired

  for (const [index, stay] of draft.stays.entries()) {
    if (!stay.place.trim() || !stay.startDate || !stay.endDate) {
      return copy.wizardStayFieldsRequired
    }

    if (stay.endDate < stay.startDate) {
      return copy.wizardStayDatesInvalid
    }

    if (
      stay.startDate < draft.origin.date ||
      stay.endDate > draft.destination.date
    ) {
      return copy.wizardStayOutsideTrip
    }

    const previousStay = draft.stays[index - 1]
    if (previousStay && stay.startDate < previousStay.endDate) {
      return copy.wizardStayOrderInvalid
    }
  }

  return null
}

function TripWizard({ open, copy, language, onCancel, onFinish }) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => createInitialDraft(copy))
  const [error, setError] = useState('')

  function updateEndpoint(endpoint, field, value) {
    setDraft((current) => ({
      ...current,
      [endpoint]: {
        ...current[endpoint],
        [field]: value,
      },
    }))
  }

  function updateEndpointPlace(endpoint, value, selection) {
    setDraft((current) => ({
      ...current,
      [endpoint]: updatePlace(current[endpoint], value, selection),
    }))
  }

  function updateStay(id, field, value) {
    setDraft((current) => ({
      ...current,
      stays: current.stays.map((stay) => {
        if (stay.id !== id) return stay
        if (field === 'startDate' && stay.endDate < value) {
          return { ...stay, startDate: value, endDate: value }
        }
        return { ...stay, [field]: value }
      }),
    }))
  }

  function updateStayPlace(id, value, selection) {
    setDraft((current) => ({
      ...current,
      stays: current.stays.map((stay) =>
        stay.id === id ? updatePlace(stay, value, selection) : stay,
      ),
    }))
  }

  function addStay() {
    setDraft((current) => {
      const previousDate =
        current.stays.at(-1)?.endDate || current.origin.date || getToday()
      return {
        ...current,
        stays: [...current.stays, createStay(previousDate)],
      }
    })
  }

  function removeStay(id) {
    setDraft((current) => ({
      ...current,
      stays: current.stays.filter((stay) => stay.id !== id),
    }))
  }

  function continueToStays() {
    const validationError = validateRoute(draft, copy)
    if (validationError) {
      setError(validationError)
      return
    }

    setDraft((current) => ({
      ...current,
      stays: current.stays.map((stay) =>
        stay.place
          ? stay
          : {
              ...stay,
              startDate: current.origin.date,
              endDate: current.destination.date,
            },
      ),
    }))
    setError('')
    setStep(1)
  }

  function completeWizard() {
    const validationError = validateStays(draft, copy)
    if (validationError) {
      setError(validationError)
      return
    }

    onFinish({
      title: draft.title.trim() || copy.newTrip,
      origin: normalizePlace(draft.origin),
      destination: normalizePlace(draft.destination),
      stays: draft.stays.map(normalizePlace),
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (step === 0) {
      continueToStays()
    } else {
      completeWizard()
    }
  }

  return (
    <Modal
      className="trip-wizard-modal"
      title={copy.wizardTitle}
      open={open}
      width={780}
      footer={null}
      mask={{ closable: false }}
      destroyOnHidden
      onCancel={onCancel}
    >
      <Steps
        className="trip-wizard-steps"
        current={step}
        responsive={false}
        items={[
          { title: copy.wizardRouteStep },
          { title: copy.wizardStaysStep },
        ]}
      />

      <form className="trip-wizard-form" onSubmit={handleSubmit}>
        {step === 0 ? (
          <div className="trip-wizard-step">
            <p className="trip-wizard-intro">{copy.wizardRouteIntro}</p>
            <label className="trip-wizard-field">
              <span>{copy.tripName}</span>
              <Input
                value={draft.title}
                aria-label={copy.tripName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>

            <div className="trip-wizard-route-grid">
              {[
                ['origin', copy.origin, 'A'],
                ['destination', copy.destination, 'B'],
              ].map(([endpoint, label, marker]) => (
                <section className="trip-wizard-endpoint" key={endpoint}>
                  <div className="trip-wizard-endpoint-heading">
                    <span>{marker}</span>
                    <strong>{label}</strong>
                  </div>
                  <div className="trip-wizard-endpoint-fields">
                    <label className="trip-wizard-field">
                      <span>{copy.cityOrPlace}</span>
                      <PlaceAutocomplete
                        value={draft[endpoint].place}
                        placeholder={copy.cityPlaceholder}
                        ariaLabel={`${label}: ${copy.cityOrPlace}`}
                        autoFocus={endpoint === 'origin'}
                        language={language}
                        copy={copy}
                        onChange={(value) =>
                          updateEndpointPlace(endpoint, value)
                        }
                        onSelect={(selection) =>
                          updateEndpointPlace(
                            endpoint,
                            selection.displayName,
                            selection,
                          )
                        }
                      />
                    </label>
                    <label className="trip-wizard-field">
                      <span>{copy.date}</span>
                      <Input
                        type="date"
                        value={draft[endpoint].date}
                        aria-label={`${label}: ${copy.date}`}
                        onChange={(event) =>
                          updateEndpoint(endpoint, 'date', event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="trip-wizard-step">
            <p className="trip-wizard-intro">{copy.wizardStaysIntro}</p>
            <div className="trip-wizard-stays">
              {draft.stays.map((stay, index) => {
                const stayLabel = `${copy.stay} ${index + 1}`

                return (
                  <section className="trip-wizard-stay" key={stay.id}>
                    <strong className="trip-wizard-stay-title">
                      {stayLabel}
                    </strong>
                    <div className="trip-wizard-stay-fields">
                      <label className="trip-wizard-field">
                        <span>{copy.cityOrPlace}</span>
                        <PlaceAutocomplete
                          value={stay.place}
                          placeholder={copy.cityOrPlace}
                          ariaLabel={`${stayLabel}: ${copy.cityOrPlace}`}
                          autoFocus={index === 0}
                          language={language}
                          copy={copy}
                          onChange={(value) =>
                            updateStayPlace(stay.id, value)
                          }
                          onSelect={(selection) =>
                            updateStayPlace(
                              stay.id,
                              selection.displayName,
                              selection,
                            )
                          }
                        />
                      </label>
                      <label className="trip-wizard-field">
                        <span>{copy.arrival}</span>
                        <Input
                          type="date"
                          min={draft.origin.date}
                          max={draft.destination.date}
                          value={stay.startDate}
                          aria-label={`${stayLabel}: ${copy.arrival}`}
                          onChange={(event) =>
                            updateStay(stay.id, 'startDate', event.target.value)
                          }
                        />
                      </label>
                      <label className="trip-wizard-field">
                        <span>{copy.departure}</span>
                        <Input
                          type="date"
                          min={stay.startDate}
                          max={draft.destination.date}
                          value={stay.endDate}
                          aria-label={`${stayLabel}: ${copy.departure}`}
                          onChange={(event) =>
                            updateStay(stay.id, 'endDate', event.target.value)
                          }
                        />
                      </label>
                      <Button
                        htmlType="button"
                        type="text"
                        danger
                        className="trip-wizard-remove-stay"
                        disabled={draft.stays.length <= 1}
                        aria-label={`${copy.delete} ${stayLabel}`}
                        icon={<DeleteOutlined aria-hidden="true" />}
                        onClick={() => removeStay(stay.id)}
                      />
                    </div>
                  </section>
                )
              })}
            </div>
            <Button
              htmlType="button"
              type="dashed"
              className="trip-wizard-add-stay"
              icon={<PlusOutlined aria-hidden="true" />}
              onClick={addStay}
            >
              {copy.wizardAddAnotherStay}
            </Button>
          </div>
        )}

        {error && (
          <Alert
            className="trip-wizard-error"
            type="error"
            title={error}
            showIcon
          />
        )}

        <div className="trip-wizard-actions">
          <Button htmlType="button" onClick={onCancel}>
            {copy.cancel}
          </Button>
          <span className="trip-wizard-actions-spacer" />
          {step > 0 && (
            <Button
              htmlType="button"
              onClick={() => {
                setError('')
                setStep(0)
              }}
            >
              {copy.back}
            </Button>
          )}
          <Button htmlType="submit" type="primary">
            {step === 0 ? copy.continue : copy.finish}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default TripWizard
