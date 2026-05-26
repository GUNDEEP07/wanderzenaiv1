import React, { useState } from 'react';

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
    bottom: 0,
    left: 0,
    right: 0,
    background: '#0a0f1e',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    padding: '24px 16px 32px',
    zIndex: 1000,
    maxHeight: '80vh',
    overflowY: 'auto',
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s ease',
  }),
  header: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '16px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  prompt: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '12px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    marginBottom: '16px',
    outline: 'none',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'space-between',
  },
  button: (variant) => ({
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
    background: variant === 'primary' ? '#00d4aa' : 'rgba(255,255,255,0.04)',
    color: variant === 'primary' ? '#0a0f1e' : '#fff',
  }),
};

export function CustomInterestModal({ destination, isOpen, onClose, onSubmit, loading }) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  const handleCancel = () => {
    setInput('');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <div
        style={s.overlay(isOpen)}
        onClick={handleCancel}
      />
      <div style={s.modal(isOpen)}>
        <div style={s.header}>Add Custom Interest</div>
        <div style={s.prompt}>What interests you in {destination}?</div>
        <input
          type="text"
          style={s.input}
          placeholder="e.g., Street Art, Photography"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
        />
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
}
