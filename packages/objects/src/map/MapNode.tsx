import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import 'leaflet/dist/leaflet.css';
import './MapNode.css';

// Fix for default Leaflet marker icons in React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
const WORLD_MAP_CENTER: [number, number] = [20, 0];
const WORLD_MAP_ZOOM = 2;
const DEFAULT_MAP_SIZE = { width: 520, height: 340 };

// Modern SVG Icons
const IconPin: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconLayers: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const IconLock: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconUnlock: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

export interface MapMarker {
  id: string;
  position: [number, number]; // [lat, lng]
  label?: string;
  color?: string;
}

export interface MapMarkerAnchor {
  x: number;
  y: number;
  visible: boolean;
}

export type TileLayerType = 'street' | 'satellite' | 'hybrid';

export interface MapData {
  center: [number, number];
  zoom: number;
  tileLayer: TileLayerType;
  markers: MapMarker[];
  markerAnchors?: Record<string, MapMarkerAnchor>;
  interactive: boolean;
}

interface MapNodeProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
  relationMode?: boolean;
  relationSourcePort?: string | null;
  onMarkerRelation?: (markerId: string) => void;
  onMarkerRelationHover?: (markerId: string | null) => void;
  onRequestRelationMode?: () => void;
}

// Licensed, free tile sources. Google's mt*.google.com endpoints are
// undocumented and against Google's ToS — do not use them.
const OSM_STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_REFERENCE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';

const TILE_LAYERS: Record<TileLayerType, { url: string; attribution: string }> = {
  street: {
    url: OSM_STREET_URL,
    attribution: OSM_ATTRIBUTION
  },
  satellite: {
    url: ESRI_IMAGERY_URL,
    attribution: ESRI_ATTRIBUTION
  },
  hybrid: {
    url: ESRI_IMAGERY_URL,
    attribution: ESRI_ATTRIBUTION
  }
};

const MapResizer: React.FC<{ width?: number; height?: number }> = ({ width, height }) => {
  const map = useMap();

  React.useEffect(() => {
    map.invalidateSize(false);
    const t1 = window.setTimeout(() => map.invalidateSize(false), 30);
    const t2 = window.setTimeout(() => map.invalidateSize(false), 150);
    const t3 = window.setTimeout(() => map.invalidateSize(false), 400);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize(false);
    });
    const container = map.getContainer();
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      resizeObserver.disconnect();
    };
  }, [map, width, height]);

  return null;
};

const MapClickEvents: React.FC<{ enabled: boolean; onAddMarker: (position: [number, number]) => void }> = ({ enabled, onAddMarker }) => {
  useMapEvents({
    dblclick: (event) => {
      if (!enabled) return;
      onAddMarker([event.latlng.lat, event.latlng.lng]);
    }
  });

  return null;
};

const MapController: React.FC<{ 
  center: [number, number]; 
  zoom: number; 
  markers: MapMarker[];
  onChangeCenterZoom: (center: [number, number], zoom: number) => void;
}> = ({ center, zoom, markers, onChangeCenterZoom }) => {
  const map = useMap();
  const lastMarkerSignatureRef = React.useRef('');

  React.useEffect(() => {
    const markerSignature = markers
      .map((marker) => `${marker.id}:${marker.position[0].toFixed(5)},${marker.position[1].toFixed(5)}`)
      .join('|');

    if (markers.length > 1 && markerSignature !== lastMarkerSignatureRef.current) {
      lastMarkerSignatureRef.current = markerSignature;
      const bounds = L.latLngBounds(markers.map((marker) => marker.position));
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: Math.max(zoom, 14) });
        return;
      }
    }

    lastMarkerSignatureRef.current = markerSignature;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const dist = currentCenter.distanceTo(L.latLng(center[0], center[1]));
    
    // Only update Leaflet if the incoming center is actually different
    if (dist > 1 || currentZoom !== zoom) {
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, markers, map]);

  useMapEvents({
    moveend: () => {
      const newCenter = map.getCenter();
      const newZoom = map.getZoom();
      const dist = newCenter.distanceTo(L.latLng(center[0], center[1]));
      
      // Prevent infinite loop: only sync to store if the user physically moved the map
      // further than a tiny floating point error, not if setView just moved it here.
      if (dist > 1 || newZoom !== zoom) {
        onChangeCenterZoom([newCenter.lat, newCenter.lng], newZoom);
      }
    },
    zoomend: () => {
      const newCenter = map.getCenter();
      const newZoom = map.getZoom();
      const dist = newCenter.distanceTo(L.latLng(center[0], center[1]));
      
      if (dist > 1 || newZoom !== zoom) {
        onChangeCenterZoom([newCenter.lat, newCenter.lng], newZoom);
      }
    }
  });

  return null;
};

const MarkerAnchorTracker: React.FC<{
  markers: MapMarker[];
  onAnchorsChange: (anchors: Record<string, MapMarkerAnchor>) => void;
}> = ({ markers, onAnchorsChange }) => {
  const map = useMap();
  const frameRef = React.useRef<number | null>(null);
  const lastSignatureRef = React.useRef('');

  React.useEffect(() => {
    const publishAnchors = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const size = map.getSize();
        const anchors = Object.fromEntries(markers.map((marker) => {
          const point = map.latLngToContainerPoint(marker.position);
          const container = map.getContainer();
          const mapNode = container.closest('.map-node') as HTMLElement | null;
          const containerRect = container.getBoundingClientRect();
          const nodeRect = mapNode?.getBoundingClientRect();
          const offsetX = nodeRect ? containerRect.left - nodeRect.left : 0;
          const offsetY = nodeRect ? containerRect.top - nodeRect.top : 0;
          return [marker.id, {
            x: offsetX + point.x,
            y: offsetY + point.y,
            visible: point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y,
          }];
        }));
        const signature = JSON.stringify(anchors);
        if (signature !== lastSignatureRef.current) {
          lastSignatureRef.current = signature;
          onAnchorsChange(anchors);
        }
      });
    };

    publishAnchors();
    map.on('move zoom resize viewreset', publishAnchors);
    return () => {
      map.off('move zoom resize viewreset', publishAnchors);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [map, markers, onAnchorsChange]);

  return null;
};

export const MapNode: React.FC<MapNodeProps> = ({
  node,
  selected,
  onChange,
  relationMode = false,
  relationSourcePort,
  onMarkerRelation,
  onMarkerRelationHover,
  onRequestRelationMode,
}) => {
  const rawData = node.data as Partial<MapData>;
  const data: MapData = {
    center: Array.isArray(rawData.center) && rawData.center.length === 2 ? rawData.center : WORLD_MAP_CENTER,
    zoom: typeof rawData.zoom === 'number' ? rawData.zoom : WORLD_MAP_ZOOM,
    tileLayer: rawData.tileLayer === 'hybrid' || rawData.tileLayer === 'street' ? rawData.tileLayer : 'satellite',
    markers: Array.isArray(rawData.markers) ? rawData.markers : [],
    markerAnchors: typeof rawData.markerAnchors === 'object' && rawData.markerAnchors ? rawData.markerAnchors as Record<string, MapMarkerAnchor> : {},
    interactive: true,
  };
  const layer = (data.tileLayer && TILE_LAYERS[data.tileLayer]) ? data.tileLayer : 'satellite';
  
  // Use a stable key so MapContainer doesn't unmount unless necessary
  const mapKey = useMemo(() => `map-${node.id}`, [node.id]);

  const setLayer = (l: TileLayerType) => {
    if (onChange) {
      onChange(node.id, { data: { ...data, tileLayer: l } });
    }
  };

  const updateMarkers = (markers: MapMarker[]) => {
    if (onChange) {
      onChange(node.id, { data: { ...data, markers } });
    }
  };

  const updateMarkerAnchors = React.useCallback((markerAnchors: Record<string, MapMarkerAnchor>) => {
    if (onChange) {
      onChange(node.id, { data: { markerAnchors } });
    }
  }, [node.id, onChange]);

  const addMarker = (position: [number, number], label = `Marker ${data.markers.length + 1}`) => {
    updateMarkers([
      ...data.markers,
      {
        id: nanoid(8),
        position,
        label,
      }
    ]);
  };

  const addMarkerAtCenter = () => {
    addMarker(data.center, `Marker ${data.markers.length + 1}`);
  };

  const handleStartPinRelation = (markerId: string) => {
    if (!relationMode) {
      onRequestRelationMode?.();
    }
    onMarkerRelation?.(markerId);
  };

  const renameMarker = (markerId: string, label: string) => {
    updateMarkers(data.markers.map((marker) => (
      marker.id === markerId ? { ...marker, label } : marker
    )));
  };

  const moveMarker = (markerId: string, position: [number, number]) => {
    updateMarkers(data.markers.map((marker) => (
      marker.id === markerId ? { ...marker, position } : marker
    )));
  };

  const centerOnMarker = (marker: MapMarker) => {
    if (onChange) {
      onChange(node.id, {
        data: {
          ...data,
          center: marker.position,
          zoom: Math.max(data.zoom, 14),
        }
      });
    }
  };

  const removeMarker = (markerId: string) => {
    updateMarkers(data.markers.filter((marker) => marker.id !== markerId));
  };

  const handleCenterZoomChange = (center: [number, number], zoom: number) => {
    if (onChange) {
      onChange(node.id, {
        data: {
          ...data,
          center,
          zoom
        }
      });
    }
  };

  const stopMapGesture = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <div className={`map-node ${selected ? 'map-node--selected' : ''} ${relationMode ? 'map-node--relation-mode' : ''}`}>
      <div className="map-node__header" title="Drag here to reposition Map Node">
        <div className="map-node__header-title">
          <span className="material-symbols-outlined map-node__drag-icon">drag_indicator</span>
          <span className="map-node__title-text">Living Map</span>
        </div>
        <div className="map-node__header-coords">
          {Array.isArray(data.center) ? `${data.center[0].toFixed(2)}°, ${data.center[1].toFixed(2)}° • Zoom ${data.zoom || 4}` : 'Globe'}
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="map-node__controls" onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
        <button
          type="button"
          className={`map-node__action-btn ${layer !== 'satellite' ? 'active' : ''}`}
          onClick={() => setLayer(layer === 'street' ? 'satellite' : layer === 'satellite' ? 'hybrid' : 'street')}
          title={layer === 'street' ? 'Satellite view' : layer === 'satellite' ? 'Roads & labels on imagery' : 'Street map'}
        >
          <IconLayers size={16} />
          <span className="map-node__action-label">Layer</span>
        </button>
        <button
          type="button"
          className="map-node__action-btn"
          onClick={() => addMarkerAtCenter()}
          title="Add Pin at Map Center"
        >
          <IconPin size={16} />
          <span className="map-node__action-label">Pin</span>
        </button>
        {data.markers.length > 0 && (
          <button
            type="button"
            className={`map-node__action-btn map-node__action-btn--connect ${relationMode ? 'active' : ''}`}
            onClick={() => onRequestRelationMode?.()}
            title={relationMode ? 'Tap a pin to connect it' : 'Connect a relation to a map pin'}
          >
            <span className="material-symbols-outlined">hub</span>
            <span className="map-node__action-label">{relationMode ? 'Pick pin' : 'Connect'}</span>
          </button>
        )}
      </div>

      <div
        className="map-node__map-surface"
        // Stop only the gesture start from reaching the infinite canvas. Once
        // Leaflet starts a drag or pinch it listens on the document, so move
        // and end events must be allowed to bubble out of this surface.
        onTouchStart={stopMapGesture}
        onWheel={stopMapGesture}
        onDoubleClick={stopMapGesture}
      >
          <MapContainer
            key={mapKey}
            center={data.center || WORLD_MAP_CENTER}
            zoom={data.zoom || 4}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
            dragging={true}
            touchZoom={true}
            scrollWheelZoom={true}
          >
            <TileLayer
              url={TILE_LAYERS[layer].url}
              attribution={TILE_LAYERS[layer].attribution}
              maxZoom={19}
            />
            {layer === 'hybrid' && (
              <TileLayer
                url={ESRI_REFERENCE_URL}
                attribution=""
                maxZoom={19}
              />
            )}
            <MapResizer width={node.size.width} height={node.size.height} />
            <MapController center={data.center} zoom={data.zoom} markers={data.markers} onChangeCenterZoom={handleCenterZoomChange} />
            <MarkerAnchorTracker markers={data.markers} onAnchorsChange={updateMarkerAnchors} />
            <MapClickEvents enabled={true} onAddMarker={addMarker} />

            {data.markers?.map(marker => (
              <Marker
              key={marker.id}
              position={marker.position}
              draggable={!relationMode}
              title={relationMode ? `Connect relation to ${marker.label || 'marker'}` : marker.label}
              eventHandlers={{
                mousedown: (event) => {
                  if (!relationMode) return;
                  event.originalEvent.stopPropagation();
                  event.originalEvent.preventDefault();
                  onMarkerRelation?.(marker.id);
                },
                mouseover: () => {
                  if (!relationMode) return;
                  onMarkerRelationHover?.(marker.id);
                },
                mouseout: () => {
                  if (!relationMode) return;
                  onMarkerRelationHover?.(null);
                },
                dragend: (event) => {
                  const nextPosition = event.target.getLatLng();
                  moveMarker(marker.id, [nextPosition.lat, nextPosition.lng]);
                },
              }}
            >
              {marker.label && (
                <Popup>{marker.label}</Popup>
              )}
            </Marker>
            ))}
          </MapContainer>
      </div>

      {data.markers.length === 0 && (
        <div className="map-node__empty-hint" aria-hidden="true">
          <span className="material-symbols-outlined">add_location_alt</span>
          <span>Double-click the map or press Pin to add a location.</span>
        </div>
      )}

      {relationMode && data.markers.length > 0 && (
        <div className="map-node__relation-hint" aria-hidden="true">
          <span className="material-symbols-outlined">hub</span>
          <span>Tap a pin to use its exact location.</span>
        </div>
      )}

      {data.markers.length > 0 && (
        <div
          className="map-node__marker-panel"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrollable so every marker stays reachable, not just the newest few. */}
          <div className="map-node__marker-list">
            {data.markers.map((marker, index) => (
              <div
                className={`map-node__marker-row ${relationSourcePort === `marker:${marker.id}` ? 'active-anchor' : ''}`}
                key={marker.id}
                onMouseEnter={() => relationMode && onMarkerRelationHover?.(marker.id)}
                onMouseLeave={() => relationMode && onMarkerRelationHover?.(null)}
              >
                <span className="map-node__marker-dot">{index + 1}</span>
                <div className="map-node__marker-main">
                  <input
                    value={marker.label || ''}
                    onChange={(e) => renameMarker(marker.id, e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    title="Marker label"
                  />
                  <span className="map-node__marker-position">
                    {marker.position[0].toFixed(4)}, {marker.position[1].toFixed(4)}
                  </span>
                </div>
                <button
                  type="button"
                  className="map-node__marker-connect"
                  onClick={() => handleStartPinRelation(marker.id)}
                  title={relationMode ? 'Use marker as relation anchor' : 'Start a relation from this pin'}
                >
                  {relationSourcePort === `marker:${marker.id}` ? 'Start' : relationMode ? 'Use pin' : 'Connect'}
                </button>
                <button type="button" onClick={() => centerOnMarker(marker)} title="Center map on marker">⌖</button>
                <button type="button" onClick={() => removeMarker(marker.id)} title="Remove marker">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const mapPlugin = {
  type: 'map',
  name: 'Map',
  icon: 'map',
  category: 'core' as const,
  defaultSize: DEFAULT_MAP_SIZE,
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'map',
    position,
    size: DEFAULT_MAP_SIZE,
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: { 
      center: WORLD_MAP_CENTER,
      zoom: WORLD_MAP_ZOOM,
      tileLayer: 'satellite',
      markers: [],
      interactive: true
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  getConnectionPorts: () => [
    { id: 'top', position: 'top' as const },
    { id: 'right', position: 'right' as const },
    { id: 'bottom', position: 'bottom' as const },
    { id: 'left', position: 'left' as const },
  ],
};
