/**
 * Create Lead API Integration Tests
 *
 * Tests for POST /api/v1/leads endpoint.
 * Covers User Story 1 - Create New Lead (Priority P1)
 */

import request from 'supertest';
import { Express } from 'express';
import { createLead } from '../../../src/services/LeadService';
import { createTestApp } from '../../helpers/testApp';
import { createTestUserToken, createAdminToken } from '../../helpers/testAuth';
import { Lead, LeadSource, LeadStatus, QualificationStatus } from '../../../src/models/Lead';
import { ConflictError } from '../../../src/api/middleware/errorHandler';

// Mock the auth middleware to avoid database lookups
jest.mock('../../../src/api/middleware/auth', () => {
  const actual = jest.requireActual('../../helpers/mockAuth');
  return {
    ...jest.requireActual('../../../src/api/middleware/auth'),
    authenticate: actual.mockAuthenticate,
  };
});

// Mock services
jest.mock('../../../src/services/LeadService');
jest.mock('../../../src/services/DaprPubSubService');

describe('POST /api/v1/leads', () => {
  let app: Express;
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  describe('Success Cases - Scenario 1: Create lead with all required fields', () => {
    it('should create lead and return 201 with complete lead object', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'john.doe@acme.com',
        phone: '+12025551234',
        company: 'Acme Corp',
        leadSource: LeadSource.WEBSITE,
        metadata: {
          utm_source: 'google',
          utm_campaign: 'summer-2024',
        },
      };

      const mockCreatedLead: Lead = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: requestBody.name,
        email: requestBody.email.toLowerCase(),
        phone: requestBody.phone,
        company: requestBody.company,
        lead_source: requestBody.leadSource,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: requestBody.metadata,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
        last_contacted_at: null,
        converted_at: null,
      };

      (createLead as jest.Mock).mockResolvedValue(mockCreatedLead);

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(201);

      // Verify response structure
      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: requestBody.name,
        email: requestBody.email.toLowerCase(),
        phone: requestBody.phone,
        company: requestBody.company,
        lead_source: requestBody.leadSource,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: requestBody.metadata,
      });

      // Verify service was called correctly
      expect(createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          name: requestBody.name,
          email: requestBody.email,
          phone: requestBody.phone,
          company: requestBody.company,
          leadSource: requestBody.leadSource,
          metadata: requestBody.metadata,
        }),
        mockUserId
      );
    });

    it('should create lead with minimal required fields only', async () => {
      const requestBody = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        leadSource: LeadSource.REFERRAL,
      };

      const mockCreatedLead: Lead = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: requestBody.name,
        email: requestBody.email.toLowerCase(),
        phone: null,
        company: null,
        lead_source: requestBody.leadSource,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockUserId,
        metadata: {},
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
        last_contacted_at: null,
        converted_at: null,
      };

      (createLead as jest.Mock).mockResolvedValue(mockCreatedLead);

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        name: requestBody.name,
        email: requestBody.email.toLowerCase(),
        phone: null,
        company: null,
        lead_source: requestBody.leadSource,
      });
    });
  });

  describe('Error Cases - Scenario 2: Duplicate email validation', () => {
    it('should return 409 Conflict when email already exists', async () => {
      const requestBody = {
        name: 'Duplicate User',
        email: 'existing@example.com',
        leadSource: LeadSource.WEBSITE,
      };

      (createLead as jest.Mock).mockRejectedValue(
        new ConflictError('Lead with email "existing@example.com" already exists', {
          existingLeadId: '550e8400-e29b-41d4-a716-446655440099',
          email: requestBody.email,
        })
      );

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(409);

      expect(response.body).toMatchObject({
        error: {
          code: 'CONFLICT',
          message: expect.stringContaining('already exists'),
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('Error Cases - Scenario 3: Missing required fields', () => {
    it('should return 400 when name is missing', async () => {
      const requestBody = {
        email: 'test@example.com',
        leadSource: LeadSource.WEBSITE,
      };

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lead validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ]),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 400 when email is missing', async () => {
      const requestBody = {
        name: 'John Doe',
        leadSource: LeadSource.WEBSITE,
      };

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lead validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ]),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 400 when leadSource is missing', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lead validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'leadSource' }),
          ]),
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('Edge Cases - Invalid formats', () => {
    it('should return 400 for invalid email format', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'not-an-email',
        leadSource: LeadSource.WEBSITE,
      };

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lead validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ]),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 400 for invalid phone format (not E.164)', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890', // Invalid format
        leadSource: LeadSource.WEBSITE,
      };

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lead validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'phone' }),
          ]),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 400 for invalid leadSource enum', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        leadSource: 'invalid_source',
      };

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lead validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'leadSource' }),
          ]),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 400 when name exceeds max length (255 chars)', async () => {
      const requestBody = {
        name: 'A'.repeat(256), // Exceeds max length
        email: 'john@example.com',
        leadSource: LeadSource.WEBSITE,
      };

      const token = createTestUserToken(mockUserId);

      const response = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lead validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ]),
          timestamp: expect.any(String),
        },
      });
    });

  });

  describe('Authentication', () => {
    it('should return 401 when authentication is missing', async () => {
      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        leadSource: LeadSource.WEBSITE,
      };

      const response = await request(app)
        .post('/api/v1/leads')
        .send(requestBody)
        .expect(401);

      expect(response.body).toMatchObject({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: expect.stringContaining('authentication'),
          timestamp: expect.any(String),
        },
      });

      expect(createLead).not.toHaveBeenCalled();
    });

    it('should allow any authenticated user to create leads', async () => {
      const requestBody = {
        name: 'Test Lead',
        email: 'test@example.com',
        leadSource: LeadSource.AD,
      };

      const mockCreatedLead: Lead = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: requestBody.name,
        email: requestBody.email.toLowerCase(),
        phone: null,
        company: null,
        lead_source: requestBody.leadSource,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: 'admin-123',
        metadata: {},
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
        last_contacted_at: null,
        converted_at: null,
      };

      (createLead as jest.Mock).mockResolvedValue(mockCreatedLead);

      // Test with admin token
      const adminToken = createAdminToken('admin-123');

      await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(requestBody)
        .expect(201);

      expect(createLead).toHaveBeenCalled();
    });
  });
});
