import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { useIsMobile } from '../../utils/useIsMobile';
import { inputFocusHandlers, hoverStyleHandlers } from '../../utils/styleHelpers';
import { SpinnerIcon, SendIcon } from '../Icons';
import { SOCIAL_LINKS, EMAIL_LINK } from '../../socialLinks';
import { colors, AnimatedSection, ThemeContext } from '../../App';
import Turnstile, { TurnstileHandle, TURNSTILE_SITE_KEY } from '../Turnstile';

const Contact: React.FC = () => {
  const isMobile = useIsMobile();
  const { theme } = useContext(ThemeContext);
  const contactCardBg = theme === 'dark' ? colors.techBg : colors.cardBg;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    message: '',
    website: ''
  });

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [formStartTime] = useState(Date.now());
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentTime = Date.now();
    const timeSinceStart = currentTime - formStartTime;
    const timeSinceLastSubmission = currentTime - lastSubmissionTime;

    if (timeSinceStart < 3000) {
      setSubmitStatus('error');
      setSubmitMessage('Please take a moment to review your message before submitting.');
      return;
    }

    if (timeSinceLastSubmission < 30000 && lastSubmissionTime > 0) {
      setSubmitStatus('error');
      setSubmitMessage('Please wait at least 30 seconds between submissions.');
      return;
    }

    if (formData.website) {
      setSubmitStatus('error');
      setSubmitMessage('Spam detected. Please try again.');
      return;
    }

    if (!turnstileToken) {
      setSubmitStatus('error');
      setSubmitMessage(TURNSTILE_SITE_KEY
        ? 'Please wait for the spam check below to finish, then send again.'
        : 'The contact form is temporarily unavailable. Please reach out on LinkedIn instead.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setLastSubmissionTime(currentTime);

    try {
      const API_URL = process.env.NODE_ENV === 'production'
        ? '/api/contact'
        : 'http://localhost:3001/api/contact';

      const submitData = {
        name: formData.name,
        subject: formData.subject,
        message: formData.message,
        website: formData.website,
        turnstileToken,
        formStartTime: formStartTime
      };

      const response = await axios.post(API_URL, submitData);

      setSubmitStatus('success');
      setSubmitMessage(response.data.message || 'Message sent successfully! I\'ll get back to you soon.');

      setFormData({
        name: '',
        subject: '',
        message: '',
        website: ''
      });
      turnstileRef.current?.reset();
    } catch (error: any) {
      setSubmitStatus('error');
      const errorMessage = error.response?.data?.message || 'Failed to send message. Please try again.';
      setSubmitMessage(errorMessage);
      console.error('Error sending message:', error);
      // Turnstile tokens are single-use, so every attempt needs a fresh one.
      turnstileRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div
      className="contact-container"
      style={{
        minHeight: '100vh',
        backgroundColor: colors.mainBg,
        color: colors.primaryText,
        paddingTop: isMobile ? '100px' : '120px',
        paddingBottom: isMobile ? '60px' : '100px',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <div style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: isMobile ? '0 16px' : '0 clamp(240px, 15vw, 720px)',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}>
        {/* Header */}
        <AnimatedSection direction="up" delay={200}>
          <div style={{
            textAlign: 'center',
            marginBottom: '40px',
            marginTop: isMobile ? '20px' : '30px'
          }}>
            <h1 style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              color: colors.primaryText,
              fontWeight: '700',
              marginBottom: '20px',
              letterSpacing: '-1px'
            }}>
              Get In Touch
            </h1>
            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: colors.secondaryText,
              lineHeight: '1.6',
              maxWidth: '700px',
              margin: '0 auto',
              padding: '0 20px',
              fontWeight: '400'
            }}>
              Have a project in mind or want to collaborate? I'd love to hear from you!
            </p>
          </div>
        </AnimatedSection>

        {/* Main Content Grid */}
        <AnimatedSection direction="up" delay={400}>
          <div
            className="contact-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: isMobile ? '20px' : '32px',
              maxWidth: isMobile ? '100%' : '840px',
              margin: '0 auto',
              width: '100%'
            }}
          >
          {/* Contact Form */}
          <div style={{
            backgroundColor: contactCardBg,
            borderRadius: '12px',
            border: `1px solid ${colors.borderColor}`,
            padding: isMobile ? '16px' : 'clamp(20px, 3.5vw, 40px)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}>
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: colors.primaryText,
                marginBottom: '8px'
              }}>
                Send me a message
              </h2>
              <p style={{
                fontSize: '0.95rem',
                fontWeight: '400',
                color: colors.secondaryText,
                lineHeight: '1.5'
              }}>
                Fill out the form below and I'll get back to you as soon as possible. Be sure to include your contact details!
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div>
                <label htmlFor="contact-name" style={{
                  display: 'block',
                  color: colors.primaryText,
                  marginBottom: '8px',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}>
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: colors.lightBg,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '8px',
                    color: colors.primaryText,
                    fontSize: '0.95rem',
                    transition: 'all 0.3s ease'
                  }}
                  placeholder="John Doe"
                  {...inputFocusHandlers(colors.accentText, colors.accentHover, colors.borderColor)}
                />
              </div>
              <div>
                <label htmlFor="contact-subject" style={{
                  display: 'block',
                  color: colors.primaryText,
                  marginBottom: '8px',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}>
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: colors.lightBg,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '8px',
                    color: colors.primaryText,
                    fontSize: '0.95rem',
                    transition: 'all 0.3s ease'
                  }}
                  placeholder="Project Inquiry"
                  {...inputFocusHandlers(colors.accentText, colors.accentHover, colors.borderColor)}
                />
              </div>

              <div>
                <label htmlFor="contact-message" style={{
                  display: 'block',
                  color: colors.primaryText,
                  marginBottom: '8px',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}>
                  Message
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: colors.lightBg,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '8px',
                    color: colors.primaryText,
                    fontSize: '0.95rem',
                    resize: 'vertical',
                    transition: 'all 0.3s ease',
                    minHeight: '80px'
                  }}
                  placeholder="I'd like to discuss a project opportunity..."
                  {...inputFocusHandlers(colors.accentText, colors.accentHover, colors.borderColor)}
                />
              </div>

              {/* Honeypot field - hidden from users but visible to bots */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <label>Website (leave blank):</label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Spam check: Cloudflare Turnstile, usually finishes without any interaction */}
              {TURNSTILE_SITE_KEY && (
                <Turnstile
                  ref={turnstileRef}
                  action="contact"
                  theme={theme === 'dark' ? 'dark' : 'light'}
                  onToken={setTurnstileToken}
                  onError={(message) => {
                    setSubmitStatus('error');
                    setSubmitMessage(message);
                  }}
                />
              )}

              {/* Status Message */}
              {submitStatus !== 'idle' && (
                <div role="alert" style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  backgroundColor: submitStatus === 'success'
                    ? colors.accentHover
                    : 'rgba(220, 53, 69, 0.1)',
                  color: submitStatus === 'success'
                    ? colors.accentText
                    : (theme === 'dark' ? '#f5a5a5' : '#721c24'),
                  border: `1px solid ${submitStatus === 'success'
                    ? colors.accentText
                    : (theme === 'dark' ? '#f5a5a5' : '#721c24')}`
                }}>
                  {submitMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  transition: 'all 0.3s ease',
                  padding: '14px 24px',
                  borderRadius: '8px',
                  backgroundColor: isSubmitting ? colors.mutedText : colors.buttonPrimary,
                  color: colors.white,
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  opacity: isSubmitting ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    (e.target as HTMLElement).style.backgroundColor = colors.buttonHover;
                    (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    (e.target as HTMLElement).style.backgroundColor = colors.buttonPrimary;
                    (e.target as HTMLElement).style.transform = 'translateY(0)';
                  }
                }}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
                {isSubmitting ? <SpinnerIcon size={18} /> : <SendIcon size={18} />}
              </button>
            </form>
          </div>

          {/* Contact Links Card */}
          <div style={{
            backgroundColor: contactCardBg,
            borderRadius: '12px',
            border: `1px solid ${colors.borderColor}`,
            padding: isMobile ? '16px' : 'clamp(20px, 3.5vw, 40px)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            height: 'fit-content'
          }}>
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: colors.primaryText,
                marginBottom: '8px'
              }}>
                Connect with me
              </h2>
              <p style={{
                fontSize: '0.95rem',
                fontWeight: '400',
                color: colors.secondaryText,
                lineHeight: '1.5'
              }}>
                You can also reach out to me directly through these channels
              </p>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {[...SOCIAL_LINKS, EMAIL_LINK].map(({ href, label, subtitle, icon: Icon, external }) => (
                <a
                  key={label}
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px',
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '8px',
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                    backgroundColor: colors.lightBg
                  }}
                  {...hoverStyleHandlers(
                    { backgroundColor: colors.accentHover, transform: 'translateY(-2px)' },
                    { backgroundColor: colors.lightBg, transform: 'translateY(0)' }
                  )}
                >
                  <div style={{
                    marginRight: '16px',
                    backgroundColor: colors.accentHover,
                    borderRadius: '50%',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={20} style={{ color: colors.accentText }} />
                  </div>
                  <div>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: colors.primaryText,
                      marginBottom: '4px'
                    }}>
                      {label}
                    </h4>
                    <p style={{
                      fontSize: '0.85rem',
                      fontWeight: '400',
                      color: colors.secondaryText,
                      margin: 0
                    }}>
                      {subtitle}
                    </p>
                  </div>
                </a>
              ))}

              {/* Location */}
              <div style={{
                marginTop: '20px',
                paddingTop: '20px',
                borderTop: `1px solid ${colors.borderColor}`
              }}>
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: colors.primaryText,
                  marginBottom: '8px'
                }}>
                  Current Location
                </h4>
                <p style={{
                  fontSize: '0.85rem',
                  fontWeight: 'normal',
                  color: colors.secondaryText,
                  margin: 0
                }}>
                  Singapore
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Responsive Adjustments */}
        <style>
          {`
            /* General responsive adjustments */
            .contact-container {
              padding: 0 20px !important;
              padding-top: 120px !important;
              padding-bottom: 80px !important;
            }

            /* Tablet and mobile - single column */
            @media (max-width: 768px) {
              .contact-container {
                padding: 0 16px !important;
                padding-top: 100px !important;
                padding-bottom: 60px !important;
              }
              .contact-grid {
                grid-template-columns: 1fr !important;
                gap: 24px !important;
                max-width: 600px !important;
              }
            }

            /* Mobile adjustments */
            @media (max-width: 480px) {
              .contact-container {
                padding: 0 12px !important;
                padding-top: 80px !important;
                padding-bottom: 40px !important;
              }
              .contact-grid {
                gap: 20px !important;
              }
            }

            /* Scoped fixes for contact page only */
            .contact-container input,
            .contact-container textarea,
            .contact-container button,
            .contact-container select,
            .contact-container div,
            .contact-container a {
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
          `}
        </style>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default Contact;
