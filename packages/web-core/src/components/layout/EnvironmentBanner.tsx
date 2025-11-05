import { useState, useEffect } from 'react';
import { envTag } from '@refly/ui-kit/src/utils/env';

/**
 * Environment banner component that displays for test and staging environments
 */
export const EnvironmentBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show banner for test and staging environments
    if (!envTag || (envTag !== 'test' && envTag !== 'staging')) {
      setIsVisible(false);
      return;
    }

    // Banner is visible by default for test and staging environments
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (envTag !== 'test') {
      return;
    }

    // Find existing favicon link or create new one
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;

    if (link) {
      // Update existing favicon
      link.href = '/logo-test.svg';
      link.type = 'image/svg+xml';
    } else {
      // Create new favicon link if none exists
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = '/logo-test.svg';
      const head = document.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(link);
      }
    }
  }, []);

  const hideBanner = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  const isTest = envTag === 'test';
  const bannerColor = isTest ? 'bg-orange-400' : 'bg-yellow-400';
  const bannerText = isTest ? 'TEST ENVIRONMENT' : 'STAGING ENVIRONMENT. PLEASE USE WITH CAUTION.';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${bannerColor} text-black font-semibold text-center py-2 text-sm flex items-center justify-center relative`}
    >
      <span>{bannerText}</span>
      <button
        type="button"
        onClick={hideBanner}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-black hover:bg-black/10 rounded-full border-none p-1 transition-colors flex items-center"
        aria-label="Close banner"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};
