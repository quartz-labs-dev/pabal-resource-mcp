export interface WorkItem {
  id: string;
  title: string;
  summary: string;
  period?: string;
  screenshotUrl?: string;
  techStack?: string[];
  tags?: string[];
  links?: string[];
  order?: number;
}

export interface WorkLocaleData {
  items: WorkItem[];
}

export interface ResolvedWorkData {
  items: WorkItem[];
  usedLocale: string;
}
