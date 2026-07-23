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
const MAP_PADDING = 16;
const WORLD_MAP_CENTER: [number, number] = [20, 0];

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

export type TileLayerType = 'satellite' | 'hybrid';

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
}

const TILE_LAYERS: Record<TileLayerType, { url: string; attribution: string }> = {
  satellite: {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps'
  },
  hybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps'
  }
};

// Component to handle map interaction state changes
const MapEffect: React.FC<{ interactive: boolean }> = ({ interactive }) => {
  const map = useMap();
  
  React.useEffect(() => {
    if (interactive) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      if ((map as any).tap) (map as any).tap.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      if ((map as any).tap) (map as any).tap.disable();
    }
  }, [map, interactive]);

  React.useEffect(() => {
    // Force Leaflet to recalculate its internal size if the wrapper node resizes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(map.getContainer());
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
};

// Component to watch map move/zoom and save center/zoom back to store
const MapEvents: React.FC<{ onChangeCenterZoom: (center: [number, number], zoom: number) => void }> = ({ onChangeCenterZoom }) => {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onChangeCenterZoom([center.lat, center.lng], map.getZoom());
    },
    zoomend: () => {
      const center = map.getCenter();
      onChangeCenterZoom([center.lat, center.lng], map.getZoom());
    }
  });

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

const MapViewSync: React.FC<{ center: [number, number]; zoom: number; markers: MapMarker[] }> = ({ center, zoom, markers }) => {
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
    map.setView(center, zoom, { animate: false });
  }, [center, zoom, markers, map]);

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
          return [marker.id, {
            x: MAP_PADDING + point.x,
            y: MAP_PADDING + point.y,
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

export const MapNode: React.FC<MapNodeProps> = ({ node, selected, onChange, relationMode = false, relationSourcePort, onMarkerRelation, onMarkerRelationHover }) => {
  const rawData = node.data as Partial<MapData>;
  const data: MapData = {
    center: Array.isArray(rawData.center) && rawData.center.length === 2 ? rawData.center : WORLD_MAP_CENTER,
    zoom: typeof rawData.zoom === 'number' ? rawData.zoom : 4,
    tileLayer: rawData.tileLayer === 'hybrid' ? 'hybrid' : 'satellite',
    markers: Array.isArray(rawData.markers) ? rawData.markers : [],
    markerAnchors: typeof rawData.markerAnchors === 'object' && rawData.markerAnchors ? rawData.markerAnchors as Record<string, MapMarkerAnchor> : {},
    interactive: typeof rawData.interactive === 'boolean' ? rawData.interactive : true,
  };
  const layer = (data.tileLayer && TILE_LAYERS[data.tileLayer]) ? data.tileLayer : 'satellite';
  const interactive = data.interactive ?? true;
  
  // Use a stable key so MapContainer doesn't unmount unless necessary
  const mapKey = useMemo(() => `map-${node.id}`, [node.id]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // If map is interactive, stop event propagation so canvas doesn't pan
    if (interactive) {
      e.stopPropagation();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (interactive) {
      e.stopPropagation();
    }
  };

  const setLayer = (l: TileLayerType) => {
    if (onChange) {
      onChange(node.id, { data: { ...data, tileLayer: l } });
    }
  };

  const setInteractive = (val: boolean) => {
    if (onChange) {
      onChange(node.id, { data: { ...data, interactive: val } });
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

  return (
    <div 
      className={`map-node ${selected ? 'map-node--selected' : ''}`}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
    >
      <MapContainer 
        key={mapKey}
        center={data.center || WORLD_MAP_CENTER} 
        zoom={data.zoom || 4} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={interactive}
        attributionControl={false}
      >
        <TileLayer
          url={TILE_LAYERS[layer].url}
          attribution={TILE_LAYERS[layer].attribution}
        />
        <MapEffect interactive={interactive} />
        <MapViewSync center={data.center} zoom={data.zoom} markers={data.markers} />
        <MarkerAnchorTracker markers={data.markers} onAnchorsChange={updateMarkerAnchors} />
        <MapEvents onChangeCenterZoom={handleCenterZoomChange} />
        <MapClickEvents enabled={Boolean(selected && interactive)} onAddMarker={addMarker} />
        
        {data.markers?.map(marker => (
          <Marker
            key={marker.id}
            position={marker.position}
            draggable={Boolean(selected && interactive && !relationMode)}
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

      {selected && (
        <div className="map-node__controls">
          <button 
            className={`map-node__layer-btn ${layer === 'hybrid' ? 'active' : ''}`}
            onClick={() => setLayer(layer === 'satellite' ? 'hybrid' : 'satellite')}
            title={layer === 'satellite' ? 'Show Roads Overlay' : 'Satellite Only'}
          >
            <IconLayers size={16} />
          </button>
          <button 
            className={`map-node__toggle-btn ${!interactive ? 'active' : ''}`}
            onClick={() => setInteractive(!interactive)}
            title={interactive ? 'Lock map interaction to pan canvas' : 'Unlock map interaction'}
          >
            {interactive ? <IconUnlock size={16} /> : <IconLock size={16} />}
          </button>
          <button
            className="map-node__toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              addMarkerAtCenter();
            }}
            title="Add marker at map center"
          >
            <IconPin size={16} />
          </button>
        </div>
      )}

      {selected && data.markers.length > 0 && (
        <div className="map-node__marker-panel" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {data.markers.slice(-4).map((marker, index) => (
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
                onClick={() => onMarkerRelation?.(marker.id)}
                disabled={!relationMode}
                title={relationMode ? 'Use marker as relation anchor' : 'Select relation tool to connect marker'}
              >
                ↗
              </button>
              <button type="button" onClick={() => centerOnMarker(marker)} title="Center map on marker">⌖</button>
              <button type="button" onClick={() => removeMarker(marker.id)} title="Remove marker">×</button>
            </div>
          ))}
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
  defaultSize: { width: 400, height: 300 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'map',
    position,
    size: { width: 400, height: 300 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: { 
      center: WORLD_MAP_CENTER,
      zoom: 4,
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
