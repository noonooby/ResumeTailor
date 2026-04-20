export interface WorkExperience {
  title: string;
  company: string;
  period: string;
  duration?: string; // Fallback for older data or AI variations
  description: string;
  achievements: string[];
  role?: string; // Keep for backward compatibility if needed
}

export interface Education {
  institution: string;
  degree: string;
  year: string;
  location?: string;
  details?: string[];
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
}

export interface AtsAnalysis {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  improvementReasoning: string;
}

export interface OptimizationResult {
  personalInfo: PersonalInfo;
  targetJob: { company: string, role: string };
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  certifications: string[];
  atsAnalysis: AtsAnalysis;
  coverLetter: string;
}

export interface CompanyConfig {
  name: string;
  bulletCount: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  company: string;
  role: string;
  score: number;
  jobDescription: string;
  result: OptimizationResult;
}

export interface MasterStyle {
  fontFamily: string;
  fontSizePt: number;
  margins: { top: number, bottom: number, left: number, right: number };
  spacing: { before: string, after: string, line: string, lineRule: string };
}

export type AppStep = 'input-job' | 'input-resume' | 'processing' | 'review' | 'history';
