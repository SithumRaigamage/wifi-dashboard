// upnp.js — US-26: UPnP Port Mapping Audit & Exposure Manager.
//
// Discovers the LAN's UPnP Internet Gateway Device (IGD) via SSDP, then
// queries its WANIPConnection/WANPPPConnection service for the router's
// active port-forwarding table. No dependency added: SSDP is plain UDP
// multicast, and the device description + SOAP responses are small,
// predictable XML that a few regexes can pull the handful of fields we
// need out of — consistent with how this codebase already parses
// system_profiler's plaintext output rather than pulling in a full parser.
//
// If UPnP is disabled (increasingly the shipped default, for security
// reasons) or nothing responds, this returns upnpAvailable: false rather
// than an error — "no UPnP found" is itself honest, useful information.
//
// SSDP is unauthenticated UDP multicast: anything on the LAN can reply to
// our M-SEARCH with a LOCATION header pointing anywhere. Every URL this file
// fetches (the device description, then the control URL parsed back out of
// that description) is validated first — deliberately *stricter* than
// portScanner.js's isPrivateIPv4 (which allows loopback, correct for its
// context of "scan a LAN device, possibly this Mac itself"). A real UPnP IGD
// is always a separate physical router, never localhost, so a spoofed reply
// pointing at 127.0.0.1 has to be rejected here specifically — otherwise a
// LAN attacker could use this feature to make the server issue requests to
// its own loopback-bound services.

import dgram from 'node:dgram';
import http from 'node:http';
import { URL } from 'node:url';
import { isPrivateIPv4 } from './portScanner.js';

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const DISCOVERY_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 3000;
const MAX_MAPPINGS = 100; // sane upper bound so a misbehaving router can't loop this forever
const OVERALL_MAPPING_DEADLINE_MS = 20000; // cap total mapping-enumeration time regardless of per-request timeouts
const OVERALL_LOCATION_DEADLINE_MS = 10000; // cap total time spent trying candidate devices, in case many were spoofed

const SEARCH_TARGETS = [
  'urn:schemas-upnp-org:service:WANIPConnection:1',
  'urn:schemas-upnp-org:service:WANIPConnection:2',
  'urn:schemas-upnp-org:service:WANPPPConnection:1',
];

// Device descriptions and SOAP responses are small (a few KB); anything past
// this is a malicious/compromised LAN device streaming as much as it can
// within the request timeout to spike server memory. Matches the maxBuffer
// convention this codebase already uses for exec-based collectors
// (channels.js/wifiStats.js: 4MB, traceroute.js: 1MB).
const MAX_RESPONSE_BYTES = 1024 * 1024;

function isSafeUpnpTarget(url) {
  try {
    const host = new URL(url).hostname;
    return isPrivateIPv4(host) && !host.startsWith('127.');
  } catch {
    return false;
  }
}

// Broadcast an SSDP M-SEARCH for each known WAN-connection service type and
// collect distinct LOCATION URLs from whatever responds within the window.
// Only private-IP LOCATIONs are kept — see the file header on why.
function discoverLocations() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const locations = new Set();

    socket.on('message', (msg) => {
      const m = /LOCATION:\s*(\S+)/i.exec(msg.toString());
      if (m && isSafeUpnpTarget(m[1].trim())) locations.add(m[1].trim());
    });
    socket.on('error', () => {});

    socket.bind(() => {
      for (const st of SEARCH_TARGETS) {
        const query = Buffer.from(
          'M-SEARCH * HTTP/1.1\r\n' +
            `HOST: ${SSDP_ADDR}:${SSDP_PORT}\r\n` +
            'MAN: "ssdp:discover"\r\n' +
            'MX: 2\r\n' +
            `ST: ${st}\r\n\r\n`
        );
        socket.send(query, 0, query.length, SSDP_PORT, SSDP_ADDR);
      }
    });

    setTimeout(() => {
      socket.close();
      resolve([...locations]);
    }, DISCOVERY_TIMEOUT_MS);
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      let body = '';
      let bytes = 0;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          req.destroy(new Error('response too large'));
          return;
        }
        body += c;
      });
      res.on('end', () => resolve(body));
      res.on('error', reject); // a reset mid-body would otherwise throw uncaught and take the whole server down
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function httpPost(url, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      target,
      {
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'Content-Length': Buffer.byteLength(body),
          ...extraHeaders,
        },
      },
      (res) => {
        let data = '';
        let bytes = 0;
        res.on('data', (c) => {
          bytes += c.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error('response too large'));
            return;
          }
          data += c;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        res.on('error', reject); // same reasoning as httpGet above
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

// Pull the WAN-connection service's control URL + type out of the device
// description XML — full XML parsing would be overkill for the two fields
// actually needed out of a small, well-known document structure.
function findWanConnectionService(deviceXml, baseUrl) {
  const serviceBlocks = deviceXml.match(/<service>[\s\S]*?<\/service>/gi) || [];
  for (const block of serviceBlocks) {
    const typeMatch = /<serviceType>([^<]+)<\/serviceType>/i.exec(block);
    const controlMatch = /<controlURL>([^<]+)<\/controlURL>/i.exec(block);
    if (!typeMatch || !controlMatch) continue;
    if (!SEARCH_TARGETS.includes(typeMatch[1].trim())) continue;
    const controlUrl = new URL(controlMatch[1].trim(), baseUrl).toString();
    if (!isSafeUpnpTarget(controlUrl)) continue; // the device description is untrusted too — don't follow it off-LAN
    return { serviceType: typeMatch[1].trim(), controlUrl };
  }
  return null;
}

function soapEnvelope(serviceType, action, params = '') {
  return (
    '<?xml version="1.0"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    '<s:Body>' +
    `<u:${action} xmlns:u="${serviceType}">${params}</u:${action}>` +
    '</s:Body></s:Envelope>'
  );
}

function xmlValue(xml, tag) {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(xml);
  return m ? m[1] : null;
}

// UPnP error code 713 (SpecifiedArrayIndexInvalid) is the standard "you've
// walked past the last entry" signal — the *only* non-200 response treated
// as a clean, natural end of the list. Any other non-200 (auth required, a
// malformed request, a firmware bug, ...) is a genuine query failure and
// must not be silently read as "no more mappings," or a security audit could
// report zero exposed ports when it never actually got a real answer.
const END_OF_LIST_UPNP_ERROR_CODE = '713';

async function getPortMappingEntry(controlUrl, serviceType, index) {
  const body = soapEnvelope(serviceType, 'GetGenericPortMappingEntry', `<NewPortMappingIndex>${index}</NewPortMappingIndex>`);
  const { statusCode, body: respBody } = await httpPost(controlUrl, body, {
    SOAPAction: `"${serviceType}#GetGenericPortMappingEntry"`,
  });

  if (statusCode !== 200) {
    if (xmlValue(respBody, 'errorCode') === END_OF_LIST_UPNP_ERROR_CODE) return null;
    throw new Error(`unexpected SOAP response (status ${statusCode})`);
  }

  const externalPort = Number(xmlValue(respBody, 'NewExternalPort'));
  if (!externalPort) return null;

  // xsd:boolean allows both "1"/"0" and "true"/"false" serializations —
  // accept either rather than only the former, since misreading an active
  // mapping as disabled understates real internet exposure.
  const enabledValue = (xmlValue(respBody, 'NewEnabled') || '').toLowerCase();

  return {
    externalPort,
    protocol: xmlValue(respBody, 'NewProtocol'),
    internalClient: xmlValue(respBody, 'NewInternalClient'),
    internalPort: Number(xmlValue(respBody, 'NewInternalPort')) || null,
    description: xmlValue(respBody, 'NewPortMappingDescription'),
    enabled: enabledValue === '1' || enabledValue === 'true',
  };
}

export async function auditUpnpPortMappings() {
  const locations = await discoverLocations();
  if (locations.length === 0) {
    return { upnpAvailable: false, mappings: [], truncated: false, error: null };
  }

  const locationsDeadline = Date.now() + OVERALL_LOCATION_DEADLINE_MS;
  let ranOutOfTime = false;
  for (const location of locations) {
    if (Date.now() > locationsDeadline) {
      // Some candidates were never tried — "none exposed a WAN service" would
      // overstate certainty (a legitimate device may simply not have been
      // reached yet), so the fallback below needs to know this happened.
      ranOutOfTime = true;
      break;
    }

    let service;
    try {
      const deviceXml = await httpGet(location);
      service = findWanConnectionService(deviceXml, location);
    } catch {
      continue; // couldn't fetch/parse this device's description — try the next one, if any
    }
    if (!service) continue;

    // Collected inside the loop (not in the try/catch below) so a failure
    // partway through enumeration reports the mappings already found
    // instead of discarding real, already-confirmed port-forwarding rules —
    // exactly the data this audit exists to surface. `truncated` distinguishes
    // "the router told us there's nothing more" (entry comes back null/failed
    // status — a real, complete answer) from any other exit reason (deadline,
    // MAX_MAPPINGS, a query failure) where the list may not be the full
    // picture — for a feature whose whole point is surfacing every exposed
    // port, presenting a cut-off list as if it were exhaustive would be worse
    // than not having the feature at all.
    const mappings = [];
    const mappingDeadline = Date.now() + OVERALL_MAPPING_DEADLINE_MS;
    let stoppedEarly = false;
    let truncated = false;
    for (let i = 0; i < MAX_MAPPINGS; i++) {
      if (Date.now() >= mappingDeadline) {
        truncated = true;
        break;
      }
      let entry;
      try {
        entry = await getPortMappingEntry(service.controlUrl, service.serviceType, i);
      } catch {
        stoppedEarly = true;
        truncated = true;
        break;
      }
      if (!entry) break; // the router's own "no more entries" signal — a complete, natural end
      mappings.push(entry);
      if (i === MAX_MAPPINGS - 1) truncated = true; // hit the cap without a natural end
    }
    return {
      upnpAvailable: true,
      mappings,
      truncated,
      error: stoppedEarly && mappings.length === 0 ? 'found a UPnP device but could not query its port mappings' : null,
    };
  }

  return {
    upnpAvailable: true,
    mappings: [],
    truncated: ranOutOfTime,
    error: ranOutOfTime
      ? 'found UPnP device(s) but ran out of time checking them for a WAN connection service'
      : 'found UPnP device(s) but none exposed a WAN connection service',
  };
}
