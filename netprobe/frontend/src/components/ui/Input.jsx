import { forwardRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const Input = forwardRef(({ error, success, className = '', ...p }, ref) => {
  const [focused, setFocused] = useState(false);
  const border = error ? 'border-[#ff453a]/50' : success ? 'border-[#00ff88]/40' : focused ? 'border-[#00ff88]/30' : 'border-[rgba(255,255,255,0.1)]';
  return (
    <div className="relative">
      <input
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full bg-[rgba(255,255,255,0.06)] border ${border} rounded-lg px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        {...p}
      />
      {error && <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#ff453a]" />}
      {success && !error && <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#00ff88]" />}
    </div>
  );
});
Input.displayName = 'Input';
