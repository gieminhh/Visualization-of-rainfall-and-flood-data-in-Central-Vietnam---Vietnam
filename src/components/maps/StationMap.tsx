import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Station } from '../../types';
import { cn } from '../../utils';

interface StationMapProps {
  stations: Station[];
  selectedStation: string | null;
  onSelectStation: (name: string | null) => void;
  height?: string;
  showAll?: boolean;
}

function MapBounds({ stations }: { stations: Station[] }) {
  const map = useMap();
  useEffect(() => {
    if (stations.length > 0) {
      const bounds = stations.map(s => [s.latitude, s.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [stations, map]);
  return null;
}

export default function StationMap({ stations, selectedStation, onSelectStation, height = '400px' }: StationMapProps) {
  const center: [number, number] = [15.5, 108.0];

  return (
    <div style={{ height, position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds stations={stations} />
        {stations.map(station => {
          const isSelected = selectedStation === station.station_name;
          const hasData = station.n_rows > 0;
          return (
            <CircleMarker
              key={station.station_name}
              center={[station.latitude, station.longitude]}
              radius={isSelected ? 12 : 8}
              pathOptions={{
                fillColor: isSelected ? '#0891B2' : hasData ? '#2563EB' : '#94A3B8',
                fillOpacity: isSelected ? 1 : 0.8,
                color: isSelected ? '#0891B2' : '#FFFFFF',
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onSelectStation(isSelected ? null : station.station_name),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-slate-800">{station.station_name}</div>
                  <div className="text-slate-500 text-xs">{station.province_name}</div>
                  <hr className="my-1.5 border-slate-200" />
                  <div className="space-y-0.5 text-xs text-slate-600">
                    <div>📍 {station.latitude.toFixed(4)}°N, {station.longitude.toFixed(4)}°E</div>
                    <div>📊 {station.n_rows.toLocaleString()} bản ghi</div>
                    <div>🌧️ {station.n_rainfall.toLocaleString()} ngày có lượng mưa hợp lệ</div>
                    <div>📅 {station.first_date.slice(0, 10)} → {station.last_date.slice(0, 10)}</div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white rounded-lg shadow-md px-3 py-2 text-xs space-y-1"
        style={{ border: '1px solid #E2E8F0' }}>
        <div className="font-semibold text-slate-700 mb-1">Trạm quan trắc</div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2563EB' }} />
          <span className="text-slate-600">Có dữ liệu khí tượng</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#0891B2' }} />
          <span className="text-slate-600">Đang chọn</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#94A3B8' }} />
          <span className="text-slate-600">Chưa có dữ liệu</span>
        </div>
      </div>
    </div>
  );
}

// Mini chip for selected station
export function StationChip({ station, onRemove }: { station: Station; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      {station.station_name}
      <button onClick={onRemove} className="ml-0.5 hover:text-blue-800">×</button>
    </div>
  );
}
