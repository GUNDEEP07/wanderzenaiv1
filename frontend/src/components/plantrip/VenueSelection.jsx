// frontend/src/components/plantrip/VenueSelection.jsx
import { useState, useEffect } from 'react';
import { ActivityGrid } from './subcomponents/ActivityGrid';
import { ActivityTabs } from './subcomponents/ActivityTabs';
import { YouTubeCarousel } from './subcomponents/YouTubeCarousel';
import { VenuesList } from './subcomponents/VenuesList';
import { CustomInterestModal } from './subcomponents/CustomInterestModal';
import { getUserLocationFromIP } from '../../utils/geolocation';
import { fetchTrendingVideos } from '../../utils/youtube';
import { fetchVenuesForActivity } from '../../utils/foursquare';
import './styles/venueselection-redesign.css';

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife'];

export function VenueSelection({ destination, onSubmit, onSkip }) {
  const [selectedActivities, setSelectedActivities] = useState([]);
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

  // Fetch YouTube + Foursquare data for preset activities
  useEffect(() => {
    if (!loading && PRESET_ACTIVITIES.length > 0) {
      PRESET_ACTIVITIES.forEach(activity => {
        if (!youtubeVideos[activity]) {
          fetchActivityContent(activity);
        }
      });
    }
  }, [loading]);

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
    if (selectedActivities.includes(activity)) {
      const updated = selectedActivities.filter(a => a !== activity);
      setSelectedActivities(updated);
      if (activeTab === activity) {
        setActiveTab(updated.length > 0 ? updated[0] : null);
      }
    } else {
      const updated = [...selectedActivities, activity];
      setSelectedActivities(updated);
      if (!activeTab) {
        setActiveTab(activity);
      }
      // Fetch content for newly selected activity if not cached
      if (!youtubeVideos[activity] || !foursquareVenues[activity]) {
        fetchActivityContent(activity);
      }
    }
  };

  const handleCustomActivitySubmit = async (activityName) => {
    if (!selectedActivities.includes(activityName)) {
      const updated = [...selectedActivities, activityName];
      setSelectedActivities(updated);
      setActiveTab(activityName);
      setShowCustomModal(false);
      await fetchActivityContent(activityName);
    }
  };

  const handleVenueToggle = (venueId) => {
    const activeActivity = activeTab;
    setSelectedVenues(prev => {
      const activityVenues = prev[activeActivity] || new Set();
      const updated = new Set(activityVenues);
      if (updated.has(venueId)) {
        updated.delete(venueId);
      } else {
        updated.add(venueId);
      }
      return { ...prev, [activeActivity]: updated };
    });
  };

  const handleContinue = () => {
    const venueData = {};
    Object.entries(selectedVenues).forEach(([activity, venues]) => {
      venueData[activity] = Array.from(venues);
    });
    onSubmit(venueData);
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

      <div className="venue-selection-content">
        {/* Activity Grid */}
        <ActivityGrid
          selectedActivities={selectedActivities}
          onActivityToggle={handleActivityToggle}
          onOpenCustomModal={() => setShowCustomModal(true)}
        />

        {/* Activity Tabs */}
        {selectedActivities.length > 0 && (
          <ActivityTabs
            selectedActivities={selectedActivities}
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
          disabled={selectedActivities.length === 0}
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
