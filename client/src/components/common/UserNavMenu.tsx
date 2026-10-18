import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User as UserIcon,
  LogOut,
  ShieldCheck,
  GraduationCap,
  LogIn,
  ChevronDown,
  BookOpen,
  Edit3,
  ExternalLink
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface UserNavMenuProps {
  className?: string;
  compactOnMobile?: boolean;
}

export const UserNavMenu: React.FC<UserNavMenuProps> = ({
  className = '',
  compactOnMobile = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn, logout } = useAppStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignIn = () => {
    const currentPath = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  };

  if (!isLoggedIn || !user) {
    return (
      <div className={`flex items-center ${className}`}>
        <button
          type="button"
          onClick={handleSignIn}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
          title="Đăng nhập tài khoản InMind"
        >
          <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Đăng nhập</span>
        </button>
      </div>
    );
  }

  const initial = (user.full_name || user.username || 'U')[0].toUpperCase();
  const isAdmin = user.role === 'admin';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* User Button Trigger */}
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 hover:border-slate-600 transition-all cursor-pointer"
        title="Tài khoản cá nhân"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-slate-950 text-xs font-black shadow-xs shrink-0">
          {initial}
        </div>

        <div className={`text-left ${compactOnMobile ? 'hidden sm:block' : ''}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white truncate max-w-[100px]">
              {user.full_name || user.username}
            </span>
            {isAdmin ? (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" />
                Admin
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] font-semibold flex items-center gap-0.5">
                <GraduationCap className="w-2.5 h-2.5" />
                Học viên
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform hidden sm:block ${
            isDropdownOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0f172a] border border-slate-700/80 shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Details Header */}
          <div className="px-4 py-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-slate-950 text-sm font-black shadow-md shadow-sky-500/20">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {user.full_name || user.username}
                </p>
                <p className="text-[11px] text-slate-400 font-mono truncate">
                  @{user.username}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {isAdmin ? 'Quản trị viên (Admin)' : 'Học viên'}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-1.5 space-y-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                navigate('/courses');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Thư viện khóa học</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/editor');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>Soạn thảo bài học (WYSIWYG)</span>
              </button>
            )}

            <a
              href="https://auth.inmind.site"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span>Tài khoản CentralAuth</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          </div>

          {/* Logout Action */}
          <div className="p-1.5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
