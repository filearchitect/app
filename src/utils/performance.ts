import React from "react";

// Performance monitoring utility for development
const isDevelopment = import.meta.env.DEV;

export const performanceMonitor = {
  start: (label: string) => {
    if (isDevelopment) {
      console.time(`⏱️ ${label}`);
    }
  },

  end: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(`⏱️ ${label}`);
    }
  },

  measure: <T>(label: string, fn: () => T): T => {
    if (isDevelopment) {
      performanceMonitor.start(label);
      const result = fn();
      performanceMonitor.end(label);
      return result;
    }
    return fn();
  },

  measureAsync: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    if (isDevelopment) {
      performanceMonitor.start(label);
      const result = await fn();
      performanceMonitor.end(label);
      return result;
    }
    return fn();
  },
};

// React performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  if (!isDevelopment) {
    return Component;
  }

  const WrappedComponent = React.memo((props: P) => {
    const renderCount = React.useRef(0);
    renderCount.current += 1;

    React.useEffect(() => {
      console.log(`🔄 ${componentName} rendered ${renderCount.current} times`);
    });

    return React.createElement(Component, props);
  });

  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName})`;
  return WrappedComponent;
};

// Hook for measuring hook performance
export const usePerformanceMonitor = (hookName: string) => {
  const renderCount = React.useRef(0);
  renderCount.current += 1;

  React.useEffect(() => {
    if (isDevelopment) {
      console.log(`🔄 ${hookName} executed ${renderCount.current} times`);
    }
  });
};
