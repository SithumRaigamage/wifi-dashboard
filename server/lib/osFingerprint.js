// osFingerprint.js — best-effort OS guess for a LAN device from its mDNS/DHCP
// hostname (the strong signal — most OSes advertise a distinctive default
// hostname pattern) and, failing that, its vendor (a much weaker signal, since
// e.g. "Apple" alone can't distinguish a Mac from an iPhone). Never claims more
// certainty than it has: hostname matches are 'high' confidence, vendor-only
// guesses are 'low', and anything unmatched returns null rather than guessing.

// Checked in order, first match wins — more specific patterns (macbook/imac)
// are listed before broader ones that could otherwise incidentally overlap
// (bare "iphone"/"ipad" substrings) in an unusual hostname.
const HOSTNAME_RULES = [
  { os: 'macOS', re: /\bmac(book|-?mini|-?pro|-?studio)?\b|\bimac\b/i },
  { os: 'iOS', re: /iphone|ipad/i },
  // Windows' actual OOBE-generated default hostnames (DESKTOP-XXXXXXX,
  // WIN-XXXXXXXXX) — not "-pc"/"laptop-", which are just generic English
  // words anyone on any OS could pick for a machine name.
  { os: 'Windows', re: /^desktop-|^win-/i },
  { os: 'Android', re: /^android|^galaxy[-_]|-android|^pixel-/i },
  { os: 'Tizen', re: /\btizen\b/i },
  { os: 'Linux', re: /^ubuntu|^debian|^raspberrypi|^raspi|-linux|^fedora|^arch(linux)?\b/i },
];

// Vendors specific enough to guess an OS from alone, used only when the
// hostname didn't already resolve something. Deliberately short: something
// like "Apple" or "Samsung" covers far too many device *categories* (phone,
// laptop, TV, watch, appliance) to responsibly guess a specific OS from the
// vendor name alone, so those are left unclassified rather than guessed.
const VENDOR_HINTS = [{ os: 'Linux', re: /raspberry\s*pi/i }];

// DHCP/reverse-DNS names commonly carry a domain suffix (.local, .lan, an
// ISP's .attlocal.net, ...) — match against just the host label, or an
// end-anchored rule like `-pc$` would never fire against "Johns-PC.local".
function hostLabel(hostname) {
  return hostname ? hostname.split('.')[0] : '';
}

export function classifyOs({ hostname, vendor }) {
  const name = hostLabel(hostname);
  for (const rule of HOSTNAME_RULES) {
    if (rule.re.test(name)) return { os: rule.os, confidence: 'high' };
  }
  const hint = vendor && VENDOR_HINTS.find((h) => h.re.test(vendor));
  return hint ? { os: hint.os, confidence: 'low' } : { os: null, confidence: null };
}
