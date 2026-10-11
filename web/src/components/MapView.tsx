import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { ActivityCard } from '../api/client'
import { useRefData } from '../state/auth'
import { categoryColor } from '../lib/format'

export const SEATTLE: [number, number] = [47.6205, -122.3393]
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; OpenStreetMap contributors'

function pinIcon(emoji: string, color: string, mine = false) {
  return L.divIcon({
    className: '',
    html: `<div class="tandem-pin${mine ? ' is-mine' : ''}" style="background:${color}"><span>${emoji}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [4, 38],
  })
}

/** Leaflet measures its container once; re-measure when layout settles or resizes. */
function ResizeFix() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [map])
  return null
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map(p => p.join(',')).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    else if (points.length === 1) map.setView(points[0], 14)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

/** Map of activities; tapping a pin selects it. */
export function ActivityMap({ activities, selectedId, onSelect, className = 'h-full' }: {
  activities: ActivityCard[]; selectedId?: number | null; onSelect?: (id: number) => void; className?: string
}) {
  const { hobbyMap } = useRefData()
  const points = useMemo(() => activities.map(a => [a.lat, a.lng] as [number, number]), [activities])
  return (
    <MapContainer center={SEATTLE} zoom={12} className={className} zoomControl={false} attributionControl>
      <TileLayer url={TILES} attribution={ATTR} />
      <ResizeFix />
      <FitBounds points={points} />
      {activities.map(a => {
        const h = hobbyMap[a.hobby_id]
        const color = a.id === selectedId ? '#1F1A17' : categoryColor(h?.category)
        return (
          <Marker key={a.id} position={[a.lat, a.lng]} icon={pinIcon(h?.emoji ?? '✨', color, !!a.my_status)}
            eventHandlers={{ click: () => onSelect?.(a.id) }} />
        )
      })}
    </MapContainer>
  )
}

/** Static single-location map; approximate locations get a soft circle. */
export function PlaceMap({ lat, lng, emoji = '📍', approximate, className = 'h-44' }: { lat: number; lng: number; emoji?: string; approximate?: boolean; className?: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={approximate ? 14 : 15} className={className} zoomControl={false}
      dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false}>
      <TileLayer url={TILES} attribution={ATTR} />
      <ResizeFix />
      {approximate
        ? <Circle center={[lat, lng]} radius={450} pathOptions={{ color: '#1F1A17', weight: 2, fillColor: '#FF6B4A', fillOpacity: 0.25 }} />
        : <Marker position={[lat, lng]} icon={pinIcon(emoji, '#FF6B4A')} />}
    </MapContainer>
  )
}

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onMove(e.latlng.lat, e.latlng.lng) })
  return null
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], Math.max(map.getZoom(), 14)) }, [lat, lng, map])
  return null
}

/** Pin picker: tap the map or drag the pin. */
export function PinPicker({ lat, lng, onChange, emoji = '📍', className = 'h-56' }: {
  lat: number; lng: number; onChange: (lat: number, lng: number) => void; emoji?: string; className?: string
}) {
  const icon = useMemo(() => pinIcon(emoji, '#FF6B4A'), [emoji])
  return (
    <MapContainer center={[lat, lng]} zoom={14} className={className} zoomControl={false}>
      <TileLayer url={TILES} attribution={ATTR} />
      <ResizeFix />
      <Recenter lat={lat} lng={lng} />
      <ClickToMove onMove={onChange} />
      <Marker position={[lat, lng]} icon={icon} draggable
        eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng) } }} />
    </MapContainer>
  )
}
