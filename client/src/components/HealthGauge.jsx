import { useMemo } from 'react';
import { calculateHealthScore } from '../lib/signal.js';
import { Card, Badge } from './ui/primitives.jsx';


export function HealthGauge({ live }) {
  const health = useMemo(() => calculateHealthScore(live), [live]);

  // SVG Gauge calculations (radius = 70, circumference = 2 * PI * 70 = ~439.82)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  // Semi-circle / 270 degree arc (75% of full circle)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (arcLength * health.score) / 100;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/50 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-950 p-6 border-zinc-200/80 dark:border-zinc-800/80 shadow-md transition-all">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Gauge Radial Display */}
        <div className="relative flex flex-col items-center justify-center">
          <svg className="w-48 h-48 transform -rotate-135" viewBox="0 0 180 180">
            {/* Background Arc */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth="12"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
              className="text-zinc-200 dark:text-zinc-800"
            />
            {/* Value Arc */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke={health.color}
              strokeWidth="12"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {health.score}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Health Score
            </span>
            <div className="mt-1">
              <Badge variant={health.variant} className="px-2.5 py-0.5 text-xs font-medium">
                {health.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="flex-1 w-full grid grid-cols-2 gap-3">
          <div className="flex flex-col p-3 rounded-xl bg-white/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Signal (35%)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-bold text-zinc-900 dark:text-white">
                {health.breakdown.signal.score}/100
              </span>
              <span className="text-xs text-zinc-500 font-mono">{health.breakdown.signal.label}</span>
            </div>
          </div>

          <div className="flex flex-col p-3 rounded-xl bg-white/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Latency (30%)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-bold text-zinc-900 dark:text-white">
                {health.breakdown.latency.score}/100
              </span>
              <span className="text-xs text-zinc-500 font-mono">{health.breakdown.latency.label}</span>
            </div>
          </div>

          <div className="flex flex-col p-3 rounded-xl bg-white/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Stability & Jitter (25%)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-bold text-zinc-900 dark:text-white">
                {health.breakdown.stability.score}/100
              </span>
              <span className="text-xs text-zinc-500 font-mono">{health.breakdown.stability.label}</span>
            </div>
          </div>

          <div className="flex flex-col p-3 rounded-xl bg-white/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Link Speed (10%)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-bold text-zinc-900 dark:text-white">
                {health.breakdown.speed.score}/100
              </span>
              <span className="text-xs text-zinc-500 font-mono">{health.breakdown.speed.label}</span>
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
}
