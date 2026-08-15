// iotClassifier.js — best-effort "is this a smart-home/IoT device" guess from
// vendor and hostname, in the same spirit as osFingerprint.js: only classify
// on signals specific enough to be trustworthy, return false rather than guess
// on anything ambiguous.
//
// Deliberately excludes major dual-purpose brands (TP-Link, Samsung, Amazon,
// Xiaomi, ...) from vendor-only matching — they make both IoT gadgets *and*
// routers/range-extenders/computers, so the vendor name alone isn't a safe
// enough signal (the same false-positive risk already hit once in US-20's
// mesh-AP case). Dedicated embedded-WiFi-module silicon vendors are a much
// safer bet: they're essentially never used in general-purpose computers or
// routers, only in smart-home products built around their chipsets.
const IOT_VENDOR_RE = /^(espressif|altobeam|mxchip|tuya)\b/i;

const IOT_HOSTNAME_RE =
  /^esp(32|8266)-|^shelly|^sonoff|^tasmota|^tuya|smart-?plug|smart-?bulb|philips-?hue|^hue-bridge|^wemo|^lifx|^ring-(doorbell|cam)|^nest-|^roomba|^sonos-|^iot-/i;

export function classifyIot({ hostname, vendor }) {
  if (hostname && IOT_HOSTNAME_RE.test(hostname)) return true;
  if (vendor && IOT_VENDOR_RE.test(vendor)) return true;
  return false;
}
