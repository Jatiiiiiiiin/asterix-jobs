import React from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-background-dark border-4 border-black dark:border-white shadow-[16px_16px_0px_rgba(0,0,0,0.15)] dark:shadow-[16px_16px_0px_rgba(255,255,255,0.05)] overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-emerald-500" />

        <div className="p-8 md:p-12 space-y-8">

          {/* Icon + close */}
          <div className="flex items-start justify-between">
            <div className="size-14 bg-black dark:bg-white flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-white dark:text-black">lock</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <p className="text-[9px] font-black tracking-[0.4em] text-emerald-500">
              Access Restricted
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.9]">
              Premium<br />Student Plan<br />Required
            </h2>
            <p className="text-xs font-bold tracking-widest opacity-40 leading-relaxed pt-1">
              Manual applications are reserved for Premium Student members.
              Free plan users can only be auto-matched via Neural Auto-Pilot.
            </p>
          </div>

          {/* Feature comparison */}
          <div className="space-y-2 border-t border-black/10 dark:border-white/10 pt-6">
            {[
              { label: 'Neural Auto-Pilot matching', free: true, premium: true },
              { label: 'View all live mandates', free: true, premium: true },
              { label: 'Manual Initialize (apply)', free: false, premium: true },
              { label: 'Full job detail access', free: false, premium: true },
              { label: 'Priority recruiter visibility', free: false, premium: true },
            ].map(({ label, free, premium }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
                <span className="text-[10px] font-black tracking-widest opacity-60">{label}</span>
                <div className="flex gap-6">
                  <span className={`text-[10px] font-black ${free ? 'text-emerald-500' : 'opacity-20'}`}>
                    {free ? '✓' : '✗'}
                  </span>
                  <span className={`text-[10px] font-black ${premium ? 'text-emerald-500' : 'opacity-20'}`}>
                    {premium ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            ))}
            {/* Column headers */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[8px] font-black tracking-widest opacity-30">Feature</span>
              <div className="flex gap-4">
                <span className="text-[8px] font-black tracking-widest opacity-30 w-6 text-center">Free</span>
                <span className="text-[8px] font-black tracking-widest text-emerald-500 w-10 text-center">Student</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                // TODO: route to your upgrade/pricing page
                onClose();
              }}
              className="flex-1 bg-black dark:bg-white text-white dark:text-black py-4 text-[10px] font-black tracking-widest hover:invert transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">upgrade</span>
              Upgrade to Student Plan
            </button>
            <button
              onClick={onClose}
              className="flex-1 border-2 border-black/20 dark:border-white/20 py-4 text-[10px] font-black tracking-widest opacity-40 hover:opacity-100 hover:border-black dark:hover:border-white transition-all"
            >
              Stay on Free
            </button>
          </div>

          {/* Footnote */}
          <p className="text-[8px] font-black tracking-widest opacity-20 text-center">
            No payment gateway required — contact support to activate your student plan.
          </p>
        </div>
      </div>
    </div>
  );
}
