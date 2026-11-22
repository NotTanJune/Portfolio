import React, { useEffect, useRef, useState } from 'react';
import './ProjectLot.css';
import { daysSince, formatAge, shortLanguage } from './format';
import { acquireLot, LotHandle, lotLayout, lotRendererKind, lotTargetFor } from './lotStage';
import { CityRepo } from './types';

export interface ProjectLotProps {
  repos: CityRepo[];
  repoName: string | null;  // lower-cased repo name from the card's GitHub link, or null
  park: number;             // which park to show when there is no building
  seed: string;             // the project title; fixes the starting angle
}

/**
 * A card's building turning slowly on a lot plate, or a park when the project has no building in the city.
 * Renders two siblings meant to be the first children of the card's footer row: the lot and, for a
 * building, a caption with its language and last push. The picture is drawn by the shared `lotStage`.
 * Cards are keyed by index, so one instance is handed a different project when the filter changes; the
 * picture, the caption and the height all follow the props.
 */
const ProjectLot: React.FC<ProjectLotProps> = ({ repos, repoName, park, seed }) => {
  const target = lotTargetFor(repos, repoName, park);
  const layout = lotLayout(repos, target);
  const repo = target.kind === 'building' && repoName
    ? repos.find((r) => r.name.toLowerCase() === repoName.toLowerCase()) || null
    : null;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<LotHandle | null>(null);
  const latest = useRef({ repos, repoName, park, seed });
  const [renderer, setRenderer] = useState<'webgl2' | 'canvas2d' | 'none'>('none');

  // Declared before the effects that read it, so it is current whenever they run.
  useEffect(() => {
    latest.current = { repos, repoName, park, seed };
  });

  // Once per mount: join the shared stage and follow the card's hover.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const now = latest.current;
    const handle = acquireLot(canvas, now.repos, lotTargetFor(now.repos, now.repoName, now.park), now.seed);
    handleRef.current = handle;
    setRenderer(handle ? lotRendererKind() : 'none');
    if (!handle) return undefined;
    const card = canvas.closest('[data-project-card]');
    const enter = (): void => handle.setHover(true);
    const leave = (): void => handle.setHover(false);
    if (card) {
      card.addEventListener('mouseenter', enter);
      card.addEventListener('mouseleave', leave);
    }
    return () => {
      if (card) {
        card.removeEventListener('mouseenter', enter);
        card.removeEventListener('mouseleave', leave);
      }
      handle.release();
      handleRef.current = null;
    };
  }, []);

  // The same instance can be handed another project: point the picture at it.
  useEffect(() => {
    const handle = handleRef.current;
    if (handle) handle.setTarget(lotTargetFor(repos, repoName, park));
  }, [repos, repoName, park]);

  return (
    <>
      <div
        className="project-lot"
        data-kind={target.kind}
        data-park={target.kind === 'park' ? target.park : undefined}
        data-renderer={renderer}
        style={{ width: layout.width, height: layout.height }}
      >
        <canvas
          className="project-lot__canvas"
          aria-hidden="true"
          ref={canvasRef}
          style={{ width: layout.width, height: layout.canvasHeight }}
        />
      </div>
      {repo && (
        <div className="project-lot__cap">
          {shortLanguage(repo.language)}
          <span>pushed {formatAge(daysSince(repo.pushedAt, Date.now()))}</span>
        </div>
      )}
    </>
  );
};

export default ProjectLot;
