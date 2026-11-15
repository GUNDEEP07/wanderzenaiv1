import React, { Suspense } from 'react';
import { lazyWithReload as lazy } from './utils/lazyWithReload';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGate } from './components/RoleGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieBanner } from './components/CookieBanner';
import Seo from './seo/Seo';

/**
 * Head tags for pages without their own data (pages that load content — blog, guides —
 * render <Seo> themselves). Private and app pages are noindex.
 */
const page = (seo, element) => <><Seo {...seo} />{element}</>;
const PRIVATE = { noindex: true };

const Landing       = lazy(() => import('./pages/Landing'));
const PlanTrip      = lazy(() => import('./pages/PlanTrip'));
const Confirmation  = lazy(() => import('./pages/Confirmation'));
const Pricing       = lazy(() => import('./pages/Pricing'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const AgencyDashboard = lazy(() => import('./pages/AgencyDashboard'));
const ExplorePage   = lazy(() => import('./pages/ExplorePage'));
const Login         = lazy(() => import('./pages/Login'));
const Signup        = lazy(() => import('./pages/Signup'));
const Onboarding    = lazy(() => import('./pages/Onboarding'));
const Settings      = lazy(() => import('./pages/Settings'));
const PrivacyPolicy  = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ItineraryView  = lazy(() => import('./pages/ItineraryView'));
const NotFound       = lazy(() => import('./pages/NotFound'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminBlogPanel = lazy(() => import('./pages/AdminBlogPanel'));
const BlogListPage   = lazy(() => import('./pages/BlogListPage'));
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage'));
const Feedback       = lazy(() => import('./pages/Feedback'));
const Contact        = lazy(() => import('./pages/Contact'));
const GuidesIndex    = lazy(() => import('./pages/guides/GuidesIndex'));
const GuidePage      = lazy(() => import('./pages/guides/GuidePage'));

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#06090f' }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,212,170,0.15)', borderTopColor: '#00d4aa', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/"             element={page({ title: 'WanderZenAI — AI slow travel itinerary planner', description: 'Plan a slow trip with AI: fewer stops, longer stays, hidden cafés, village homestays and morning trails, mapped day by day. Free to start.', path: '/' }, <Landing />)} />
              <Route path="/login"        element={page({ title: 'Sign in', ...PRIVATE }, <Login />)} />
              <Route path="/signup"       element={page({ title: 'Create your account', ...PRIVATE }, <Signup />)} />
              <Route path="/onboarding"   element={page({ title: 'Welcome', ...PRIVATE }, <ProtectedRoute><Onboarding /></ProtectedRoute>)} />
              {/* Open to guests (Nov 2026): sign-in is asked for at Submit, on the Review step. */}
              <Route path="/plan"         element={page({ title: 'Plan a trip', ...PRIVATE }, <PlanTrip />)} />
              <Route path="/confirmation" element={page({ title: 'Your trip is on its way', ...PRIVATE }, <Confirmation />)} />
              <Route path="/pricing"      element={page({ title: 'Pricing', description: 'Start free, then pay per trip or join Wanderer for five AI slow travel itineraries a month. Simple, honest pricing with no lock-in.', path: '/pricing' }, <Pricing />)} />
              <Route path="/dashboard"    element={page({ title: 'Your trips', ...PRIVATE }, <ProtectedRoute><Dashboard /></ProtectedRoute>)} />
              <Route path="/agency"       element={page({ title: 'Agency', ...PRIVATE }, <AgencyDashboard />)} />
              <Route path="/admin"        element={page({ title: 'Admin', ...PRIVATE }, <RoleGate requiredRoles={['admin','superadmin','support']}><AdminDashboard /></RoleGate>)} />
              <Route path="/admin/blog"   element={page({ title: 'Blog admin', ...PRIVATE }, <RoleGate requiredRoles={['admin','superadmin']}><AdminBlogPanel /></RoleGate>)} />
              <Route path="/blog"         element={<BlogListPage />} />
              <Route path="/blog/:postId" element={<BlogDetailPage />} />
              <Route path="/explore"      element={page({ title: 'Explore slow travel destinations', description: 'Browse trending destinations and quieter places across every continent, then turn any of them into a slow, day-by-day itinerary.', path: '/explore' }, <ExplorePage />)} />
              <Route path="/guides"       element={<GuidesIndex />} />
              <Route path="/guides/:country" element={<GuidePage />} />
              <Route path="/settings"     element={page({ title: 'Settings', ...PRIVATE }, <ProtectedRoute><Settings /></ProtectedRoute>)} />
              <Route path="/itinerary/:id" element={page({ title: 'Your trip', ...PRIVATE }, <ItineraryView />)} />
              <Route path="/feedback"     element={page({ title: 'Feedback', description: 'Tell us what worked and what didn\'t on your WanderZenAI trip. We read every message.', path: '/feedback' }, <Feedback />)} />
              <Route path="/contact"      element={page({ title: 'Contact us', description: 'Questions about a trip, your account or working with WanderZenAI? Send us a message.', path: '/contact' }, <Contact />)} />
              <Route path="/privacy"      element={page({ title: 'Privacy policy', description: 'How WanderZenAI collects, uses and protects your data.', path: '/privacy' }, <PrivacyPolicy />)} />
              <Route path="/terms"        element={page({ title: 'Terms of service', description: 'The terms for using WanderZenAI.', path: '/terms' }, <TermsOfService />)} />
              <Route path="*"             element={page({ title: 'Page not found', ...PRIVATE }, <NotFound />)} />
            </Routes>
          </Suspense>
          <CookieBanner />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
