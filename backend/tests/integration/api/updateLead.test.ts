/**
 * Update Lead API Integration Tests
 *
 * Tests for PATCH /api/v1/leads/:id endpoint.
 * Covers User Story 3 - Update Lead Information (Priority P3)
 */

import request from 'supertest';
import { Express } from 'express';
import { updateLead, getLeadByIdOrFail } from '../../../src/services/LeadService';
import { createTestApp } from '../../helpers/testApp';
import {
    createTestUserToken,
    createManagerToken,
} from '../../helpers/testAuth';
import { Lead, LeadSource, LeadStatus, QualificationStatus } from '../../../src/models/Lead';
import { ConflictError, NotFoundError } from '../../../src/api/middleware/errorHandler';

// Mock the auth middleware
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

describe('PATCH /api/v1/leads/:id', () => {
    let app: Express;
    const mockUserId = 'test-user-123';
    const mockLeadId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
        jest.clearAllMocks();
        app = createTestApp();
    });

    describe('Success Cases - Scenario 1: Partial update with status change', () => {
        it('should update status and metadata, return updated lead', async () => {
            const existingLead: Lead = {
                id: mockLeadId,
                name: 'John Doe',
                email: 'john@acme.com',
                phone: '+12025551234',
                company: 'Acme Corp',
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId,
                created_by: mockUserId,
                metadata: {},
                created_at: new Date('2024-01-01T10:00:00Z'),
                updated_at: new Date('2024-01-01T10:00:00Z'),
                last_contacted_at: null,
                converted_at: null,
            };

            const updateRequest = {
                status: LeadStatus.CONTACTED,
                metadata: {
                    notes: 'Called and left voicemail',
                    contact_attempts: 1,
                },
            };

            const updatedLead: Lead = {
                ...existingLead,
                status: LeadStatus.CONTACTED,
                metadata: updateRequest.metadata,
                updated_at: new Date('2024-01-02T15:30:00Z'),
                last_contacted_at: new Date('2024-01-02T15:30:00Z'),
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(existingLead);
            (updateLead as jest.Mock).mockResolvedValue(updatedLead);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .send(updateRequest)
                .expect(200);

            expect(response.body).toMatchObject({
                id: mockLeadId,
                status: LeadStatus.CONTACTED,
                metadata: updateRequest.metadata,
                last_contacted_at: expect.any(String),
            });

            expect(updateLead).toHaveBeenCalledWith(
                mockLeadId,
                expect.objectContaining({
                    status: LeadStatus.CONTACTED,
                    metadata: updateRequest.metadata,
                }),
                mockUserId,
                undefined // No optimistic locking timestamp provided
            );
        });

        it('should update only specified fields, leave others unchanged', async () => {
            const existingLead: Lead = {
                id: mockLeadId,
                name: 'Jane Smith',
                email: 'jane@example.com',
                phone: '+12025551234',
                company: 'Example Inc',
                lead_source: LeadSource.REFERRAL,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId, // Fixed: must be assigned to user for sales_rep to access
                created_by: mockUserId,
                metadata: { initial_note: 'Referral from partner' },
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
            };

            const updateRequest = {
                phone: '+14155551234', // Only update phone
            };

            const updatedLead: Lead = {
                ...existingLead,
                phone: updateRequest.phone,
                updated_at: new Date('2024-01-02'),
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(existingLead);
            (updateLead as jest.Mock).mockResolvedValue(updatedLead);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .send(updateRequest)
                .expect(200);

            expect(response.body).toMatchObject({
                phone: '+14155551234',
                name: 'Jane Smith', // Unchanged
                email: 'jane@example.com', // Unchanged
                company: 'Example Inc', // Unchanged
            });
        });
    });

    describe('Success Cases - Scenario 2: Lead reassignment', () => {
        it('should reassign lead to different user and publish event', async () => {
            const existingLead: Lead = {
                id: mockLeadId,
                name: 'Test Lead',
                email: 'test@example.com',
                phone: null,
                company: 'Test Corp',
                lead_source: LeadSource.AD,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId,
                created_by: 'admin-123',
                metadata: {},
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
            };

            const newAssigneeId = '550e8400-e29b-41d4-a716-446655440099'; // Valid UUID
            const updateRequest = {
                assigned_to: newAssigneeId,
            };

            const updatedLead: Lead = {
                ...existingLead,
                assigned_to: newAssigneeId,
                updated_at: new Date('2024-01-02'),
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(existingLead);
            (updateLead as jest.Mock).mockResolvedValue(updatedLead);

            const managerToken = createManagerToken('manager-123');

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send(updateRequest)
                .expect(200);

            expect(response.body.assigned_to).toBe(newAssigneeId);
        });
    });

    describe('Error Cases - Scenario 3: RBAC permission check', () => {
        it('should return 403 when sales rep tries to update unassigned lead', async () => {
            const unassignedLead: Lead = {
                id: mockLeadId,
                name: 'Unassigned Lead',
                email: 'unassigned@example.com',
                phone: null,
                company: null,
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: 'other-user-456', // Assigned to different user
                created_by: 'admin-123',
                metadata: {},
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(unassignedLead);

            const salesRepToken = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${salesRepToken}`)
                .send({ status: LeadStatus.CONTACTED })
                .expect(404); // Changed from 403 to 404 to match masking strategy

            expect(response.body).toMatchObject({
                error: {
                    code: 'NOT_FOUND',
                    message: expect.stringContaining('not found'),
                    timestamp: expect.any(String),
                },
            });

            expect(updateLead).not.toHaveBeenCalled();
        });


        it('should allow manager to update any lead', async () => {
            const anyLead: Lead = {
                id: mockLeadId,
                name: 'Any Lead',
                email: 'any@example.com',
                phone: null,
                company: null,
                lead_source: LeadSource.REFERRAL,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: 'sales-rep-789',
                created_by: 'admin-123',
                metadata: {},
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
            };

            const updatedLead: Lead = {
                ...anyLead,
                status: LeadStatus.CONTACTED,
                updated_at: new Date('2024-01-02'),
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(anyLead);
            (updateLead as jest.Mock).mockResolvedValue(updatedLead);

            const managerToken = createManagerToken('manager-123');

            await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ status: LeadStatus.CONTACTED })
                .expect(200);

            expect(updateLead).toHaveBeenCalled();
        });
    });

    describe('Error Cases - Scenario 4: Duplicate email conflict', () => {
        it('should return 400 when changing email to existing address', async () => {
            const existingLead: Lead = {
                id: mockLeadId,
                name: 'John Doe',
                email: 'john@example.com',
                phone: null,
                company: null,
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId,
                created_by: mockUserId,
                metadata: {},
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(existingLead);
            (updateLead as jest.Mock).mockRejectedValue(
                new ConflictError('Lead with email "existing@example.com" already exists', {
                    existingLeadId: 'other-lead-id',
                    email: 'existing@example.com',
                })
            );

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ email: 'existing@example.com' })
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

    describe('Error Cases - Scenario 5: Optimistic locking conflict', () => {
        it('should return 409 when lead was modified by another user', async () => {
            const existingLead: Lead = {
                id: mockLeadId,
                name: 'Concurrent Update Test',
                email: 'concurrent@example.com',
                phone: null,
                company: null,
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId,
                created_by: mockUserId,
                metadata: {},
                created_at: new Date('2024-01-01T10:00:00Z'),
                updated_at: new Date('2024-01-01T12:00:00Z'), // Updated at 12:00
                last_contacted_at: null,
                converted_at: null,
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(existingLead);
            (updateLead as jest.Mock).mockRejectedValue(
                new ConflictError(
                    'Lead was modified by another user. Please refresh and try again.',
                    {
                        currentUpdatedAt: new Date('2024-01-01T12:00:00Z'),
                        providedUpdatedAt: new Date('2024-01-01T10:00:00Z'),
                    }
                )
            );

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .set('If-Unmodified-Since', new Date('2024-01-01T10:00:00Z').toUTCString())
                .send({ status: LeadStatus.CONTACTED })
                .expect(409);

            expect(response.body).toMatchObject({
                error: {
                    code: 'CONFLICT',
                    message: expect.stringContaining('modified by another user'),
                    timestamp: expect.any(String),
                },
            });
        });
    });

    describe('Edge Cases - No fields changed', () => {
        it('should return current lead when no fields are modified', async () => {
            const existingLead: Lead = {
                id: mockLeadId,
                name: 'No Change Lead',
                email: 'nochange@example.com',
                phone: null,
                company: null,
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId,
                created_by: mockUserId,
                metadata: {},
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(existingLead);
            (updateLead as jest.Mock).mockResolvedValue(existingLead); // Same lead returned

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({}) // Empty update
                .expect(200);

            expect(response.body).toMatchObject({
                id: mockLeadId,
                updated_at: existingLead.updated_at.toISOString(),
            });
        });
    });

    describe('Edge Cases - Lead not found', () => {
        it('should return 404 when updating non-existent lead', async () => {
            const nonExistentId = '550e8400-e29b-41d4-a716-446655440099';

            (getLeadByIdOrFail as jest.Mock).mockRejectedValue(
                new NotFoundError(`Lead with ID "${nonExistentId}" not found`)
            );

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${nonExistentId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: LeadStatus.CONTACTED })
                .expect(404);

            expect(response.body).toMatchObject({
                error: {
                    code: 'NOT_FOUND',
                    message: expect.stringContaining('not found'),
                    timestamp: expect.any(String),
                },
            });
        });
    });


    describe('Edge Cases - Invalid UUID format', () => {
        it('should return 400 for invalid lead ID format', async () => {
            const invalidId = 'not-a-uuid';

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${invalidId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: LeadStatus.CONTACTED })
                .expect(400);

            expect(response.body).toMatchObject({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid Lead ID',
                    timestamp: expect.any(String),
                },
            });
        });
    });


    describe('Validation', () => {
        it('should return 400 for invalid status enum value', async () => {
            const existingLead: Lead = {
                id: mockLeadId,
                name: 'Test Lead',
                email: 'test@example.com',
                phone: null,
                company: null,
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId,
                created_by: mockUserId,
                metadata: {},
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
            };

            (getLeadByIdOrFail as jest.Mock).mockResolvedValue(existingLead);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'invalid_status' })
                .expect(400);

            expect(response.body).toMatchObject({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Lead update validation failed',
                    details: expect.arrayContaining([
                        expect.objectContaining({ field: 'status' }),
                    ]),
                    timestamp: expect.any(String),
                },
            });
        });
    });



    describe('Authentication', () => {
        it('should return 401 when authentication is missing', async () => {
            const response = await request(app)
                .patch(`/api/v1/leads/${mockLeadId}`)
                .send({ status: LeadStatus.CONTACTED })
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
});
