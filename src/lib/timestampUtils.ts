/**
 * Utility functions for handling timestamps consistently in UTC format
 */

/**
 * Converts any timestamp to UTC ISO string format
 * Handles both ISO string timestamps and Unix timestamps
 */
export function toUTCTimestamp(timestamp: string | number | Date | null | undefined): string | null {
  if (!timestamp) return null;
  
  try {
    let date: Date;
    
    if (typeof timestamp === 'string') {
      // If it's already an ISO string without timezone, treat it as UTC
      if (timestamp.includes('T') && !timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('-', 10)) {
        date = new Date(timestamp + 'Z'); // Add Z to treat as UTC
      } else {
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp provided:', timestamp);
      return null;
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('Error converting timestamp to UTC:', error, timestamp);
    return null;
  }
}

/**
 * Compares two timestamps in UTC format
 * Returns true if timestamp1 is newer than timestamp2
 */
export function isTimestampNewer(timestamp1: string | number | Date | null | undefined, timestamp2: string | number | Date | null | undefined): boolean {
  const utc1 = toUTCTimestamp(timestamp1);
  const utc2 = toUTCTimestamp(timestamp2);
  
  if (!utc1 || !utc2) return false;
  
  return utc1 > utc2;
}

/**
 * Gets current UTC timestamp as ISO string
 */
export function getCurrentUTCTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Logs timestamp comparison for debugging
 */
export function logTimestampComparison(
  currentTimestamp: string | number | Date | null | undefined,
  newTimestamp: string | number | Date | null | undefined,
  componentName: string
) {
  const currentUTC = toUTCTimestamp(currentTimestamp);
  const newUTC = toUTCTimestamp(newTimestamp);
  const requestUTC = getCurrentUTCTimestamp();
  
  console.log(`🔍 ${componentName.toUpperCase()} TIMESTAMP ANALYSIS (UTC):`);
  console.log('  - Current request time (UTC):', requestUTC);
  console.log('  - Frontend data time (UTC):', currentUTC || 'NO_TIMESTAMP');
  console.log('  - Swagger data time (UTC):', newUTC || 'NO_TIMESTAMP');
  console.log('  - Raw current timestamp:', currentTimestamp);
  console.log('  - Raw new timestamp:', newTimestamp);
  
  if (currentUTC && newUTC) {
    const isNewer = newUTC > currentUTC;
    console.log('  - Is new data newer?:', isNewer);
    console.log('  - UTC comparison:', newUTC, '>', currentUTC, '=', isNewer);
  }
}