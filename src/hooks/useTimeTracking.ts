import { useEffect, useRef, useState, useCallback } from 'react';

interface UseTimeTrackingProps {
  enabled?: boolean;
  onDurationUpdate?: (seconds: number) => void;
}

interface TimeTrackingState {
  startTime: number;
  pausedTime: number;
  elapsedSeconds: number;
  isActive: boolean;
  isPaused: boolean;
}

/**
 * Hook for tracking time spent in study sessions
 * - Automatically pauses when tab is hidden
 * - Resumes when tab becomes visible
 * - Updates in real-time
 * - Cleans up on unmount
 */
export const useTimeTracking = ({ 
  enabled = true, 
  onDurationUpdate 
}: UseTimeTrackingProps = {}) => {
  const stateRef = useRef<TimeTrackingState>({
    startTime: Date.now(),
    pausedTime: 0,
    elapsedSeconds: 0,
    isActive: enabled,
    isPaused: false,
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(enabled);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update elapsed time periodically
  useEffect(() => {
    if (!isActive || stateRef.current.isPaused) {
      return;
    }

    // Update immediately
    const updateTime = () => {
      const now = Date.now();
      const totalElapsed = Math.floor(
        (now - stateRef.current.startTime + stateRef.current.pausedTime) / 1000
      );
      stateRef.current.elapsedSeconds = totalElapsed;
      setElapsedSeconds(totalElapsed);
      
      // Call callback with update
      onDurationUpdate?.(totalElapsed);
    };

    updateTime();

    // Update every second
    intervalRef.current = setInterval(updateTime, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, onDurationUpdate]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - pause tracking
        stateRef.current.isPaused = true;
        setIsActive(false);
      } else {
        // Tab is visible - resume tracking
        if (stateRef.current.isPaused) {
          // Adjust start time to account for hidden period
          const hiddenDuration = Date.now() - stateRef.current.startTime;
          stateRef.current.startTime = Date.now();
          stateRef.current.isPaused = false;
        }
        setIsActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle browser close/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Don't prevent default, just ensure state is saved
      // Parent component should handle saving via onDurationUpdate callback
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Pause tracking
  const pause = useCallback(() => {
    stateRef.current.isPaused = true;
    setIsActive(false);
  }, []);

  // Resume tracking
  const resume = useCallback(() => {
    if (stateRef.current.isPaused) {
      stateRef.current.startTime = Date.now();
      stateRef.current.isPaused = false;
      setIsActive(true);
    }
  }, []);

  // Reset tracking
  const reset = useCallback(() => {
    stateRef.current = {
      startTime: Date.now(),
      pausedTime: 0,
      elapsedSeconds: 0,
      isActive: enabled,
      isPaused: false,
    };
    setElapsedSeconds(0);
    setIsActive(enabled);
  }, [enabled]);

  // Get elapsed time formatted as HH:MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }, []);

  return {
    elapsedSeconds,
    isActive,
    pause,
    resume,
    reset,
    formatTime,
    getSnapshot: () => ({
      elapsedSeconds: stateRef.current.elapsedSeconds,
      isPaused: stateRef.current.isPaused,
    }),
  };
};
