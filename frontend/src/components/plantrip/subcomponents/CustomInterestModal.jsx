import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const API_URL = import.meta.env.VITE_API_URL;

const s = {
  overlay: (isOpen) => ({
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 999,
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? 'auto' : 'none',
    transition: 'opacity 0.3s ease',
  }),
  modal: (isOpen) => ({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: isOpen ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.9)',
    background: '#0a0f1e',
    borderRadius: '16px',
    padding: '32px 28px',
    zIndex: 1000,
    maxWidth: '480px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(0,212,170,0.2)',
    opacity: isOpen ? 1 : 0,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: isOpen ? 'auto' : 'none',
  }),
  header: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    textAlign: 'center',
  },
  prompt: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '20px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(0,212,170,0.2)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    marginBottom: '20px',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  categoriesLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '12px',
    fontWeight: '600',
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '10px',
    marginBottom: '24px',
  },
  categoryTag: (isSelected) => ({
    padding: '10px 12px',
    borderRadius: '8px',
    border: isSelected ? 'none' : '1px solid rgba(0,212,170,0.3)',
    background: isSelected ? '#00d4aa' : 'rgba(0,212,170,0.1)',
    color: isSelected ? '#0a0f1e' : '#00d4aa',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }),
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'space-between',
  },
  button: (variant) => ({
    flex: 1,
    padding: '13px 20px',
    borderRadius: '10px',
    border: variant === 'primary' ? 'none' : '1px solid rgba(255,255,255,0.15)',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    background: variant === 'primary' ? '#00d4aa' : 'rgba(255,255,255,0.05)',
    color: variant === 'primary' ? '#0a0f1e' : 'rgba(255,255,255,0.8)',
  }),
};

export function CustomInterestModal({ destination, isOpen, onClose, onSubmit, loading }) {
  const [input, setInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  useEffect(() => {
    if (isOpen && allCategories.length === 0) {
      fetchCategories();
    }
    if (!isOpen) {
      setInput('');
      setSelectedCategory(null);
      setFilteredCategories([]);
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch(`${API_URL}/recommendations/categories`);
      if (response.ok) {
        const data = await response.json();
        setAllCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleInputChange = (query) => {
    setInput(query);
    setSelectedCategory(null);

    if (query.trim().length === 0) {
      setFilteredCategories([]);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = allCategories.filter(cat =>
        cat.name.toLowerCase().includes(lowerQuery) ||
        cat.label.toLowerCase().includes(lowerQuery)
      );
      setFilteredCategories(filtered);
    }
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setInput(category);
    setFilteredCategories([]);
  };

  const handleSubmit = () => {
    const finalInput = selectedCategory || input.trim();
    if (finalInput) {
      onSubmit(finalInput);
      setInput('');
      setSelectedCategory(null);
    }
  };

  const handleCancel = () => {
    setInput('');
    setSelectedCategory(null);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const modalContent = (
    <>
      <div
        style={s.overlay(isOpen)}
        onClick={handleCancel}
      />
      <div style={s.modal(isOpen)}>
        <div style={s.header}>Add Custom Interest</div>
        <div style={s.prompt}>What interests you in {destination?.name}?</div>

        <input
          type="text"
          style={s.input}
          placeholder="Search categories or type something custom..."
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
        />

        {(categoriesLoading || filteredCategories.length > 0) && (
          <div style={s.categoriesLabel}>Matching Categories</div>
        )}

        {categoriesLoading && input.trim().length > 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '12px' }}>
            Searching...
          </div>
        )}

        {filteredCategories.length > 0 && (
          <div style={s.categoriesGrid}>
            {filteredCategories.map(category => (
              <button
                key={category.id}
                style={s.categoryTag(selectedCategory === category.label)}
                onClick={() => handleCategoryClick(category.label)}
                disabled={loading}
                title={category.label}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
        <div style={s.buttons}>
          <button
            style={s.button('secondary')}
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            style={s.button('primary')}
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
          >
            {loading ? 'Adding...' : 'Add Interest'}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
