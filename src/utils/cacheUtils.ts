/**
 * Utility functions for user-specific cache management
 */

/**
 * Get user-specific cache key
 */
export const getUserCacheKey = (baseKey: string, userId: string | null | undefined): string => {
  if (!userId) {
    return baseKey; // Fallback to base key if no user ID
  }
  return `${baseKey}_${userId}`;
};

/**
 * Clear all user-specific cache for a given user
 */
export const clearUserCache = (userId: string | null | undefined): void => {
  if (!userId) {
    // Clear all cache keys (fallback)
    const cacheKeys = [
      'marketIntelligenceData',
      'competitorData',
      'regulatoryData',
      'industryTrendsData',
      'marketEntryData',
      'profilerCache',
      'companyProfile',
      'companyProfileHash'
    ];
    cacheKeys.forEach(key => localStorage.removeItem(key));
    return;
  }

  // Clear user-specific cache keys
  const cacheKeys = [
    'marketIntelligenceData',
    'competitorData',
    'regulatoryData',
    'industryTrendsData',
    'marketEntryData',
    'profilerCache',
    'companyProfile',
    'companyProfileHash'
  ];
  
  cacheKeys.forEach(key => {
    localStorage.removeItem(getUserCacheKey(key, userId));
    // Also clear old format for backward compatibility
    localStorage.removeItem(key);
  });
  
  console.log(`🧹 Cleared all cache for user: ${userId}`);
};

/**
 * Get user-specific localStorage item
 */
export const getUserLocalStorage = (key: string, userId: string | null | undefined): string | null => {
  if (!userId) {
    return localStorage.getItem(key); // Fallback to base key
  }
  const userKey = getUserCacheKey(key, userId);
  const value = localStorage.getItem(userKey);
  // Fallback to old format for backward compatibility
  if (!value) {
    return localStorage.getItem(key);
  }
  return value;
};

/**
 * Set user-specific localStorage item
 */
export const setUserLocalStorage = (key: string, value: string, userId: string | null | undefined): void => {
  if (!userId) {
    localStorage.setItem(key, value); // Fallback to base key
    return;
  }
  const userKey = getUserCacheKey(key, userId);
  localStorage.setItem(userKey, value);
};

/**
 * Remove user-specific localStorage item
 */
export const removeUserLocalStorage = (key: string, userId: string | null | undefined): void => {
  if (!userId) {
    localStorage.removeItem(key); // Fallback to base key
    return;
  }
  const userKey = getUserCacheKey(key, userId);
  localStorage.removeItem(userKey);
  // Also remove old format for backward compatibility
  localStorage.removeItem(key);
};


