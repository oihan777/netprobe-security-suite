import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const V = {
  primary:   'bg-[rgba(0,255,136,0.15)] border-[rgba(0,255,136,0.3)] text-[#00ff88] hover:bg-[rgba(0,255,136,0.25)]',
  secondary: 'bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.7)] hover:text-white hover:bg-[rgba(255,255,255,0.1)]',
  danger:    'bg-[rgba(255,69,58,0.15)] border-[rgba(255,69,58,0.3)] text-[#ff453a] hover:bg-[rgba(255,69,58,0.25)]',
  ghost:     'bg-transparent border-transparent text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]',
};
const S = {
  xs: 'px-2 py-1 text-xs gap-1.5',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export function Button({ children, variant='secondary', size='md', icon, isLoading, disabled, className='', ...p }) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center border rounded-lg font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${V[variant]} ${S[size]} ${className}`}
      {...p}
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </motion.button>
  );
}
