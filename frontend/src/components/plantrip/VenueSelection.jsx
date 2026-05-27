// frontend/src/components/plantrip/VenueSelection.jsx
import { useState, useEffect } from 'react';
import { ActivityGrid } from './subcomponents/ActivityGrid';
import { ActivityTabs } from './subcomponents/ActivityTabs';
import { YouTubeCarousel } from './subcomponents/YouTubeCarousel';
import { VenuesList } from './subcomponents/VenuesList';
import { CustomInterestModal } from './subcomponents/CustomInterestModal';
import { getUserLocationFromIP } from '../../utils/geolocation';
import { fetchTrendingVideos } from '../../utils/youtube';
import { fetchVenuesForActivity, getActivitiesForTravelStyle } from '../../utils/foursquare';
import './styles/venueselection-redesign.css';

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife'];

export function VenueSelection({ destinations, travelStyles, onSubmit, onSkip }) {
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
  const [userLocation, setUserLocation] = useState(null);
  const [countryCode, setCountryCode] = useState('US');
  const [error, setError] = useState(null);

  const destination = destinations && destinations[selectedDestination];
  const destKey = destination?.name || `destination_${selectedDestination}`;
  const currentActivities = selectedActivities[destKey] || [];

  // Determine which activities to show based on travel styles
  const availableActivities = travelStyles && travelStyles.length > 0
    ? getActivitiesForTravelStyle(travelStyles)
    : PRESET_ACTIVITIES;

  console.log('[VenueSelection] travelStyles:', travelStyles);
  console.log('[VenueSelection] availableActivities:', availableActivities);

  // Fetch user IP location on mount
  useEffect(() => {
    const fetchUserLocation = async () => {
      const location = await getUserLocationFromIP();
      setUserLocation(location);
      setCountryCode(location.countryCode);
      setLoading(false);
    };
    fetchUserLocation();
  }, []);


  const fetchActivityContent = async (activity) => {
    // Fetch YouTube
    if (!youtubeVideos[activity]) {
      setVideoLoading(prev => ({ ...prev, [activity]: true }));
      const videos = await fetchTrendingVideos(activity, destination, countryCode);
      setYoutubeVideos(prev => ({ ...prev, [activity]: videos }));
      setVideoLoading(prev => ({ ...prev, [activity]: false }));
    }

    // Fetch Foursquare
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
        if (activeTab === activity) {
          setActiveTab(updated.length > 0 ? updated[0] : null);
        }
      } else {
        updated = [...activities, activity];
        if (!activeTab) {
          setActiveTab(activity);
        }
        if (!youtubeVideos[activity] || !foursquareVenues[activity]) {
          fetchActivityContent(activity);
        }
      }
      return { ...prev, [destKey]: updated };
    });
  };

  const handleCustomActivitySubmit = async (activityName) => {
    setSelectedActivities(prev => {
      const activities = prev[destKey] || [];
      if (!activities.includes(activityName)) {
        const updated = [...activities, activityName];
        setActiveTab(activityName);
        setShowCustomModal(false);
        fetchActivityContent(activityName);
        return { ...prev, [destKey]: updated };
      }
      return prev;
    });
  };

  const handleVenueToggle = (venueId) => {
    const activeActivity = activeTab;
    const venueKey = `${destKey}/${activeActivity}`;
    setSelectedVenues(prev => {
      const activityVenues = prev[venueKey] || new Set();
      const updated = new Set(activityVenues);
      if (updated.has(venueId)) {
        updated.delete(venueId);
      } else {
        updated.add(venueId);
      }
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
        <div>Detecting your location...</div>
      </div>
    );
  }

  // Detect mobile vs desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600;

  return (
    <>
    <div className="venue-selection-redesign">
      <div className="venue-selection-header">
        <div className="step-label">STEP 2 OF 6</div>
        <h2>What gets you excited?</h2>
        <p>Pick your passions to discover amazing spots</p>
      </div>

      {destinations && destinations.length > 1 && (
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {destinations.map((dest, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedDestination(idx);
                setActiveTab(null);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: selectedDestination === idx ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.2)',
                background: selectedDestination === idx ? 'rgba(0,212,170,0.15)' : 'transparent',
                color: selectedDestination === idx ? '#00d4aa' : 'rgba(255,255,255,0.6)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {dest.name}
            </button>
          ))}
        </div>
      )}

      <div className="venue-selection-content">
        {/* Activity Grid */}
        <ActivityGrid
          availableActivities={availableActivities}
          selectedActivities={currentActivities}
          onActivityToggle={handleActivityToggle}
          onOpenCustomModal={() => setShowCustomModal(true)}
        />

        {/* Activity Tabs */}
        {currentActivities.length > 0 && (
          <ActivityTabs
            selectedActivities={currentActivities}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}

        {/* YouTube Carousel */}
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

            {/* Venues List */}
            <VenuesList
              activity={activeTab}
              venues={foursquareVenues[activeTab] || []}
              selectedVenues={selectedVenues[activeTab] || new Set()}
              onVenueToggle={handleVenueToggle}
              loading={venueLoading[activeTab] || false}
              destination={destination}
            />
          </>
        )}

        {error && (
          <div className="venue-selection-error">{error}</div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="venue-selection-footer">
        <button className="btn-skip" onClick={onSkip}>
          Skip
        </button>
        <button
          className="btn-continue"
          onClick={handleContinue}
          disabled={Object.values(selectedActivities).every(arr => arr.length === 0)}
        >
          Continue →
        </button>
      </div>

    </div>

    {/* Custom Interest Modal - Uses React Portal to render at document body */}
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
