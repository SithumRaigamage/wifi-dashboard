// airportParse.js — shared parsing for `system_profiler SPAirPortDataType`
// fields that show up in more than one collector's output (currently: the
// "Channel: N (band, width)" value, parsed identically by wifiStats.js for
// the connected network and by channels.js for the current channel count and
// every nearby network). Kept as its own tiny module rather than three
// separately-maintained copies of the same regex — this exact format is
// exactly what the file's own collectors warn is fragile across macOS
// versions, so drift between copies is a real risk, not a hypothetical one.

// e.g. "36 (5GHz, 80MHz)" -> { channel: 36, band: '5GHz', channelWidth: '80MHz' }
// e.g. "7 (2GHz, 20MHz)"  -> { channel: 7, band: '2GHz', channelWidth: '20MHz' }
export function parseChannelValue(val) {
  const m = val?.match(/^(\d+)\s*(?:\(([^,)]+)(?:,\s*([^)]+))?\))?/);
  if (!m) return { channel: null, band: null, channelWidth: null };
  return {
    channel: Number(m[1]),
    band: m[2]?.trim() || null,
    channelWidth: m[3]?.trim() || null,
  };
}

// A "Key: value" line within an indented system_profiler block, e.g.
// "      PHY Mode: 802.11ac" -> { key: 'PHY Mode', value: '802.11ac' }.
// Returns null for lines that aren't this shape (blank, a bare "Name:"
// header with nothing after it, a section title, ...).
export function parseKeyValueLine(line) {
  const m = line.match(/^\s+([\w\s/]+):\s*(.+)$/);
  return m ? { key: m[1].trim(), value: m[2].trim() } : null;
}
