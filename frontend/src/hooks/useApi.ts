import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

/** Load data from the API when deps change. Ignores stale responses if deps change mid-request. */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)

  const run = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    load()
      .then((result) => {
        if (id === requestId.current) setData(result)
      })
      .catch((err: Error) => {
        if (id === requestId.current) setError(err.message)
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, deps)

  useEffect(run, [run])

  return { data, error, loading, reload: run, setData }
}
