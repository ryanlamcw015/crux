import { useSyncExternalStore } from 'react'

export type Units = 'imperial' | 'metric'

const KEY = 'crux_units'
const listeners = new Set<() => void>()

function read(): Units {
  try {
    return localStorage.getItem(KEY) === 'metric' ? 'metric' : 'imperial'
  } catch {
    return 'imperial'
  }
}

export function setUnits(units: Units) {
  try {
    localStorage.setItem(KEY, units)
  } catch {
    /* storage unavailable: keep the default */
  }
  listeners.forEach((l) => l())
}

/** °F/°C preference shared by every component, remembered per browser. */
export function useUnits() {
  const units = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 'imperial' as Units,
  )
  const temp = (c: number) => (units === 'metric' ? `${Math.round(c)}°C` : `${Math.round((c * 9) / 5 + 32)}°F`)
  const speed = (kmh: number) => (units === 'metric' ? `${Math.round(kmh)} km/h` : `${Math.round(kmh * 0.621)} mph`)
  const distance = (km: number) => (units === 'metric' ? `${Math.round(km)} km` : `${Math.round(km * 0.621)} mi`)
  return { units, setUnits, temp, speed, distance }
}
