import { useState, useEffect, useRef } from 'react';

/**
 * CountryFilter - Searchable dropdown for country filtering
 * Props:
 *   - onCountryChange: Callback function(country) when selection changes
 *   - selectedCountry: Currently selected country (or '' for no filter)
 *   - countries: Array of available countries (optional, will use default list)
 */
export function CountryFilter({ onCountryChange, selectedCountry = '', countries = [] }) {
  // Default country list (can be overridden by prop)
  const defaultCountries = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
    'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas',
    'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
    'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
    'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
    'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China',
    'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba',
    'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
    'East Timor', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
    'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
    'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
    'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
    'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
    'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan',
    'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'North Korea', 'South Korea',
    'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
    'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
    'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
    'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova',
    'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
    'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
    'Niger', 'Nigeria', 'North Macedonia', 'Norway', 'Oman', 'Pakistan',
    'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
    'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia',
    'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
    'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
    'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
    'Somalia', 'South Africa', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan',
    'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
    'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia',
    'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
    'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
    'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
  ];

  const countryList = countries.length > 0 ? countries : defaultCountries;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(selectedCountry);
  const [filtered, setFiltered] = useState(countryList);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Filter countries based on search term
  useEffect(() => {
    if (searchTerm === '') {
      setFiltered(countryList);
    } else {
      const lower = searchTerm.toLowerCase();
      setFiltered(countryList.filter((country) => country.toLowerCase().includes(lower)));
    }
  }, [searchTerm, countryList]);

  // Update search term when selected country changes externally
  useEffect(() => {
    setSearchTerm(selectedCountry);
  }, [selectedCountry]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (country) => {
    setSearchTerm(country);
    onCountryChange(country);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearchTerm('');
    onCountryChange('');
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '300px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          Country:
        </label>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search countries..."
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(0,212,170,0.1)',
              border: '1px solid rgba(0,212,170,0.3)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '14px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'all 0.2s ease',
              paddingRight: searchTerm ? '32px' : '12px',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,170,0.6)';
              e.currentTarget.style.background = 'rgba(0,212,170,0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,170,0.3)';
              e.currentTarget.style.background = 'rgba(0,212,170,0.1)';
            }}
          />

          {/* Clear button */}
          {searchTerm && (
            <button
              onClick={handleClear}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'rgba(0,212,170,0.6)',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#00d4aa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(0,212,170,0.6)';
              }}
            >
              ×
            </button>
          )}

          {/* Dropdown menu */}
          {isOpen && filtered.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'rgba(10,14,24,0.95)',
                border: '1px solid rgba(0,212,170,0.3)',
                borderRadius: '6px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
                backdropFilter: 'blur(8px)',
              }}
            >
              {filtered.map((country) => (
                <button
                  key={country}
                  onClick={() => handleSelect(country)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: country === selectedCountry ? 'rgba(0,212,170,0.2)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: country === selectedCountry ? '#00d4aa' : '#ffffff',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontWeight: country === selectedCountry ? '600' : '400',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0,212,170,0.15)';
                    e.currentTarget.style.color = '#00d4aa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = country === selectedCountry ? 'rgba(0,212,170,0.2)' : 'transparent';
                    e.currentTarget.style.color = country === selectedCountry ? '#00d4aa' : '#ffffff';
                  }}
                >
                  {country}
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {isOpen && filtered.length === 0 && searchTerm !== '' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'rgba(10,14,24,0.95)',
                border: '1px solid rgba(0,212,170,0.3)',
                borderRadius: '6px',
                padding: '12px',
                zIndex: 1000,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '13px',
              }}
            >
              No countries match "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
