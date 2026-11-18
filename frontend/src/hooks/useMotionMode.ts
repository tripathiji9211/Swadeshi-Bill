import { useState, useEffect } from 'react';

const STORAGE_KEY = 'receiptradar_reduce_motion';

export function useMotionMode() {
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => {
    // 1. Check persistent preference in localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    // 2. Fall back to system preference (OS prefers-reduced-motion)
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(reduceMotion));

    // Listen to OS prefers-reduced-motion changes if user hasn't set an explicit preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = (e: MediaQueryListEvent) => {
        const hasSaved = localStorage.getItem(STORAGE_KEY);
        if (hasSaved === null) {
          setReduceMotionState(e.matches);
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [reduceMotion]);

  const toggleReduceMotion = () => {
    setReduceMotionState((prev) => !prev);
  };

  const setReduceMotion = (val: boolean) => {
    setReduceMotionState(val);
  };

  return {
    reduceMotion,
    setReduceMotion,
    toggleReduceMotion,
    is2DMode: reduceMotion,
  };
}

export default useMotionMode;
