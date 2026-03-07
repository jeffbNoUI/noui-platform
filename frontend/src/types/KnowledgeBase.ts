/** Knowledge Base article — contextual help indexed by workflow stage. */
export interface KBArticle {
  articleId: string;
  tenantId: string;
  stageId: string;
  topic?: string;
  title: string;
  /** Main explanatory context text. */
  context: string;
  /** Checklist items ("What to check"). */
  checklist: string[];
  /** Recommended next step (shown in Guided mode). */
  nextAction?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;

  /** Rule references linked to this article. */
  rules?: KBRuleReference[];
}

/** Rule reference — links to a specific RMC section or business rule. */
export interface KBRuleReference {
  referenceId: string;
  articleId: string;
  ruleId: string;
  /** Display code, e.g. "RMC §18-201". */
  code: string;
  /** Human-readable description. */
  description: string;
  /** Domain grouping, e.g. "eligibility", "salary", "dro". */
  domain?: string;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
}
