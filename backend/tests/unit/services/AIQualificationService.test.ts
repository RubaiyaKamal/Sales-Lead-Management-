/**
 * AI Qualification Service Unit Tests
 *
 * Tests for Claude API integration and BANT scoring logic.
 */

import { Lead, LeadSource, LeadStatus, QualificationStatus } from '../../../src/models/Lead';

// Create mock functions before importing the service
const mockCreate = jest.fn();

// Mock Anthropic SDK before importing service
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }));
});

// Import after mock is set up
import { qualifyLeadWithAI } from '../../../src/services/AIQualificationService';

describe('AIQualificationService', () => {
  const mockLead: Lead = {
    id: 'lead-123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+12025551234',
    company: 'Acme Corp',
    lead_source: LeadSource.WEBSITE,
    status: LeadStatus.NEW,
    qualification_status: QualificationStatus.NOT_QUALIFIED,
    assigned_to: null,
    created_by: 'user-123',
    metadata: {
      utm_campaign: 'enterprise-2024',
      initial_message: 'Looking for a CRM solution for our sales team of 50 people',
    },
    created_at: new Date(),
    updated_at: new Date(),
    last_contacted_at: null,
    converted_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('qualifyLeadWithAI', () => {
    it('should successfully qualify lead and return BANT scores', async () => {
      // Mock Claude API response
      const mockClaudeResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              budget_score: 20,
              authority_score: 22,
              need_score: 18,
              timeline_score: 24,
              total_score: 84,
              reasoning: 'Strong enterprise lead with clear CRM need for 50-person team. High authority indicated, urgent timeline, allocated budget.',
              confidence: 0.85,
            }),
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 80,
        },
      };

      mockCreate.mockResolvedValue(mockClaudeResponse);

      const result = await qualifyLeadWithAI(mockLead);

      // Verify Claude API was called correctly
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          max_tokens: expect.any(Number),
          temperature: expect.any(Number),
          system: expect.stringContaining('BANT'),
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('John Doe'),
            },
          ],
        })
      );

      // Verify response structure
      expect(result).toEqual({
        budget_score: 20,
        authority_score: 22,
        need_score: 18,
        timeline_score: 24,
        total_score: 84,
        reasoning: expect.any(String),
        confidence: 0.85,
      });

      // Verify score validation
      expect(result.budget_score).toBeGreaterThanOrEqual(0);
      expect(result.budget_score).toBeLessThanOrEqual(25);
      expect(result.total_score).toBe(84);
    });

    it('should include lead metadata in qualification prompt', async () => {
      const mockClaudeResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              budget_score: 15,
              authority_score: 12,
              need_score: 14,
              timeline_score: 16,
              total_score: 57,
              reasoning: 'Medium-qualified lead with some budget and need.',
              confidence: 0.70,
            }),
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 80,
        },
      };

      mockCreate.mockResolvedValue(mockClaudeResponse);

      await qualifyLeadWithAI(mockLead);

      // Verify metadata is included in prompt
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;

      expect(userMessage).toContain('enterprise-2024'); // UTM campaign
      expect(userMessage).toContain('Looking for a CRM solution'); // Initial message
    });

    it('should handle Claude API errors gracefully', async () => {
      const mockError = new Error('API rate limit exceeded');
      mockCreate.mockRejectedValue(mockError);

      await expect(qualifyLeadWithAI(mockLead)).rejects.toThrow('API rate limit exceeded');
    });

    it('should handle invalid JSON response from Claude API', async () => {
      const mockClaudeResponse = {
        content: [
          {
            type: 'text',
            text: 'This is not valid JSON',
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 80,
        },
      };

      mockCreate.mockResolvedValue(mockClaudeResponse);

      await expect(qualifyLeadWithAI(mockLead)).rejects.toThrow('Failed to parse Claude API response as JSON');
    });

    it('should validate scores are within valid ranges', async () => {
      const mockClaudeResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              budget_score: 30, // Invalid: exceeds 25
              authority_score: 22,
              need_score: 18,
              timeline_score: 24,
              total_score: 94,
              reasoning: 'Invalid score test',
              confidence: 0.85,
            }),
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 80,
        },
      };

      mockCreate.mockResolvedValue(mockClaudeResponse);

      await expect(qualifyLeadWithAI(mockLead)).rejects.toThrow('Invalid qualification response');
    });

    it('should handle markdown code blocks in Claude response', async () => {
      const mockClaudeResponse = {
        content: [
          {
            type: 'text',
            text: '```json\n{"budget_score":20,"authority_score":22,"need_score":18,"timeline_score":24,"total_score":84,"reasoning":"Test","confidence":0.85}\n```',
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 80,
        },
      };

      mockCreate.mockResolvedValue(mockClaudeResponse);

      const result = await qualifyLeadWithAI(mockLead);

      expect(result.total_score).toBe(84);
      expect(result.confidence).toBe(0.85);
    });
  });
});
