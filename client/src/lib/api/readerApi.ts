import { apiClient } from './apiClient';

export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  role: string;
  sso_id?: string;
}

export interface AuthConfig {
  auth_provider: string;
  sso_enabled: boolean;
  central_auth_url: string;
  jump_url?: string | null;
}

export interface TOCItem {
  id: string;
  level: number;
  text: string;
}

export interface LessonProgress {
  is_completed: boolean;
  last_scroll_pos: number;
  last_audio_pos: number;
}

export interface Lesson {
  id: number;
  chapter_id: number;
  slug: string;
  title: string;
  order_num: number;
  raw_markdown?: string;
  audio_url?: string | null;
  timestamps_url?: string | null;
  duration_seconds: number;
  tts_enabled: boolean;
  tts_generated: boolean;
  frontmatter_data?: Record<string, any> | null;
  toc_data?: TOCItem[] | null;
  chapter?: { id: number; title: string; course_id: number };
  course?: { id: number; title: string };
  progress?: LessonProgress | null;
}

export interface Chapter {
  id: number;
  course_id: number;
  slug: string;
  title: string;
  order_num: number;
  lessons?: Lesson[];
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  cover_image?: string;
  order_num: number;
  chapter_count?: number;
  lesson_count?: number;
  completed_count?: number;
  chapters?: Chapter[];
}

export interface UserSettings {
  reading_theme: 'dark' | 'sepia' | 'light';
  font_size: 'sm' | 'base' | 'lg' | 'xl';
  line_spacing: 'normal' | 'relaxed' | 'loose';
  audio_speed: number;
  auto_scroll: boolean;
  tts_wake_lock?: boolean;
  tts_auto_advance?: boolean;
}

export interface LessonComment {
  id: number;
  lesson_id: number;
  user_id: number;
  parent_id?: number | null;
  content: string;
  created_at: string;
  updated_at?: string;
  user?: {
    username: string;
    full_name?: string;
    role: string;
  };
}

export interface UserLessonNote {
  id?: number | null;
  lesson_id: number;
  user_id: number;
  content: string;
  created_at?: string;
  updated_at?: string | null;
}

export const readerApi = {
  // Auth
  getAuthConfig: async (): Promise<AuthConfig> => {
    const res = await apiClient.get('/api/v1/auth/config');
    return res.data;
  },
  getMe: async (): Promise<{ authenticated: boolean; user: User | null }> => {
    const res = await apiClient.get('/api/v1/auth/me');
    return res.data;
  },
  login: async (credentials: any) => {
    const res = await apiClient.post('/api/v1/auth/login', credentials);
    return res.data;
  },
  logout: async () => {
    const res = await apiClient.get('/api/v1/auth/logout');
    return res.data;
  },

  // Courses
  getCourses: async (): Promise<Course[]> => {
    const res = await apiClient.get('/api/v1/courses');
    return res.data;
  },
  getCourseDetail: async (courseIdOrSlug: number | string): Promise<Course> => {
    const res = await apiClient.get(`/api/v1/courses/${courseIdOrSlug}`);
    return res.data;
  },
  createCourse: async (data: { title: string; description?: string; icon?: string }): Promise<Course> => {
    const res = await apiClient.post('/api/v1/courses', data);
    return res.data;
  },
  updateCourse: async (courseId: number, data: Partial<Course>): Promise<Course> => {
    const res = await apiClient.put(`/api/v1/courses/${courseId}`, data);
    return res.data;
  },
  deleteCourse: async (courseId: number) => {
    const res = await apiClient.delete(`/api/v1/courses/${courseId}`);
    return res.data;
  },

  // Chapters
  createChapter: async (courseId: number, data: { title: string; order_num?: number }): Promise<Chapter> => {
    const res = await apiClient.post(`/api/v1/courses/${courseId}/chapters`, data);
    return res.data;
  },
  updateChapter: async (chapterId: number, data: { title?: string; order_num?: number }): Promise<Chapter> => {
    const res = await apiClient.put(`/api/v1/chapters/${chapterId}`, data);
    return res.data;
  },
  deleteChapter: async (chapterId: number) => {
    const res = await apiClient.delete(`/api/v1/chapters/${chapterId}`);
    return res.data;
  },

  // Batch Upload Markdown
  batchUploadMarkdownToChapter: async (chapterId: number, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const res = await apiClient.post(`/api/v1/chapters/${chapterId}/batch-upload-md`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  batchUploadMarkdownToCourse: async (
    courseId: number,
    options: { chapterId?: number; newChapterTitle?: string; files: File[] }
  ): Promise<any> => {
    const formData = new FormData();
    if (options.chapterId) {
      formData.append('chapter_id', String(options.chapterId));
    }
    if (options.newChapterTitle) {
      formData.append('new_chapter_title', options.newChapterTitle);
    }
    options.files.forEach((f) => formData.append('files', f));
    const res = await apiClient.post(`/api/v1/courses/${courseId}/batch-upload-md`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Lessons
  getLessonDetail: async (lessonId: number | string): Promise<Lesson> => {
    const res = await apiClient.get(`/api/v1/lessons/${lessonId}`);
    return res.data;
  },
  createLesson: async (data: any): Promise<Lesson> => {
    const res = await apiClient.post('/api/v1/lessons', data);
    return res.data;
  },
  updateLesson: async (lessonId: number, data: Partial<Lesson>): Promise<Lesson> => {
    const res = await apiClient.put(`/api/v1/lessons/${lessonId}`, data);
    return res.data;
  },
  deleteLesson: async (lessonId: number) => {
    const res = await apiClient.delete(`/api/v1/lessons/${lessonId}`);
    return res.data;
  },
  updateProgress: async (lessonId: number, data: Partial<LessonProgress>) => {
    const res = await apiClient.post(`/api/v1/lessons/${lessonId}/progress`, data);
    return res.data;
  },
  generateTTS: async (lessonId: number) => {
    const res = await apiClient.post(`/api/v1/lessons/${lessonId}/generate-tts`);
    return res.data;
  },

  // Batch Import
  importZip: async (formData: FormData) => {
    const res = await apiClient.post('/api/v1/import/zip', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  importFolder: async (folderPath: string, courseTitle?: string) => {
    const res = await apiClient.post('/api/v1/import/folder', {
      folder_path: folderPath,
      course_title: courseTitle,
    });
    return res.data;
  },

  // Settings
  getUserSettings: async (): Promise<UserSettings> => {
    const res = await apiClient.get('/api/v1/user/settings');
    return res.data;
  },
  updateUserSettings: async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    const res = await apiClient.post('/api/v1/user/settings', settings);
    return res.data;
  },

  // Comments
  getLessonComments: async (lessonId: number): Promise<LessonComment[]> => {
    const res = await apiClient.get(`/api/v1/lessons/${lessonId}/comments`);
    return res.data;
  },
  postLessonComment: async (lessonId: number, content: string, parentId?: number | null): Promise<LessonComment> => {
    const res = await apiClient.post(`/api/v1/lessons/${lessonId}/comments`, {
      content,
      parent_id: parentId,
    });
    return res.data;
  },
  deleteLessonComment: async (lessonId: number, commentId: number) => {
    const res = await apiClient.delete(`/api/v1/lessons/${lessonId}/comments/${commentId}`);
    return res.data;
  },

  // Personal Notes
  getUserLessonNote: async (lessonId: number): Promise<UserLessonNote> => {
    const res = await apiClient.get(`/api/v1/lessons/${lessonId}/note`);
    return res.data;
  },
  saveUserLessonNote: async (lessonId: number, content: string): Promise<UserLessonNote> => {
    const res = await apiClient.put(`/api/v1/lessons/${lessonId}/note`, { content });
    return res.data;
  },
};
