import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly/stores';
import { SubscriptionPlanType } from '@refly-packages/ai-workspace-common/requests/types.gen';

/**
 * Hook to get user membership level information
 *
 * @returns Object containing membership level and related information
 */
export const useUserMembership = () => {
  const { t } = useTranslation();
  const userProfile = useUserStoreShallow((state) => state.userProfile);

  const membershipInfo = useMemo(() => {
    const planType = userProfile?.subscription?.planType || 'free';

    // Map plan types to display names
    const planTypeToDisplayName: Record<SubscriptionPlanType, string> = {
      free: t('subscription.planType.free', '免费用户'),
      starter: t('subscription.planType.starter', 'Starter 用户'),
      maker: t('subscription.planType.maker', 'Maker 用户'),
      enterprise: t('subscription.planType.enterprise', '企业用户'),
    };

    const planTypeToDisplayNameEn: Record<SubscriptionPlanType, string> = {
      free: 'Free User',
      starter: 'Starter User',
      maker: 'Maker User',
      enterprise: 'Enterprise User',
    };

    return {
      planType,
      displayName: planTypeToDisplayName[planType] || planTypeToDisplayName.free,
      displayNameEn: planTypeToDisplayNameEn[planType] || planTypeToDisplayNameEn.free,
      isFree: planType === 'free',
      isSubscribed: planType !== 'free',
      subscription: userProfile?.subscription,
    };
  }, [userProfile?.subscription, t]);

  return membershipInfo;
};
