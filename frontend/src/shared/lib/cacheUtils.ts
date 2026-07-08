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
      "marketIntelligenceData",
      "competitorData",
      "regulatoryData",
      "industryTrendsData",
      "marketEntryData",
      "profilerCache",
      "companyProfile",
      "companyProfileHash",
    ];
    cacheKeys.forEach((key) => localStorage.removeItem(key));
    return;
  }

  // Clear user-specific cache keys
  const cacheKeys = [
    "marketIntelligenceData",
    "competitorData",
    "regulatoryData",
    "industryTrendsData",
    "marketEntryData",
    "profilerCache",
    "companyProfile",
    "companyProfileHash",
  ];

  cacheKeys.forEach((key) => {
    localStorage.removeItem(getUserCacheKey(key, userId));
    // Also clear old format for backward compatibility
    localStorage.removeItem(key);
  });

  console.log(`🧹 Cleared all cache for user: ${userId}`);
};

/**
 * Get user-specific localStorage item
 */
export const getUserLocalStorage = (
  key: string,
  userId: string | null | undefined,
): string | null => {
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
export const setUserLocalStorage = (
  key: string,
  value: string,
  userId: string | null | undefined,
): void => {
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

/**
 * Get org-specific cache key. Org-owned data (Customer-Profile / Current ICPs)
 * must be keyed by org, never by uid or uid+org, so one org's tenant data never
 * leaks into another org on a shared browser. Namespaced (`_org_`) to avoid
 * colliding with the uid-scoped keys above.
 */
export const getOrgCacheKey = (baseKey: string, orgId: string | null | undefined): string => {
  if (!orgId) {
    return baseKey; // Fallback to base key if no org ID
  }
  return `${baseKey}_org_${orgId}`;
};

/**
 * Get org-specific localStorage item. Deliberately NO uid/global fallback —
 * org isolation is the point; falling back would re-introduce the cross-org leak.
 */
export const getOrgLocalStorage = (key: string, orgId: string | null | undefined): string | null =>
  localStorage.getItem(getOrgCacheKey(key, orgId));

/**
 * Set org-specific localStorage item
 */
export const setOrgLocalStorage = (
  key: string,
  value: string,
  orgId: string | null | undefined,
): void => {
  localStorage.setItem(getOrgCacheKey(key, orgId), value);
};

/**
 * Remove org-specific localStorage item
 */
export const removeOrgLocalStorage = (key: string, orgId: string | null | undefined): void => {
  localStorage.removeItem(getOrgCacheKey(key, orgId));
};
