/**
 * CategoryFilter - Dropdown/button filter for blog post categories
 * Props:
 *   - onCategoryChange: Callback function(category) when selection changes
 *   - selectedCategory: Currently selected category (or 'all' for no filter)
 */
export function CategoryFilter({ onCategoryChange, selectedCategory = 'all' }) {
  const categories = [
    { value: 'all', label: 'All Posts' },
    { value: 'tips', label: 'Tips' },
    { value: 'adventure', label: 'Adventure' },
    { value: 'culture', label: 'Culture' },
    { value: 'food', label: 'Food' },
    { value: 'budget', label: 'Budget' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label
        style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        Category:
      </label>
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        style={{
          padding: '8px 12px',
          background: 'rgba(0,212,170,0.1)',
          border: '1px solid rgba(0,212,170,0.3)',
          borderRadius: '6px',
          color: '#ffffff',
          fontSize: '14px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          minWidth: '160px',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0,212,170,0.6)';
          e.currentTarget.style.background = 'rgba(0,212,170,0.15)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0,212,170,0.3)';
          e.currentTarget.style.background = 'rgba(0,212,170,0.1)';
        }}
      >
        {categories.map((cat) => (
          <option key={cat.value} value={cat.value} style={{ background: '#0a0e18', color: '#ffffff' }}>
            {cat.label}
          </option>
        ))}
      </select>
    </div>
  );
}
