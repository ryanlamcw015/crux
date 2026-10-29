import { useCallback, useState } from 'react'

export interface Coords {
  lat: number
  lon: number
}

/** Ask the browser for the user's location on demand (never automatically). */
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setError('Location permission denied')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }, [])

  return { coords, error, locating, locate, clear: () => setCoords(null) }
}
