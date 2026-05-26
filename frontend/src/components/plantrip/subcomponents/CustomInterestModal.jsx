import React, { useState } from 'react';
import { createPortal } from 'react-dom';

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
    maxWidth: '420px',
    width: '90%',
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
    marginBottom: '24px',
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
    marginBottom: '24px',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
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

  const modalContent = (
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

  return createPortal(modalContent, document.body);
}
