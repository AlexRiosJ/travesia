import { useEffect, useRef, useState } from 'react'
import { LoadingOutlined } from '@ant-design/icons'
import { AutoComplete, Input } from 'antd'
import { searchPlaces } from '../utils/placeSearch'

const MIN_QUERY_LENGTH = 2
const SEARCH_DELAY_MS = 350

function getStatusOption(message) {
  return [
    {
      value: `status:${message}`,
      disabled: true,
      label: <span className="place-autocomplete-status">{message}</span>,
    },
  ]
}

function getResultOptions(results) {
  return results.map((result) => ({
    key: result.id,
    value: result.displayName,
    result,
    label: (
      <span className="place-autocomplete-option">
        <strong>{result.name}</strong>
        {result.context && <small>{result.context}</small>}
      </span>
    ),
  }))
}

function PlaceAutocomplete({
  value,
  placeholder,
  ariaLabel,
  autoFocus = false,
  language,
  copy,
  onChange,
  onSelect,
}) {
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const requestRef = useRef(null)
  const timerRef = useRef(null)
  const latestQueryRef = useRef('')
  const focusedRef = useRef(false)

  function cancelPendingSearch() {
    window.clearTimeout(timerRef.current)
    requestRef.current?.abort()
    requestRef.current = null
  }

  function resetSearch() {
    cancelPendingSearch()
    latestQueryRef.current = ''
    setOptions([])
    setOpen(false)
    setStatus('idle')
  }

  useEffect(() => () => cancelPendingSearch(), [])

  function handleSearch(nextQuery) {
    cancelPendingSearch()
    const query = nextQuery.trim()
    latestQueryRef.current = query

    if (query.length < MIN_QUERY_LENGTH) {
      setOptions([])
      setOpen(false)
      setStatus('idle')
      return
    }

    setOptions(getStatusOption(copy.placeSearchLoading))
    setOpen(focusedRef.current)
    setStatus('loading')
    timerRef.current = window.setTimeout(async () => {
      const controller = new AbortController()
      requestRef.current = controller

      try {
        const results = await searchPlaces(query, language, controller.signal)
        if (latestQueryRef.current !== query) return

        setOptions(
          results.length
            ? getResultOptions(results)
            : getStatusOption(copy.placeSearchNoResults),
        )
        setStatus(results.length ? 'ready' : 'empty')
        setOpen(focusedRef.current)
      } catch (error) {
        if (error.name === 'AbortError' || latestQueryRef.current !== query) {
          return
        }

        console.error('Place search failed.', error)
        setOptions(getStatusOption(copy.placeSearchError))
        setStatus('error')
        setOpen(focusedRef.current)
      } finally {
        if (requestRef.current === controller) requestRef.current = null
      }
    }, SEARCH_DELAY_MS)
  }

  function handleValueChange(nextValue) {
    onChange(nextValue)
    if (!nextValue.trim()) resetSearch()
  }

  function handleSelect(_value, option) {
    if (!option.result) return
    resetSearch()
    onSelect(option.result)
  }

  return (
    <AutoComplete
      className="place-autocomplete"
      classNames={{ popup: { root: 'place-autocomplete-popup' } }}
      value={value}
      options={options}
      open={open}
      status={status === 'error' ? 'error' : undefined}
      showSearch={{ filterOption: false, onSearch: handleSearch }}
      onChange={handleValueChange}
      onSelect={handleSelect}
      onFocus={() => {
        focusedRef.current = true
        if (options.length > 0) setOpen(true)
      }}
      onBlur={() => {
        focusedRef.current = false
        setOpen(false)
      }}
      onOpenChange={(nextOpen) =>
        setOpen(nextOpen && focusedRef.current && options.length > 0)
      }
      popupRender={(menu) => (
        <>
          {menu}
          <div className="place-autocomplete-attribution">
            {copy.placeSearchAttribution}{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>
          </div>
        </>
      )}
    >
      <Input
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-busy={status === 'loading'}
        autoFocus={autoFocus}
        suffix={
          <span className="place-autocomplete-loading">
            {status === 'loading' && (
            <LoadingOutlined spin aria-hidden="true" />
            )}
          </span>
        }
      />
    </AutoComplete>
  )
}

export default PlaceAutocomplete
