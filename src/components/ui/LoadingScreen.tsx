import React from 'react';
import { Shield } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading terminal records...',
  subtext = 'Elite International School · Admissions & Bursary Terminal',
  fullScreen = true,
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
      {/* Animated Crest Icon */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5 animate-pulse">
          <Shield className="w-8 h-8" />
        </div>
        <div className="absolute -inset-1.5 rounded-2xl border border-primary/20 animate-ping opacity-25 pointer-events-none" />
      </div>

      {/* Title & Brand */}
      <h2 className="font-serif text-xl font-bold text-foreground tracking-tight mb-1">
        Elite International School
      </h2>
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
        {subtext}
      </p>

      {/* Progress Line */}
      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden mb-3">
        <div className="h-full bg-primary rounded-full animate-indeterminate" />
      </div>

      {/* Status Message */}
      <p className="text-xs text-muted-foreground font-medium animate-pulse">
        {message}
      </p>
    </div>
  );

  if (!fullScreen) {
    return <div className="py-16 flex items-center justify-center">{content}</div>;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground transition-colors duration-300">
      {content}
    </div>
  );
};
