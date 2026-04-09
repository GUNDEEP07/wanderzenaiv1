import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Landing = lazy(() => import('./pages/Landing'));
const PlanTrip = lazy(() => import('./pages/PlanTrip'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AgencyDashboard = lazy(() => import('./pages/AgencyDashboard'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <div className="wz-spinner" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/plan" element={<PlanTrip />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agency" element={<AgencyDashboard />} />
          <Route path="/explore" element={<ExplorePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
