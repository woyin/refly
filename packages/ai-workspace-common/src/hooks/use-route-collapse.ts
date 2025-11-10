import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiderStoreShallow } from '@refly/stores';

/**
 * Custom hook to handle sidebar collapse state based on route changes
 * Sets collapse to false for specific routes, true for all others
 */
export const useRouteCollapse = () => {
  const location = useLocation();
  const { collapse, isManualCollapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    isManualCollapse: state.isManualCollapse,
    setCollapse: state.setCollapse,
  }));

  useEffect(() => {
    if (isManualCollapse) {
      return;
    }

    const currentPath = location.pathname;

    // Routes that should have sidebar expanded (collapse = false)
    const expandedRoutes = ['/app-manager', '/workflow-list', '/canvas/empty', '/home', '/project'];

    // Check if current route matches any of the expanded routes
    const shouldExpand = expandedRoutes.some((route) => {
      if (route === '/home') {
        return currentPath === '/';
      }
      if (route === '/canvas/empty') {
        // Exact match for /canvas/empty
        return currentPath === '/canvas/empty';
      }

      // For other routes, check if path starts with the route
      return currentPath.startsWith(route);
    });

    // Set collapse state based on route
    // If shouldExpand is true, set collapse to false (expanded)
    // If shouldExpand is false, set collapse to true (collapsed)
    const nextCollapse = !shouldExpand;
    if (collapse !== nextCollapse) {
      setCollapse(nextCollapse);
    }
  }, [collapse, isManualCollapse, location.pathname, setCollapse]);
};
