import { useState, useEffect } from 'react';
import { Clock, Play, Pause } from 'lucide-react';

interface SessionTimerProps {
  startedAt?: string | null;
  pausedAt?: string | null;
  stoppedAt?: string | null;
  status?: string;
  pauseDurationMs?: number;
  className?: string;
}

export default function SessionTimer({
  startedAt,
  pausedAt,
  stoppedAt,
  status,
  pauseDurationMs = 0,
  className = '',
}: SessionTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsedMs(0);
      return;
    }

    const calculateElapsed = () => {
      const startTime = new Date(startedAt).getTime();
      let endTime: number;

      if (stoppedAt) {
        endTime = new Date(stoppedAt).getTime();
      } else if (pausedAt && status === 'paused') {
        endTime = new Date(pausedAt).getTime();
      } else {
        endTime = Date.now();
      }

      const totalElapsed = endTime - startTime - pauseDurationMs;
      setElapsedMs(Math.max(0, totalElapsed));
    };

    calculateElapsed();

    // Update every second if session is running
    if (status === 'running' && !stoppedAt) {
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [startedAt, pausedAt, stoppedAt, status, pauseDurationMs]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    if (status === 'running') {
      return <Play className="w-3 h-3 text-green-500" />;
    }
    if (status === 'paused') {
      return <Pause className="w-3 h-3 text-yellow-500" />;
    }
    return <Clock className="w-3 h-3 text-gray-400" />;
  };

  const getStatusColor = () => {
    if (status === 'running') return 'text-green-600 dark:text-green-400';
    if (status === 'paused') return 'text-yellow-600 dark:text-yellow-400';
    if (status === 'stopped' || status === 'completed') return 'text-gray-500';
    return 'text-gray-400';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {getStatusIcon()}
      <span className={`font-mono font-semibold ${getStatusColor()}`}>
        {formatTime(elapsedMs)}
      </span>
      {status === 'paused' && (
        <span className="text-xs text-muted-foreground">(Paused)</span>
      )}
    </div>
  );
}

interface JourneyTimerProps {
  journeyDurationMs?: number;
  sessionStartedAt?: string | null;
  currentPositionMs?: number;
  status?: string;
  className?: string;
}

export function JourneyTimer({
  journeyDurationMs,
  sessionStartedAt,
  currentPositionMs = 0,
  status,
  className = '',
}: JourneyTimerProps) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!journeyDurationMs || !sessionStartedAt || status !== 'running') {
      setRemainingMs(journeyDurationMs ? journeyDurationMs - currentPositionMs : 0);
      return;
    }

    const calculateRemaining = () => {
      const elapsed = Date.now() - new Date(sessionStartedAt).getTime();
      const remaining = Math.max(0, journeyDurationMs - currentPositionMs - elapsed);
      setRemainingMs(remaining);
    };

    calculateRemaining();

    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [journeyDurationMs, sessionStartedAt, currentPositionMs, status]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const percentComplete = journeyDurationMs
    ? Math.min(100, ((journeyDurationMs - remainingMs) / journeyDurationMs) * 100)
    : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Remaining</span>
        <span className="font-mono font-semibold">{formatTime(remainingMs)}</span>
      </div>
      {journeyDurationMs && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-1000"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      )}
    </div>
  );
}
