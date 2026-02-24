
export type UserRole = 'candidate' | 'recruiter' | null;

export interface Job {
  id: string;
  title: string;
  department: string;

  company: {
    name: string;
    industry: string;
    website: string;
    headquarters: string;
    size: string;
    founded: number;
  };

  location: {
    type: string;
    city: string;
    remoteAllowed: boolean;
  };

  employmentType: string;

  salaryRange: {
    min: number;
    max: number;
    currency: string;
  };

  experienceRequired: string;
  educationRequired: string;
  openings: number;

  jobSummary: string;

  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  techStack: string[];
  benefits: string[];
  hiringProcess: string[];

  postedDate: string;
  applicationDeadline: string;

  matchScore: number;
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
