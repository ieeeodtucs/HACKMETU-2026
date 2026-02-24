/**
 * GeoIP lookup service using ip-api.com (free, no API key needed)
 * Rate limit: 45 req/min for free tier — we cache aggressively
 */

export interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
  org: string;
  timezone: string;
  query: string;
  cached: boolean;
  updatedAt: string;
}

// In-memory cache: IP → GeoLocation
const geoCache = new Map<string, GeoLocation>();

// Private/reserved IP check
function isPrivateIP(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  // localhost
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  // 10.x.x.x
  if (ip.startsWith("10.")) return true;
  // 172.16-31.x.x
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  // 192.168.x.x
  if (ip.startsWith("192.168.")) return true;
  // 169.254.x.x (link-local)
  if (ip.startsWith("169.254.")) return true;
  return false;
}

/**
 * Lookup a single IP
 */
export async function lookupIP(ip: string): Promise<GeoLocation | null> {
  // Check cache first
  const cached = geoCache.get(ip);
  if (cached) return { ...cached, cached: true };

  // Private IPs get a synthetic location
  if (isPrivateIP(ip)) {
    const local: GeoLocation = {
      ip,
      country: "Local Network",
      countryCode: "LAN",
      region: "Local",
      city: "Local",
      lat: 0,
      lon: 0,
      isp: "Local Network",
      org: "Local Network",
      timezone: "UTC",
      query: ip,
      cached: false,
      updatedAt: new Date().toISOString(),
    };
    geoCache.set(ip, local);
    return local;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org,query`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== "success") {
      console.warn(`[GEOIP] Lookup failed for ${ip}: ${data.message}`);
      return null;
    }

    const geo: GeoLocation = {
      ip,
      country: data.country || "Unknown",
      countryCode: data.countryCode || "XX",
      region: data.regionName || "Unknown",
      city: data.city || "Unknown",
      lat: data.lat || 0,
      lon: data.lon || 0,
      isp: data.isp || "Unknown",
      org: data.org || "Unknown",
      timezone: data.timezone || "UTC",
      query: data.query || ip,
      cached: false,
      updatedAt: new Date().toISOString(),
    };

    geoCache.set(ip, geo);
    return geo;
  } catch (err) {
    console.error(`[GEOIP] Error looking up ${ip}:`, err);
    return null;
  }
}

/**
 * Batch lookup IPs (ip-api.com supports batch up to 100)
 */
export async function lookupBatch(ips: string[]): Promise<Map<string, GeoLocation>> {
  const results = new Map<string, GeoLocation>();
  const uncached: string[] = [];

  for (const ip of ips) {
    const cached = geoCache.get(ip);
    if (cached) {
      results.set(ip, { ...cached, cached: true });
    } else if (isPrivateIP(ip)) {
      const local: GeoLocation = {
        ip,
        country: "Local Network",
        countryCode: "LAN",
        region: "Local",
        city: "Local",
        lat: 0,
        lon: 0,
        isp: "Local Network",
        org: "Local Network",
        timezone: "UTC",
        query: ip,
        cached: false,
        updatedAt: new Date().toISOString(),
      };
      geoCache.set(ip, local);
      results.set(ip, local);
    } else {
      uncached.push(ip);
    }
  }

  if (uncached.length === 0) return results;

  // ip-api.com batch endpoint (POST, up to 100 IPs)
  try {
    const batchPayload = uncached.map((ip) => ({
      query: ip,
      fields: "status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org,query",
    }));

    const res = await fetch("http://ip-api.com/batch?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org,query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uncached),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[GEOIP] Batch lookup failed: HTTP ${res.status}`);
      return results;
    }

    const data: any[] = await res.json();
    for (const item of data) {
      if (item.status !== "success") continue;
      const geo: GeoLocation = {
        ip: item.query,
        country: item.country || "Unknown",
        countryCode: item.countryCode || "XX",
        region: item.regionName || "Unknown",
        city: item.city || "Unknown",
        lat: item.lat || 0,
        lon: item.lon || 0,
        isp: item.isp || "Unknown",
        org: item.org || "Unknown",
        timezone: item.timezone || "UTC",
        query: item.query,
        cached: false,
        updatedAt: new Date().toISOString(),
      };
      geoCache.set(item.query, geo);
      results.set(item.query, geo);
    }
  } catch (err) {
    console.error("[GEOIP] Batch lookup error:", err);
  }

  return results;
}

/**
 * Get cache contents
 */
export function getGeoCache(): Map<string, GeoLocation> {
  return geoCache;
}

/**
 * Clear cache
 */
export function clearGeoCache() {
  geoCache.clear();
}
