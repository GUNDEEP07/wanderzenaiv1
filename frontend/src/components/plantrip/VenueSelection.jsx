import { useState, useEffect, useRef } from 'react';
const API_URL = import.meta.env.VITE_API_URL;
import { ActivityGrid } from './subcomponents/ActivityGrid';
import { ActivityTabs } from './subcomponents/ActivityTabs';
import { YouTubeCarousel } from './subcomponents/YouTubeCarousel';
import { VenuesList } from './subcomponents/VenuesList';
import { CustomInterestModal } from './subcomponents/CustomInterestModal';
import { DestinationInsightsPanel } from './subcomponents/DestinationInsightsPanel';
import { AccommodationSection } from './subcomponents/AccommodationSection';
import { getUserLocationFromIP } from '../../utils/geolocation';
import { fetchTrendingVideos } from '../../utils/youtube';
import { fetchVenuesForActivity, getActivitiesForTravelStyle } from '../../utils/foursquare';
import './styles/venueselection-redesign.css';

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife', 'Wellness'];

export function VenueSelection({ destinations, travelStyles, startDate, endDate, days = 5, onSubmit, onSkip, onBack, savedState, onSave, preferredActivities = [], currency = 'USD', budget = 0, userLocation = '' }) {
  const [activeMode, setActiveMode] = useState('experiences');
  const [detectedOriginCity, setDetectedOriginCity] = useState('');
  const [selectedDestination, setSelectedDestination] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState(() => savedState?.activities || {});
  const [activeTab, setActiveTab] = useState(() => savedState?.activeTab || null);
  const [youtubeVideos, setYoutubeVideos] = useState({});
  const [foursquareVenues, setFoursquareVenues] = useState({});
  const [selectedVenues, setSelectedVenues] = useState(() => {
    const raw = savedState?.venues || {};
    const result = {};
    Object.entries(raw).forEach(([k, arr]) => { result[k] = new Set(arr); });
    return result;
  });
  const [dayAssignments, setDayAssignments] = useState(() => savedState?.dayAssignments || {});
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState({});
  const [venueLoading, setVenueLoading] = useState({});
  const [countryCode, setCountryCode] = useState('US');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [destinationInsights, setDestinationInsights] = useState(null);

  const destination = destinations?.[selectedDestination];
  const destKey = destination?.name || `destination_${selectedDestination}`;

  // Default dates when user hasn't set travel dates yet — use 30 days from now
  const effectiveStartDate = startDate || (() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  })();
  const effectiveEndDate = endDate || (() => {
    const d = new Date(); d.setDate(d.getDate() + 30 + days);
    return d.toISOString().split('T')[0];
  })();
  const currentActivities = selectedActivities[destKey] || [];
  const availableActivities = travelStyles?.length > 0
    ? getActivitiesForTravelStyle(travelStyles)
    : PRESET_ACTIVITIES;

  useEffect(() => {
    getUserLocationFromIP()
      .then(loc => {
        setCountryCode(loc.countryCode);
        setLoading(false);
        // Use detected city as origin fallback if user hasn't set their home city
        if (!userLocation && loc.city && loc.city !== 'Unknown') {
          setDetectedOriginCity(`${loc.city}, ${loc.country}`);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchActivityContent = async (activity) => {
    if (!youtubeVideos[activity]) {
      setVideoLoading(prev => ({ ...prev, [activity]: true }));
      const videos = await fetchTrendingVideos(activity, destination, countryCode);
      setYoutubeVideos(prev => ({ ...prev, [activity]: videos }));
      setVideoLoading(prev => ({ ...prev, [activity]: false }));
    }
    if (!foursquareVenues[activity]) {
      setVenueLoading(prev => ({ ...prev, [activity]: true }));
      const venues = await fetchVenuesForActivity(activity, destination);
      setFoursquareVenues(prev => ({ ...prev, [activity]: venues }));
      setVenueLoading(prev => ({ ...prev, [activity]: false }));
    }
  };

  const handleActivityToggle = (activity) => {
    setSelectedActivities(prev => {
      const activities = prev[destKey] || [];
      let updated;
      if (activities.includes(activity)) {
        updated = activities.filter(a => a !== activity);
        if (activeTab === activity) setActiveTab(updated.length > 0 ? updated[0] : null);
      } else {
        updated = [...activities, activity];
        if (!activeTab) setActiveTab(activity);
        // Only search Foursquare/YouTube for generic categories, not AI-specific place names
        if (availableActivities.includes(activity)) {
          fetchActivityContent(activity);
        }
      }
      return { ...prev, [destKey]: updated };
    });
  };

  const handleDayAssign = (nameOrId, day) => {
    setDayAssignments(prev => ({ ...prev, [nameOrId]: day }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q || !destination?.lat) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams({
        query: q,
        destination: destination.name || '',
        lat: destination.lat.toString(),
        lng: destination.lng.toString(),
      });
      const res = await fetch(`${API_URL}/recommendations/venues?${params}`);
      const data = await res.json();
      const allVenues = (data.categories || []).flatMap(c => c.venues || []).map(v => ({
        id: v.fsq_id,
        name: v.name,
        category: v.category || q,
        rating: v.rating || null,
        reviewCount: v.reviewCount || 0,
        score: v.score || 0,
        address: v.address || '',
        source: v.source || 'foursquare',
        description: v.description || null,
        openingHours: v.openingHours || v.hours?.display || null,
        photoUrl: v.photoUrl || null,
        photos: v.photos || [],
        lat: v.lat || null,
        lng: v.lng || null,
        hours: v.hours || null,
        website: v.website || null,
        tel: v.tel || null,
        instagramUrl: v.instagramUrl || null,
        attributes: v.attributes || null,
      }));
      setSearchResults(allVenues);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCustomActivitySubmit = (activityName) => {
    setSelectedActivities(prev => {
      const activities = prev[destKey] || [];
      if (activities.includes(activityName)) return prev;
      setActiveTab(activityName);
      setShowCustomModal(false);
      fetchActivityContent(activityName);
      return { ...prev, [destKey]: [...activities, activityName] };
    });
  };

  const handleVenueToggle = (venueId) => {
    const venueKey = `${destKey}/${activeTab}`;
    setSelectedVenues(prev => {
      const existing = prev[venueKey] || new Set();
      const updated = new Set(existing);
      if (updated.has(venueId)) updated.delete(venueId);
      else updated.add(venueId);
      return { ...prev, [venueKey]: updated };
    });
  };

  const buildSnapshot = () => {
    const venueData = {};
    Object.entries(selectedVenues).forEach(([key, venues]) => { venueData[key] = Array.from(venues); });
    return { activities: selectedActivities, venues: venueData, dayAssignments, activeTab };
  };

  const handleContinue = () => {
    const snap = buildSnapshot();
    onSave?.(snap);
    onSubmit({ activities: snap.activities, venues: snap.venues, dayAssignments: snap.dayAssignments });
  };

  if (loading) {
    return (
      <div className="venue-loading">
        <div>Detecting your location…</div>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const selectedCount = Object.values(selectedActivities).flat().length +
    Object.values(selectedVenues).reduce((s, set) => s + set.size, 0);
  const scheduledCount = Object.keys(dayAssignments).length;

  return (
    <>
      {/* ── Mode tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 3, gap: 3 }}>
          {[
            { key: 'experiences', label: '🎯 Experiences' },
            { key: 'stays', label: '✈️ Stays & Flights' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveMode(key)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontFamily: 'inherit',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: activeMode === key ? 'rgba(0,212,170,0.15)' : 'transparent',
                color: activeMode === key ? '#00d4aa' : 'rgba(255,255,255,0.55)',
                transition: 'all 0.18s',
                boxShadow: activeMode === key ? '0 0 0 1px rgba(0,212,170,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {activeMode === 'experiences' && (
          <button
            type="button"
            onClick={() => setActiveMode('stays')}
            style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ✈️ Plan stays →
          </button>
        )}
      </div>

      {/* ── Stays & Flights tab (full width) ── */}
      {activeMode === 'stays' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px', scrollbarWidth: 'none', maxWidth: 720, margin: '0 auto', width: '100%' }}>
          <AccommodationSection
            destination={destination}
            insights={destinationInsights}
            budget={budget}
            currency={currency}
            days={days}
            travelStyle={travelStyles}
            alwaysOpen
          />
          {/* Always mount insights panel — uses default dates if user hasn't set travel dates */}
          {destination && (
            <div style={{ display: 'none' }}>
              <DestinationInsightsPanel
                destination={destination}
                travelStyles={travelStyles}
                startDate={effectiveStartDate}
                endDate={effectiveEndDate}
                selectedActivities={currentActivities}
                onActivityToggle={handleActivityToggle}
                onDayAssign={handleDayAssign}
                onFullInsightsLoaded={setDestinationInsights}
                days={days}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Experiences tab (split panel) ── */}
      {activeMode === 'experiences' && (
      <div className="venue-split">
        {/* LEFT PANEL */}
        <div className="venue-panel-left">
          <div className="venue-left-head">
            <div className="venue-eyebrow">Your journey awaits</div>
            <div className="venue-headline">
              What makes<br />you <em>come alive?</em>
            </div>
            {destination && (
              <div className="venue-dest-pill">
                <div className="venue-dest-pill__dot"></div>
                {destination.name}{startDate ? ` · ${days} days` : ''}
              </div>
            )}
          </div>

          {destinations?.length > 1 && (
            <div className="venue-dest-tabs">
              {destinations.map((dest, idx) => (
                <button
                  key={dest.name}
                  className={`venue-dest-tab${selectedDestination === idx ? ' venue-dest-tab--active' : ''}`}
                  onClick={() => { setSelectedDestination(idx); setActiveTab(null); }}
                >
                  {dest.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="venue-panel-right">
          <div className="venue-panel-right__scroll">
            {/* AI Suggestions — uses effective dates so panel always loads */}
            {destination && (
              <DestinationInsightsPanel
                destination={destination}
                travelStyles={travelStyles}
                startDate={effectiveStartDate}
                endDate={effectiveEndDate}
                selectedActivities={currentActivities}
                onActivityToggle={handleActivityToggle}
                onDayAssign={handleDayAssign}
                onFullInsightsLoaded={setDestinationInsights}
                days={days}
              />
            )}
            <div className="venue-sec-row">
              <div className="venue-sec-label">Explore by category</div>
              <div className="venue-sec-line"></div>
            </div>
            <ActivityGrid
              availableActivities={availableActivities}
              selectedActivities={currentActivities}
              onActivityToggle={handleActivityToggle}
              onOpenCustomModal={() => setShowCustomModal(true)}
              initialSelected={preferredActivities}
            />

            {/* Natural language search */}
            <form onSubmit={handleSearch} style={{ marginBottom: 20 }}>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '6px 6px 6px 14px',
                transition: 'border-color 0.2s',
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`e.g. top Indian restaurants near ${destination?.name || 'here'}`}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: '#fff', fontFamily: 'inherit', fontSize: 12,
                  }}
                />
                <button type="submit" disabled={searchLoading || !searchQuery.trim()} style={{
                  padding: '7px 14px', background: searchLoading ? 'rgba(255,255,255,0.08)' : '#00d4aa',
                  border: 'none', borderRadius: 8, color: '#06090f', fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 700, cursor: searchLoading ? 'not-allowed' : 'pointer',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                  {searchLoading ? '…' : 'Search'}
                </button>
              </div>
            </form>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="venue-sec-row">
                  <div className="venue-sec-label">🎯 Search results</div>
                  <div className="venue-sec-line"></div>
                </div>
                <VenuesList
                  key={searchQuery}
                  activity={searchQuery}
                  venues={searchResults}
                  selectedVenues={selectedVenues[`${destKey}/__search__/${searchQuery}`] || new Set()}
                  onVenueToggle={(venueId) => {
                    const venueKey = `${destKey}/__search__/${searchQuery}`;
                    setSelectedVenues(prev => {
                      const existing = prev[venueKey] || new Set();
                      const updated = new Set(existing);
                      if (updated.has(venueId)) updated.delete(venueId);
                      else updated.add(venueId);
                      return { ...prev, [venueKey]: updated };
                    });
                  }}
                  onDayAssign={handleDayAssign}
                  loading={false}
                  destination={destination}
                  days={days}
                  startDate={startDate}
                />
              </div>
            )}

            {currentActivities.length > 0 && (
              <ActivityTabs
                selectedActivities={currentActivities}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onActivityToggle={handleActivityToggle}
              />
            )}

            {activeTab && availableActivities.includes(activeTab) && (
              <>
                <div className="venue-sec-row" style={{ marginTop: 16 }}>
                  <div className="venue-sec-label">📺 {activeTab} — watch before you go</div>
                  <div className="venue-sec-line"></div>
                </div>
                <div className="yt-row">
                  <YouTubeCarousel
                    activity={activeTab}
                    destination={destination}
                    countryCode={countryCode}
                    videos={youtubeVideos[activeTab] || []}
                    loading={videoLoading[activeTab] || false}
                    isMobile={isMobile}
                  />
                </div>

                <VenuesList
                  activity={activeTab}
                  venues={foursquareVenues[activeTab] || []}
                  selectedVenues={selectedVenues[`${destKey}/${activeTab}`] || new Set()}
                  onVenueToggle={handleVenueToggle}
                  onDayAssign={handleDayAssign}
                  loading={venueLoading[activeTab] || false}
                  destination={destination}
                  days={days}
                  startDate={startDate}
                />
              </>
            )}

            {activeTab && !availableActivities.includes(activeTab) && (
              <div style={{ marginTop: 16, padding: '16px', background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00d4aa', marginBottom: 4 }}>{activeTab}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                  This is an AI-curated pick — already added to your itinerary.<br />
                  Assign it a day using the left panel.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── Footer (always visible) ── */}
      <div className="venue-footer">
        <button className="venue-footer__skip" onClick={() => { onSave?.(buildSnapshot()); onBack?.(); }}>← Back</button>
        <div className="venue-footer__count">
          <b>{selectedCount}</b> selected{scheduledCount > 0 && <> · <b>{scheduledCount}</b> scheduled</>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="venue-footer__skip" onClick={() => { onSave?.(buildSnapshot()); onSkip?.(); }}>Skip</button>
          <button
            className="venue-footer__continue"
            onClick={handleContinue}
          >
            Continue →
          </button>
        </div>
      </div>

      <CustomInterestModal
        destination={destination}
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSubmit={handleCustomActivitySubmit}
        loading={false}
      />
    </>
  );
}
