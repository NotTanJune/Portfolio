import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  style,
  placeholder,
  loading = 'lazy',
  onLoad,
  onError,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(loading === 'eager');
  const imgRef = useRef<HTMLImageElement>(null);

  const getWebPSrc = (originalSrc: string) => {
    const lastDotIndex = originalSrc.lastIndexOf('.');
    if (lastDotIndex === -1) return originalSrc;
    return originalSrc.substring(0, lastDotIndex) + '.webp';
  };

  const webpSrc = getWebPSrc(src);

  useEffect(() => {
    if (loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [loading]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const imageStyle: React.CSSProperties = {
    opacity: isLoaded ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...style,
  };

  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: placeholder || 'linear-gradient(135deg, var(--sage-200), var(--sage-300))',
    opacity: isLoaded ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--brunswick-green)',
    fontSize: '0.8rem',
    zIndex: 1,
  };

  return (
    <div 
      ref={imgRef}
      className={`optimized-image ${className}`} 
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {/* Placeholder */}
      <div style={placeholderStyle}>
        {!isLoaded && !hasError && (
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--brunswick-green)',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 8px'
              }}
            />
            Loading...
          </div>
        )}
        {hasError && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📷</div>
            Image unavailable
          </div>
        )}
      </div>

      {isInView && (
        <picture>
          <source srcSet={webpSrc} type="image/webp" />
          <img
            src={src}
            alt={alt}
            loading={loading}
            style={imageStyle}
            onLoad={handleLoad}
            onError={handleError}
            decoding="async"
          />
        </picture>
      )}
    </div>
  );
};

export default OptimizedImage;
