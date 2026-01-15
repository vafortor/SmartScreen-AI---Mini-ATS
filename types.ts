
export interface User {
  username: string;
  password?: string;
  name: string;
  role: string;
  tier: UserTier;
  createdAt: string;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  minYearsExperience: number;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  requiredCertifications: string[];
  educationLevel: string;
  salaryBand?: string;
  createdAt: string;
}

export interface Experience {
  title: string;
  company: string;
  duration: string;
  description: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  totalYearsExperience: number;
  skills: string[];
  education: string[];
  experience: Experience[];
  certifications: string[];
  rawText: string;
}

export interface ScoreBreakdown {
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  locationMatch: number;
  overallScore: number;
}

export interface CandidateScore {
  candidateId: string;
  jobId: string;
  score: ScoreBreakdown;
  flags: string[];
  status: 'top_fit' | 'borderline' | 'not_suitable';
  analysis: string;
  mismatchReason?: string;
  hasTailoringPotential?: boolean;
  transferableSkills?: string[];
}

export interface TailoredResume {
  suggestedSummary: string;
  optimizedExperience: {
    originalTitle: string;
    suggestedBullets: string[];
  }[];
  justification: string;
}

export interface TalentReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  pipelineHealthScore: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIAgentContext {
  currentView: View;
  activeJob?: Job;
  pipelineCount?: number;
  allJobs?: Job[];
}

export interface ResumeBuilderData {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: string[];
}

export type View = 'dashboard' | 'jobs' | 'candidates' | 'job-detail' | 'create-job' | 'billing' | 'settings' | 'auth' | 'resume-builder';

export type UserTier = 'free' | 'pro';

export interface TrialInfo {
  startDate: string;
  isExpired: boolean;
  daysRemaining: number;
}
