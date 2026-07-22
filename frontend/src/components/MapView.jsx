import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom MapBoundsUpdater component to zoom and center the map dynamically
function MapBoundsUpdater({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [points, map]);
  return null;
}

// Generate Custom Div Icons with Tailwind CSS
const createMarkerIcon = (label, bgClass) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="flex items-center justify-center w-8 h-8 rounded-full ${bgClass} border-2 border-white shadow-lg text-white font-bold text-sm transform transition-all duration-300 hover:scale-125">
        ${label}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const createFuelIcon = () => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="flex items-center justify-center w-7 h-7 rounded-full bg-dark-800 border-2 border-amber-500 shadow-md text-amber-500 text-xs font-bold transform transition-all duration-300 hover:scale-125">
        ⛽
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

export default function MapView({ 
  originCoords, 
  pickupCoords, 
  destinationCoords, 
  routePoints,
  originAddress,
  pickupAddress,
  destinationAddress,
  rawEvents
}) {
  // Extract fuel stops from the timeline events
  const fuelStops = rawEvents
    ? rawEvents.filter(e => e.event_type === 'ON_DUTY_ND' && e.description.toLowerCase().includes('refuel'))
    : [];

  // Estimate geographic position for fuel stops along the route points
  const getFuelStopPositions = () => {
    if (!routePoints || routePoints.length === 0 || fuelStops.length === 0) return [];
    
    const positions = [];
    const totalPoints = routePoints.length;
    
    // Distribute fuel stops evenly along the route list (since fuel stops occur at distance-based intervals)
    fuelStops.forEach((stop, index) => {
      // Find the index along route points
      const ratio = (index + 1) / (fuelStops.length + 1);
      const pointIndex = Math.min(Math.floor(totalPoints * ratio), totalPoints - 1);
      positions.push({
        coords: routePoints[pointIndex],
        odometer: stop.start_odometer,
        description: stop.description
      });
    });
    
    return positions;
  };

  const fuelPositions = getFuelStopPositions();
  const center = originCoords || [39.8283, -98.5795]; // Geographical center of continental US

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-800 shadow-glass">
      <MapContainer
        center={center}
        zoom={4}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        {/* CartoDB Dark Matter Map Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Dynamic bounds updater */}
        <MapBoundsUpdater points={routePoints} />

        {/* Origin Marker */}
        {originCoords && (
          <Marker position={originCoords} icon={createMarkerIcon('S', 'bg-primary-600 shadow-primary-500/50')}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-primary-400">Start Location</p>
                <p>{originAddress}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Pickup Marker */}
        {pickupCoords && (
          <Marker position={pickupCoords} icon={createMarkerIcon('P', 'bg-emerald-600 shadow-emerald-500/50')}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-emerald-400">Pickup Location</p>
                <p>{pickupAddress}</p>
                <p className="text-slate-400 mt-1">Status: 1-hour loading scheduled</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {destinationCoords && (
          <Marker position={destinationCoords} icon={createMarkerIcon('D', 'bg-rose-600 shadow-rose-500/50')}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-rose-400">Destination Location</p>
                <p>{destinationAddress}</p>
                <p className="text-slate-400 mt-1">Status: 1-hour unloading scheduled</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Fuel Stop Markers */}
        {fuelPositions.map((fuel, idx) => (
          <Marker key={idx} position={fuel.coords} icon={createFuelIcon()}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-amber-400">⛽ Fuel Stop {idx + 1}</p>
                <p>Scheduled at Odometer: {Math.round(fuel.odometer)} mi</p>
                <p className="text-slate-400 mt-0.5">Duration: 30 minutes (On Duty)</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Route Polyline Path */}
        {routePoints && routePoints.length > 0 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#0ea5e9',
              weight: 4,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: 'none'
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
