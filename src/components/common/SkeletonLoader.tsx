import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 6 }) => {
  return (
    <div className="w-full space-y-2.5 animate-pulse py-2">
      <div className="h-10 bg-muted/60 rounded-lg w-full mb-3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
          <div className="h-4 w-5 bg-muted rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-4 flex-1 bg-muted/70 rounded" />
          <div className="h-4 w-20 bg-muted rounded hidden sm:block" />
          <div className="h-4 w-24 bg-muted/80 rounded" />
          <div className="h-7 w-16 bg-muted rounded-md" />
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 rounded-2xl bg-card border border-border/60 space-y-3">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-7 w-32 bg-muted/80 rounded" />
          <div className="h-3 w-full bg-muted/50 rounded" />
        </div>
      ))}
    </div>
  );
};
