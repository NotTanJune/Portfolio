import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import LoadingScreen from './components/LoadingScreen';


const useInView = (threshold = 0.1) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isInView] as const;
};

interface AnimatedSectionProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

const AnimatedSection: React.FC<AnimatedSectionProps> = ({ 
  children, 
  direction = 'up', 
  delay = 0,
  className,
  style 
}) => {
  const [ref, isInView] = useInView(0.1);

  const getTransform = () => {
    if (isInView) return 'none';
    switch (direction) {
      case 'up': return 'translateY(30px)';
      case 'down': return 'translateY(-30px)';
      case 'left': return 'translateX(30px)';
      case 'right': return 'translateX(-30px)';
      default: return 'translateY(30px)';
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: getTransform(),
        transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
        ...style
      }}
    >
      {children}
    </div>
  );
};

// Color scheme constants
const colors = {
  // Main color palette 
  mainBg: '#dad7cd',   
  cardBg: '#f0efeb',
  lightBg: '#f8f7f5',
  techBg: '#b4baad',
  
  // Green accents for text and interactive elements
  primaryText: '#344e41',
  secondaryText: '#3a5a40',
  accentText: '#588157',
  mutedText: '#a3b18a',
  
  // Interactive elements
  buttonPrimary: '#588157',
  buttonHover: '#3a5a40',
  borderColor: '#b6b09c',

  // Dark elements (for contrast)
  darkAccent: '#344e41',
  white: '#ffffff',
  
  // Legacy color names for compatibility
  timberwolf: '#dad7cd',
  sage: '#a3b18a',
  fernGreen: '#588157',
  hunterGreen: '#3a5a40',
  brunswickGreen: '#344e41',
  
  // Opacity variations
  transparentBg: 'rgba(218, 215, 205, 0.3)',
  overlayBg: 'rgba(218, 215, 205, 0.95)',
  accentHover: 'rgba(88, 129, 87, 0.1)'
};

// Technical Skills Data
const skillsData = {
  'Languages': [
    { name: 'C++', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg' },
    { name: 'Python', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg' },
    { name: 'JavaScript', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg' },
    { name: 'TypeScript', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg' },
    { name: 'HTML5', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg' },
    { name: 'CSS3', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg' }
  ],
  'Frameworks': [
    { name: 'React', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
    { name: 'Node.js', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg' },
    { name: 'Flask', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg' },
    { name: 'TensorFlow', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg' },
    { name: 'NumPy', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/numpy/numpy-original.svg' },
    { name: 'Pandas', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pandas/pandas-original.svg' }
  ],
  'Databases': [
    { name: 'PostgreSQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg' },
    { name: 'MongoDB', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg' },
    { name: 'Supabase', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/supabase/supabase-original.svg' },
  ],
  'Tools': [
    { name: 'Git', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg' },
    { name: 'Docker', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg' },
    { name: 'AWS', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg' },
    { name: 'VS Code', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg' },
    { name: 'Postman', icon: 'https://www.svgrepo.com/show/354202/postman-icon.svg' },
    { name: 'Figma', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg' }
  ]
};

// Profile Carousel Component
const ProfileCarousel: React.FC = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Array of profile images
  const profileImages = [
    {
      src: "/images/profile/pfp.JPG",
      alt: "Tanmay Nargas - AI Engineer"
    },
    {
      src: "/images/profile/pfp2.JPG",
      alt: "Tanmay Nargas - Developer"
    },
    {
      src: "/images/profile/pfp3.JPG",
      alt: "Tanmay Nargas - Student"
    },
    {
      src: "/images/profile/pfp4-updated.jpg",
      alt: "Tanmay Nargas - Researcher"
    },
  ];

  // Auto-advance carousel every 4 seconds
  useEffect(() => {
    if (profileImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prevIndex) => 
          (prevIndex + 1) % profileImages.length
        );
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [profileImages.length]);

  return (
    <div style={{
      position: 'relative',
      maxWidth: isMobile ? '250px' : '300px',
      width: '100%',
      margin: '0 auto',
      minHeight: isMobile ? '250px' : '300px',
      visibility: 'visible',
      display: 'block'
    }}>
      {/* Background shadow div */}
      <div style={{
        backgroundColor: colors.fernGreen,
        width: '100%',
        height: isMobile ? '250px' : '300px',
        borderRadius: '4px',
        position: 'absolute',
        top: isMobile ? '15px' : '20px',
        left: isMobile ? '15px' : '20px',
        zIndex: 1
      }} />
      
      {/* Main image container */}
      <div style={{
        backgroundColor: colors.hunterGreen,
        width: '100%',
        height: isMobile ? '250px' : '300px',
        borderRadius: '4px',
        position: 'relative',
        zIndex: 2,
        border: `2px solid ${colors.fernGreen}`,
        overflow: 'hidden'
      }}>
        {profileImages.map((image, index) => (
          <img 
            key={index}
            src={image.src} 
            alt={image.alt}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: index === currentImageIndex ? 1 : 0,
              transition: 'opacity 1s ease-in-out',
              zIndex: index === currentImageIndex ? 2 : 1
            }}
            onError={(e) => {
              console.error('Image failed to load:', image.src);
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', image.src);
            }}
          />
        ))}
        
        {/* Fallback content if images don't load */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: colors.white,
          fontSize: '14px',
          textAlign: 'center',
          zIndex: 0,
          opacity: 0.5
        }}>
          Loading...
        </div>
      </div>
    </div>
  );
};

// Technical Skills Component
const TechnicalSkills: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Languages');
  const [animatedItems, setAnimatedItems] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {

    setAnimatedItems(new Set());
    
    const resetTimer = setTimeout(() => {
      const skills = skillsData[activeTab as keyof typeof skillsData];
      const timeouts: NodeJS.Timeout[] = [];
      
      skills.forEach((_, index) => {
        const timeout = setTimeout(() => {
          setAnimatedItems(prev => {
            const newSet = new Set(prev);
            newSet.add(`${activeTab}-${index}`);
            return newSet;
          });
        }, index * 50 + 100);
        
        timeouts.push(timeout);
      });

      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }, 50);

    return () => {
      clearTimeout(resetTimer);
    };
  }, [activeTab]);

  const tabs = Object.keys(skillsData);

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: isMobile ? '24px' : '32px',
        padding: isMobile ? '0 8px' : '0'
      }}>
        <div style={{
          backgroundColor: colors.mainBg,
          color: colors.accentText,
          padding: '3px',
          borderRadius: '8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: isMobile ? '4px' : '8px',
          maxWidth: '100%',
          width: isMobile ? '100%' : 'auto'
        }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                padding: isMobile ? '6px 12px' : '8px 16px',
                borderRadius: '6px',
                backgroundColor: activeTab === tab ? colors.buttonPrimary : 'transparent',
                color: activeTab === tab ? colors.mainBg : colors.primaryText,
                border: 'none',
                cursor: 'pointer',
                flex: isMobile ? '1' : 'auto',
                minWidth: isMobile ? '0' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab) {
                  (e.target as HTMLElement).style.backgroundColor = colors.lightBg;
                  (e.target as HTMLElement).style.color = colors.accentText;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab) {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                  (e.target as HTMLElement).style.color = colors.primaryText;
                }
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        backgroundColor: colors.techBg,
        borderRadius: '8px',
        padding: isMobile ? '16px 12px' : '24px',
        margin: isMobile ? '0 8px' : '0'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(140px, 1fr))' : 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: isMobile ? '8px' : '12px',
          justifyItems: 'center'
        }}>
          {skillsData[activeTab as keyof typeof skillsData].map((skill, index) => {
            const itemKey = `${activeTab}-${index}`;
            const isAnimated = animatedItems.has(itemKey);
            
            return (
              <div
                key={`${activeTab}-skill-${index}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? '6px' : '8px',
                  padding: isMobile ? '8px 12px' : '8px 16px',
                  backgroundColor: colors.mainBg,
                  color: colors.primaryText,
                  border: `1px solid ${colors.borderColor}`,
                  borderRadius: '6px',
                  fontSize: isMobile ? '0.75rem' : '0.875rem',
                  fontWeight: '500',
                  transition: 'background-color 0.1s ease, border-color 0.3s ease, color 0.3s ease, opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  opacity: isAnimated ? 1 : 0,
                  transform: isAnimated ? 'none' : 'translateY(20px)',
                  width: '100%',
                  maxWidth: isMobile ? '200px' : 'none',
                  minWidth: isMobile ? '140px' : 'auto'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = colors.buttonPrimary;
                  (e.target as HTMLElement).style.borderColor = colors.accentText;
                  (e.target as HTMLElement).style.color = colors.white;
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = colors.mainBg;
                  (e.target as HTMLElement).style.borderColor = colors.borderColor;
                  (e.target as HTMLElement).style.color = colors.primaryText;
                }}
              >
                {skill.icon.startsWith('http') ? (
                  <img 
                    src={skill.icon} 
                    alt={`${skill.name} logo`} 
                    style={{ 
                      height: isMobile ? '18px' : '20px', 
                      width: isMobile ? '18px' : '20px', 
                      objectFit: 'contain' 
                    }} 
                  />
                ) : (
                  <span style={{ fontSize: isMobile ? '18px' : '20px' }}>{skill.icon}</span>
                )}
                {skill.name}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Navbar Component
const Navbar: React.FC = () => {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <nav style={{ 
      position: 'fixed', 
      top: isMobile ? '12px' : '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: isMobile ? '97%' : '95%',
      maxWidth: '1200px',
      backgroundColor: colors.transparentBg, 
      backdropFilter: 'blur(20px)',
      border: `1px solid ${colors.borderColor}`,
      borderRadius: isMobile ? '16px' : '12px',
      zIndex: 1000,
      padding: isMobile ? '10px 16px' : '12px 24px',
      transition: 'all 0.3s ease',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        width: '100%'
      }}>
        {/* Left side - Portfolio logo */}
        <AnimatedSection direction="left" delay={0}>
          <Link 
            to="/" 
            style={{ 
              fontSize: isMobile ? '1.1rem' : '1.5rem', 
              fontWeight: '400', 
              color: colors.primaryText, 
              textDecoration: 'none',
              letterSpacing: '-0.5px',
              whiteSpace: 'nowrap',
              minWidth: isMobile ? 'auto' : '160px'
            }}
          >
            Portfolio
          </Link>
        </AnimatedSection>
        
        {/* Center - Navigation items */}
        <div style={{ 
          display: 'flex', 
          gap: isMobile ? '2px' : '8px',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          {[
            { to: '/', label: 'Home' },
            { to: '/projects', label: 'Projects' },
            { to: '/contact', label: 'Contact' }
          ].map((item, index) => (
            <AnimatedSection key={item.to} direction="down" delay={200 + index * 100}>
              <Link 
                to={item.to} 
                style={{ 
                  color: location.pathname === item.to ? colors.primaryText : colors.primaryText,
                  backgroundColor: location.pathname === item.to ? colors.techBg : 'transparent',
                  textDecoration: 'none',
                  fontWeight: location.pathname === item.to ? '300' : '200',
                  fontSize: isMobile ? '0.7rem' : '1rem',
                  transition: 'all 0.3s ease',
                  padding: isMobile ? '5px 6px' : '8px 16px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== item.to) {
                    (e.target as HTMLElement).style.backgroundColor = colors.accentHover;
                    (e.target as HTMLElement).style.color = colors.primaryText;
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== item.to) {
                    (e.target as HTMLElement).style.backgroundColor = 'transparent';
                    (e.target as HTMLElement).style.color = colors.primaryText;
                  }
                }}
              >
                {item.label}
              </Link>
            </AnimatedSection>
          ))}
        </div>

        {/* Right side - Spacer for balance */}
        <AnimatedSection direction="right" delay={600}>
          <div style={{ 
            minWidth: isMobile ? 'auto' : '160px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            {/* Empty spacer to balance the left side */}
          </div>
        </AnimatedSection>
      </div>
    </nav>
  );
};

// Home Component
const Home: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.mainBg,
      color: colors.primaryText,
      width: '100%',
      overflowX: 'hidden'
    }}>
      {/* Hero Section */}
      <section style={{ 
        minHeight: '85vh',
        paddingTop: isMobile ? '100px' : '120px',
        paddingBottom: isMobile ? '60px' : '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        backgroundColor: colors.mainBg,
        position: 'relative',
        overflow: 'hidden',
        width: '100%'
      }}>
        {/* Background Animation */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 20% 80%, rgba(52, 78, 65, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(88, 129, 87, 0.05) 0%, transparent 50%)`,
          zIndex: 1
        }} />
        
        <div style={{ 
          maxWidth: '1000px',
          padding: isMobile ? '0 20px' : '0 40px',
          zIndex: 2,
          position: 'relative',
          width: '100%'
        }}>
          <AnimatedSection direction="up" delay={200}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ 
                fontSize: '1.5rem',
                color: colors.accentText,
                fontWeight: '500',
                marginBottom: '10px',
                letterSpacing: '2px'
              }}>
                Hi, my name is
              </p>
              <h1 style={{ 
                fontSize: 'clamp(3rem, 8vw, 5rem)', 
                fontWeight: '500',
                marginBottom: '20px',
                color: colors.primaryText,
                lineHeight: '1.1',
                letterSpacing: '-2px'
              }}>
                Tanmay Nargas
              </h1>
              <h2 style={{ 
                fontSize: 'clamp(0.5rem, 6vw, 3rem)', 
                fontWeight: '300',
                color: colors.buttonPrimary,
                marginBottom: '30px',
                lineHeight: '1.1'
              }}>
                I'm an{' '}
                <span style={{ 
                  color: colors.buttonPrimary,
                  transition: 'all 0.5s ease'
                }}>
                  AI Engineer
                </span>
              </h2>
            </div>
          </AnimatedSection>
          
          <AnimatedSection direction="up" delay={400}>
            <p style={{ 
              fontSize: '1.3rem',
              fontWeight: '100',
              color: colors.secondaryText,
              maxWidth: '600px',
              margin: '0 auto 50px',
              lineHeight: '1.6'
            }}>
              I strive to build exceptional digital experiences. Currently focused on honing my skills by pursuing an MS degree in Artificial Intelligence at NTU Singapore.
            </p>
          </AnimatedSection>
          
          <AnimatedSection direction="up" delay={600}>
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              justifyContent: 'center', 
              flexWrap: 'wrap',
              marginBottom: '60px'
            }}>
            <Link 
              to="/projects" 
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                fontSize: '0.875rem',
                fontWeight: '100',
                transition: 'all 0.3s ease',
                padding: '0 24px',
                height: '40px',
                borderRadius: '6px',
                backgroundColor: colors.buttonPrimary,
                color: colors.white,
                textDecoration: 'none',
                border: 'none',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = colors.buttonHover;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = colors.buttonPrimary;
              }}
            >
              View My Work
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px', transition: 'transform 0.3s ease' }}>
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </Link>
            <Link 
              to="/resume"
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                fontSize: '0.875rem',
                fontWeight: '100',
                transition: 'all 0.3s ease',
                padding: '0 24px',
                height: '40px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: colors.primaryText,
                textDecoration: 'none',
                border: `1px solid ${colors.fernGreen}`,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = colors.fernGreen;
                (e.target as HTMLElement).style.color = colors.white;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
                (e.target as HTMLElement).style.color = colors.primaryText;
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" x2="8" y1="13" y2="13"></line>
                <line x1="16" x2="8" y1="17" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              Resume
            </Link>
          </div>
          </AnimatedSection>
          
          {/* Social Links */}
          <AnimatedSection direction="up" delay={800}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '40px',
              width: '100%'
            }}>
              <div style={{
                display: 'flex',
                gap: '40px',
                alignItems: 'center'
              }}>
              {[
                { name: 'GitHub', url: 'https://github.com/NotTanJune' },
                { name: 'LinkedIn', url: 'https://linkedin.com/in/tanmay-nargas' },
              ].map((platform) => (
                <a 
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    color: colors.accentText,
                    fontSize: '1.3rem',
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '120px',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.darkAccent;
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.backgroundColor = colors.accentHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.accentText;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {platform.name}
                </a>
              ))}
            </div>
          </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Technical Skills Section */}
      <section style={{ 
        padding: isMobile ? '80px 20px' : '120px 40px 120px 40px',
        margin: '0',
        textAlign: 'center',
        backgroundColor: colors.techBg,
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}>
        <AnimatedSection direction="up" delay={200}>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: isMobile ? '40px' : '60px'
          }}>
            <h2 style={{ 
              fontSize: isMobile ? '2.2rem' : '3rem',
              fontWeight: '300',
              color: colors.primaryText,
              marginBottom: '20px'
            }}>
              Technical Skills
            </h2>
            <p style={{ 
              maxWidth: isMobile ? '350px' : '700px',
              color: colors.secondaryText,
              fontSize: isMobile ? '1rem' : '1.2rem',
              lineHeight: '1.6',
              padding: isMobile ? '0 10px' : '0'
            }}>
              My expertise across various technologies and tools
            </p>
          </div>
        </AnimatedSection>
        
        <AnimatedSection direction="up" delay={400}>
        <TechnicalSkills />
        </AnimatedSection>
      </section>

      {/* About Section */}
      <section style={{ 
        padding: isMobile ? '60px 20px' : '100px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        
        <div style={{ 
          display: isMobile ? 'flex' : 'grid', 
          gridTemplateColumns: isMobile ? 'none' : '3fr 2fr',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '40px' : '60px',
          alignItems: isMobile ? 'stretch' : 'center',
          width: '100%'
        }}>
          <div style={{
            order: isMobile ? 2 : 0,
            width: '100%'
          }}>
            <p style={{ 
              fontSize: isMobile ? '1rem' : '1.1rem',
              fontWeight: '100',
              color: colors.secondaryText,
              lineHeight: '1.7',
              marginBottom: '20px',
              textAlign: isMobile ? 'left' : 'left'
            }}>
              Hello! I'm a passionate developer and student pursuing my MS in Artificial Intelligence at NTU
              who enjoys creating things that intelligently leverage AI to solve problems. 
              My interest in coding started back in 2013 when I first got my hands on a Raspberry Pi
              and learnt how to code in Python.
              I have since built a variety of projects, participated in hackathons, and attended conferences.
              I aim to keep learning and growing as a developer in all my future endeavors.
            </p>
          </div>
          
          <div style={{ 
            position: 'relative',
            order: isMobile ? 1 : 0,
            display: 'flex',
            justifyContent: isMobile ? 'center' : 'flex-start',
            alignItems: 'center',
            width: '100%',
            minHeight: isMobile ? '280px' : 'auto',
            flex: isMobile ? '0 0 auto' : 'initial'
          }}>
            <ProfileCarousel />
          </div>
        </div>
      </section>

      {/* Featured Projects Preview */}
      <section style={{ 
        padding: isMobile ? '60px 20px' : '100px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ marginBottom: isMobile ? '40px' : '60px' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.6rem' : '2rem',
            color: colors.primaryText,
            fontWeight: '200',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '12px' : '20px',
            flexWrap: 'wrap'
          }}>
            Some Things I've Built
          </h2>
        </div>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: isMobile ? '20px' : '24px',
          width: '100%'
        }}>
          {[
            {
              title: 'Binary Classification ML Model',
              description: 'A machine learning model for binary classification to differentiate between cracked and un-cracked images for cell tower bases using TensorFlow and scikit-learn.',
              tech: ['Python', 'TensorFlow', 'scikit-learn', 'Django', 'NumPy', 'Pandas', 'Matplotlib'],
              features: [
                'Built machine learning model for binary classification tasks',
                'Implemented comprehensive data preprocessing, data augmentation, and model evaluation',
                'Deployed model using Django for real-time batch predictions'
              ],
              githubUrl: 'https://github.com/NotTanJune/crack-detection'
            },
            {
              title: 'Grab a Degree',
              description: 'A college application tracker and AI SOP analysis tool.',
              tech: ['HTML', 'Django', 'CSS', 'Supabase', 'Bootstrap'],
              features: [
                'Built for college application tracking and management',
                'Enabled AI-powered SOP analysis and grading tool',
                'Implemented email connection to allow app to scan for application notifications'
              ],
              githubUrl: 'https://github.com/NotTanJune/GrAD',
              liveDemoUrl: 'https://grad-app.fly.dev/'
            }
          ].map((project, index) => (
            <div key={index} style={{
              backgroundColor: colors.mainBg,
              border: `2px solid ${colors.borderColor}`,
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.accentText;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.borderColor;
            }}>
              {/* Image */}
              <div style={{
                aspectRatio: '16 / 9',
                overflow: 'hidden',
                marginBottom: '16px',
                borderRadius: '8px'
              }}>
                <img 
                  src={(() => {
                    switch(project.title) {
                      case 'Binary Classification ML Model':
                        return '/images/projects/MLModel.png';
                      case 'Grab a Degree':
                        return '/images/projects/GrabADegree.png';
                      case 'Portfolio Website':
                        return '/images/projects/Portfolio.png';
                      default:
                        return '/images/projects/Portfolio.png'; // fallback
                    }
                  })()}
                  alt={project.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    transition: 'transform 0.3s ease',
                    imageRendering: '-webkit-optimize-contrast',
                    backfaceVisibility: 'hidden',
                    transform: 'translateZ(0)',
                    willChange: 'transform'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05) translateZ(0)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1) translateZ(0)';
                  }}
                />
              </div>

              {/* Header */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '300',
                  lineHeight: '1',
                  color: colors.primaryText,
                  marginBottom: '8px'
                }}>
                  {project.title}
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '200',
                  color: colors.accentText,
                  lineHeight: '1.4'
                }}>
                  {project.description}
                </p>
              </div>

              {/* Content */}
              <div style={{ flex: 1, marginBottom: '16px' }}>
                {/* Tech badges */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {project.tech.map((tech, techIndex) => (
                    <span key={techIndex} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: '200',
                      whiteSpace: 'nowrap',
                      backgroundColor: tech.startsWith('+') ? 'transparent' : colors.techBg,
                      color: tech.startsWith('+') ? colors.primaryText : colors.primaryText,
                      border: tech.startsWith('+') ? `1px solid ${colors.borderColor}` : 'none'
                    }}>
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Features list */}
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  fontSize: '0.875rem',
                  color: colors.accentText
                }}>
                  {project.features.map((feature, featureIndex) => (
                    <li key={featureIndex} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      marginBottom: '8px',
                      fontWeight: '100'
                    }}>
                      <svg 
                        style={{
                          marginRight: '8px',
                          marginTop: '2px',
                          width: '16px',
                          height: '16px',
                          color: colors.accentText,
                          flexShrink: 0
                        }}
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ flex: 1 }}></div>
                
                <a 
                  href={project.githubUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: colors.primaryText,
                    width: '36px',
                    height: '36px',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.accentHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg 
                    style={{
                      width: '16px',
                      height: '16px'
                    }}
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                    <path d="M9 18c-4.51 2-5-2-7-2"></path>
                  </svg>
                </a>

                {project.liveDemoUrl && (
                  <a 
                    href={project.liveDemoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      transition: 'all 0.3s ease',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: colors.primaryText,
                      width: '36px',
                      height: '36px',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.accentHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg 
                      style={{
                        width: '16px',
                        height: '16px'
                      }}
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h6v6"></path>
                      <path d="M10 14 21 3"></path>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link 
            to="/projects"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.3s ease',
              border: `1px solid ${colors.borderColor}`,
              backgroundColor: colors.mainBg,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              color: colors.primaryText,
              height: '36px',
              padding: '0 16px',
              textDecoration: 'none'
            }}
          >
            View All Projects
            <svg 
              style={{
                marginLeft: '8px',
                width: '16px',
                height: '16px'
              }}
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
};

// Projects Component  
const Projects: React.FC = () => {
  const [filter, setFilter] = useState('All');
  const [isMobile, setIsMobile] = useState(false);
  const filters = ['All', 'Web App', 'ML Model'];
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const projects = [
    {
      title: 'Binary Classification ML Model',
      description: 'A machine learning model for binary classification to differentiate between cracked and un-cracked images for cell tower bases using TensorFlow and scikit-learn.',
      tech: ['Python', 'TensorFlow', 'scikit-learn', 'Django'],
      category: 'ML Model',
      featured: true,
      GitHub: 'https://github.com/NotTanJune/crack-detection'
    },
    {
      title: 'Grab a Degree',
      description: 'College application tracker and AI SOP analysis tool.',
      tech: ['HTML', 'CSS', 'Django', 'Supabase', 'Bootstrap'],
      category: 'Web App',
      featured: true,
      GitHub: 'https://github.com/NotTanJune/GrAD',
      LiveDemo: 'https://grad-app.fly.dev/'
    },
    {
      title: 'Portfolio Website',
      description: 'Personal portfolio showcasing projects and skills with modern design.',
      tech: ['React', 'TypeScript', 'CSS3', 'Framer Motion', 'MongoDB'],
      category: 'Web App',
      featured: false
    },
  ];

  const filteredProjects = filter === 'All' 
    ? projects 
    : projects.filter(project => project.category === filter);

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.mainBg,
      color: colors.primaryText,
      paddingTop: isMobile ? '100px' : '120px',
      width: '100%',
      overflowX: 'hidden'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: isMobile ? '0 20px' : '0 40px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <AnimatedSection direction="up" delay={200}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '60px' : '80px' }}>
            <h1 style={{ 
              fontSize: isMobile ? '2.2rem' : '3rem',
              color: colors.primaryText,
              fontWeight: '300',
              marginBottom: '20px'
            }}>
              My Projects
            </h1>
            <p style={{ 
              fontSize: isMobile ? '1rem' : '1.2rem',
              fontWeight: '100',
              color: colors.secondaryText,
              maxWidth: isMobile ? '350px' : '600px',
              margin: '0 auto',
              marginBottom: '-40px',
              padding: isMobile ? '0 10px' : '0'
            }}>
              A collection of projects that showcase my skills in web development, and software engineering.
            </p>
          </div>
        </AnimatedSection>

        {/* Filter Buttons */}
        <AnimatedSection direction="up" delay={400}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'center',
            gap: isMobile ? '8px' : '12px',
            marginBottom: isMobile ? '50px' : '60px',
            flexWrap: 'wrap',
            padding: isMobile ? '0 10px' : '0'
          }}>
          {filters.map((filterItem) => (
            <button
              key={filterItem}
              onClick={() => setFilter(filterItem)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                padding: '0 16px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: filter === filterItem ? colors.buttonPrimary : colors.mainBg,
                color: filter === filterItem ? colors.white : colors.primaryText,
                border: `1px solid ${colors.borderColor}`,
                cursor: 'pointer',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                if (filter !== filterItem) {
                  (e.target as HTMLElement).style.backgroundColor = colors.lightBg;
                  (e.target as HTMLElement).style.color = colors.accentText;
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== filterItem) {
                  (e.target as HTMLElement).style.backgroundColor = colors.mainBg;
                  (e.target as HTMLElement).style.color = colors.primaryText;
                }
              }}
            >
              {filterItem}
            </button>
          ))}
        </div>
        </AnimatedSection>
        
        {/* Projects Grid */}
        <AnimatedSection direction="up" delay={600}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))', 
            gap: isMobile ? '20px' : '24px',
            marginBottom: isMobile ? '60px' : '80px'
          }}>
          {filteredProjects.map((project, index) => (
            <div key={index} style={{
              backgroundColor: colors.mainBg,
              border: `2px solid ${colors.borderColor}`,
              borderRadius: '12px',
              padding: isMobile ? '20px' : '24px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.accentText;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.borderColor;
            }}>

              {/* Image placeholder */}
              <div style={{
                aspectRatio: '16 / 9',
                overflow: 'hidden',
                marginBottom: '16px',
                borderRadius: '8px'
              }}>
                <img 
                  src={(() => {
                    switch(project.title) {
                      case 'Binary Classification ML Model':
                        return '/images/projects/MLModel.png';
                      case 'Grab a Degree':
                        return '/images/projects/GrabADegree.png';
                      case 'Portfolio Website':
                        return '/images/projects/Portfolio.png';
                      default:
                        return '/images/projects/Portfolio.png';
                    }
                  })()}
                  alt={project.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    transition: 'transform 0.3s ease',
                    imageRendering: '-webkit-optimize-contrast',
                    backfaceVisibility: 'hidden',
                    transform: 'translateZ(0)',
                    willChange: 'transform'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05) translateZ(0)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1) translateZ(0)';
                  }}
                />
              </div>

              {/* Header */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '100',
                  lineHeight: '1',
                  color: colors.primaryText,
                  marginBottom: '8px'
                }}>
                  {project.title}
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '50',
                  color: colors.accentText,
                  lineHeight: '1.4'
                }}>
                  {project.description}
                </p>
              </div>

              {/* Content */}
              <div style={{ flex: 1, marginBottom: '16px' }}>
                {/* Tech badges */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {project.tech.map((tech, techIndex) => (
                    <span key={techIndex} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: '30',
                      whiteSpace: 'nowrap',
                      backgroundColor: colors.techBg,
                      color: colors.primaryText
                    }}>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                
                <div style={{ flex: 1 }}></div>
                
                {project.GitHub && (
                  <a 
                    href={project.GitHub} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      transition: 'all 0.3s ease',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: colors.primaryText,
                      width: '36px',
                      height: '36px',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.accentHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg 
                      style={{
                        width: '16px',
                        height: '16px'
                      }}
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                      <path d="M9 18c-4.51 2-5-2-7-2"></path>
                    </svg>
                  </a>
                )}

                {project.LiveDemo && (
                  <a 
                    href={project.LiveDemo} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      transition: 'all 0.3s ease',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: colors.primaryText,
                      width: '36px',
                      height: '36px',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.accentHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg 
                      style={{
                        width: '16px',
                        height: '16px'
                      }}
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h6v6"></path>
                      <path d="M10 14 21 3"></path>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

// Contact Component
const Contact: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    const answer = operator === '+' ? num1 + num2 : num1 - num2;
    return { question: `${num1} ${operator} ${num2}`, answer };
  };

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    message: '',
    website: '',
    captchaAnswer: ''
  });

  const [captcha, setCaptcha] = useState(generateCaptcha());
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

    if (parseInt(formData.captchaAnswer) !== captcha.answer) {
      setSubmitStatus('error');
      setSubmitMessage('Incorrect answer to the math question. Please try again.');
      setCaptcha(generateCaptcha());
      setFormData(prev => ({ ...prev, captchaAnswer: '' }));
      return;
    }

    const suspiciousPatterns = [
      /https?:\/\//gi,
      /\b(viagra|casino|lottery|winner|congratulations|claim|prize)\b/gi,
      /(.)\1{10,}/,
    ];

    const content = `${formData.name} ${formData.subject} ${formData.message}`;
    if (suspiciousPatterns.some(pattern => pattern.test(content))) {
      setSubmitStatus('error');
      setSubmitMessage('Message contains suspicious content. Please revise and try again.');
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
        captchaAnswer: formData.captchaAnswer,
        captchaExpected: captcha.answer,
        formStartTime: formStartTime
      };
      
      const response = await axios.post(API_URL, submitData);
      
      setSubmitStatus('success');
      setSubmitMessage(response.data.message || 'Message sent successfully! I\'ll get back to you soon.');
      
      setFormData({
        name: '',
        subject: '',
        message: '',
        website: '',
        captchaAnswer: ''
      });
      setCaptcha(generateCaptcha());
    } catch (error: any) {
      setSubmitStatus('error');
      const errorMessage = error.response?.data?.message || 'Failed to send message. Please try again.';
      setSubmitMessage(errorMessage);
      console.error('Error sending message:', error);
      setCaptcha(generateCaptcha());
      setFormData(prev => ({ ...prev, captchaAnswer: '' }));
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
        paddingTop: isMobile ? '120px' : '140px',
        paddingBottom: isMobile ? '60px' : '80px',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: isMobile ? '0 20px' : '0 20px',
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
              fontWeight: '200',
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
              fontWeight: '100'
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
              gridTemplateColumns: '1fr 1fr',
              gap: '32px',
              maxWidth: '1000px',
              margin: '0 auto',
              width: '100%'
            }}
          >
          {/* Contact Form */}
          <div style={{
            backgroundColor: colors.cardBg,
            borderRadius: '12px',
            border: `1px solid ${colors.borderColor}`,
            padding: 'clamp(20px, 4vw, 40px)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}>
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '200',
                color: colors.primaryText,
                marginBottom: '8px'
              }}>
                Send me a message
              </h3>
              <p style={{
                fontSize: '0.95rem',
                fontWeight: '100',
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
                <label style={{ 
                  display: 'block',
                  color: colors.primaryText,
                  marginBottom: '8px',
                  fontWeight: '100',
                  fontSize: '0.9rem'
                }}>
                  Name
                </label>
                <input 
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
                    transition: 'all 0.3s ease',
                    outline: 'none'
                  }}
                  placeholder="John Doe"
                  onFocus={(e) => {
                    e.target.style.borderColor = colors.accentText;
                    e.target.style.boxShadow = `0 0 0 3px ${colors.accentHover}`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div>
                <label style={{ 
                  display: 'block',
                  color: colors.primaryText,
                  marginBottom: '8px',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}>
                  Subject
                </label>
                <input 
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
                    transition: 'all 0.3s ease',
                    outline: 'none'
                  }}
                  placeholder="Project Inquiry"
                  onFocus={(e) => {
                    e.target.style.borderColor = colors.accentText;
                    e.target.style.boxShadow = `0 0 0 3px ${colors.accentHover}`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  display: 'block',
                  color: colors.primaryText,
                  marginBottom: '8px',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}>
                  Message
                </label>
                <textarea 
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
                    outline: 'none',
                    minHeight: '80px'
                  }}
                  placeholder="I'd like to discuss a project opportunity..."
                  onFocus={(e) => {
                    e.target.style.borderColor = colors.accentText;
                    e.target.style.boxShadow = `0 0 0 3px ${colors.accentHover}`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Honeypot field - hidden from users but visible to bots */}
              <div style={{ display: 'none' }}>
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

              {/* CAPTCHA */}
              <div style={{
                backgroundColor: colors.lightBg,
                border: `2px solid ${colors.accentText}`,
                borderRadius: '8px',
                padding: '16px',
                marginTop: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <span style={{
                    fontSize: '1.2rem',
                    color: colors.accentText
                  }}>🔒</span>
                  <label style={{ 
                    display: 'block',
                    color: colors.primaryText,
                    fontWeight: '500',
                    fontSize: '0.9rem',
                    margin: 0
                  }}>
                    Security Check: What is {captcha.question}?
                  </label>
                </div>
                <input 
                  type="number"
                  name="captchaAnswer"
                  value={formData.captchaAnswer}
                  onChange={handleChange}
                  required
                  style={{ 
                    width: '120px',
                    padding: '12px 16px',
                    backgroundColor: colors.white,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '6px',
                    color: colors.primaryText,
                    fontSize: '0.95rem',
                    transition: 'all 0.3s ease',
                    outline: 'none',
                    textAlign: 'center',
                    fontWeight: '500'
                  }}
                  placeholder="?"
                  onFocus={(e) => {
                    e.target.style.borderColor = colors.accentText;
                    e.target.style.boxShadow = `0 0 0 3px ${colors.accentHover}`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <div style={{
                  marginTop: '8px',
                  fontSize: '0.8rem',
                  color: colors.mutedText,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>🛡️</span>
                  This helps prevent spam and automated submissions
                </div>
              </div>
              
              {/* Status Message */}
              {submitStatus !== 'idle' && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  backgroundColor: submitStatus === 'success' ? '#d4edda' : '#f8d7da',
                  color: submitStatus === 'success' ? '#155724' : '#721c24',
                  border: `1px solid ${submitStatus === 'success' ? '#c3e6cb' : '#f5c6cb'}`
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
                {isSubmitting ? (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56"></path>
                  </svg>
                ) : (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path>
                    <path d="m21.854 2.147-10.94 10.939"></path>
                  </svg>
                )}
              </button>
            </form>
          </div>

          {/* Contact Links Card */}
          <div style={{
            backgroundColor: colors.cardBg,
            borderRadius: '12px',
            border: `1px solid ${colors.borderColor}`,
            padding: 'clamp(20px, 4vw, 40px)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            height: 'fit-content'
          }}>
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '300',
                color: colors.primaryText,
                marginBottom: '8px'
              }}>
                Connect with me
              </h3>
              <p style={{
                fontSize: '0.95rem',
                fontWeight: '100',
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
              {/* GitHub */}
              <a 
                href="https://github.com/NotTanJune"
                target="_blank"
                rel="noopener noreferrer"
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.accentHover;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.lightBg;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
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
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={colors.accentText} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                    <path d="M9 18c-4.51 2-5-2-7-2"></path>
                  </svg>
                </div>
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '100',
                    color: colors.primaryText,
                    marginBottom: '4px'
                  }}>
                    GitHub
                  </h4>
                  <p style={{
                    fontSize: '0.85rem',
                    fontWeight: '10',
                    color: colors.secondaryText,
                    margin: 0
                  }}>
                    github.com/NotTanJune
                  </p>
                </div>
              </a>

              {/* LinkedIn */}
              <a 
                href="https://linkedin.com/in/tanmay-nargas"
                target="_blank"
                rel="noopener noreferrer"
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.accentHover;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.lightBg;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
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
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={colors.accentText} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect width="4" height="12" x="2" y="9"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                </div>
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '100',
                    color: colors.primaryText,
                    marginBottom: '4px'
                  }}>
                    LinkedIn
                  </h4>
                  <p style={{
                    fontSize: '0.85rem',
                    fontWeight: '10',
                    color: colors.secondaryText,
                    margin: 0
                  }}>
                    linkedin.com/in/tanmay-nargas
                  </p>
                </div>
              </a>

              {/* Email */}
              <a 
                href="mailto:tanmaynargas291@gmail.com"
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.accentHover;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.lightBg;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
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
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={colors.accentText} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  </svg>
                </div>
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '100',
                    color: colors.primaryText,
                    marginBottom: '4px'
                  }}>
                    Email
                  </h4>
                  <p style={{
                    fontSize: '0.85rem',
                    fontWeight: '10',
                    color: colors.secondaryText,
                    margin: 0
                  }}>
                    tanmaynargas291@gmail.com
                  </p>
                </div>
              </a>

              {/* Location */}
              <div style={{
                marginTop: '20px',
                paddingTop: '20px',
                borderTop: `1px solid ${colors.borderColor}`
              }}>
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: '200',
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
            
            /* Global fixes for all screens */
            input, textarea, button, select, div, a {
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

// Resume Component
const Resume: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
            fontWeight: '200',
            marginBottom: '20px',
            letterSpacing: '-1px'
          }}>
            Resume
          </h1>
          <p style={{ 
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            fontWeight: '100',
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
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = colors.buttonHover;
              (e.target as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = colors.buttonPrimary;
              (e.target as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15,3 21,3 21,9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
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
            minHeight: '800px'
          }}>
          <iframe
            src="/resume.pdf#toolbar=1&navpanes=1&scrollbar=1"
            style={{
              width: '100%',
              height: '800px',
              border: 'none',
              borderRadius: '8px'
            }}
            title="Resume PDF"
          />
          
          {/* Fallback message */}
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
        </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

// Footer Component
const Footer: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <footer style={{
      backgroundColor: '#344e41',
      borderTop: '1px solid colors.hunterGreen',
      padding: isMobile ? '30px 0' : '40px 0',
      marginTop: isMobile ? '50px' : '80px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '0 20px' : '0 20px',
        display: isMobile ? 'flex' : 'grid',
        gridTemplateColumns: isMobile ? 'none' : 'repeat(auto-fit, minmax(250px, 1fr))',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '30px' : '40px'
      }}>
        {/* About Section */}
        <div>
          <h3 style={{
            color: '#dae0d0',
            fontSize: isMobile ? '1.1rem' : '1.2rem',
            marginBottom: '20px',
            fontWeight: '200'
          }}>
            Tanmay Nargas
          </h3>
          <p style={{
            color: colors.sage,
            lineHeight: '1.6',
            marginBottom: '20px',
            fontSize: isMobile ? '0.85rem' : '0.9rem'
          }}>
            AI Engineer & Machine Learning Enthusiast based in Singapore, specialized in 
            creating intelligent solutions and cutting-edge applications.
          </p>
        </div>
        {/* Connect Section */}
        <div style={{ 
          marginLeft: isMobile ? '0' : '300px',
          alignSelf: isMobile ? 'stretch' : 'auto'
        }}>
          <h3 style={{
            color: '#dae0d0',
            fontSize: isMobile ? '1.1rem' : '1.2rem',
            marginBottom: '20px',
            fontWeight: '200'
          }}>
            Connect
          </h3>
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '12px' : '15px',
            justifyContent: isMobile ? 'flex-start' : 'flex-start',
            flexWrap: 'wrap'
          }}>
            <a href="https://github.com/NotTanJune" target="_blank" rel="noopener noreferrer" style={{
              color: colors.sage,
              fontSize: '1.2rem',
              transition: 'color 0.3s ease',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: colors.hunterGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px'
            }} onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = '#a3b18a';
              (e.target as HTMLElement).style.backgroundColor = '#a3b18a20';
            }} onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = colors.sage;
              (e.target as HTMLElement).style.backgroundColor = colors.hunterGreen;
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                <path d="M9 18c-4.51 2-5-2-7-2"></path>
              </svg>
            </a>
            <a href="https://www.linkedin.com/in/tanmay-nargas" target="_blank" rel="noopener noreferrer" style={{
              color: colors.sage,
              fontSize: '1.2rem',
              transition: 'color 0.3s ease',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: colors.hunterGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px'
            }} onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = '#a3b18a';
              (e.target as HTMLElement).style.backgroundColor = '#a3b18a20';
            }} onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = colors.sage;
              (e.target as HTMLElement).style.backgroundColor = colors.hunterGreen;
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect width="4" height="12" x="2" y="9"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
            </a>
            <a href="mailto:tanmaynargas291@gmail.com" style={{
              color: colors.sage,
              fontSize: '1.2rem',
              transition: 'color 0.3s ease',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: colors.hunterGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px'
            }} onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = '#a3b18a';
              (e.target as HTMLElement).style.backgroundColor = '#a3b18a20';
            }} onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = colors.sage;
              (e.target as HTMLElement).style.backgroundColor = colors.hunterGreen;
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
            </a>
            <a href="tel:+6584514388" style={{
              color: colors.sage,
              fontSize: '1.2rem',
              transition: 'color 0.3s ease',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: colors.hunterGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px'
            }} onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = '#a3b18a';
              (e.target as HTMLElement).style.backgroundColor = '#a3b18a20';
            }} onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = colors.sage;
              (e.target as HTMLElement).style.backgroundColor = colors.hunterGreen;
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{
        marginTop: isMobile ? '30px' : '40px',
        paddingTop: '20px',
        borderTop: '1px solid colors.hunterGreen'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: isMobile ? 'center' : 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{
            color: colors.sage,
            fontSize: isMobile ? '0.8rem' : '0.9rem',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textAlign: isMobile ? 'center' : 'left'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M14.83 14.83a4 4 0 1 1 0-5.66"></path>
            </svg>
            <span>2025 Tanmay Nargas. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

function App() {
  const [fontLoaded, setFontLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      document.body.style.cursor = 'auto';
      document.body.style.cursor = '';
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const checkFont = () => {
      try {
        if ('fonts' in document) {
          document.fonts.ready.then(() => {
            setFontLoaded(true);
            document.body.classList.add('font-loaded');
            document.body.classList.remove('font-loading');
          });
          
          document.fonts.load('1em ShinierPersonal').then(() => {
            setFontLoaded(true);
            document.body.classList.add('font-loaded');
            document.body.classList.remove('font-loading');
          }).catch(() => {
            setTimeout(() => {
              setFontLoaded(true);
              document.body.classList.add('font-loaded');
              document.body.classList.remove('font-loading');
            }, 3000);
          });
        } else {
          setTimeout(() => {
            setFontLoaded(true);
            document.body.classList.add('font-loaded');
            document.body.classList.remove('font-loading');
          }, 2000);
        }
      } catch (error) {
        console.warn('Font loading detection failed:', error);
        setFontLoaded(true);
        document.body.classList.add('font-loaded');
        document.body.classList.remove('font-loading');
      }
    };

    document.body.classList.add('font-loading');
    
    if (document.readyState === 'complete') {
      checkFont();
    } else {
      window.addEventListener('load', checkFont);
      return () => window.removeEventListener('load', checkFont);
    }
  }, []);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  return (
    <>
      {isLoading && <LoadingScreen onLoadingComplete={handleLoadingComplete} />}
      <Router>
        <div className={`App ${fontLoaded ? 'font-loaded' : 'font-loading'}`} style={{
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          minHeight: '100vh'
        }}>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/resume" element={<Resume />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </>
  );
}

export default App;
