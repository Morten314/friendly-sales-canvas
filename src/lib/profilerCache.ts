/**
 * Centralized cache service for Profiler components
 * Handles persistence of ICP cards and their associated data
 */
import { getUserCacheKey, getUserLocalStorage, setUserLocalStorage, removeUserLocalStorage } from '@/utils/cacheUtils';

export interface CachedICPData {
  id: string;
  name: string;
  description: string;
  industry: string;
  companySize: string;
  painPoints: string[];
  buyingSignals: string[];
  marketSize: string;
  competitiveLandscape: string;
  lastUpdated: number;
  dataSource: 'api' | 'cache';
  // Additional cached data for the 4 components
  buyerMapData?: any;
  competitiveOverlapData?: any;
  regulatoryComplianceData?: any;
  marketAnalysisData?: any;
}

export interface CachedProfilerData {
  icpCards: CachedICPData[];
  lastProfileUpdate: number;
  cacheTimestamp: number;
  profileHash: string; // Hash of company profile to detect changes
}

class ProfilerCacheService {
  private readonly CACHE_KEY = 'profilerCache';
  private readonly PROFILE_HASH_KEY = 'companyProfileHash';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get cached profiler data if available and valid (user-specific)
   */
  getCachedData(userId?: string | null): CachedProfilerData | null {
    try {
      const cached = getUserLocalStorage(this.CACHE_KEY, userId);
      if (!cached) return null;

      const data: CachedProfilerData = JSON.parse(cached);
      
      // Check if cache is still valid
      const now = Date.now();
      if (now - data.cacheTimestamp > this.CACHE_DURATION) {
        console.log('🗑️ Profiler cache expired, clearing...');
        this.clearCache(userId);
        return null;
      }

      // Check if company profile has changed
      const currentProfileHash = this.getCurrentProfileHash(userId);
      if (data.profileHash !== currentProfileHash) {
        console.log('🔄 Company profile changed, cache invalidated');
        this.clearCache(userId);
        return null;
      }

      console.log('📦 Using cached profiler data');
      return data;
    } catch (error) {
      console.error('❌ Error reading profiler cache:', error);
      this.clearCache(userId);
      return null;
    }
  }

  /**
   * Cache profiler data (user-specific)
   */
  setCachedData(icpCards: CachedICPData[], userId?: string | null): void {
    try {
      const data: CachedProfilerData = {
        icpCards,
        lastProfileUpdate: Date.now(),
        cacheTimestamp: Date.now(),
        profileHash: this.getCurrentProfileHash(userId)
      };

      setUserLocalStorage(this.CACHE_KEY, JSON.stringify(data), userId);
      console.log('💾 Profiler data cached successfully');
    } catch (error) {
      console.error('❌ Error caching profiler data:', error);
    }
  }

  /**
   * Get cached data for a specific ICP (user-specific)
   */
  getCachedICPData(icpId: string, userId?: string | null): CachedICPData | null {
    const cachedData = this.getCachedData(userId);
    if (!cachedData) return null;

    return cachedData.icpCards.find(icp => icp.id === icpId) || null;
  }

  /**
   * Update cached data for a specific ICP (user-specific)
   */
  updateCachedICPData(icpId: string, updatedData: Partial<CachedICPData>, userId?: string | null): void {
    const cachedData = this.getCachedData(userId);
    if (!cachedData) return;

    const index = cachedData.icpCards.findIndex(icp => icp.id === icpId);
    if (index !== -1) {
      cachedData.icpCards[index] = { ...cachedData.icpCards[index], ...updatedData };
      this.setCachedData(cachedData.icpCards, userId);
    }
  }

  /**
   * Cache component data for a specific ICP (user-specific)
   */
  cacheComponentData(icpId: string, componentType: 'buyerMap' | 'competitiveOverlap' | 'regulatoryCompliance' | 'marketAnalysis', data: any, userId?: string | null): void {
    const cachedData = this.getCachedData(userId);
    if (!cachedData) return;

    const index = cachedData.icpCards.findIndex(icp => icp.id === icpId);
    if (index !== -1) {
      const updateData: Partial<CachedICPData> = {};
      switch (componentType) {
        case 'buyerMap':
          updateData.buyerMapData = data;
          break;
        case 'competitiveOverlap':
          updateData.competitiveOverlapData = data;
          break;
        case 'regulatoryCompliance':
          updateData.regulatoryComplianceData = data;
          break;
        case 'marketAnalysis':
          updateData.marketAnalysisData = data;
          break;
      }
      
      this.updateCachedICPData(icpId, updateData, userId);
      console.log(`💾 Cached ${componentType} data for ICP ${icpId}`);
    }
  }

  /**
   * Get cached component data for a specific ICP (user-specific)
   */
  getCachedComponentData(icpId: string, componentType: 'buyerMap' | 'competitiveOverlap' | 'regulatoryCompliance' | 'marketAnalysis', userId?: string | null): any {
    const cachedICPData = this.getCachedICPData(icpId, userId);
    if (!cachedICPData) return null;

    switch (componentType) {
      case 'buyerMap':
        return cachedICPData.buyerMapData;
      case 'competitiveOverlap':
        return cachedICPData.competitiveOverlapData;
      case 'regulatoryCompliance':
        return cachedICPData.regulatoryComplianceData;
      case 'marketAnalysis':
        return cachedICPData.marketAnalysisData;
      default:
        return null;
    }
  }

  /**
   * Clear all cached data (user-specific)
   */
  clearCache(userId?: string | null): void {
    removeUserLocalStorage(this.CACHE_KEY, userId);
    removeUserLocalStorage(this.PROFILE_HASH_KEY, userId);
    console.log('🧹 Profiler cache cleared');
  }

  /**
   * Check if cache exists and is valid (user-specific)
   */
  hasValidCache(userId?: string | null): boolean {
    return this.getCachedData(userId) !== null;
  }

  /**
   * Get current company profile hash for change detection (user-specific)
   */
  private getCurrentProfileHash(userId?: string | null): string {
    try {
      const profile = getUserLocalStorage('companyProfile', userId);
      if (!profile) return '';

      // Create a simple hash of the profile data
      const profileData = JSON.parse(profile);
      const hashString = JSON.stringify({
        industry: profileData.industry,
        companySize: profileData.companySize,
        strategicGoals: profileData.strategicGoals,
        targetMarkets: profileData.targetMarkets
      });
      
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < hashString.length; i++) {
        const char = hashString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return hash.toString();
    } catch (error) {
      console.error('❌ Error generating profile hash:', error);
      return '';
    }
  }

  /**
   * Check if data should be fetched from API (user-specific)
   * Returns true if cache is invalid or data doesn't exist
   */
  shouldFetchFromAPI(userId?: string | null): boolean {
    const cachedData = this.getCachedData(userId);
    return !cachedData || cachedData.icpCards.length === 0;
  }

  /**
   * Get cache status for debugging (user-specific)
   */
  getCacheStatus(userId?: string | null): {
    hasCache: boolean;
    cacheAge: number;
    icpCount: number;
    profileHash: string;
  } {
    const cachedData = this.getCachedData(userId);
    const now = Date.now();
    
    return {
      hasCache: !!cachedData,
      cacheAge: cachedData ? now - cachedData.cacheTimestamp : 0,
      icpCount: cachedData ? cachedData.icpCards.length : 0,
      profileHash: this.getCurrentProfileHash(userId)
    };
  }
}

// Export singleton instance
export const profilerCache = new ProfilerCacheService();
