import React from "react";
import { CheckCircle2 } from "lucide-react";

interface CompactActionCardProps {
  icon: React.ReactNode;
  onAction: () => void;
  isSuccess?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
  "data-testid"?: string;
}

const CompactActionCard: React.FC<CompactActionCardProps> = ({ 
  icon, 
  onAction, 
  isSuccess, 
  theme = 'dark',
  className = "",
  "data-testid": dataTestId
}) => {
  const baseStyles = "relative w-[72px] h-[72px] md:w-[84px] md:h-[84px] flex items-center justify-center transition-all group overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border active:scale-[0.98]";
  
  const themeStyles = theme === 'dark' 
    ? (isSuccess 
        ? "bg-white text-brand-green border-white shadow-xl shadow-white/20" 
        : "bg-white/10 hover:bg-white/20 backdrop-blur-xl border-white/20 text-white")
    : (isSuccess
        ? "bg-brand-green text-white border-brand-green shadow-xl shadow-brand-green/20"
        : "bg-neutral-50 hover:bg-neutral-100 border-neutral-100 text-neutral-600");

  const iconBgStyles = theme === 'dark'
    ? "bg-white/10 group-hover:bg-white/20"
    : "bg-white shadow-sm group-hover:shadow-md";

  return (
    <button 
      onClick={onAction}
      data-testid={dataTestId}
      className={`${baseStyles} ${themeStyles} ${className}`}
    >
      {/* Original Content */}
      <div className={`transition-all duration-300 ${isSuccess ? 'opacity-0 scale-75 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className={`p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 ${iconBgStyles}`}>
          {icon}
        </div>
      </div>

      {/* Success Content Overlay */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${isSuccess ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-75 pointer-events-none'}`}>
        <div className={`flex flex-col items-center transition-all duration-500 delay-100 ${isSuccess ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-brand-green' : 'text-white'}`}>
            Copied!
          </span>
        </div>
      </div>
    </button>
  );
};

export default CompactActionCard;
