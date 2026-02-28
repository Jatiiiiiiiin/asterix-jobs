
export type UserRole = 'candidate' | 'recruiter' | null;

export interface Job {
  id: string;
  title: string;
  department?: string;

  company: {
    name: string;
    industry?: string;
    website?: string;
    headquarters?: string;
    size?: string;
    founded?: number | string;
  } | string;

  location: {
    type?: string;
    city: string;
    remoteAllowed?: boolean;
  } | string;

  employmentType?: string;

  salaryRange?: {
    min?: number | null;
    max?: number | null;
    currency: string;
  };

  experienceRequired?: string;
  educationRequired?: string;
  openings?: number;

  jobSummary?: string;

  responsibilities?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  techStack?: string[];
  benefits?: string[];
  hiringProcess?: string[];

  postedDate?: string;
  applicationDeadline?: string;

  matchScore?: number;
  applied?: boolean;
  analyzing?: boolean;
  matchHighlights?: string[];
  breakdown?: any;
}


export interface Candidate {
  id: string;
  name: string;
  title: string;
  experience: string;
  matchScore: number;
  skills: string[];
  status: string;
  avatarUrl?: string;
  tier?: 1 | 2 | 3;
  isUnlocked?: boolean;
}
