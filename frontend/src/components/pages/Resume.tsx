import React, { useEffect } from 'react';
import { useIsMobile } from '../../utils/useIsMobile';
import { hoverStyleHandlers } from '../../utils/styleHelpers';
import { OpenInNewIcon } from '../Icons';
import { colors, AnimatedSection } from '../../App';

// Android Chrome (and some in-app browsers) cannot render a PDF inside an iframe and show a blank box.
// navigator.pdfViewerEnabled is false there; older browsers without the property keep the iframe.
const canEmbedPdf = () =>
  typeof navigator === 'undefined' ||
  (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;

const Resume: React.FC = () => {
  const isMobile = useIsMobile();
  const embedPdf = canEmbedPdf();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.mainBg,
      color: colors.primaryText,
      paddingTop: isMobile ? '100px' : '120px',
      paddingBottom: isMobile ? '60px' : '80px',
      width: '100%',
      overflowX: 'hidden'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '0 20px' : '0 20px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <AnimatedSection direction="up" delay={200}>
          <div style={{
            textAlign: 'center',
            marginBottom: '40px'
          }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            color: colors.primaryText,
            fontWeight: '700',
            marginBottom: '20px',
            letterSpacing: '-1px'
          }}>
            Resume
          </h1>
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            fontWeight: '400',
            color: colors.secondaryText,
            lineHeight: '1.6',
            maxWidth: '700px',
            margin: '0 auto',
            marginBottom: '30px'
          }}>
            View my resume below or open it in a new tab
          </p>

          {/* View Resume Button */}
          <a
            href="/resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: colors.buttonPrimary,
              color: colors.white,
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: '500',
              fontSize: '0.95rem',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
            {...hoverStyleHandlers(
              { backgroundColor: colors.buttonHover, transform: 'translateY(-1px)' },
              { backgroundColor: colors.buttonPrimary, transform: 'translateY(0)' }
            )}
          >
            <OpenInNewIcon size={18} />
            View Resume
          </a>
        </div>
        </AnimatedSection>

        {/* PDF Viewer */}
        <AnimatedSection direction="up" delay={400}>
          <div style={{
            backgroundColor: colors.cardBg,
            borderRadius: '12px',
            border: `1px solid ${colors.borderColor}`,
            padding: '20px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minHeight: embedPdf ? (isMobile ? '500px' : '800px') : undefined
          }}>
          {embedPdf ? (
          <iframe
            src="/resume.pdf#toolbar=1&navpanes=1&scrollbar=1"
            style={{
              width: '100%',
              height: isMobile ? '500px' : '800px',
              border: 'none',
              borderRadius: '8px'
            }}
            title="Resume PDF"
          />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '32px 8px'
            }}>
              <p style={{ margin: 0, color: colors.secondaryText, textAlign: 'center' }}>
                This browser can't show the PDF inline.
              </p>
              <a
                href="/resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: colors.buttonPrimary,
                  color: colors.white,
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}
              >
                <OpenInNewIcon size={18} />
                Open resume
              </a>
              <a
                href="/resume.pdf"
                download="Tanmay_Nargas_Resume.pdf"
                style={{ color: colors.accentText, textDecoration: 'underline' }}
              >
                Download PDF
              </a>
            </div>
          )}

          {/* Mobile prompt to open PDF in new tab */}
          {isMobile && embedPdf && (
            <div style={{
              textAlign: 'center',
              marginTop: '16px',
              padding: '12px',
              backgroundColor: colors.accentHover,
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: colors.secondaryText
            }}>
              For the best viewing experience,{' '}
              <a
                href="/resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: colors.accentText, textDecoration: 'underline' }}
              >
                open the PDF in a new tab
              </a>.
            </div>
          )}

          {/* Fallback message */}
          {embedPdf && (
          <div style={{
            textAlign: 'center',
            marginTop: '20px',
            color: colors.secondaryText,
            fontSize: '0.9rem'
          }}>
            <p>
              Can't view the PDF?
              <a
                href="/resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: colors.accentText,
                  textDecoration: 'none',
                  marginLeft: '5px',
                  marginRight: '5px'
                }}
              >
                Open in new tab
              </a>
              or
              <a
                href="/resume.pdf"
                download="Tanmay_Nargas_Resume.pdf"
                style={{
                  color: colors.accentText,
                  textDecoration: 'none',
                  marginLeft: '5px'
                }}
              >
                download it here
              </a>
            </p>
          </div>
          )}
        </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default Resume;
