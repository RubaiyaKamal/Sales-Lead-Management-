/**
 * LeadScore Model
 *
 * Represents AI-generated qualification scores using BANT methodology.
 * Tracks historical scores over time (one lead can have multiple scores).
 */

/**
 * BANT scoring methodology:
 * - Budget: Does the lead have allocated budget? (0-25 points)
 * - Authority: Is the lead a decision-maker? (0-25 points)
 * - Need: Does the lead have a clear business need? (0-25 points)
 * - Timeline: Is there an urgent timeline to purchase? (0-25 points)
 *
 * Total Score: Sum of all four categories (0-100 points)
 */

/**
 * Individual BANT score (0-25 points)
 */
export type BANTScore = number; // Must be between 0 and 25 (enforced by DB CHECK constraint)

/**
 * Total BANT score (0-100 points)
 */
export type TotalScore = number; // Must be between 0 and 100 (sum of 4 BANT scores)

/**
 * Confidence level of AI scoring (0.0-1.0)
 */
export type ConfidenceScore = number; // Must be between 0.0 and 1.0

/**
 * LeadScore entity from database
 */
export interface LeadScore {
  /**
   * Unique identifier (UUID)
   */
  id: string;

  /**
   * Associated lead (FK to leads.id)
   */
  lead_id: string;

  /**
   * Budget score (0-25 points)
   * Evaluates if lead has allocated budget for the solution
   */
  budget_score: BANTScore;

  /**
   * Authority score (0-25 points)
   * Evaluates if lead has decision-making authority
   */
  authority_score: BANTScore;

  /**
   * Need score (0-25 points)
   * Evaluates if lead has a clear business need
   */
  need_score: BANTScore;

  /**
   * Timeline score (0-25 points)
   * Evaluates urgency of purchase timeline
   */
  timeline_score: BANTScore;

  /**
   * Total score (0-100 points)
   * Computed as: budget_score + authority_score + need_score + timeline_score
   */
  total_score: TotalScore;

  /**
   * AI reasoning text explaining the scores
   * Claude API provides natural language explanation
   */
  reasoning: string;

  /**
   * Confidence level of AI scoring (0.0-1.0)
   * Higher = more confident in the assessment
   */
  confidence: ConfidenceScore | null;

  /**
   * Score creation timestamp
   * Multiple scores can exist for same lead (historical tracking)
   */
  created_at: Date;
}

/**
 * Request payload for AI qualification
 * Sent to Claude API for BANT analysis
 */
export interface QualificationRequest {
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  leadCompany: string | null;
  leadSource: string;
  metadata: Record<string, any>;
}

/**
 * Response from Claude API after BANT analysis
 */
export interface QualificationResponse {
  budget_score: BANTScore;
  authority_score: BANTScore;
  need_score: BANTScore;
  timeline_score: BANTScore;
  total_score: TotalScore;
  reasoning: string;
  confidence: ConfidenceScore;
}

/**
 * Create lead score request (from AI qualification)
 */
export interface CreateLeadScoreRequest {
  lead_id: string;
  budget_score: BANTScore;
  authority_score: BANTScore;
  need_score: BANTScore;
  timeline_score: BANTScore;
  reasoning: string;
  confidence?: ConfidenceScore;
}

/**
 * BANT score breakdown for display
 */
export interface BANTBreakdown {
  budget: {
    score: BANTScore;
    percentage: number; // score / 25 * 100
    label: string; // 'Low', 'Medium', 'High', 'Very High'
  };
  authority: {
    score: BANTScore;
    percentage: number;
    label: string;
  };
  need: {
    score: BANTScore;
    percentage: number;
    label: string;
  };
  timeline: {
    score: BANTScore;
    percentage: number;
    label: string;
  };
  total: {
    score: TotalScore;
    percentage: number; // score / 100 * 100
    label: string; // 'Disqualified', 'In Progress', 'Qualified'
  };
}

/**
 * Constants for score thresholds
 */
export const SCORE_THRESHOLDS = {
  MIN_BANT_SCORE: 0,
  MAX_BANT_SCORE: 25,
  MIN_TOTAL_SCORE: 0,
  MAX_TOTAL_SCORE: 100,
  QUALIFIED_THRESHOLD: 60,
  IN_PROGRESS_THRESHOLD: 40,
  DISQUALIFIED_THRESHOLD: 40,
} as const;

/**
 * Validate BANT score (must be 0-25)
 */
export function isValidBANTScore(score: number): score is BANTScore {
  return (
    Number.isInteger(score) &&
    score >= SCORE_THRESHOLDS.MIN_BANT_SCORE &&
    score <= SCORE_THRESHOLDS.MAX_BANT_SCORE
  );
}

/**
 * Validate total score (must be 0-100)
 */
export function isValidTotalScore(score: number): score is TotalScore {
  return (
    Number.isInteger(score) &&
    score >= SCORE_THRESHOLDS.MIN_TOTAL_SCORE &&
    score <= SCORE_THRESHOLDS.MAX_TOTAL_SCORE
  );
}

/**
 * Validate confidence score (must be 0.0-1.0)
 */
export function isValidConfidenceScore(
  score: number
): score is ConfidenceScore {
  return score >= 0.0 && score <= 1.0;
}

/**
 * Calculate total score from individual BANT scores
 */
export function calculateTotalScore(
  budget: BANTScore,
  authority: BANTScore,
  need: BANTScore,
  timeline: BANTScore
): TotalScore {
  return (budget + authority + need + timeline) as TotalScore;
}

/**
 * Get label for BANT score (0-25)
 * - 0-6: Low
 * - 7-13: Medium
 * - 14-19: High
 * - 20-25: Very High
 */
export function getBANTScoreLabel(score: BANTScore): string {
  if (score <= 6) return 'Low';
  if (score <= 13) return 'Medium';
  if (score <= 19) return 'High';
  return 'Very High';
}

/**
 * Get label for total score (0-100)
 * - 0-39: Disqualified
 * - 40-59: In Progress
 * - 60-100: Qualified
 */
export function getTotalScoreLabel(score: TotalScore): string {
  if (score < SCORE_THRESHOLDS.IN_PROGRESS_THRESHOLD) return 'Disqualified';
  if (score < SCORE_THRESHOLDS.QUALIFIED_THRESHOLD) return 'In Progress';
  return 'Qualified';
}

/**
 * Convert LeadScore to BANT breakdown for display
 */
export function toBANTBreakdown(leadScore: LeadScore): BANTBreakdown {
  return {
    budget: {
      score: leadScore.budget_score,
      percentage: (leadScore.budget_score / 25) * 100,
      label: getBANTScoreLabel(leadScore.budget_score),
    },
    authority: {
      score: leadScore.authority_score,
      percentage: (leadScore.authority_score / 25) * 100,
      label: getBANTScoreLabel(leadScore.authority_score),
    },
    need: {
      score: leadScore.need_score,
      percentage: (leadScore.need_score / 25) * 100,
      label: getBANTScoreLabel(leadScore.need_score),
    },
    timeline: {
      score: leadScore.timeline_score,
      percentage: (leadScore.timeline_score / 25) * 100,
      label: getBANTScoreLabel(leadScore.timeline_score),
    },
    total: {
      score: leadScore.total_score,
      percentage: leadScore.total_score,
      label: getTotalScoreLabel(leadScore.total_score),
    },
  };
}

/**
 * Validate all scores in a qualification response
 */
export function validateQualificationResponse(
  response: QualificationResponse
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidBANTScore(response.budget_score)) {
    errors.push(
      `Invalid budget_score: ${response.budget_score} (must be 0-25)`
    );
  }
  if (!isValidBANTScore(response.authority_score)) {
    errors.push(
      `Invalid authority_score: ${response.authority_score} (must be 0-25)`
    );
  }
  if (!isValidBANTScore(response.need_score)) {
    errors.push(`Invalid need_score: ${response.need_score} (must be 0-25)`);
  }
  if (!isValidBANTScore(response.timeline_score)) {
    errors.push(
      `Invalid timeline_score: ${response.timeline_score} (must be 0-25)`
    );
  }
  if (!isValidTotalScore(response.total_score)) {
    errors.push(
      `Invalid total_score: ${response.total_score} (must be 0-100)`
    );
  }
  if (
    response.confidence !== undefined &&
    response.confidence !== null &&
    !isValidConfidenceScore(response.confidence)
  ) {
    errors.push(
      `Invalid confidence: ${response.confidence} (must be 0.0-1.0)`
    );
  }

  // Verify total score matches sum of BANT scores
  const expectedTotal = calculateTotalScore(
    response.budget_score,
    response.authority_score,
    response.need_score,
    response.timeline_score
  );
  if (response.total_score !== expectedTotal) {
    errors.push(
      `Total score mismatch: ${response.total_score} !== ${expectedTotal} (sum of BANT scores)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
