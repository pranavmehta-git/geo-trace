/**
 * Offline geocoder using bundled boundary data.
 * Performs point-in-polygon tests to determine jurisdiction.
 *
 * Uses simplified boundary datasets:
 * - Country boundaries from Natural Earth
 * - US state boundaries from Census TIGER
 *
 * For MVP, we use a bounding-box approach with key jurisdictions
 * and a simplified polygon dataset loaded on demand.
 */

interface BoundingBox {
  name: string;
  code: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface GeocodingResult {
  country: string;
  countryCode: string;
  state?: string;
  stateCode?: string;
  nearBoundary: boolean;
}

// US State bounding boxes (simplified)
const US_STATES: BoundingBox[] = [
  { name: 'Alabama', code: 'AL', minLat: 30.22, maxLat: 35.01, minLng: -88.47, maxLng: -84.89 },
  { name: 'Alaska', code: 'AK', minLat: 51.21, maxLat: 71.39, minLng: -179.15, maxLng: -129.98 },
  { name: 'Arizona', code: 'AZ', minLat: 31.33, maxLat: 37.00, minLng: -114.82, maxLng: -109.04 },
  { name: 'Arkansas', code: 'AR', minLat: 33.00, maxLat: 36.50, minLng: -94.62, maxLng: -89.64 },
  { name: 'California', code: 'CA', minLat: 32.53, maxLat: 42.01, minLng: -124.41, maxLng: -114.13 },
  { name: 'Colorado', code: 'CO', minLat: 36.99, maxLat: 41.00, minLng: -109.06, maxLng: -102.04 },
  { name: 'Connecticut', code: 'CT', minLat: 40.95, maxLat: 42.05, minLng: -73.73, maxLng: -71.79 },
  { name: 'Delaware', code: 'DE', minLat: 38.45, maxLat: 39.84, minLng: -75.79, maxLng: -75.05 },
  { name: 'Florida', code: 'FL', minLat: 24.40, maxLat: 31.00, minLng: -87.63, maxLng: -80.03 },
  { name: 'Georgia', code: 'GA', minLat: 30.36, maxLat: 35.00, minLng: -85.61, maxLng: -80.84 },
  { name: 'Hawaii', code: 'HI', minLat: 18.91, maxLat: 22.24, minLng: -160.25, maxLng: -154.81 },
  { name: 'Idaho', code: 'ID', minLat: 41.99, maxLat: 49.00, minLng: -117.24, maxLng: -111.04 },
  { name: 'Illinois', code: 'IL', minLat: 36.97, maxLat: 42.51, minLng: -91.51, maxLng: -87.02 },
  { name: 'Indiana', code: 'IN', minLat: 37.77, maxLat: 41.76, minLng: -88.10, maxLng: -84.78 },
  { name: 'Iowa', code: 'IA', minLat: 40.38, maxLat: 43.50, minLng: -96.64, maxLng: -90.14 },
  { name: 'Kansas', code: 'KS', minLat: 36.99, maxLat: 40.00, minLng: -102.05, maxLng: -94.59 },
  { name: 'Kentucky', code: 'KY', minLat: 36.50, maxLat: 39.15, minLng: -89.57, maxLng: -81.96 },
  { name: 'Louisiana', code: 'LA', minLat: 28.93, maxLat: 33.02, minLng: -94.04, maxLng: -88.82 },
  { name: 'Maine', code: 'ME', minLat: 43.06, maxLat: 47.46, minLng: -71.08, maxLng: -66.95 },
  { name: 'Maryland', code: 'MD', minLat: 37.91, maxLat: 39.72, minLng: -79.49, maxLng: -75.05 },
  { name: 'Massachusetts', code: 'MA', minLat: 41.24, maxLat: 42.89, minLng: -73.51, maxLng: -69.93 },
  { name: 'Michigan', code: 'MI', minLat: 41.70, maxLat: 48.26, minLng: -90.42, maxLng: -82.12 },
  { name: 'Minnesota', code: 'MN', minLat: 43.50, maxLat: 49.38, minLng: -97.24, maxLng: -89.49 },
  { name: 'Mississippi', code: 'MS', minLat: 30.17, maxLat: 34.99, minLng: -91.66, maxLng: -88.10 },
  { name: 'Missouri', code: 'MO', minLat: 35.99, maxLat: 40.61, minLng: -95.77, maxLng: -89.10 },
  { name: 'Montana', code: 'MT', minLat: 44.36, maxLat: 49.00, minLng: -116.05, maxLng: -104.04 },
  { name: 'Nebraska', code: 'NE', minLat: 39.99, maxLat: 43.00, minLng: -104.05, maxLng: -95.31 },
  { name: 'Nevada', code: 'NV', minLat: 35.00, maxLat: 42.00, minLng: -120.01, maxLng: -114.04 },
  { name: 'New Hampshire', code: 'NH', minLat: 42.70, maxLat: 45.31, minLng: -72.56, maxLng: -70.70 },
  { name: 'New Jersey', code: 'NJ', minLat: 38.93, maxLat: 41.36, minLng: -75.56, maxLng: -73.89 },
  { name: 'New Mexico', code: 'NM', minLat: 31.33, maxLat: 37.00, minLng: -109.05, maxLng: -103.00 },
  { name: 'New York', code: 'NY', minLat: 40.50, maxLat: 45.01, minLng: -79.76, maxLng: -71.86 },
  { name: 'North Carolina', code: 'NC', minLat: 33.84, maxLat: 36.59, minLng: -84.32, maxLng: -75.46 },
  { name: 'North Dakota', code: 'ND', minLat: 45.94, maxLat: 49.00, minLng: -104.05, maxLng: -96.55 },
  { name: 'Ohio', code: 'OH', minLat: 38.40, maxLat: 41.98, minLng: -84.82, maxLng: -80.52 },
  { name: 'Oklahoma', code: 'OK', minLat: 33.62, maxLat: 37.00, minLng: -103.00, maxLng: -94.43 },
  { name: 'Oregon', code: 'OR', minLat: 41.99, maxLat: 46.29, minLng: -124.57, maxLng: -116.46 },
  { name: 'Pennsylvania', code: 'PA', minLat: 39.72, maxLat: 42.27, minLng: -80.52, maxLng: -74.69 },
  { name: 'Rhode Island', code: 'RI', minLat: 41.15, maxLat: 42.02, minLng: -71.86, maxLng: -71.12 },
  { name: 'South Carolina', code: 'SC', minLat: 32.03, maxLat: 35.22, minLng: -83.35, maxLng: -78.54 },
  { name: 'South Dakota', code: 'SD', minLat: 42.48, maxLat: 45.95, minLng: -104.06, maxLng: -96.44 },
  { name: 'Tennessee', code: 'TN', minLat: 34.98, maxLat: 36.68, minLng: -90.31, maxLng: -81.65 },
  { name: 'Texas', code: 'TX', minLat: 25.84, maxLat: 36.50, minLng: -106.65, maxLng: -93.51 },
  { name: 'Utah', code: 'UT', minLat: 36.99, maxLat: 42.00, minLng: -114.05, maxLng: -109.04 },
  { name: 'Vermont', code: 'VT', minLat: 42.73, maxLat: 45.02, minLng: -73.44, maxLng: -71.46 },
  { name: 'Virginia', code: 'VA', minLat: 36.54, maxLat: 39.47, minLng: -83.68, maxLng: -75.24 },
  { name: 'Washington', code: 'WA', minLat: 45.54, maxLat: 49.00, minLng: -124.85, maxLng: -116.92 },
  { name: 'West Virginia', code: 'WV', minLat: 37.20, maxLat: 40.64, minLng: -82.64, maxLng: -77.72 },
  { name: 'Wisconsin', code: 'WI', minLat: 42.49, maxLat: 47.08, minLng: -92.89, maxLng: -86.25 },
  { name: 'Wyoming', code: 'WY', minLat: 40.99, maxLat: 45.01, minLng: -111.06, maxLng: -104.05 },
  { name: 'District of Columbia', code: 'DC', minLat: 38.79, maxLat: 38.99, minLng: -77.12, maxLng: -76.91 },
];

// Major country bounding boxes (covers most common travel destinations)
const COUNTRIES: BoundingBox[] = [
  { name: 'United States', code: 'US', minLat: 24.40, maxLat: 49.38, minLng: -124.85, maxLng: -66.93 },
  { name: 'Canada', code: 'CA', minLat: 41.68, maxLat: 83.11, minLng: -141.00, maxLng: -52.62 },
  { name: 'Mexico', code: 'MX', minLat: 14.53, maxLat: 32.72, minLng: -118.40, maxLng: -86.70 },
  { name: 'United Kingdom', code: 'GB', minLat: 49.67, maxLat: 60.86, minLng: -8.65, maxLng: 1.77 },
  { name: 'France', code: 'FR', minLat: 41.36, maxLat: 51.09, minLng: -5.14, maxLng: 9.56 },
  { name: 'Germany', code: 'DE', minLat: 47.27, maxLat: 55.06, minLng: 5.87, maxLng: 15.04 },
  { name: 'Italy', code: 'IT', minLat: 36.65, maxLat: 47.09, minLng: 6.63, maxLng: 18.52 },
  { name: 'Spain', code: 'ES', minLat: 36.00, maxLat: 43.79, minLng: -9.30, maxLng: 4.33 },
  { name: 'Portugal', code: 'PT', minLat: 36.96, maxLat: 42.15, minLng: -9.50, maxLng: -6.19 },
  { name: 'Netherlands', code: 'NL', minLat: 50.75, maxLat: 53.47, minLng: 3.36, maxLng: 7.21 },
  { name: 'Belgium', code: 'BE', minLat: 49.50, maxLat: 51.51, minLng: 2.55, maxLng: 6.40 },
  { name: 'Switzerland', code: 'CH', minLat: 45.82, maxLat: 47.81, minLng: 5.96, maxLng: 10.49 },
  { name: 'Austria', code: 'AT', minLat: 46.37, maxLat: 49.02, minLng: 9.53, maxLng: 17.16 },
  { name: 'Ireland', code: 'IE', minLat: 51.42, maxLat: 55.39, minLng: -10.48, maxLng: -5.99 },
  { name: 'Sweden', code: 'SE', minLat: 55.34, maxLat: 69.06, minLng: 11.11, maxLng: 24.17 },
  { name: 'Norway', code: 'NO', minLat: 57.97, maxLat: 71.19, minLng: 4.65, maxLng: 31.08 },
  { name: 'Denmark', code: 'DK', minLat: 54.56, maxLat: 57.75, minLng: 8.09, maxLng: 15.20 },
  { name: 'Finland', code: 'FI', minLat: 59.81, maxLat: 70.09, minLng: 20.55, maxLng: 31.59 },
  { name: 'Poland', code: 'PL', minLat: 49.00, maxLat: 54.84, minLng: 14.12, maxLng: 24.15 },
  { name: 'Czech Republic', code: 'CZ', minLat: 48.55, maxLat: 51.06, minLng: 12.09, maxLng: 18.86 },
  { name: 'Greece', code: 'GR', minLat: 34.80, maxLat: 41.75, minLng: 19.37, maxLng: 29.65 },
  { name: 'Turkey', code: 'TR', minLat: 35.82, maxLat: 42.11, minLng: 25.66, maxLng: 44.82 },
  { name: 'Japan', code: 'JP', minLat: 24.25, maxLat: 45.52, minLng: 122.93, maxLng: 153.99 },
  { name: 'South Korea', code: 'KR', minLat: 33.19, maxLat: 38.61, minLng: 124.61, maxLng: 131.87 },
  { name: 'China', code: 'CN', minLat: 18.16, maxLat: 53.56, minLng: 73.62, maxLng: 134.77 },
  { name: 'India', code: 'IN', minLat: 6.75, maxLat: 35.99, minLng: 68.11, maxLng: 97.40 },
  { name: 'Australia', code: 'AU', minLat: -43.64, maxLat: -10.06, minLng: 113.34, maxLng: 153.64 },
  { name: 'New Zealand', code: 'NZ', minLat: -47.29, maxLat: -34.13, minLng: 166.43, maxLng: 178.57 },
  { name: 'Brazil', code: 'BR', minLat: -33.74, maxLat: 5.27, minLng: -73.98, maxLng: -34.79 },
  { name: 'Argentina', code: 'AR', minLat: -55.06, maxLat: -21.78, minLng: -73.58, maxLng: -53.59 },
  { name: 'Colombia', code: 'CO', minLat: -4.23, maxLat: 13.39, minLng: -81.73, maxLng: -66.87 },
  { name: 'Thailand', code: 'TH', minLat: 5.61, maxLat: 20.46, minLng: 97.34, maxLng: 105.64 },
  { name: 'Vietnam', code: 'VN', minLat: 8.56, maxLat: 23.39, minLng: 102.14, maxLng: 109.46 },
  { name: 'Singapore', code: 'SG', minLat: 1.16, maxLat: 1.47, minLng: 103.60, maxLng: 104.41 },
  { name: 'Malaysia', code: 'MY', minLat: 0.85, maxLat: 7.36, minLng: 99.64, maxLng: 119.27 },
  { name: 'Indonesia', code: 'ID', minLat: -11.00, maxLat: 6.08, minLng: 95.01, maxLng: 141.02 },
  { name: 'Philippines', code: 'PH', minLat: 4.64, maxLat: 21.12, minLng: 116.95, maxLng: 126.60 },
  { name: 'United Arab Emirates', code: 'AE', minLat: 22.63, maxLat: 26.08, minLng: 51.58, maxLng: 56.38 },
  { name: 'Israel', code: 'IL', minLat: 29.49, maxLat: 33.33, minLng: 34.27, maxLng: 35.90 },
  { name: 'South Africa', code: 'ZA', minLat: -34.84, maxLat: -22.13, minLng: 16.45, maxLng: 32.89 },
  { name: 'Egypt', code: 'EG', minLat: 22.00, maxLat: 31.67, minLng: 24.70, maxLng: 36.87 },
  { name: 'Morocco', code: 'MA', minLat: 27.67, maxLat: 35.92, minLng: -13.17, maxLng: -1.00 },
  { name: 'Costa Rica', code: 'CR', minLat: 8.03, maxLat: 11.22, minLng: -85.95, maxLng: -82.55 },
  { name: 'Peru', code: 'PE', minLat: -18.35, maxLat: -0.04, minLng: -81.33, maxLng: -68.65 },
  { name: 'Chile', code: 'CL', minLat: -55.98, maxLat: -17.50, minLng: -75.64, maxLng: -66.96 },
  { name: 'Romania', code: 'RO', minLat: 43.62, maxLat: 48.27, minLng: 20.26, maxLng: 29.69 },
  { name: 'Hungary', code: 'HU', minLat: 45.74, maxLat: 48.59, minLng: 16.11, maxLng: 22.90 },
  { name: 'Croatia', code: 'HR', minLat: 42.39, maxLat: 46.55, minLng: 13.49, maxLng: 19.43 },
  { name: 'Iceland', code: 'IS', minLat: 63.39, maxLat: 66.56, minLng: -24.33, maxLng: -13.50 },
  { name: 'Russia', code: 'RU', minLat: 41.19, maxLat: 81.86, minLng: 19.64, maxLng: -169.05 },
  { name: 'Taiwan', code: 'TW', minLat: 21.90, maxLat: 25.30, minLng: 120.21, maxLng: 122.00 },
  { name: 'Hong Kong', code: 'HK', minLat: 22.15, maxLat: 22.56, minLng: 113.84, maxLng: 114.41 },
];

const BOUNDARY_THRESHOLD_KM = 5;

function isInBox(lat: number, lng: number, box: BoundingBox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

function distanceToBoxEdgeKm(lat: number, lng: number, box: BoundingBox): number {
  // Approximate distance to nearest box edge in km
  const latDiffs = [Math.abs(lat - box.minLat), Math.abs(lat - box.maxLat)];
  const lngDiffs = [Math.abs(lng - box.minLng), Math.abs(lng - box.maxLng)];
  const minLatDiff = Math.min(...latDiffs);
  const minLngDiff = Math.min(...lngDiffs);
  const minDegrees = Math.min(minLatDiff, minLngDiff * Math.cos(lat * Math.PI / 180));
  return minDegrees * 111; // ~111 km per degree
}

export function geocode(lat: number, lng: number): GeocodingResult | null {
  // Check US states first (more specific)
  const isUS = isInBox(lat, lng, COUNTRIES.find(c => c.code === 'US')!) ||
    isInBox(lat, lng, { name: 'Alaska', code: 'AK', minLat: 51.21, maxLat: 71.39, minLng: -179.15, maxLng: -129.98 }) ||
    isInBox(lat, lng, { name: 'Hawaii', code: 'HI', minLat: 18.91, maxLat: 22.24, minLng: -160.25, maxLng: -154.81 });

  if (isUS) {
    // Find matching US states
    const matchingStates = US_STATES.filter(s => isInBox(lat, lng, s));

    if (matchingStates.length > 0) {
      // Pick the smallest bounding box (most specific match)
      const state = matchingStates.reduce((best, s) => {
        const bArea = (best.maxLat - best.minLat) * (best.maxLng - best.minLng);
        const sArea = (s.maxLat - s.minLat) * (s.maxLng - s.minLng);
        return sArea < bArea ? s : best;
      });

      const nearBoundary = distanceToBoxEdgeKm(lat, lng, state) < BOUNDARY_THRESHOLD_KM;

      return {
        country: 'United States',
        countryCode: 'US',
        state: state.name,
        stateCode: state.code,
        nearBoundary,
      };
    }

    // In US bounding box but no state match (ocean, etc.)
    return {
      country: 'United States',
      countryCode: 'US',
      nearBoundary: true,
    };
  }

  // Check other countries
  const matchingCountries = COUNTRIES.filter(c => c.code !== 'US' && isInBox(lat, lng, c));

  if (matchingCountries.length > 0) {
    // Pick smallest bounding box
    const country = matchingCountries.reduce((best, c) => {
      const bArea = (best.maxLat - best.minLat) * (best.maxLng - best.minLng);
      const cArea = (c.maxLat - c.minLat) * (c.maxLng - c.minLng);
      return cArea < bArea ? c : best;
    });

    const nearBoundary = distanceToBoxEdgeKm(lat, lng, country) < BOUNDARY_THRESHOLD_KM;

    return {
      country: country.name,
      countryCode: country.code,
      nearBoundary,
    };
  }

  return null;
}

export function getJurisdictionLabel(result: GeocodingResult): string {
  if (result.state) {
    return `${result.state}, US`;
  }
  return result.country;
}
