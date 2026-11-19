import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView as fmUseInView, useReducedMotion } from 'framer-motion';
import ScrollReveal from '../ScrollReveal';
import AnimatedContent from '../AnimatedContent';
import Timeline from '../Timeline';
import { useIsMobile } from '../../utils/useIsMobile';
import { useNoWordSplit } from '../../utils/useNoWordSplit';
import CircularCarousel from '../CircularCarousel';
import { SOCIAL_LINKS } from '../../socialLinks';
import { colors, CARD_RADIUS, AnimatedSection, AnimationContext } from '../../App';
import { XIcon } from '../Icons';

const profileImages = [
  { src: '/images/profile/pfp.webp', alt: 'Tanmay Nargas, AI engineer', title: 'AI Engineer' },
  { src: '/images/profile/pfp2.webp', alt: 'Tanmay Nargas, developer', title: 'Developer' },
  { src: '/images/profile/pfp3.webp', alt: 'Tanmay Nargas, student', title: 'Student' },
  { src: '/images/profile/pfp4-updated.webp', alt: 'Tanmay Nargas, researcher', title: 'Researcher' },
  { src: '/images/profile/pfp5.webp', alt: 'Tanmay at the PSA Hackathon', title: 'PSA Hackathon' },
  { src: '/images/profile/pfp6.webp', alt: 'Tanmay at the SQ Collective demo', title: 'SQ Collective' },
  { src: '/images/profile/pfp7.webp', alt: 'Tanmay at the Lovable Hackathon', title: 'Lovable Hackathon' },
  { src: '/images/profile/pfp8.webp', alt: 'Tanmay speaking on a panel', title: 'Panel Talk' },
  { src: '/images/profile/pfp9.webp', alt: 'Tanmay at a hackathon', title: 'Hackathon' },
  { src: '/images/profile/pfp10.webp', alt: 'Tanmay working under the AI Labs sign', title: 'AI Labs' },
  { src: '/images/profile/pfp11.webp', alt: 'Tanmay speaking to a room of developers', title: 'Workshop' },
  { src: '/images/profile/pfp12.webp', alt: 'Tanmay presenting at SMU', title: 'SMU' },
];

// Technical Skills Data
const skillsData = {
  'Languages': [
    { name: 'C++', icon: '/images/skills/cplusplus.svg' },
    { name: 'Python', icon: '/images/skills/python.svg' },
    { name: 'JavaScript', icon: '/images/skills/javascript.svg' },
    { name: 'TypeScript', icon: '/images/skills/typescript.svg' },
    { name: 'HTML5', icon: '/images/skills/html5.svg' },
    { name: 'CSS3', icon: '/images/skills/css3.svg' },
    { name: 'Swift', icon: '/images/skills/swift.svg' },
    { name: 'Rust', icon: '/images/skills/rust.svg' },
  ],
  'Frameworks': [
    { name: 'React', icon: '/images/skills/react.svg' },
    { name: 'Node.js', icon: '/images/skills/node-js.svg' },
    { name: 'Django', icon: '/images/skills/django.svg' },
    { name: 'Flask', icon: '/images/skills/flask.svg' },
    { name: 'Tailwind CSS', icon: '/images/skills/tailwind-css.svg' },
    { name: 'TensorFlow', icon: '/images/skills/tensorflow.svg' },
    { name: 'PyTorch', icon: '/images/skills/pytorch.svg' },
    { name: 'Scikit-learn', icon: '/images/skills/scikit-learn.svg' },
    { name: 'NumPy', icon: '/images/skills/numpy.svg' },
    { name: 'Pandas', icon: '/images/skills/pandas.svg' },
    { name: 'LangChain', icon: '/images/skills/langchain.svg' },
    { name: 'LangGraph', icon: '/images/skills/langgraph.svg' },
    { name: 'Langfuse', icon: '/images/skills/langfuse.svg' },
    { name: 'vLLM', icon: '/images/skills/vllm.svg' },
    { name: 'Playwright', icon: '/images/skills/playwright.svg' },
  ],
  'Databases': [
    { name: 'PostgreSQL', icon: '/images/skills/postgresql.svg' },
    { name: 'MongoDB', icon: '/images/skills/mongodb.svg' },
    { name: 'Supabase', icon: '/images/skills/supabase.svg' },
    { name: 'SQLite', icon: '/images/skills/sqlite.svg' },

  ],
  'Tools': [
    { name: 'Git', icon: '/images/skills/git.svg' },
    { name: 'GitHub Actions', icon: '/images/skills/github-actions.svg' },
    { name: 'Docker', icon: '/images/skills/docker.svg' },
    { name: 'Linux', icon: '/images/skills/linux.svg' },
    { name: 'AWS', icon: '/images/skills/aws.svg' },
    { name: 'Azure DevOps', icon: '/images/skills/azure-devops.svg' },
    { name: 'VS Code', icon: '/images/skills/vs-code.svg' },
    { name: 'Postman', icon: '/images/skills/postman.svg' },
    { name: 'Figma', icon: '/images/skills/figma.svg' },
    { name: 'Groq', icon: '/images/skills/groq.png'},
  ]
};

// Technical Skills Component
const TechnicalSkills: React.FC = React.memo(() => {
  const [activeTab, setActiveTab] = useState('Languages');
  const isMobile = useIsMobile();
  const { canAnimate } = useContext(AnimationContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = fmUseInView(containerRef, { amount: 0.2, once: true });
  const reduce = useReducedMotion();

  const tabs = Object.keys(skillsData);

  const containerVariants = {
    hidden: {},
    visible: {}
  } as const;

  const itemVariants = reduce
    ? ({ hidden: { opacity: 0 }, visible: { opacity: 1 } } as const)
    : ({ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } } as const);

  const animateState = canAnimate && isInView ? 'visible' : 'hidden';

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: isMobile ? '24px' : '32px',
        padding: isMobile ? '0 8px' : '0'
      }}>
        <div
          aria-label="Technical skill categories"
          style={{
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
            <motion.button
              type="button"
              key={tab}
              aria-pressed={activeTab === tab}
              onClick={() => {
                if (tab !== activeTab) setActiveTab(tab);
              }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                fontWeight: '800',
                transition: 'background-color 80ms ease-out, color 80ms ease-out',
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
                  (e.target as HTMLElement).style.backgroundColor = colors.accentHover;
                  (e.target as HTMLElement).style.color = colors.primaryText;
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
            </motion.button>
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
          maxWidth: isMobile ? '640px' : '1000px',
          margin: '0 auto'
        }}>
          <motion.div
            key={activeTab}
            ref={containerRef}
            variants={containerVariants}
            initial="hidden"
            animate={animateState}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: isMobile ? '8px' : '12px',
              justifyContent: 'center',
              alignItems: 'stretch',
              margin: '0 auto',
              maxWidth: '100%'
            }}
          >
          {skillsData[activeTab as keyof typeof skillsData].map((skill, index) => (
            <motion.div
              key={`${activeTab}-skill-${index}`}
              variants={itemVariants}
              transition={{
                duration: reduce ? 0 : 0.14,
                delay: 0,
                ease: [0.4, 0, 0.2, 1]
              }}
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
                transition: 'background-color 0.1s ease, border-color 0.3s ease, color 0.3s ease',
                cursor: 'pointer',
                flex: isMobile ? '0 1 150px' : '0 1 200px',
                minWidth: isMobile ? '120px' : '160px',
                maxWidth: isMobile ? '180px' : '220px',
                height: isMobile ? '40px' : '44px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
              {skill.icon.startsWith('/') ? (
                <img
                  src={skill.icon}
                  alt={`${skill.name} logo`}
                  loading="lazy"
                  decoding="async"
                  width={isMobile ? 18 : 20}
                  height={isMobile ? 18 : 20}
                  style={{
                    height: isMobile ? '18px' : '20px',
                    width: isMobile ? '18px' : '20px',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    // Icon file missing: hide the broken image rather than show a placeholder glyph
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span style={{ fontSize: isMobile ? '18px' : '20px' }}>{skill.icon}</span>
              )}
              {skill.name}
            </motion.div>
          ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
});

const Home: React.FC = () => {
  const isMobile = useIsMobile();
  const aboutTextRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // no-op; this ensures aboutTextRef is initialized before hook runs
  }, []);
  useNoWordSplit(aboutTextRef, 'p');

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
        // Keep the next section outside the initial viewport while the hero enters.
        minHeight: isMobile ? '100dvh' : '100vh',
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
  {/* (Removed decorative background) */}

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
                Hi<span style={{ display: 'inline-block', transform: 'scale(1.15, 1.25)', transformOrigin: '50% 60%' }}>,</span> my name is
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
                fontWeight: '600',
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
              fontWeight: '400',
              color: colors.secondaryText,
              maxWidth: '600px',
              margin: '0 auto 50px',
              lineHeight: '1.6'
            }}>
              I am currently pursuing my MS in Artificial Intelligence from NTU Singapore. I am also looking for full-time opportunities in the AI space, post my experience as an Agentic AI Intern at Bosch.
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
                fontWeight: '600',
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
                fontWeight: '600',
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
                gap: isMobile ? '16px' : '40px',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
              {SOCIAL_LINKS.map((platform) => (
                <a
                  key={platform.label}
                  href={platform.href}
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
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.primaryText;
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.backgroundColor = colors.accentHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.accentText;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {platform.label}
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
              fontWeight: '700',
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          gap: 0
        }}>
          <AnimatedContent
            distance={80}
            direction="vertical"
            reverse={false}
            duration={1.2}
            ease="power3.out"
            initialOpacity={0}
            animateOpacity
            scale={1}
            threshold={0.2}
            delay={0.15}
            style={{ width: '100%' }}
          >
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1100px',
              height: isMobile ? 430 : 620,
              margin: '0 auto',
              color: colors.primaryText
            }}>
              <CircularCarousel
                items={profileImages}
                className="circular-carousel--fade-sides"
                preset="cylinder"
                intro="rise"
                cardWidth={isMobile ? 220 : 340}
                aspectRatio={1}
                gap={isMobile ? 16 : 28}
                speed={12}
                fadeColor={colors.mainBg}
                depthFade={0.72}
                cornerRadius={12}
              />
            </div>
          </AnimatedContent>
          <div ref={aboutTextRef} style={{
            width: '100%',
            maxWidth: '760px',
            marginTop: isMobile ? -36 : -72
          }}>
            {[
              "Welcome to my site! I'm a developer by profession and hobby, and a student pursuing my MS in AI at NTU.",
              "I enjoy creating things that intelligently leverage AI to solve problems. My interest in coding started back in 2013 when I first got my hands on a Raspberry Pi and learnt how to code in Python.",
              "I have since built a variety of projects, participated in hackathons, and attended conferences. I aim to keep learning and growing as a developer in all my future endeavors.",
            ].map((paragraph, i) => (
              <ScrollReveal
                key={i}
                baseOpacity={0.15}
                baseRotation={0}
                enableBlur={false}
                stagger={0.015}
                style={{ marginBottom: i === 2 ? '0' : '20px' }}
                textStyle={{
                  fontSize: isMobile ? '1rem' : '1.1rem',
                  fontWeight: 500,
                  color: colors.secondaryText,
                  lineHeight: '1.7',
                  textAlign: 'center',
                }}
              >
                {paragraph}
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <Timeline colors={colors} isMobile={isMobile} />

      {/* Featured Projects Preview */}
      <section style={{
        padding: isMobile ? '60px 20px' : '100px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <AnimatedSection>
        <div style={{ marginBottom: isMobile ? '40px' : '60px' }}>
          <h2 style={{
            fontSize: isMobile ? '1.6rem' : '2rem',
            color: colors.primaryText,
            fontWeight: '700',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '12px' : '20px',
            flexWrap: 'wrap'
          }}>
            Some Things I've Built
          </h2>
        </div>
        </AnimatedSection>

        <AnimatedContent>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(min(350px, 100%), 1fr))',
          gap: isMobile ? '20px' : '24px',
          width: '100%'
        }}>
          {[
            {
              title: 'Kelpie',
              description: 'Automatic spend tracking for iPhone, logged from the alert emails your bank already sends.',
              tech: ['Swift', 'SwiftUI', 'Next.js', 'Supabase', 'Gmail API'],
              features: [
                'Every card tap, PayNow and NETS payment logged automatically from bank alert emails, with no Shortcuts or manual entry',
                'Gmail push pipeline parses DBS/POSB alerts and commits each spend idempotently to the ledger, with anything unreadable held for review',
                'iPhone, Apple Watch and widget clients with budgets, subscriptions, statement import and a single SGD + INR ledger'
              ],
              liveDemoUrl: 'https://kelpie.site',
              twitterUrl: 'https://x.com/nottanjune/status/2111028384327458821'
            },
            {
              title: 'Every Round',
              description: 'AI-Powered Mock Interview Coach - Built for ARM',
              tech: ['Swift', 'SwiftUI', 'Supabase', 'Groq', 'ARM'],
              features: [
                'AI powered mock interviews that analyze eye contact, speech patterns, and confidence in real-time with instant feedback',
                'Privacy-preserving through on-device processing using ARM\'s Neural Engine with sub-30ms response times',
                'Comprehensive analytics including eye contact tracking, speaking pace analysis, sentiment scoring, and personalized improvement recommendations'
              ],
              liveDemoUrl: 'https://everyround.live'
            },
            {
              title: 'Locator (lctr)',
              description: '"lctr" is a Rust-built local metadata search CLI/TUI. It stores local SQLite indexes for filenames, paths, file kinds, sizes, and dates.',
              tech: ["Rust", "ratatui", "SQLite"],
              features: [
                'Instant local search for huge folders and external drives, without waiting on Finder or Spotlight.',
                'Private by design, with local SQLite metadata indexes and no cloud upload, telemetry, or background service.',
                'CLI plus interactive TUI workflow, so you can scan, search, filter, and script file lookups directly from the terminal.'
              ],
              liveDemoUrl: 'https://github.com/NotTanJune/locator#-demo',
              githubUrl: 'https://github.com/NotTanJune/locator',
            }
          ].map((project, index) => (
            <div key={index} style={{
              backgroundColor: colors.mainBg,
              border: `2px solid ${colors.borderColor}`,
              borderRadius: CARD_RADIUS,
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
                borderRadius: CARD_RADIUS,
                WebkitMaskImage: '-webkit-radial-gradient(white, black)'
              }}>
                {(() => {
                  const pngSrc = (() => {
                    switch(project.title) {
                      case 'Kelpie':
                        return '/images/projects/Kelpie.webp';
                      case 'Locator (lctr)':
                        return '/images/projects/lctr.webp';
                      case 'Branch To the Future (bttf)':
                        return '/images/projects/bttf.webp';
                      case 'LatentSDF':
                        return '/images/projects/latent.webp';
                      case 'Social Media AI Detector':
                        return '/images/projects/LLM.webp';
                      case 'DevDéx':
                        return '/images/projects/DevDex.webp';
                      case 'Profile Quest':
                        return '/images/projects/ProfileQuest.webp';
                      case 'Every Round':
                        return '/images/projects/Every-Round.webp';
                      case 'Anglerfish':
                        return '/images/projects/AnglerFish.webp';
                      case 'SentiStock':
                        return '/images/projects/SentiStock.webp';
                      case 'Vehicle Remix Studio':
                        return '/images/projects/VehicleRemixStudio.webp';
                      case 'StrAIt':
                        return '/images/projects/strait.webp';
                      case 'Grab a Degree':
                        return '/images/projects/GrabADegree.webp';
                      case 'Portfolio Website':
                        return '/images/projects/Portfolio.webp';
                      case 'Book My Ticket':
                        return '/images/projects/BMT.webp';
                      case 'Harbour':
                        return '/images/projects/Harbour.webp';
                      case 'Remote Control Robot':
                        return '/images/projects/RPi.webp';
                      case 'Binary Classification ML Model':
                        return '/images/projects/MLModel.webp';
                      default:
                        return '/images/projects/Portfolio.webp';
                    }
                  })();
                  return (
                    <img
                        src={pngSrc}
                        alt={project.title}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          const fallback = '/images/projects/Portfolio.webp';
                          if (!img.src.endsWith(fallback)) img.src = fallback;
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          objectPosition: 'center',
                          transition: 'transform 0.3s ease',
                          imageRendering: '-webkit-optimize-contrast',
                          backfaceVisibility: 'hidden',
                          transform: 'translateZ(0)',
                          willChange: 'transform',
                          borderRadius: CARD_RADIUS,
                          display: 'block'
                        }}
                      />
                  );
                })()}
              </div>

              {/* Header */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  lineHeight: '1',
                  color: colors.primaryText,
                  marginBottom: '8px'
                }}>
                  {project.title}
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '400',
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
                      fontWeight: '500',
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
                      fontWeight: '400'
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

                {project.githubUrl && (
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
                )}

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

                {project.twitterUrl && (
                  <a
                    href={project.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${project.title} announcement on X`}
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
                    <XIcon size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        </AnimatedContent>

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
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = colors.fernGreen;
              (e.target as HTMLElement).style.color = colors.white;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = colors.mainBg;
              (e.target as HTMLElement).style.color = colors.primaryText;
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

export default Home;
