import React, { useState, useEffect } from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let minLoadTimeout: NodeJS.Timeout;
    let hasReachedTarget = false;
    
    const startTime = Date.now();
    const totalDuration = 2500;
    
    progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPercentage = Math.min((elapsed / totalDuration) * 100, 100);
      
      const variance = Math.random() * 3 - 1.5;
      const adjustedProgress = Math.min(Math.max(progressPercentage + variance, 0), 100);
      
      setProgress(adjustedProgress);
      
      if (adjustedProgress >= 100 && !hasReachedTarget) {
        hasReachedTarget = true;
        clearInterval(progressInterval);
        
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onLoadingComplete();
          }, 800);
        }, 300);
      }
    }, 50);

    minLoadTimeout = setTimeout(() => {
      if (!hasReachedTarget) {
        hasReachedTarget = true;
        setProgress(100);
        clearInterval(progressInterval);
        
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onLoadingComplete();
          }, 800);
        }, 300);
      }
    }, totalDuration + 500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(minLoadTimeout);
    };
  }, [onLoadingComplete]);

  return (
    <div className={`loading-screen ${!isVisible ? 'loading-screen--fade-out' : ''}`}>
      <div className="loading-screen__content">
        <div className="loading-screen__header">
          <h1 className="loading-screen__title">Tanmay Nargas</h1>
          <p className="loading-screen__subtitle">AI Engineer & ML Developer</p>
        </div>
        
        <div className="loading-screen__progress">
          <div className="loading-screen__progress-bar">
            <div 
              className="loading-screen__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="loading-screen__percentage">
            {Math.floor(progress)}%
          </div>
        </div>

        <div className="loading-screen__dots">
          <div className="loading-screen__dot loading-screen__dot--1"></div>
          <div className="loading-screen__dot loading-screen__dot--2"></div>
          <div className="loading-screen__dot loading-screen__dot--3"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
