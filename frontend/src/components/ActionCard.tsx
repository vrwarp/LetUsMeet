import React from "react";
import { Copy, CheckCircle2 } from "lucide-react";

interface ActionCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
  isCopied?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
  "data-testid"?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({ 
  icon, 
  label, 
  value, 
  onCopy, 
  isCopied, 
  theme = 'dark',
  className = "",
  "data-testid": dataTestId
}) => {
  const isClickable = !!onCopy;

  const baseStyles = "relative flex-1 min-w-[240px] flex items-center gap-4 transition-all group overflow-hidden h-[72px] md:h-[84px] py-3 px-5 rounded-[1.5rem] md:rounded-[2rem] border";
  
  const themeStyles = theme === 'dark' 
    ? (isCopied 
        ? "bg-white text-brand-green border-white shadow-xl shadow-white/20" 
        : "bg-white/10 hover:bg-white/20 backdrop-blur-xl border-white/20 text-white")
    : (isCopied
        ? "bg-brand-green text-white border-brand-green shadow-xl shadow-brand-green/20"
        : "bg-neutral-50 hover:bg-neutral-100 border-neutral-100 text-neutral-600");

  const iconBgStyles = theme === 'dark'
    ? "bg-white/10 text-white shadow-inner"
    : "bg-brand-green-light/50 text-brand-green";

  const labelStyles = theme === 'dark'
    ? "text-white/60"
    : "text-neutral-400";

  const valueStyles = theme === 'dark'
    ? "text-white"
    : "text-brand-charcoal";

  const cardContent = (
    <>
      {/* Original Content */}
      <div className={`flex items-center gap-4 transition-all duration-300 w-full ${isCopied ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className={`p-2.5 md:p-3 rounded-2xl group-hover:scale-110 transition-transform flex-shrink-0 ${iconBgStyles}`}>
          {icon}
        </div>
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[11px] uppercase tracking-[0.15em] font-black leading-none ${labelStyles}`}>{label}</span>
            {isClickable && <Copy className={`w-3.5 h-3.5 transition-colors ${theme === 'dark' ? 'text-white/40 group-hover:text-white' : 'text-neutral-300 group-hover:text-brand-green'}`} />}
          </div>
          <span className={`text-base font-bold leading-tight break-words line-clamp-2 ${valueStyles}`}>{value}</span>
        </div>
      </div>

      {/* Success Content Overlay */}
      <div className={`absolute inset-0 flex items-center justify-center gap-3 px-6 py-4 transition-all duration-500 ${isCopied ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className={`p-2.5 rounded-2xl shadow-lg ${theme === 'dark' ? 'bg-brand-green text-white' : 'bg-white text-brand-green'}`}>
          <CheckCircle2 className="w-6 h-6 animate-in zoom-in duration-300" />
        </div>
        <span className="font-black text-lg tracking-tight">Copied!</span>
      </div>
    </>
  );

  if (isClickable) {
    return (
      <button 
        onClick={onCopy}
        data-testid={dataTestId}
        className={`${baseStyles} ${themeStyles} ${className} active:scale-[0.98] text-left`}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div 
      data-testid={dataTestId}
      className={`${baseStyles} ${themeStyles} ${className}`}
    >
      {cardContent}
    </div>
  );
};

export default ActionCard;
