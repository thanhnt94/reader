import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';

import Dashboard from './pages/Dashboard';
import CourseDashboard from './pages/CourseDashboard';
import LessonReader from './pages/LessonReader';
import LiveEditor from './pages/LiveEditor';
import Login from './pages/Login';

// Production ErrorBoundary as required by Ecosystem Frontend White Screen Prevention
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 text-2xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred in Reader.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
          >
            Reload Reader
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { fetchUser, fetchAuthConfig } = useAppStore();

  useEffect(() => {
    fetchAuthConfig();
    fetchUser();
  }, [fetchAuthConfig, fetchUser]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/courses" element={<Dashboard />} />
          <Route path="/courses/:courseSlugOrId" element={<CourseDashboard />} />
          <Route path="/courses/:courseSlug/:lessonSlug" element={<LessonReader />} />
          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonReader />} />
          <Route path="/reader/:lessonId" element={<LessonReader />} />
          <Route path="/editor" element={<LiveEditor />} />
          <Route path="/editor/:lessonId" element={<LiveEditor />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
