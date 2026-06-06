import { useState } from 'react';
import './Contact.css';

const navy = '#0a0f1e';
const navy3 = '#141d33';
const teal = '#00d4aa';
const border = 'rgba(255,255,255,0.08)';
const w60 = 'rgba(255,255,255,0.6)';
const w40 = 'rgba(255,255,255,0.4)';

export default function Contact() {
  const [inquiryType, setInquiryType] = useState('general');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    company: '',
    partnershipType: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    if (inquiryType === 'partnership' && !formData.company.trim()) {
      setError('Please enter your company name');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          inquiryType,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setFormData({ name: '', email: '', phone: '', subject: '', message: '', company: '', partnershipType: '' });
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        setError('Failed to send message. Please try again.');
      }
    } catch (err) {
      setError('Error sending message: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: navy, minHeight: '100vh', padding: '3rem 2rem', color: '#fff' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>
            Get in touch
          </h1>
          <p style={{ fontSize: '1.1rem', color: w40, lineHeight: 1.6 }}>
            Have questions? Want to partner with us? We'd love to hear from you.
          </p>
        </div>

        {/* Inquiry Type Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '2rem' }}>
          <button
            type="button"
            onClick={() => setInquiryType('general')}
            style={{
              padding: '1.25rem',
              borderRadius: 12,
              border: `1.5px solid ${inquiryType === 'general' ? teal : border}`,
              background: inquiryType === 'general' ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.02)',
              color: inquiryType === 'general' ? teal : w60,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬</div>
            General Inquiry
          </button>
          <button
            type="button"
            onClick={() => setInquiryType('partnership')}
            style={{
              padding: '1.25rem',
              borderRadius: 12,
              border: `1.5px solid ${inquiryType === 'partnership' ? teal : border}`,
              background: inquiryType === 'partnership' ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.02)',
              color: inquiryType === 'partnership' ? teal : w60,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🤝</div>
            Partnership Inquiry
          </button>
        </div>

        {/* Form Card */}
        <div style={{ background: navy3, border: `1px solid ${border}`, borderRadius: 16, padding: '2rem' }}>

          {submitted && (
            <div style={{ padding: '1rem', background: 'rgba(0,212,170,0.1)', border: `1px solid ${teal}`, borderRadius: 10, marginBottom: '1.5rem', color: teal, fontSize: '0.95rem' }}>
              ✓ Thank you for reaching out! We'll get back to you soon.
            </div>
          )}

          {error && (
            <div style={{ padding: '1rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.5)', borderRadius: 10, marginBottom: '1.5rem', color: '#ff6b6b', fontSize: '0.95rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>
                Full name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your name"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>
                Email address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Phone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>
                Phone number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 000-0000"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Company (for partnerships) */}
            {inquiryType === 'partnership' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>
                  Company name *
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Your company"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Partnership Type (for partnerships) */}
            {inquiryType === 'partnership' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#fff' }}>
                  Partnership type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {['API Integration', 'White Label', 'Affiliate', 'Content', 'Other'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.75rem', borderRadius: 8, border: `1px solid ${formData.partnershipType === type ? teal : border}`, background: formData.partnershipType === type ? 'rgba(0,212,170,0.08)' : 'transparent' }}>
                      <input
                        type="radio"
                        name="partnershipType"
                        value={type}
                        checked={formData.partnershipType === type}
                        onChange={handleChange}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.9rem' }}>{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Subject (for general inquiries) */}
            {inquiryType === 'general' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>
                  Subject
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="What is this about?"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Message */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>
                Message *
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder={inquiryType === 'partnership'
                  ? "Tell us about your partnership proposal..."
                  : "Your message..."}
                style={{
                  width: '100%',
                  minHeight: 160,
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: '0.8rem', color: w40, marginTop: '0.5rem' }}>
                {formData.message.length}/1000 characters
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.875rem 1.5rem',
                background: loading ? 'rgba(0,212,170,0.4)' : teal,
                color: navy,
                border: 'none',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </div>

        {/* Quick Contact Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
          <div style={{ background: 'rgba(0,212,170,0.08)', border: `1px solid ${teal}`, borderRadius: 12, padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: teal }}>📧 Email</div>
            <div style={{ fontSize: '0.9rem', color: w60 }}>contact@wanderzenai.com</div>
          </div>
          <div style={{ background: 'rgba(0,212,170,0.08)', border: `1px solid ${teal}`, borderRadius: 12, padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: teal }}>🌍 Website</div>
            <div style={{ fontSize: '0.9rem', color: w60 }}>www.wanderzenai.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}
