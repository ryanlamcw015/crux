import L from 'leaflet'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { scoreTone } from '../lib/format'

export interface MapPoint {
  id: number
  name: string
  lat: number
  lon: number
  score: number | null
  subtitle?: string
}

function FitBounds({ points, padding }: { points: MapPoint[]; padding: number }) {
  const map = useMap()
  const key = points.map((p) => p.id).join(',')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 13)
      return
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [padding, padding], maxZoom: 15 })
  }, [key])
  return null
}

/** Dark map with markers colored by Conditions Score. */
export function AreaMap({
  points,
  activeId,
  onSelect,
  onHover,
  className,
}: {
  points: MapPoint[]
  activeId?: number | null
  onSelect?: (id: number) => void
  onHover?: (id: number | null) => void
  className?: string
}) {
  return (
    <MapContainer center={[39.5, -98.35]} zoom={4} scrollWheelZoom className={className} zoomControl attributionControl>
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
      <FitBounds points={points} padding={40} />
      {points.map((p) => {
        const tone = scoreTone(p.score)
        const active = p.id === activeId
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={active ? 13 : 9}
            pathOptions={{ color: active ? '#ffffff' : tone.color, weight: active ? 3 : 2, fillColor: tone.color, fillOpacity: 0.85 }}
            eventHandlers={{
              click: () => onSelect?.(p.id),
              mouseover: () => onHover?.(p.id),
              mouseout: () => onHover?.(null),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="font-semibold">{p.name}</div>
              <div style={{ color: tone.color }}>
                {p.score ?? '–'} · {tone.label}
              </div>
              {p.subtitle && <div className="text-ink-400">{p.subtitle}</div>}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
