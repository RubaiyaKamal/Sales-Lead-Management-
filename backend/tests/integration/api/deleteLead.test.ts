/**
 * Delete Lead API Integration Tests
 *
 * Tests for DELETE /api/v1/leads/:id endpoint.
 */

import request from 'supertest';
import { Express } from 'express';
import { deleteLead, getLeadByIdOrFail } from '../../../src/services/LeadService';
import { createTestApp } from '../../helpers/testApp';
import { createTestUserToken, createAdminToken } from '../../helpers/testAuth';
import { Lead, LeadSource, LeadStatus, QualificationStatus } from '../../../src/models/Lead';
import { NotFoundError } from '../../../src/api/middleware/errorHandler';
import { UserRole } from '../../../src/models/User';

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

describe('DELETE /api/v1/leads/:id', () => {
  let app: Express;
  const mockLeadId = '550e8400-e29b-41d4-a716-446655440000';
  const mockAdminUserId = 'admin-123';
  const mockSalesRepUserId = 'sales-rep-123';

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  describe('Success Cases', () => {
    it('should delete lead and return 204 No Content when admin user deletes', async () => {
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
        created_by: mockSalesRepUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      // Mock admin token
      const adminToken = createAdminToken(mockAdminUserId);

      // Set up mocks
      (getLeadByIdOrFail as jest.Mock).mockResolvedValue(mockLead);
      (deleteLead as jest.Mock).mockResolvedValue(undefined);

      // Make request
      const response = await request(app)
        .delete(`/api/v1/leads/${mockLeadId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify no response body
      expect(response.body).toEqual({});

      // Verify service calls
      expect(getLeadByIdOrFail).toHaveBeenCalledWith(mockLeadId);
      expect(deleteLead).toHaveBeenCalledWith(mockLeadId, mockAdminUserId, {
        reason: undefined,
        gdprRequest: false,
      });
    });

    it('should include optional reason and gdprRequest parameters', async () => {
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
        created_by: mockSalesRepUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      const adminToken = createAdminToken(mockAdminUserId);

      (getLeadByIdOrFail as jest.Mock).mockResolvedValue(mockLead);
      (deleteLead as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .delete(`/api/v1/leads/${mockLeadId}`)
        .query({ reason: 'GDPR data deletion request', gdprRequest: 'true' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      expect(deleteLead).toHaveBeenCalledWith(mockLeadId, mockAdminUserId, {
        reason: 'GDPR data deletion request',
        gdprRequest: true,
      });
    });
  });

  describe('Error Cases', () => {
    it('should return 400 for invalid lead ID format', async () => {
      const invalidLeadId = 'not-a-uuid';
      const adminToken = createAdminToken(mockAdminUserId);

      const response = await request(app)
        .delete(`/api/v1/leads/${invalidLeadId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('Lead ID'),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 404 when lead not found', async () => {
      const nonExistentLeadId = '550e8400-e29b-41d4-a716-446655440099';
      const adminToken = createAdminToken(mockAdminUserId);

      (getLeadByIdOrFail as jest.Mock).mockRejectedValue(
        new NotFoundError(`Lead with ID "${nonExistentLeadId}" not found`)
      );

      const response = await request(app)
        .delete(`/api/v1/leads/${nonExistentLeadId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 403 when non-admin user attempts deletion', async () => {
      // Create sales rep token (non-admin)
      const salesRepToken = createTestUserToken(mockSalesRepUserId);

      const response = await request(app)
        .delete(`/api/v1/leads/${mockLeadId}`)
        .set('Authorization', `Bearer ${salesRepToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: expect.stringContaining('Only administrators can delete leads'),
          timestamp: expect.any(String),
        },
      });

      // Verify service was NOT called
      expect(deleteLead).not.toHaveBeenCalled();
    });

    it('should return 401 when authentication is missing', async () => {
      const response = await request(app)
        .delete(`/api/v1/leads/${mockLeadId}`)
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

  describe('RBAC Authorization', () => {
    it('should allow deletion for admin users', async () => {
      const mockLead: Lead = {
        id: mockLeadId,
        name: 'Test Lead',
        email: 'test@example.com',
        phone: '+1234567890',
        company: 'Test Corp',
        lead_source: LeadSource.WEBSITE,
        status: LeadStatus.NEW,
        qualification_status: QualificationStatus.NOT_QUALIFIED,
        assigned_to: null,
        created_by: mockSalesRepUserId,
        metadata: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_contacted_at: null,
        converted_at: null,
      };

      const adminToken = createAdminToken(mockAdminUserId);

      (getLeadByIdOrFail as jest.Mock).mockResolvedValue(mockLead);
      (deleteLead as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .delete(`/api/v1/leads/${mockLeadId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      expect(deleteLead).toHaveBeenCalled();
    });

    it('should deny deletion for manager users', async () => {
      const { createManagerToken } = require('../../helpers/testAuth');
      const managerToken = createManagerToken('manager-123');

      const response = await request(app)
        .delete(`/api/v1/leads/${mockLeadId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);

      expect(response.body.error.message).toContain('Only administrators can delete leads');
      expect(deleteLead).not.toHaveBeenCalled();
    });

    it('should deny deletion for sales rep users', async () => {
      const salesRepToken = createTestUserToken(mockSalesRepUserId);

      const response = await request(app)
        .delete(`/api/v1/leads/${mockLeadId}`)
        .set('Authorization', `Bearer ${salesRepToken}`)
        .expect(403);

      expect(response.body.error.message).toContain('Only administrators can delete leads');
      expect(deleteLead).not.toHaveBeenCalled();
    });
  });
});
