import { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Trash2, MapPin, Sliders, Layers, Info } from 'lucide-react';
import { Card, SectionHeader, Button, Badge } from '../components/ui/primitives.jsx';

const STORAGE_KEY = 'wifi-dashboard.floorplan';

function getStoredData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { image: null, pins: [] };
  } catch {
    return { image: null, pins: [] };
  }
}

export function FloorPlan({ live }) {
  const [data, setData] = useState(getStoredData);
  const [opacity, setOpacity] = useState(0.5);
  const [roomName, setRoomName] = useState('Living Room');
  // Set only from <img onLoad> — the heatmap effect below depends on this
  // (not a ref mutated imperatively in the load handler) so a canvas
  // resize and the redraw it requires always happen together in the same
  // effect run, instead of two independently-timed DOM mutations racing.
  const [imgSize, setImgSize] = useState(null); // { width, height }
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentRssi = live.wifi?.rssi ?? -65;


  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore storage quota */
    }
  }, [data]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImgSize(null); // this image hasn't loaded yet — wait for onLoad's real size rather than drawing at the previous image's
      setData((prev) => ({ ...prev, image: evt.target?.result || null }));
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (e) => {
    if (!data.image || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPin = {
      id: Date.now(),
      x,
      y,
      rssi: currentRssi,
      room: roomName || 'Room',
      ts: Date.now(),
    };

    setData((prev) => ({ ...prev, pins: [...prev.pins, newPin] }));
  };

  const clearAll = () => {
    if (confirm('Clear floor plan image and all recorded pins?')) {
      setData({ image: null, pins: [] });
      setImgSize(null);
    }
  };

  const clearPins = () => {
    setData((prev) => ({ ...prev, pins: [] }));
  };

  // Draw Heatmap on Canvas using IDW. Depends on imgSize (not just data.image)
  // and does the resize itself, right before drawing — sizing the canvas
  // always clears it, so sizing and drawing have to happen in the same pass
  // or whichever finishes last silently wins with nothing to redraw after it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.image || !imgSize) return;

    canvas.width = imgSize.width;
    canvas.height = imgSize.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (data.pins.length === 0) return;

    const imgData = ctx.createImageData(width, height);
    const p = 2; // IDW power factor

    // Step size for performance
    const step = 4;
    for (let py = 0; py < height; py += step) {
      for (let px = 0; px < width; px += step) {
        const normX = (px / width) * 100;
        const normY = (py / height) * 100;

        let num = 0;
        let den = 0;
        let exactRssi = null;

        for (const pin of data.pins) {
          const dist = Math.hypot(normX - pin.x, normY - pin.y);
          if (dist < 0.5) {
            exactRssi = pin.rssi;
            break;
          }
          const weight = 1 / Math.pow(dist, p);
          num += weight * pin.rssi;
          den += weight;
        }

        const interpolatedRssi = exactRssi !== null ? exactRssi : num / den;

        // Map RSSI (-40 to -90) to Hue (120=Green to 0=Red)
        const clampedRssi = Math.max(-90, Math.min(-40, interpolatedRssi));
        const hue = ((clampedRssi + 90) / 50) * 120; // 0 (red) -> 120 (green)

        // Fill pixel block
        for (let dy = 0; dy < step && py + dy < height; dy++) {
          for (let dx = 0; dx < step && px + dx < width; dx++) {
            const idx = ((py + dy) * width + (px + dx)) * 4;
            const rgb = hslToRgb(hue / 360, 1.0, 0.45);
            imgData.data[idx] = rgb[0];
            imgData.data[idx + 1] = rgb[1];
            imgData.data[idx + 2] = rgb[2];
            imgData.data[idx + 3] = Math.round(opacity * 255);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [data.image, data.pins, opacity, imgSize]);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        right={
          <div className="flex items-center gap-2">
            {data.pins.length > 0 && (
              <Button size="sm" variant="outline" onClick={clearPins}>
                Clear Pins ({data.pins.length})
              </Button>
            )}
            {data.image && (
              <Button size="sm" variant="outline" onClick={clearAll} className="text-rose-500">
                <Trash2 className="h-3.5 w-3.5" /> Clear Plan
              </Button>
            )}
          </div>
        }
      >
        Signal Heatmap & Floor Plan
      </SectionHeader>

      {!data.image ? (
        <Card className="flex flex-col items-center justify-center p-12 border-dashed border-2 border-zinc-300 dark:border-zinc-700 text-center">
          <Upload className="h-10 w-10 text-zinc-400 mb-3" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Upload House / Office Floor Plan</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Upload a floor plan image (PNG/JPEG) to map signal readings across rooms and detect Wi-Fi dead zones.
          </p>
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer"
            >
              Choose Image File
            </Button>
          </div>
        </Card>
      ) : (

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Controls Side Panel */}
          <Card className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Pin Controls</h4>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                Room Label
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Living Room, Office"
                  className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none"
                />
              </label>
              <div className="mt-2 text-xs text-zinc-500 flex items-center justify-between">
                <span>Current Signal:</span>
                <Badge variant={currentRssi >= -55 ? 'success' : currentRssi >= -70 ? 'warning' : 'danger'}>
                  {currentRssi} dBm
                </Badge>
              </div>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>Heatmap Opacity</span>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-[11px] text-blue-900 dark:text-blue-200 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
              <span>Click anywhere on the floor plan image while standing in that room to drop a signal measurement pin.</span>
            </div>
          </Card>

          {/* Canvas Image Container */}
          <Card className="flex-1 p-2 relative overflow-hidden flex items-center justify-center bg-zinc-900/5 dark:bg-zinc-950/50">
            <div className="relative inline-block max-w-full max-h-[600px] overflow-hidden rounded-lg">
              <img
                ref={imageRef}
                src={data.image}
                alt="Floor Plan"
                className="max-w-full max-h-[600px] object-contain block"
                onLoad={() => {
                  if (imageRef.current) {
                    setImgSize({ width: imageRef.current.width, height: imageRef.current.height });
                  }
                }}
              />
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="absolute inset-0 w-full h-full cursor-crosshair"
              />

              {/* Render Pins Overlay */}
              {data.pins.map((pin) => (
                <div
                  key={pin.id}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none group z-10"
                >
                  <div className="relative flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-rose-600 drop-shadow-md animate-bounce" />
                    <span className="absolute -bottom-5 px-1.5 py-0.5 rounded bg-zinc-900/90 text-white font-mono text-[10px] whitespace-nowrap shadow-lg">
                      {pin.room}: {pin.rssi}dBm
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// HSL Helper
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
