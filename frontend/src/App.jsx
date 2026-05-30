import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

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

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#06090f' }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,212,170,0.15)', borderTopColor: '#00d4aa', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/"             element={<Landing />} />
            <Route path="/login"        element={<Login />} />
            <Route path="/signup"       element={<Signup />} />
            <Route path="/onboarding"   element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/plan"         element={<ProtectedRoute><PlanTrip /></ProtectedRoute>} />
            <Route path="/confirmation" element={<Confirmation />} />
            <Route path="/pricing"      element={<Pricing />} />
            <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/agency"       element={<AgencyDashboard />} />
            <Route path="/explore"      element={<ExplorePage />} />
            <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
