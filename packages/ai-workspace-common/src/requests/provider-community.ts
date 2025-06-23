import { CommunityProviderResponse } from '../components/settings/model-providers/provider-store-types';
import { mockCommunityProviders } from './provider-community-mock';

// const COMMUNITY_PROVIDER_API_URL = 'https://static.refly.ai/provider-config/provider-catalog.json';

/**
 * Fetch community provider configurations
 * Currently using mock data for development
 */
export const fetchCommunityProviderConfigs = async (): Promise<CommunityProviderResponse> => {
  try {
    // Simulate network delay for realistic behavior
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return mock data
    return mockCommunityProviders;

    // TODO: Replace with actual API call when endpoint is ready
    /*
    const response = await fetch(COMMUNITY_PROVIDER_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch community providers: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format: expected object');
    }

    // Handle both direct array format and object with providers property
    let providers = [];
    if (Array.isArray(data)) {
      providers = data;
    } else if (data.providers && Array.isArray(data.providers)) {
      providers = data.providers;
    } else {
      throw new Error('Invalid response format: providers array not found');
    }

    return {
      providers,
      meta: data.meta || {
        total: providers.length,
        lastUpdated: new Date().toISOString(),
      },
    };
    */
  } catch (error) {
    console.error('Error fetching community provider configs:', error);
    throw error;
  }
};

/**
 * Check community provider API health
 * Currently using mock data, always returns true
 */
export const checkCommunityProviderApiHealth = async (): Promise<boolean> => {
  try {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return true for mock data
    return true;

    // TODO: Replace with actual API health check when endpoint is ready
    /*
    const response = await fetch(COMMUNITY_PROVIDER_API_URL, {
      method: 'HEAD',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    return response.ok;
    */
  } catch (error) {
    console.error('Community provider API health check failed:', error);
    return false;
  }
};
