import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Observer } from 'tailwindcss-intersect';

/** Restart the intersect observer when the route changes so new page elements are detected. */
export default function IntersectObserver() {
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => Observer.restart(), 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
};
