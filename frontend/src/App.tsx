import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/Layout';
import { Skeleton, SkeletonCard, SkeletonKPICard } from '@/components/ui/Skeleton';

// ============================================================================
// LAZY-LOADED ROUTE COMPONENTS (CODE SPLITTING)
// ============================================================================

const LandingPage = lazy(() =>
  import('@/pages/Landing').then((m) => ({ default: m.Landing || m.default }))
);
const AuthPage = lazy(() =>
  import('@/pages/Auth').then((m) => ({ default: m.AuthPage || m.default }))
);
const UploadPage = lazy(() =>
  import('@/pages/Upload').then((m) => ({ default: m.Upload || m.default }))
);
const ReviewQueuePage = lazy(() =>
  import('@/pages/ReviewQueue').then((m) => ({ default: m.ReviewQueue || m.default }))
);
const DashboardPage = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard || m.default }))
);
const ForecastPage = lazy(() =>
  import('@/pages/Forecast').then((m) => ({ default: m.Forecast || m.default }))
);
const InsightsPage = lazy(() =>
  import('@/pages/Insights').then((m) => ({ default: m.Insights || m.default }))
);
const AskPage = lazy(() => import('@/pages/Ask').then((m) => ({ default: m.Ask || m.default })));
const AboutPage = lazy(() =>
  import('@/pages/About').then((m) => ({ default: m.About || m.default }))
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFound').then((m) => ({ default: m.NotFound || m.default }))
);

// Sleek fallback loader while route chunk is loading
const PageLoader: React.FC = () => (
  <div className="space-y-6 animate-fade-in py-2">
    <div className="space-y-2">
      <Skeleton className="h-8 w-64 rounded-xl" />
      <Skeleton className="h-4 w-96 rounded-lg" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <SkeletonKPICard />
      <SkeletonKPICard />
      <SkeletonKPICard />
      <SkeletonKPICard />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Root Landing Page */}
              <Route
                index
                element={
                  <Suspense fallback={<PageLoader />}>
                    <LandingPage />
                  </Suspense>
                }
              />

              {/* Authentication (Sign In & Sign Up) */}
              <Route
                path="auth"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AuthPage />
                  </Suspense>
                }
              />

              {/* Core Route Destinations */}
            <Route
              path="upload"
              element={
                <Suspense fallback={<PageLoader />}>
                  <UploadPage />
                </Suspense>
              }
            />
            <Route
              path="review-queue"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ReviewQueuePage />
                </Suspense>
              }
            />
            <Route
              path="dashboard"
              element={
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="forecast"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ForecastPage />
                </Suspense>
              }
            />
            <Route
              path="insights"
              element={
                <Suspense fallback={<PageLoader />}>
                  <InsightsPage />
                </Suspense>
              }
            />
            <Route
              path="ask"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AskPage />
                </Suspense>
              }
            />
            <Route
              path="about"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AboutPage />
                </Suspense>
              }
            />

            {/* 404 Route */}
            <Route
              path="*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <NotFoundPage />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);
}

export default App;
