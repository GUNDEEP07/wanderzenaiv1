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

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife'];

export function VenueSelection({ destinations, travelStyles, startDate, endDate, onSubmit, onSkip }) {
  const [selectedDestination, setSelectedDestination] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [youtubeVideos, setYoutubeVideos] = useState({});
  const [foursquareVenues, setFoursquareVenues] = useState({});
  const [selectedVenues, setSelectedVenues] = useState({});
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
    getUserLocationFromIP().then(loc => {
      setCountryCode(loc.countryCode);
      setLoading(false);
    });
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
    onSubmit({ activities: selectedActivities, venues: venueData });
  };

  if (loading) {
    return (
      <div className="venue-selection-redesign venue-selection-loading">
        <div>Detecting your location…</div>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <>
      <div className="venue-selection-redesign">
        <div className="venue-selection-header">
          <div className="step-label">STEP 2 OF 6</div>
          <h2>What gets you excited?</h2>
          <p>Pick your passions to discover amazing spots</p>
        </div>

        {destinations?.length > 1 && (
          <div className="venue-dest-tabs">
            {destinations.map((dest, idx) => (
              <button
                key={idx}
                className={`venue-dest-tab${selectedDestination === idx ? ' venue-dest-tab--active' : ''}`}
                onClick={() => { setSelectedDestination(idx); setActiveTab(null); }}
              >
                {dest.name}
              </button>
            ))}
          </div>
        )}

        <div className="venue-split">
          <div className="venue-panel-left">
            {destination && startDate && endDate && (
              <DestinationInsightsPanel
                destination={destination}
                travelStyles={travelStyles}
                startDate={startDate}
                endDate={endDate}
                selectedActivities={currentActivities}
                onActivityToggle={handleActivityToggle}
                onInsightsLoaded={setAiSuggestions}
              />
            )}
          </div>

          <div className="venue-panel-right">
            {aiSuggestions.length > 0 && (
              <div className="ai-chip-row">
                <div className="ai-chip-row__label">AI Picks — tap to add</div>
                <div className="ai-chip-row__chips">
                  {aiSuggestions.map((thing, idx) => (
                    <button
                      key={idx}
                      className={`ai-chip${currentActivities.includes(thing.name) ? ' ai-chip--selected' : ''}`}
                      onClick={() => handleActivityToggle(thing.name)}
                    >
                      {thing.emoji} {thing.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="venue-browse-label">Or Browse All</div>

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
                <YouTubeCarousel
                  activity={activeTab}
                  destination={destination}
                  countryCode={countryCode}
                  videos={youtubeVideos[activeTab] || []}
                  loading={videoLoading[activeTab] || false}
                  isMobile={isMobile}
                />
                <VenuesList
                  activity={activeTab}
                  venues={foursquareVenues[activeTab] || []}
                  selectedVenues={selectedVenues[`${destKey}/${activeTab}`] || new Set()}
                  onVenueToggle={handleVenueToggle}
                  loading={venueLoading[activeTab] || false}
                  destination={destination}
                />
              </>
            )}
          </div>
        </div>

        <div className="venue-selection-footer">
          <button className="btn-skip" onClick={onSkip}>Skip</button>
          <button
            className="btn-continue"
            onClick={handleContinue}
            disabled={Object.values(selectedActivities).every(arr => arr.length === 0)}
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
