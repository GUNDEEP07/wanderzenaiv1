import { useState, useEffect } from 'react';
import { ActivityGrid } from './subcomponents/ActivityGrid';
import { ActivityTabs } from './subcomponents/ActivityTabs';
import { YouTubeCarousel } from './subcomponents/YouTubeCarousel';
import { VenuesList } from './subcomponents/VenuesList';
import { CustomInterestModal } from './subcomponents/CustomInterestModal';
import { DestinationInsightsPanel } from './subcomponents/DestinationInsightsPanel';
import { getUserLocationFromIP } from '../../utils/geolocation';
import { fetchTrendingVideos } from '../../utils/youtube';
import { fetchVenuesForActivity, getActivitiesForTravelStyle } from '../../utils/foursquare';
import './styles/venueselection-redesign.css';

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife', 'Wellness'];

export function VenueSelection({ destinations, travelStyles, startDate, endDate, days = 5, onSubmit, onSkip, onBack }) {
  const [selectedDestination, setSelectedDestination] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [youtubeVideos, setYoutubeVideos] = useState({});
  const [foursquareVenues, setFoursquareVenues] = useState({});
  const [selectedVenues, setSelectedVenues] = useState({});
  const [dayAssignments, setDayAssignments] = useState({});
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState({});
  const [venueLoading, setVenueLoading] = useState({});
  const [countryCode, setCountryCode] = useState('US');
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const destination = destinations?.[selectedDestination];
  const destKey = destination?.name || `destination_${selectedDestination}`;
  const currentActivities = selectedActivities[destKey] || [];
  const availableActivities = travelStyles?.length > 0
    ? getActivitiesForTravelStyle(travelStyles)
    : PRESET_ACTIVITIES;

  useEffect(() => {
    getUserLocationFromIP()
      .then(loc => { setCountryCode(loc.countryCode); setLoading(false); })
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
        fetchActivityContent(activity);
      }
      return { ...prev, [destKey]: updated };
    });
  };

  const handleDayAssign = (nameOrId, day) => {
    setDayAssignments(prev => ({ ...prev, [nameOrId]: day }));
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

  const handleContinue = () => {
    const venueData = {};
    Object.entries(selectedVenues).forEach(([key, venues]) => {
      venueData[key] = Array.from(venues);
    });
    onSubmit({ activities: selectedActivities, venues: venueData, dayAssignments });
  };

  if (loading) {
    return (
      <div className="venue-loading">
        <div>Detecting your location…</div>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const selectedCount = Object.values(selectedActivities).flat().length +
    Object.values(selectedVenues).reduce((s, set) => s + set.size, 0);
  const scheduledCount = Object.keys(dayAssignments).length;

  return (
    <>
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

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', padding: '0 14px 16px 24px', position: 'relative', zIndex: 1 }}>
            {destination && startDate && endDate && (
              <DestinationInsightsPanel
                destination={destination}
                travelStyles={travelStyles}
                startDate={startDate}
                endDate={endDate}
                selectedActivities={currentActivities}
                onActivityToggle={handleActivityToggle}
                onInsightsLoaded={setAiSuggestions}
                onDayAssign={handleDayAssign}
                days={days}
              />
            )}
          </div>

          {destinations?.length > 1 && (
            <div className="venue-dest-tabs">
              {destinations.map((dest, idx) => (
                <button
                  key={dest.name}
                  className={`venue-dest-tab${selectedDestination === idx ? ' venue-dest-tab--active' : ''}`}
                  onClick={() => { setSelectedDestination(idx); setActiveTab(null); setAiSuggestions([]); }}
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
            {aiSuggestions.length > 0 && (
              <div className="venue-picks-scroll">
                <div className="venue-picks-label">
                  <span className="venue-picks-label__text">AI Picks — tap to add</span>
                  <div className="venue-picks-label__line"></div>
                </div>
                <div className="venue-chips">
                  {aiSuggestions.map((thing, idx) => (
                    <button
                      key={idx}
                      className={`venue-chip--teal${currentActivities.includes(thing.name) ? ' venue-chip--selected' : ''}`}
                      onClick={() => handleActivityToggle(thing.name)}
                    >
                      {thing.emoji} {thing.name}
                    </button>
                  ))}
                </div>
              </div>
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
            />

            {currentActivities.length > 0 && (
              <ActivityTabs
                selectedActivities={currentActivities}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab && (
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
          </div>

          <div className="venue-footer">
            <button className="venue-footer__skip" onClick={onBack}>← Back</button>
            <div className="venue-footer__count">
              <b>{selectedCount}</b> selected{scheduledCount > 0 && <> · <b>{scheduledCount}</b> scheduled</>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="venue-footer__skip" onClick={onSkip}>Skip</button>
              <button
                className="venue-footer__continue"
                onClick={handleContinue}
              >
                Continue →
              </button>
            </div>
          </div>
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
