import { useState, useEffect } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStoreShallow, useUserStoreShallow } from '@refly/stores';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { Button } from 'antd';
import thanks from './thanks.svg';

// Local storage key for tracking if the modal has been shown
const CREDITS_WELCOME_SHOWN_KEY = 'refly_credits_welcome_shown';

export const CreditWelcomeModalEarlybirds = () => {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
    setPlanType: state.setPlanType,
    planType: state.planType,
  }));

  useEffect(() => {
    // Check if user is logged in and if this is the first time showing the modal
    if (userProfile?.uid) {
      const hasShown = localStorage.getItem(CREDITS_WELCOME_SHOWN_KEY + Math.random());
      if (!hasShown) {
        setVisible(true);
      }
    }
  }, [userProfile?.uid]);

  // Close modal and mark as shown
  const handleClose = () => {
    localStorage.setItem(CREDITS_WELCOME_SHOWN_KEY, 'true');
    setVisible(false);
  };

  // Learn more button click handler
  const handleLearnMore = () => {
    // Can navigate to points system details page
    setSubscribeModalVisible(true);
    handleClose();
  };

  return (
    <Modal
      open={visible}
      footer={null}
      closable={false}
      centered
      width={600}
      bodyStyle={{ padding: '20px 16px' }}
      maskClosable={false}
    >
      <div className="flex flex-col items-start w-full p-0 dark:bg-[#1E1E1E] bg-white">
        {/* Logo container */}
        <div className="w-full flex justify-start mb-4">
          <Logo />
        </div>

        {/* Title section */}
        <div
          className="mt-[16px]
        [font-family:'PingFang_SC'] text-[color:var(--text-icon-refly-text-0,#1C1F23)] dark:text-white text-[22px] font-semibold leading-8"
        >
          致最早的同行者
        </div>
        <div
          className="
        [font-family:'PingFang_SC'] text-[color:var(--text-icon-refly-text-0,#1C1F23)] dark:text-white text-[22px] font-semibold leading-8"
        >
          积分系统上线的第一天，我们最想感谢的，就是你。
        </div>

        {/* Description text */}
        <div
          className=" mt-[8px]
       [font-family:'PingFang_SC'] self-stretch text-[color:var(--text-icon-refly-text-0,#1C1F23)] dark:text-gray-200 text-sm font-normal leading-5"
        >
          {t('subscription.subscriptionManagement.creditsWelcome.description1')}
        </div>
        <div
          className="
       [font-family:'PingFang_SC'] self-stretch text-[color:var(--text-icon-refly-text-0,#1C1F23)] dark:text-gray-200 text-sm font-normal leading-5"
        >
          {t('subscription.subscriptionManagement.creditsWelcome.description2')}
        </div>

        {/* Divider */}
        <div
          className="w-full h-[1px] my-4 border-t border-dashed border-black/10 dark:border-white/10
        flex flex-col items-start gap-4 self-stretch
        "
        />

        <img
          className="
                  self-stretch text-[color:var(--text-icon-refly-text-0,#1C1F23)] dark:text-white [font-family:sans-serif] text-4xl font-normal leading-[56px] tracking-[-2px] dark:filter dark:invert dark:brightness-[0.85] dark:hue-rotate-180"
          src={thanks}
          alt="thanks"
        />

        {/* Button area */}
        <div className="flex justify-center gap-4 w-full mt-[40px]">
          <Button
            onClick={handleClose}
            className="
            flex h-[var(--height-button\_default,32px)] [padding:var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingRight,12px)_var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingLeft,12px)] justify-center items-center flex-[1_0_0] border-[color:var(--border---refly-Control-Border,rgba(0,0,0,0.14))] dark:border-gray-600 [background:var(--bg-control---refly-bg-control-z0,#F6F6F6)] dark:bg-gray-700 dark:text-white rounded-lg border-[0.5px] border-solid
            "
          >
            {t('subscription.subscriptionManagement.creditsWelcome.continueButton')}
          </Button>
          <Button
            type="primary"
            onClick={handleLearnMore}
            className="
            flex h-[var(--height-button\_default,32px)] [padding:var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingRight,12px)_var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingLeft,12px)] justify-center items-center flex-[1_0_0] [background:var(--primary---refly-primary-default,#0E9F77)] dark:bg-[#0E9F77] dark:text-white rounded-lg
            "
          >
            {t('subscription.subscriptionManagement.creditsWelcome.learnMoreButton')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
