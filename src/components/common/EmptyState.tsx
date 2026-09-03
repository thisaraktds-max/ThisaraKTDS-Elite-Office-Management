import React from 'react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  iconType?: 'applicants' | 'ledger' | 'balance' | 'search' | 'documents' | 'family';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  iconType = 'applicants',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-card/60 border border-dashed border-border/80 my-4 animate-fade">
      {/* Editorial Line-Art Graphic */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 text-primary relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/5 -z-10 scale-110"></div>
        {iconType === 'applicants' && (
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="32" cy="20" r="10" className="text-primary" />
            <path d="M14 52c0-9.941 8.059-18 18-18s18 8.059 18 18" className="text-primary" />
            <path d="M44 26l6 6 10-10" className="text-accent stroke-[2.5]" />
          </svg>
        )}
        {iconType === 'ledger' && (
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="10" width="40" height="46" rx="4" className="text-primary" />
            <line x1="20" y1="22" x2="44" y2="22" className="text-muted-foreground" />
            <line x1="20" y1="32" x2="36" y2="32" className="text-muted-foreground" />
            <line x1="20" y1="42" x2="40" y2="42" className="text-muted-foreground" />
            <circle cx="44" cy="42" r="10" className="text-accent fill-card stroke-[2.5]" />
            <path d="M44 38v8M40 42h8" className="text-accent" />
          </svg>
        )}
        {iconType === 'balance' && (
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M32 8v44M16 20l16-6 16 6M10 32l6-12 6 12a6 6 0 0 1-12 0zM42 32l6-12 6 12a6 6 0 0 1-12 0zM22 56h20" className="text-primary" />
            <path d="M28 36l4 4 8-8" className="text-accent stroke-[2.5]" />
          </svg>
        )}
        {iconType === 'documents' && (
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 12h24l12 12v30a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" className="text-primary" />
            <polyline points="40 12 40 24 52 24" className="text-muted-foreground" />
            <line x1="22" y1="36" x2="42" y2="36" className="text-accent" />
            <line x1="22" y1="44" x2="34" y2="44" className="text-muted-foreground" />
          </svg>
        )}
        {iconType === 'family' && (
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 26l24-18 24 18v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V26z" className="text-primary" />
            <circle cx="32" cy="34" r="6" className="text-accent stroke-[2]" />
            <path d="M22 50c0-5.523 4.477-10 10-10s10 4.477 10 10" className="text-accent stroke-[2]" />
          </svg>
        )}
        {iconType === 'search' && (
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="28" cy="28" r="16" className="text-primary" />
            <line x1="40" y1="40" x2="54" y2="54" className="text-accent stroke-[3]" />
            <line x1="22" y1="28" x2="34" y2="28" className="text-muted-foreground" />
          </svg>
        )}
      </div>

      <h3 className="font-serif font-bold text-base text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">{description}</p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
