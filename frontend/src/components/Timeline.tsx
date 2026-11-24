import React from 'react';
import { Timeline as TimelineUI, TimelineEntry } from './ui/timeline';

interface TimelineProps {
  colors: any;
  isMobile: boolean;
}

const Timeline: React.FC<TimelineProps> = ({ colors, isMobile }) => {
  const educationCards = [
    {
      date: 'August 2025 - Present',
      title: 'Master of Science in Artificial Intelligence',
      subtitle: 'Nanyang Technological University',
      description: 'Currently pursuing advanced studies in AI, focusing on machine learning, deep learning, and natural language processing. Working on learning how to apply AI techniques to real-world problems.',
      logo: '/images/logos/NTU.webp'
    },
    {
      date: 'July 2019 - August 2023',
      title: 'Bachelor of Technology in Mechantronics Engineering',
      subtitle: 'Manipal Institute of Technology',
      description: 'Completed undergraduate studies with a hollistic approach to mechanics, electronics, and robotics. Graduated with a minor in Robotics and Automation. Participated in various hackathons and gained hands-on lab experience.',
      logo: '/images/logos/MIT.webp'
    }
  ];

  const professionalCards = [
    {
      date: 'April 2026 - October 2026',
      title: 'Software Engineering Intern - AI Agents',
      subtitle: 'Bosch',
      description: 'Owned the AI stack end to end at Bosch Singapore: evaluated multi-agent pipelines, a self-hosted vLLM cluster with per-user usage tracking, and resilient browser automation wired into Power Automate.',
      logo: '/images/logos/Bosch.svg'
    },
    {
      date: 'February 2023 - January 2025',
      title: 'AI and Intelligent Automation Engineer',
      subtitle: 'Ericsson',
      description: 'Worked on various projects involving CI/CD pipelines, automation scripts, ML model deployments, and cloud infrastructure. Collaborated with cross-functional teams to deliver AI-driven solutions for end users.',
      logo: '/images/logos/Ericsson.svg'
    },
    {
      date: 'June 2022 - July 2022',
      title: 'Summer Intern',
      subtitle: 'VI Solutions',
      description: 'Gained hands-on experience using LabVIEW for virtual instrumentation. Coded a small project using firebase and used a MyRIO device to control a virtual robot.',
      logo: '/images/logos/VI-solutions.webp'
    }
  ];

  const mapToTimelineEntries = (cards: typeof educationCards): TimelineEntry[] =>
    cards.map((card) => ({
      title: card.date,
      content: (
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'flex-start',
            gap: isMobile ? '16px' : '24px',
          }}
        >
          {card.logo && (
            <div style={{
              width: isMobile ? '56px' : '72px',
              height: isMobile ? '56px' : '72px',
              borderRadius: '12px',
              overflow: 'hidden',
              flexShrink: 0,
              backgroundColor: colors.cardBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={card.logo}
                alt={card.title}
                loading="lazy"
                decoding="async"
                style={{ width: '75%', height: '75%', objectFit: 'contain' }}
              />
            </div>
          )}

          <div>
            <h3 style={{
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              color: colors.primaryText,
              fontWeight: 600,
              marginBottom: '4px',
              marginTop: 0,
              lineHeight: '1.3',
            }}>
              {card.title}
            </h3>

            <div style={{
              fontSize: isMobile ? '1rem' : '1.1rem',
              color: colors.secondaryText,
              fontWeight: 500,
              marginBottom: '12px',
            }}>
              {card.subtitle}
            </div>

            <p style={{
              fontSize: isMobile ? '0.95rem' : '1rem',
              color: colors.secondaryText,
              lineHeight: '1.6',
              margin: 0,
              fontWeight: 400,
            }}>
              {card.description}
            </p>
          </div>
        </div>
      ),
    }));

  return (
    <div style={{ backgroundColor: colors.mainBg, width: '100%' }}>
      {/* Professional Experience */}
      <div style={{
        padding: isMobile ? '60px 20px' : '100px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box' as const,
      }}>
        <h2 style={{
          fontSize: isMobile ? '1.8rem' : '2.2rem',
          color: colors.primaryText,
          fontWeight: '700',
          marginBottom: isMobile ? '20px' : '30px',
          textAlign: 'center' as const,
        }}>
          Professional Experience
        </h2>
        <TimelineUI data={mapToTimelineEntries(professionalCards)} colors={colors} isMobile={isMobile} />
      </div>

      {/* Education */}
      <div style={{
        padding: isMobile ? '60px 20px' : '100px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box' as const,
      }}>
        <h2 style={{
          fontSize: isMobile ? '1.8rem' : '2.2rem',
          color: colors.primaryText,
          fontWeight: '700',
          marginBottom: isMobile ? '20px' : '30px',
          textAlign: 'center' as const,
        }}>
          Education
        </h2>
        <TimelineUI data={mapToTimelineEntries(educationCards)} colors={colors} isMobile={isMobile} />
      </div>
    </div>
  );
};

export default Timeline;
