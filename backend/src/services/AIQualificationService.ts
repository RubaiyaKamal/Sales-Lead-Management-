/**
 * AI Qualification Service
 *
 * Integrates with OpenAI GPT API for lead qualification using BANT methodology.
 * Analyzes lead information and returns structured scoring across four dimensions:
 * - Budget (0-25 points)
 * - Authority (0-25 points)
 * - Need (0-25 points)
 * - Timeline (0-25 points)
 */

import OpenAI from 'openai';
import { config } from '../lib/config';
import { logger } from '../lib/logger';
import {
  QualificationRequest,
  QualificationResponse,
  validateQualificationResponse,
} from '../models/LeadScore';
import { Lead } from '../models/Lead';

/**
 * Initialize OpenAI API client
 */
const openai = new OpenAI({
  apiKey: config.ai.apiKey,
});

/**
 * System prompt for BANT lead qualification
 * Instructs GPT to analyze lead information and provide structured scoring
 */
const BANT_QUALIFICATION_PROMPT = `You are an expert sales qualification analyst specializing in the BANT (Budget, Authority, Need, Timeline) methodology.

Your task is to analyze lead information and provide a structured qualification score across four dimensions:

1. **Budget** (0-25 points): Does the lead have allocated budget or financial capacity?
   - 0-6: No budget or very limited
   - 7-13: Some budget, needs approval
   - 14-19: Budget allocated, minor approval needed
   - 20-25: Budget confirmed and ready

2. **Authority** (0-25 points): Is the lead a decision-maker or influencer?
   - 0-6: No decision-making power
   - 7-13: Can influence decision
   - 14-19: Part of decision-making team
   - 20-25: Primary decision-maker

3. **Need** (0-25 points): Does the lead have a clear business need?
   - 0-6: No clear need identified
   - 7-13: Vague or potential need
   - 14-19: Clear need, some urgency
   - 20-25: Critical need, well-defined

4. **Timeline** (0-25 points): Is there urgency to purchase?
   - 0-6: No timeline or far future
   - 7-13: Long-term consideration (6+ months)
   - 14-19: Medium-term timeline (3-6 months)
   - 20-25: Urgent timeline (<3 months)

**Input**: You will receive lead information including name, email, company, source, and any available metadata.

**Output**: Provide a JSON response with the following structure (IMPORTANT: respond ONLY with valid JSON, no additional text):

{
  "budget_score": <integer 0-25>,
  "authority_score": <integer 0-25>,
  "need_score": <integer 0-25>,
  "timeline_score": <integer 0-25>,
  "total_score": <sum of all scores>,
  "reasoning": "<2-3 sentences explaining the scoring rationale>",
  "confidence": <decimal 0.0-1.0 indicating confidence in this assessment>
}

**Rules**:
- All scores must be integers between 0 and 25
- Total score must equal the sum of the four BANT scores
- Confidence must be a decimal between 0.0 and 1.0
- Reasoning must be concise (2-3 sentences) explaining key factors
- If information is limited, score conservatively and reflect this in confidence score
- Respond ONLY with valid JSON (no markdown, no code blocks, no additional text)`;

/**
 * Qualify lead using OpenAI GPT API
 *
 * @param lead - Lead to qualify
 * @returns Qualification response with BANT scores
 */
export async function qualifyLeadWithAI(
  lead: Lead
): Promise<QualificationResponse> {
  const request: QualificationRequest = {
    leadId: lead.id,
    leadName: lead.name,
    leadEmail: lead.email,
    leadPhone: lead.phone,
    leadCompany: lead.company,
    leadSource: lead.lead_source,
    metadata: lead.metadata || {},
  };

  logger.info(
    {
      leadId: lead.id,
      leadEmail: lead.email,
      leadSource: lead.lead_source,
    },
    'Starting AI lead qualification'
  );

  try {
    // Build user prompt with lead information
    const userPrompt = buildUserPrompt(request);

    logger.debug(
      {
        leadId: lead.id,
        model: config.ai.model,
        maxTokens: config.ai.maxTokens,
      },
      'Sending qualification request to OpenAI API'
    );

    // Call OpenAI API
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: BANT_QUALIFICATION_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const duration = Date.now() - startTime;

    // Extract response text
    const responseText = response.choices[0]?.message?.content || '';

    logger.debug(
      {
        leadId: lead.id,
        duration,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        responseLength: responseText.length,
      },
      'OpenAI API response received'
    );

    // Parse JSON response
    const qualificationResult = parseQualificationResponse(responseText);

    // Validate response
    const validation = validateQualificationResponse(qualificationResult);
    if (!validation.valid) {
      logger.error(
        {
          leadId: lead.id,
          errors: validation.errors,
          response: qualificationResult,
        },
        'Invalid qualification response from OpenAI API'
      );

      throw new Error(
        `Invalid qualification response: ${validation.errors.join(', ')}`
      );
    }

    logger.info(
      {
        leadId: lead.id,
        totalScore: qualificationResult.total_score,
        confidence: qualificationResult.confidence,
        duration,
      },
      'AI lead qualification completed successfully'
    );

    return qualificationResult;
  } catch (error) {
    logger.error(
      {
        error,
        leadId: lead.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to qualify lead with AI'
    );

    // Re-throw for error handling at handler level
    throw error;
  }
}

/**
 * Build user prompt from lead information
 *
 * @param request - Qualification request
 * @returns Formatted user prompt string
 */
function buildUserPrompt(request: QualificationRequest): string {
  const parts: string[] = [];

  parts.push(`Lead Information:`);
  parts.push(`- Name: ${request.leadName}`);
  parts.push(`- Email: ${request.leadEmail}`);

  if (request.leadPhone) {
    parts.push(`- Phone: ${request.leadPhone}`);
  }

  if (request.leadCompany) {
    parts.push(`- Company: ${request.leadCompany}`);
  }

  parts.push(`- Lead Source: ${request.leadSource}`);

  // Include relevant metadata
  if (request.metadata && Object.keys(request.metadata).length > 0) {
    parts.push(`\nAdditional Information:`);

    // UTM parameters
    if (request.metadata['utm_campaign']) {
      parts.push(`- Campaign: ${request.metadata['utm_campaign']}`);
    }
    if (request.metadata['utm_source']) {
      parts.push(`- Source: ${request.metadata['utm_source']}`);
    }
    if (request.metadata['utm_medium']) {
      parts.push(`- Medium: ${request.metadata['utm_medium']}`);
    }

    // Initial message
    if (request.metadata['initial_message']) {
      parts.push(`- Initial Message: ${request.metadata['initial_message']}`);
    }

    // Referral information
    if (request.metadata['referrer_name']) {
      parts.push(`- Referred by: ${request.metadata['referrer_name']}`);
    }

    // External score
    if (request.metadata['external_score'] !== undefined) {
      parts.push(`- External Quality Score: ${request.metadata['external_score']}`);
    }
  }

  parts.push(
    `\nPlease analyze this lead and provide BANT qualification scores.`
  );

  return parts.join('\n');
}

/**
 * Parse qualification response from OpenAI API
 *
 * @param responseText - Raw response text from OpenAI
 * @returns Parsed qualification response
 */
function parseQualificationResponse(responseText: string): QualificationResponse {
  try {
    // Remove any markdown code blocks if present
    let cleanedText = responseText.trim();

    // Remove markdown code fence if present
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    // Parse JSON
    const parsed = JSON.parse(cleanedText);

    return {
      budget_score: parsed.budget_score,
      authority_score: parsed.authority_score,
      need_score: parsed.need_score,
      timeline_score: parsed.timeline_score,
      total_score: parsed.total_score,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    };
  } catch (error) {
    logger.error(
      {
        error,
        responseText,
      },
      'Failed to parse qualification response JSON'
    );

    throw new Error(
      `Failed to parse OpenAI API response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Estimate AI qualification cost
 *
 * @param inputTokens - Number of input (prompt) tokens
 * @param outputTokens - Number of output (completion) tokens
 * @returns Estimated cost in USD
 */
export function estimateQualificationCost(
  inputTokens: number,
  outputTokens: number
): number {
  // GPT-4 Turbo pricing (as of Jan 2025)
  // Input: $10.00 per million tokens
  // Output: $30.00 per million tokens
  const INPUT_COST_PER_MILLION = 10.0;
  const OUTPUT_COST_PER_MILLION = 30.0;

  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION;

  return inputCost + outputCost;
}
