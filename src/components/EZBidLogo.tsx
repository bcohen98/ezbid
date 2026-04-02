import { Hammer } from 'lucide-react';

interface EZBidLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { icon: 'h-5 w-5', box: 'h-7 w-7', text: 'text-lg' },
  md: { icon: 'h-5 w-5', box: 'h-9 w-9', text: 'text-xl' },
  lg: { icon: 'h-7 w-7', box: 'h-12 w-12', text: 'text-3xl' },
};

export default function EZBidLogo({ size = 'md', className = '' }: EZBidLogoProps) {
  const s = sizes[size];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex items-center justify-center ${s.box} rounded-lg bg-[#1e3a5f]`}>
        <Hammer className={`${s.icon} text-white`} />
      </div>
      <span className={`font-bold ${s.text} tracking-tight`} style={{ color: '#1e3a5f' }}>
        EZ-Bid
      </span>
    </div>
  );
}
