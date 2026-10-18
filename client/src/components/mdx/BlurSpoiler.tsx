import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface BlurSpoilerProps {
  children?: React.ReactNode;
  defaultBlurred?: boolean;
  globalBlur?: boolean;
}

export const BlurSpoiler: React.FC<BlurSpoilerProps> = ({
  children,
  defaultBlurred = true,
  globalBlur = false,
}) => {
  const [isBlurred, setIsBlurred] = useState(defaultBlurred || globalBlur);

  useEffect(() => {
    if (globalBlur) {
      setIsBlurred(true);
    }
  }, [globalBlur]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBlurred((prev) => !prev);
  };

  return (
    <span
      onClick={toggle}
      title={isBlurred ? 'Nhấn để hé mở câu tiếng Nhật' : 'Nhấn để che lại'}
      className={`inline-block relative cursor-pointer transition-all duration-200 rounded px-1.5 py-0.5 mx-0.5 align-baseline ${
        isBlurred
          ? 'filter blur-[5px] select-none opacity-40 bg-slate-800/60 hover:opacity-60'
          : 'bg-sky-500/10 hover:bg-sky-500/20 text-white'
      }`}
    >
      {children}
      {isBlurred && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="px-1.5 py-0.2 rounded bg-slate-900/90 text-amber-300 font-bold text-[10px] border border-amber-500/40 shadow-xs flex items-center gap-1 leading-none select-none">
            <Eye className="w-2.5 h-2.5 text-amber-400" />
            <span>Mở</span>
          </span>
        </span>
      )}
    </span>
  );
};
