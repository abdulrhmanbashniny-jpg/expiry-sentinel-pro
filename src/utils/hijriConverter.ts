/**
 * Hijri to Gregorian date converter
 * Simple implementation for common Hijri date formats
 */

// Hijri month lengths (approximation - actual can vary)
const HIJRI_MONTH_DAYS = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];

/**
 * Julian Day Number calculation for Hijri dates
 * Based on the algorithm from http://www.islamicity.com/calendar/
 */
function hijriToJulianDay(year: number, month: number, day: number): number {
  return Math.floor((11 * year + 3) / 30) + 
         354 * year + 
         30 * month - 
         Math.floor((month - 1) / 2) + 
         day + 1948440 - 385;
}

/**
 * Convert Julian Day to Gregorian date
 */
function julianDayToGregorian(jd: number): { year: number; month: number; day: number } {
  const Z = Math.floor(jd + 0.5);
  const A = Math.floor((Z - 1867216.25) / 36524.25);
  const AA = Z + 1 + A - Math.floor(A / 4);
  const B = AA + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  
  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  
  return { year, month, day };
}

/**
 * Parse Hijri date string in various formats:
 * - yyyy/MM/dd
 * - yyyy-MM-dd
 * - dd/MM/yyyy
 * - dd-MM-yyyy
 */
export function parseHijriDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const cleaned = dateStr.trim();
  
  // Try different formats
  const patterns = [
    // yyyy/MM/dd or yyyy-MM-dd
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
    // dd/MM/yyyy or dd-MM-yyyy
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const match = cleaned.match(patterns[i]);
    if (match) {
      let year: number, month: number, day: number;
      
      if (i === 0) {
        // yyyy/MM/dd format
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else {
        // dd/MM/yyyy format
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      }
      
      // Validate Hijri date ranges
      if (year < 1 || year > 1500) return null;
      if (month < 1 || month > 12) return null;
      if (day < 1 || day > 30) return null;
      
      return { year, month, day };
    }
  }
  
  return null;
}

/**
 * Convert Hijri date to Gregorian date string (yyyy-MM-dd)
 */
export function hijriToGregorian(dateStr: string): string | null {
  const hijri = parseHijriDate(dateStr);
  if (!hijri) return null;
  
  try {
    const jd = hijriToJulianDay(hijri.year, hijri.month, hijri.day);
    const gregorian = julianDayToGregorian(jd);
    
    const year = gregorian.year;
    const month = String(gregorian.month).padStart(2, '0');
    const day = String(gregorian.day).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error converting Hijri date:', error);
    return null;
  }
}

/**
 * Parse Gregorian date string in various formats
 */
export function parseGregorianDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const cleaned = dateStr.trim();
  
  // Try different formats
  const patterns = [
    // yyyy/MM/dd or yyyy-MM-dd
    { pattern: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, yearIndex: 1, monthIndex: 2, dayIndex: 3 },
    // dd/MM/yyyy or dd-MM-yyyy
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, yearIndex: 3, monthIndex: 2, dayIndex: 1 },
    // MM/dd/yyyy (US format)
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, yearIndex: 3, monthIndex: 1, dayIndex: 2 },
  ];
  
  for (const { pattern, yearIndex, monthIndex, dayIndex } of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const year = parseInt(match[yearIndex], 10);
      const month = parseInt(match[monthIndex], 10);
      const day = parseInt(match[dayIndex], 10);
      
      // Validate reasonable Gregorian date
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}

/**
 * Convert date based on type (Hijri or Gregorian)
 */
export function convertDate(dateStr: string, dateType: 'هجري' | 'ميلادي' | string): string | null {
  if (!dateStr) return null;
  
  // Check if it's already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }
  
  if (dateType === 'هجري') {
    return hijriToGregorian(dateStr);
  } else {
    return parseGregorianDate(dateStr);
  }
}
