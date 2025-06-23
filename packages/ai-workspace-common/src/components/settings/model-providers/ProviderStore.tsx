import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Select, Empty, Row, Col, Typography, Tag } from 'antd';
import { LuSearch } from 'react-icons/lu';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

import { useListCommunityProviders } from '@refly-packages/ai-workspace-common/queries';
import {
  CommunityProviderListProps,
  CommunityProviderFilterState,
  CommunityProviderResponse,
} from './provider-store-types';
import { CommunityProviderCard } from './CommunityProviderCard';
import {
  filterProviders,
  sortProviders,
  isProviderInstalled,
  getAvailableTags,
} from './provider-store-utils';

const { Text } = Typography;
const { Option } = Select;

export const ProviderStore: React.FC<CommunityProviderListProps> = ({
  visible,
  installedProviders,
  onInstallSuccess,
}) => {
  // Fetch community providers
  const { data: communityData, isLoading, error, refetch } = useListCommunityProviders();

  // Filter state
  const [filters, setFilters] = useState<CommunityProviderFilterState>({
    searchText: '',
    selectedCategory: 'all',
    selectedPricing: 'all',
    selectedTags: [],
  });

  // Get available filter options with explicit type checking
  const availableCategories = useMemo(() => {
    const data = communityData as CommunityProviderResponse | undefined;
    if (!data?.providers) return [];
    const categorySet = new Set<string>();
    for (const provider of data.providers) {
      if (provider.categories) {
        for (const category of provider.categories) {
          categorySet.add(category);
        }
      }
    }
    return Array.from(categorySet).sort();
  }, [communityData]);

  const availableTags = useMemo(() => {
    const data = communityData as CommunityProviderResponse | undefined;
    if (!data?.providers) return [];
    return getAvailableTags(data.providers);
  }, [communityData]);

  // Filter and sort providers
  const filteredProviders = useMemo(() => {
    const data = communityData as CommunityProviderResponse | undefined;
    if (!data?.providers) return [];
    const filtered = filterProviders(data.providers, filters);
    return sortProviders(filtered);
  }, [communityData, filters]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: Partial<CommunityProviderFilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Handle install success
  const handleInstallSuccess = useCallback(
    (_config: any) => {
      onInstallSuccess();
      refetch(); // Refresh community providers to update install status
    },
    [onInstallSuccess, refetch],
  );

  // Refetch when visible
  useEffect(() => {
    if (visible) {
      refetch();
    }
  }, [visible, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Empty description="Failed to load community providers">
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="provider-store p-6 pt-0 h-full overflow-hidden flex flex-col">
      {/* Search and filters */}
      <div className="mb-8 space-y-5">
        {/* Search bar */}
        <div className="relative">
          <Input
            prefix={<LuSearch className="h-4 w-4 text-gray-400" />}
            placeholder="Search providers..."
            value={filters.searchText}
            onChange={(e) => handleFiltersChange({ searchText: e.target.value })}
            className="w-full"
            size="large"
            style={{
              borderRadius: '10px',
              height: '44px',
            }}
          />
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Category filter */}
          <div className="flex items-center gap-2">
            <Text type="secondary" className="text-sm">
              Category:
            </Text>
            <Select
              value={filters.selectedCategory}
              onChange={(value) => handleFiltersChange({ selectedCategory: value })}
              className="min-w-24"
              size="small"
            >
              <Option value="all">All</Option>
              {availableCategories.map((category) => (
                <Option key={category} value={category}>
                  {category.toUpperCase()}
                </Option>
              ))}
            </Select>
          </div>

          {/* Pricing filter */}
          <div className="flex items-center gap-2">
            <Text type="secondary" className="text-sm">
              Pricing:
            </Text>
            <Select
              value={filters.selectedPricing}
              onChange={(value) => handleFiltersChange({ selectedPricing: value })}
              className="min-w-24"
              size="small"
            >
              <Option value="all">All</Option>
              <Option value="free">Free</Option>
              <Option value="paid">Paid</Option>
              <Option value="freemium">Freemium</Option>
            </Select>
          </div>

          {/* Tags filter */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-2">
              <Text type="secondary" className="text-sm">
                Tags:
              </Text>
              <Select
                mode="multiple"
                value={filters.selectedTags}
                onChange={(value) => handleFiltersChange({ selectedTags: value })}
                placeholder="Select tags"
                className="min-w-32"
                size="small"
                maxTagCount={2}
              >
                {availableTags.map((tag) => (
                  <Option key={tag} value={tag}>
                    {tag}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Active filters display */}
        {(filters.searchText ||
          filters.selectedCategory !== 'all' ||
          filters.selectedPricing !== 'all' ||
          filters.selectedTags.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <Text type="secondary" className="text-sm">
              Active filters:
            </Text>
            {filters.searchText && (
              <Tag closable onClose={() => handleFiltersChange({ searchText: '' })}>
                Search: {filters.searchText}
              </Tag>
            )}
            {filters.selectedCategory !== 'all' && (
              <Tag closable onClose={() => handleFiltersChange({ selectedCategory: 'all' })}>
                Category: {filters.selectedCategory}
              </Tag>
            )}
            {filters.selectedPricing !== 'all' && (
              <Tag closable onClose={() => handleFiltersChange({ selectedPricing: 'all' })}>
                Pricing: {filters.selectedPricing}
              </Tag>
            )}
            {filters.selectedTags.map((tag) => (
              <Tag
                key={tag}
                closable
                onClose={() =>
                  handleFiltersChange({
                    selectedTags: filters.selectedTags.filter((t) => t !== tag),
                  })
                }
              >
                {tag}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {filteredProviders.length === 0 ? (
          <Empty
            description={
              filters.searchText ||
              filters.selectedCategory !== 'all' ||
              filters.selectedPricing !== 'all' ||
              filters.selectedTags.length > 0
                ? 'No providers match your filters'
                : 'No providers available'
            }
          />
        ) : (
          <>
            {/* Results count */}
            <div className="mb-6">
              <Text type="secondary" className="text-sm">
                {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''} found
              </Text>
            </div>

            {/* Provider cards grid - maximum 2 per row */}
            <Row gutter={[24, 24]}>
              {filteredProviders.map((provider) => (
                <Col key={provider.id} xs={24} sm={24} md={12}>
                  <CommunityProviderCard
                    config={provider}
                    isInstalled={isProviderInstalled(provider, installedProviders)}
                    onInstall={handleInstallSuccess}
                  />
                </Col>
              ))}
            </Row>

            {/* Footer */}
            <div className="text-center text-gray-400 text-sm mt-8 pb-4">
              {(communityData as CommunityProviderResponse | undefined)?.meta && (
                <Text type="secondary">
                  Last updated:{' '}
                  {new Date(
                    (communityData as CommunityProviderResponse).meta.lastUpdated,
                  ).toLocaleDateString()}
                </Text>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

ProviderStore.displayName = 'ProviderStore';
