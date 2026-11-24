import {
  useScroll,
  useTransform,
  motion,
} from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

export interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

interface TimelineColors {
  buttonPrimary: string;
  buttonHover: string;
  borderColor: string;
  cardBg: string;
  mainBg: string;
  [key: string]: string;
}

interface TimelineProps {
  data: TimelineEntry[];
  colors: TimelineColors;
  isMobile: boolean;
}

const DOT_SIZE = 40;
const DOT_INNER_SIZE = 16;
const DESKTOP_DOT_X = 260;
const MOBILE_DOT_X = 0;
const BASELINE_WIDTH = 1;
const ACTIVE_LINE_WIDTH = 3;

export const Timeline: React.FC<TimelineProps> = ({ data, colors, isMobile }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  const dotX = isMobile ? MOBILE_DOT_X : DESKTOP_DOT_X;
  const lineCenter = dotX + DOT_SIZE / 2;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", backgroundColor: colors.mainBg }}
    >
      <div
        ref={ref}
        style={{
          position: "relative",
          maxWidth: "1280px",
          margin: "0 auto",
          paddingBottom: isMobile ? 40 : 80,
        }}
      >
        {data.map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              paddingTop: index === 0 ? 20 : (isMobile ? 40 : 100),
            }}
          >
            {/* Sticky title column with dot — date is LEFT of dot on desktop */}
            <div
              style={{
                position: isMobile ? "relative" : "sticky",
                top: isMobile ? undefined : 120,
                alignSelf: isMobile ? undefined : "flex-start",
                zIndex: 40,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                width: isMobile ? undefined : dotX + DOT_SIZE + 20,
                flexShrink: 0,
              }}
            >
              {/* Title (date) — on desktop, positioned to the left of the dot */}
              {!isMobile && (
                <h3
                  style={{
                    margin: 0,
                    width: dotX - 12,
                    textAlign: "right",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: colors.secondaryText,
                  }}
                >
                  {item.title}
                </h3>
              )}

              {/* Dot */}
              <div
                style={{
                  position: isMobile ? "absolute" : "relative",
                  left: isMobile ? dotX : 12,
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.mainBg,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: DOT_INNER_SIZE,
                    height: DOT_INNER_SIZE,
                    borderRadius: "50%",
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.borderColor}`,
                  }}
                />
              </div>

              {/* Title (date) — on mobile, to the right of the dot */}
              {isMobile && (
                <h3
                  style={{
                    margin: 0,
                    paddingLeft: dotX + DOT_SIZE + 12,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: colors.secondaryText,
                  }}
                >
                  {item.title}
                </h3>
              )}
            </div>

            {/* Content column */}
            <div
              style={{
                position: "relative",
                width: "100%",
                paddingLeft: isMobile ? dotX + DOT_SIZE + 8 : 0,
                paddingRight: 16,
                paddingTop: isMobile ? 16 : 0,
                paddingBottom: isMobile ? 0 : 160,
              }}
            >
              {item.content}
            </div>
          </div>
        ))}

        {/* Baseline — very faint */}
        <div
          style={{
            position: "absolute",
            left: lineCenter - BASELINE_WIDTH / 2,
            top: 0,
            width: BASELINE_WIDTH,
            height: height,
            background: `linear-gradient(to bottom, transparent 0%, ${colors.accentText}33 10%, ${colors.accentText}33 90%, transparent 100%)`,
          }}
        />

        {/* Active progress line — brighter and thicker */}
        <div
          style={{
            position: "absolute",
            left: lineCenter - ACTIVE_LINE_WIDTH / 2,
            top: 0,
            width: ACTIVE_LINE_WIDTH,
            height: height,
            overflow: "hidden",
          }}
        >
          <motion.div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              width: ACTIVE_LINE_WIDTH,
              height: heightTransform,
              opacity: opacityTransform,
              background: `linear-gradient(to top, ${colors.buttonPrimary}, ${colors.buttonHover}, transparent)`,
              borderRadius: 9999,
            }}
          />
        </div>
      </div>
    </div>
  );
};
