/**
 * Lead Qualification API Integration Tests
 *
 * Tests for POST /api/v1/leads/:id/qualify endpoint.
 */

import request from 'supertest';
import { Express } from 'express';
import { qualifyLeadWithAI } from '../../../src/services/AIQualificationService';
import { getLeadByIdOrFail, createLeadScore } from '../../../src/services/LeadService';
import { createTestApp } from '../../helpers/testApp';
import { createTestUserToken } from '../../helpers/testAuth';
import { Lead, LeadSource, LeadStatus, QualificationStatus } from '../../../src/models/Lead';
import { LeadScore } from '../../../src/models/LeadScore';
import { NotFoundError } from '../../../src/api/middleware/errorHandler';

// Mock the auth middleware to avoid database lookups
jest.mock('../../../src/api/middleware/auth', () => {
  const actual = jest.requireActual('../../helpers/mockAuth');
  return {
    ...jest.requireActual('../../../src/api/middleware/auth'),
    authenticate: actual.mockAuthenticate,
  };
});

// Mock services
jest.mock('../../../src/services/AIQualificationService');
jest.mock('../../../src/services/LeadService');

describe('POST /api/v1/leads/:id/qualify', () => {
  let app: Express;
  let authToken: string;
  const mockLeadId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create test app
    app = createTestApp();

    // Generate auth token
    authToken = createTestUserToken(mockUserId);
  });

  describe('Success Cases', () => {
    it('should qualify lead and return BANT scores with 200 OK', async () => {
      // Mock lead data
      const mockLead: Lead = {
        id: mockLeadId,
        name: 'John Doe',
        email: 'john.doe@acme.com',
        phone: '+1234567890',
        company: 'Acme Corp',
        lead_source: LeadSource.WEBSITE,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      const mockUpdatedLead: Lead = {
        ...mockLead,
        qualification_status: QualificationStatus.QUALIFIED,
      };

      // Mock AI qualification result
      const mockQualificationResult = {
        budget_score: 20,
        authority_score: 22,
        need_score: 18,
        timeline_score: 24,
        total_score: 84,
        reasoning: 'Strong enterprise lead with clear CRM need.',
        confidence: 0.85,
      };

      // Mock lead score
      const mockLeadScore: LeadScore = {
        id: 'score-123',
        lead_id: mockLeadId,
        budget_score: 20,
        authority_score: 22,
        need_score: 18,
        timeline_score: 24,
        total_score: 84,
        reasoning: 'Strong enterprise lead with clear CRM need.',
        confidence: 0.85,
        created_at: new Date('2024-01-01T12:00:00Z'),
        created_by: mockUserId,
      };

      // Set up mocks
      (getLeadByIdOrFail as jest.Mock)
        .mockResolvedValueOnce(mockLead) // First call - before qualification
        .mockResolvedValueOnce(mockUpdatedLead); // Second call - after qualification
      (qualifyLeadWithAI as jest.Mock).mockResolvedValue(mockQualificationResult);
      (createLeadScore as jest.Mock).mockResolvedValue(mockLeadScore);

      // Make request
      const response = await request(app)
        .post(`/api/v1/leads/${mockLeadId}/qualify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toMatchObject({
        leadId: mockLeadId,
        leadName: 'John Doe',
        qualificationStatus: 'qualified',
        score: {
          id: 'score-123',
          budget_score: 20,
          authority_score: 22,
          need_score: 18,
          timeline_score: 24,
          total_score: 84,
          reasoning: 'Strong enterprise lead with clear CRM need.',
          confidence: 0.85,
        },
        breakdown: {
          budget: {
            score: 20,
            percentage: 80,
            label: 'Very High',
          },
          authority: {
            score: 22,
            percentage: 88,
            label: 'Very High',
          },
          need: {
            score: 18,
            percentage: 72,
            label: 'High',
          },
          timeline: {
            score: 24,
            percentage: 96,
            label: 'Very High',
          },
          total: {
            score: 84,
            percentage: 84,
            label: 'Qualified',
          },
        },
      });

      // Verify service calls
      expect(getLeadByIdOrFail).toHaveBeenCalledWith(mockLeadId);
      expect(qualifyLeadWithAI).toHaveBeenCalledWith(mockLead);
      expect(createLeadScore).toHaveBeenCalledWith(
        mockLeadId,
        {
          budget_score: 20,
          authority_score: 22,
          need_score: 18,
          timeline_score: 24,
          reasoning: 'Strong enterprise lead with clear CRM need.',
          confidence: 0.85,
        },
        mockUserId
      );
    });
  });

  describe('Error Cases', () => {
    it('should return 400 for invalid lead ID format', async () => {
      const invalidLeadId = 'not-a-uuid';

      const response = await request(app)
        .post(`/api/v1/leads/${invalidLeadId}/qualify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_LEAD_ID',
          message: 'Invalid lead ID format. Must be a valid UUID.',
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 404 when lead not found', async () => {
      const nonExistentLeadId = '550e8400-e29b-41d4-a716-446655440099';

      // Mock getLeadByIdOrFail to throw NotFoundError
      (getLeadByIdOrFail as jest.Mock).mockRejectedValue(
        new NotFoundError(`Lead with ID "${nonExistentLeadId}" not found`)
      );

      const response = await request(app)
        .post(`/api/v1/leads/${nonExistentLeadId}/qualify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 502 when Claude API is unavailable', async () => {
      const mockLead: Lead = {
        id: mockLeadId,
        name: 'John Doe',
        email: 'john.doe@acme.com',
        phone: '+1234567890',
        company: 'Acme Corp',
        lead_source: LeadSource.WEBSITE,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      (getLeadByIdOrFail as jest.Mock).mockResolvedValue(mockLead);
      (qualifyLeadWithAI as jest.Mock).mockRejectedValue(
        new Error('Claude API network timeout')
      );

      const response = await request(app)
        .post(`/api/v1/leads/${mockLeadId}/qualify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(502);

      expect(response.body).toMatchObject({
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: expect.stringContaining('temporarily unavailable'),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 401 when authentication is missing', async () => {
      const response = await request(app)
        .post(`/api/v1/leads/${mockLeadId}/qualify`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: expect.stringContaining('authentication'),
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('BANT Scoring Logic', () => {
    it('should qualify lead with total score >= 60', async () => {
      const mockLead: Lead = {
        id: mockLeadId,
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1234567890',
        company: 'Example Inc',
        lead_source: LeadSource.REFERRAL,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      const mockUpdatedLead: Lead = {
        ...mockLead,
        qualification_status: QualificationStatus.QUALIFIED,
      };

      const mockQualificationResult = {
        budget_score: 15,
        authority_score: 15,
        need_score: 15,
        timeline_score: 15,
        total_score: 60,
        reasoning: 'Meets qualification threshold.',
        confidence: 0.75,
      };

      const mockLeadScore: LeadScore = {
        id: 'score-456',
        lead_id: mockLeadId,
        ...mockQualificationResult,
        created_at: new Date('2024-01-01T12:00:00Z'),
        created_by: mockUserId,
      };

      (getLeadByIdOrFail as jest.Mock)
        .mockResolvedValueOnce(mockLead)
        .mockResolvedValueOnce(mockUpdatedLead);
      (qualifyLeadWithAI as jest.Mock).mockResolvedValue(mockQualificationResult);
      (createLeadScore as jest.Mock).mockResolvedValue(mockLeadScore);

      const response = await request(app)
        .post(`/api/v1/leads/${mockLeadId}/qualify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Total score of 60 should result in qualification_status = 'qualified'
      expect(response.body.qualificationStatus).toBe('qualified');
      expect(response.body.score.total_score).toBeGreaterThanOrEqual(60);
    });

    it('should mark lead as in_progress with score 40-59', async () => {
      const mockLead: Lead = {
        id: mockLeadId,
        name: 'Bob Wilson',
        email: 'bob@example.com',
        phone: '+1234567890',
        company: 'Wilson Ltd',
        lead_source: LeadSource.LINKEDIN,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      const mockUpdatedLead: Lead = {
        ...mockLead,
        qualification_status: QualificationStatus.IN_PROGRESS,
      };

      const mockQualificationResult = {
        budget_score: 10,
        authority_score: 12,
        need_score: 13,
        timeline_score: 15,
        total_score: 50,
        reasoning: 'Moderate potential.',
        confidence: 0.65,
      };

      const mockLeadScore: LeadScore = {
        id: 'score-789',
        lead_id: mockLeadId,
        ...mockQualificationResult,
        created_at: new Date('2024-01-01T12:00:00Z'),
        created_by: mockUserId,
      };

      (getLeadByIdOrFail as jest.Mock)
        .mockResolvedValueOnce(mockLead)
        .mockResolvedValueOnce(mockUpdatedLead);
      (qualifyLeadWithAI as jest.Mock).mockResolvedValue(mockQualificationResult);
      (createLeadScore as jest.Mock).mockResolvedValue(mockLeadScore);

      const response = await request(app)
        .post(`/api/v1/leads/${mockLeadId}/qualify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Total score between 40-59 should result in qualification_status = 'in_progress'
      expect(response.body.qualificationStatus).toBe('in_progress');
      expect(response.body.score.total_score).toBeGreaterThanOrEqual(40);
      expect(response.body.score.total_score).toBeLessThan(60);
    });

    it('should disqualify lead with total score < 40', async () => {
      const mockLead: Lead = {
        id: mockLeadId,
        name: 'Alice Brown',
        email: 'alice@example.com',
        phone: '+1234567890',
        company: 'Brown Co',
        lead_source: LeadSource.COLD_CALL,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      const mockUpdatedLead: Lead = {
        ...mockLead,
        qualification_status: QualificationStatus.DISQUALIFIED,
      };

      const mockQualificationResult = {
        budget_score: 5,
        authority_score: 8,
        need_score: 10,
        timeline_score: 6,
        total_score: 29,
        reasoning: 'Low qualification potential.',
        confidence: 0.80,
      };

      const mockLeadScore: LeadScore = {
        id: 'score-101',
        lead_id: mockLeadId,
        ...mockQualificationResult,
        created_at: new Date('2024-01-01T12:00:00Z'),
        created_by: mockUserId,
      };

      (getLeadByIdOrFail as jest.Mock)
        .mockResolvedValueOnce(mockLead)
        .mockResolvedValueOnce(mockUpdatedLead);
      (qualifyLeadWithAI as jest.Mock).mockResolvedValue(mockQualificationResult);
      (createLeadScore as jest.Mock).mockResolvedValue(mockLeadScore);

      const response = await request(app)
        .post(`/api/v1/leads/${mockLeadId}/qualify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Total score < 40 should result in qualification_status = 'disqualified'
      expect(response.body.qualificationStatus).toBe('disqualified');
      expect(response.body.score.total_score).toBeLessThan(40);
    });
  });
});
