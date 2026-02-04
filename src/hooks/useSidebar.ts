import { useState, useEffect } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    // Check screen size on initial load
    if (typeof window !== 'undefined') {
      // Auto-collapse on mobile/tablet
      if (window.innerWidth < 1024) {
        return true;
      }
      // Check localStorage for saved preference
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed } }));
  }, [collapsed]);

  useEffect(() => {
    // Handle responsive collapse on resize
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggle = () => setCollapsed(!collapsed);

  return { collapsed, setCollapsed, toggle };
}

// Hook to listen for sidebar changes from other components
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) return true;
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handleToggle = (e: CustomEvent<{ collapsed: boolean }>) => {
      setCollapsed(e.detail.collapsed);
    };

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };

    window.addEventListener('sidebar-toggle', handleToggle as EventListener);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('sidebar-toggle', handleToggle as EventListener);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return collapsed;
}
