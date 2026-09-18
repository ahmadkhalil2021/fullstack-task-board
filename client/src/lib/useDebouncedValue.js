// useDebouncedValue.js — Delay a value without adding a runtime dependency.
// Keeps the input responsive while the effective search state updates after a pause.

import { useEffect, useState } from 'react'

export const useDebouncedValue = (value, delay = 150) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [value, delay])

  return debouncedValue
}
