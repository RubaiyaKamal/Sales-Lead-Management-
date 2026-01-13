/**
 * Get Leads API Integration Tests
 *
 * Tests for GET /api/v1/leads and GET /api/v1/leads/:id endpoints.
 * Covers User Story 2 - View Lead Details and List (Priority P2)
 */

import request from 'supertest';
import { Express } from 'express';
import { listLeads, getLeadWithScoreById } from '../../../src/services/LeadService';
import { createTestApp } from '../../helpers/testApp';
import {
    createTestUserToken,
    createAdminToken,
    createManagerToken,
} from '../../helpers/testAuth';
import {
    Lead,
    LeadWithScore,
    LeadSource,
    LeadStatus,
    QualificationStatus,
    LeadListResponse,
} from '../../../src/models/Lead';
import { LeadScore } from '../../../src/models/LeadScore';
import { NotFoundError } from '../../../src/api/middleware/errorHandler';
import { UserRole } from '../../../src/models/User';

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

describe('GET /api/v1/leads', () => {
    let app: Express;
    const mockUserId = 'test-user-123';
    const mockAdminId = 'admin-123';

    beforeEach(() => {
        jest.clearAllMocks();
        app = createTestApp();
    });

    describe('Success Cases - Scenario 1: Paginated list with defaults', () => {
        it('should return paginated leads with default parameters (20 per page)', async () => {
            const mockLeads: LeadWithScore[] = Array.from({ length: 20 }, (_, i) => ({
                id: `lead-${i}`,
                name: `Lead ${i}`,
                email: `lead${i}@example.com`,
                phone: null,
                company: `Company ${i}`,
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId,
                created_by: mockUserId,
                metadata: {},
                created_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
                updated_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
                last_contacted_at: null,
                converted_at: null,
                lead_score: null,
            }));

            const mockResponse: LeadListResponse = {
                data: mockLeads,
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 100,
                    totalPages: 5,
                },
                meta: {
                    filters: {},
                },
            };

            (listLeads as jest.Mock).mockResolvedValue(mockResponse);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .get('/api/v1/leads')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toMatchObject({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        id: expect.any(String),
                        name: expect.any(String),
                        email: expect.any(String),
                    }),
                ]),
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 100,
                    totalPages: 5,
                },
            });

            expect(response.body.data).toHaveLength(20);
        });
    });

    describe('Success Cases - Scenario 2: Filter by status', () => {
        it('should return only qualified leads when status filter applied', async () => {
            const mockQualifiedLeads: LeadWithScore[] = [
                {
                    id: 'lead-1',
                    name: 'Qualified Lead 1',
                    email: 'qualified1@example.com',
                    phone: '+12025551234',
                    company: 'Acme Corp',
                    lead_source: LeadSource.WEBSITE,
                    status: LeadStatus.QUALIFIED,
                    qualification_status: QualificationStatus.QUALIFIED,
                    assigned_to: mockUserId,
                    created_by: mockUserId,
                    metadata: {},
                    created_at: new Date('2024-01-01'),
                    updated_at: new Date('2024-01-01'),
                    last_contacted_at: new Date('2024-01-02'),
                    converted_at: null,
                    lead_score: {
                        id: 'score-1',
                        lead_id: 'lead-1',
                        budget_score: 20,
                        authority_score: 22,
                        need_score: 18,
                        timeline_score: 24,
                        total_score: 84,
                        reasoning: 'High-value lead with strong BANT indicators',
                        confidence: 0.85,
                        created_at: new Date('2024-01-02'),
                    },
                },
            ];

            const mockResponse: LeadListResponse = {
                data: mockQualifiedLeads,
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                },
                meta: {
                    filters: {
                        qualification_status: QualificationStatus.QUALIFIED,
                    },
                },
            };

            (listLeads as jest.Mock).mockResolvedValue(mockResponse);

            const token = createAdminToken(mockAdminId);

            const response = await request(app)
                .get('/api/v1/leads')
                .query({ qualification_status: 'qualified' })
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0]).toMatchObject({
                qualification_status: QualificationStatus.QUALIFIED,
                lead_score: expect.objectContaining({
                    total_score: 84,
                }),
            });
        });
    });

    describe('Success Cases - Scenario 4: Search by company', () => {
        it('should return leads matching company search (case-insensitive)', async () => {
            const mockSearchResults: LeadWithScore[] = [
                {
                    id: 'lead-acme-1',
                    name: 'John Doe',
                    email: 'john@acme.com',
                    phone: null,
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
                    lead_score: null,
                },
            ];

            const mockResponse: LeadListResponse = {
                data: mockSearchResults,
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                },
                meta: {
                    filters: {
                        search: 'Acme Corp',
                    },
                },
            };

            (listLeads as jest.Mock).mockResolvedValue(mockResponse);

            const token = createAdminToken(mockAdminId);

            const response = await request(app)
                .get('/api/v1/leads')
                .query({ search: 'Acme Corp' })
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].company).toContain('Acme');
        });
    });

    describe('Success Cases - Scenario 5: RBAC filtering', () => {
        it('should return only assigned leads for sales rep users', async () => {
            const mockAssignedLeads: LeadWithScore[] = [
                {
                    id: 'lead-assigned-1',
                    name: 'Assigned Lead',
                    email: 'assigned@example.com',
                    phone: null,
                    company: 'Test Corp',
                    lead_source: LeadSource.REFERRAL,
                    status: LeadStatus.CONTACTED,
                    qualification_status: QualificationStatus.IN_PROGRESS,
                    assigned_to: mockUserId,
                    created_by: mockAdminId,
                    metadata: {},
                    created_at: new Date('2024-01-01'),
                    updated_at: new Date('2024-01-01'),
                    last_contacted_at: new Date('2024-01-02'),
                    converted_at: null,
                    lead_score: null,
                },
            ];

            const mockResponse: LeadListResponse = {
                data: mockAssignedLeads,
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                },
                meta: {
                    filters: {},
                },
            };

            (listLeads as jest.Mock).mockResolvedValue(mockResponse);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .get('/api/v1/leads')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            // Verify service was called with correct user context
            expect(listLeads).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    userId: mockUserId,
                    role: UserRole.SALES_REP,
                })
            );

            // All returned leads should be assigned to this user
            response.body.data.forEach((lead: LeadWithScore) => {
                expect(lead.assigned_to).toBe(mockUserId);
            });
        });
    });

    describe('Edge Cases - Pagination', () => {
        it('should return empty array when page exceeds available results', async () => {
            const mockResponse: LeadListResponse = {
                data: [],
                pagination: {
                    page: 10,
                    limit: 20,
                    total: 50,
                    totalPages: 3,
                },
                meta: {
                    filters: {},
                },
            };

            (listLeads as jest.Mock).mockResolvedValue(mockResponse);

            const token = createAdminToken(mockAdminId);

            const response = await request(app)
                .get('/api/v1/leads')
                .query({ page: 10 })
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.data).toHaveLength(0);
            expect(response.body.pagination).toMatchObject({
                page: 10,
                totalPages: 3,
            });
        });
    });
});

describe('GET /api/v1/leads/:id', () => {
    let app: Express;
    const mockUserId = 'test-user-123';
    const mockLeadId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
        jest.clearAllMocks();
        app = createTestApp();
    });

    describe('Success Cases - Scenario 3: Get lead by ID', () => {
        it('should return complete lead details with score', async () => {
            const mockLeadWithScore: LeadWithScore = {
                id: mockLeadId,
                name: 'John Doe',
                email: 'john@acme.com',
                phone: '+12025551234',
                company: 'Acme Corp',
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.QUALIFIED,
                qualification_status: QualificationStatus.QUALIFIED,
                assigned_to: mockUserId,
                created_by: mockUserId,
                metadata: {
                    utm_source: 'google',
                    utm_campaign: 'summer-2024',
                },
                created_at: new Date('2024-01-01T10:00:00Z'),
                updated_at: new Date('2024-01-02T15:30:00Z'),
                last_contacted_at: new Date('2024-01-02T14:00:00Z'),
                converted_at: null,
                lead_score: {
                    id: 'score-123',
                    lead_id: mockLeadId,
                    budget_score: 20,
                    authority_score: 22,
                    need_score: 18,
                    timeline_score: 24,
                    total_score: 84,
                    reasoning: 'Strong budget and timeline indicators. Decision maker identified.',
                    confidence: 0.85,
                    created_at: new Date('2024-01-02T14:30:00Z'),
                },
            };

            (getLeadWithScoreById as jest.Mock).mockResolvedValue(mockLeadWithScore);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .get(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: mockLeadId,
                name: 'John Doe',
                email: 'john@acme.com',
                phone: '+12025551234',
                company: 'Acme Corp',
                lead_source: LeadSource.WEBSITE,
                status: LeadStatus.QUALIFIED,
                qualification_status: QualificationStatus.QUALIFIED,
                lead_score: {
                    id: 'score-123',
                    budget_score: 20,
                    authority_score: 22,
                    need_score: 18,
                    timeline_score: 24,
                    total_score: 84,
                    reasoning: expect.any(String),
                    confidence: 0.85,
                },
            });
        });

        it('should return lead without score if not yet qualified', async () => {
            const mockLeadNoScore: LeadWithScore = {
                id: mockLeadId,
                name: 'Jane Smith',
                email: 'jane@example.com',
                phone: null,
                company: null,
                lead_source: LeadSource.REFERRAL,
                status: LeadStatus.NEW,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                assigned_to: mockUserId, // Fixed: must be assigned to user for sales_rep to access
                created_by: mockUserId,
                metadata: {},
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                last_contacted_at: null,
                converted_at: null,
                lead_score: null,
            };

            (getLeadWithScoreById as jest.Mock).mockResolvedValue(mockLeadNoScore);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .get(`/api/v1/leads/${mockLeadId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: mockLeadId,
                qualification_status: QualificationStatus.NOT_QUALIFIED,
                lead_score: null,
            });
        });
    });

    describe('Edge Cases - Lead not found', () => {
        it('should return 404 when lead does not exist', async () => {
            const nonExistentId = '550e8400-e29b-41d4-a716-446655440099';

            (getLeadWithScoreById as jest.Mock).mockResolvedValue(null);

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .get(`/api/v1/leads/${nonExistentId}`)
                .set('Authorization', `Bearer ${token}`)
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
        it('should return 400 for invalid UUID format', async () => {
            const invalidId = 'not-a-uuid';

            const token = createTestUserToken(mockUserId);

            const response = await request(app)
                .get(`/api/v1/leads/${invalidId}`)
                .set('Authorization', `Bearer ${token}`)
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


    describe('Authentication', () => {
        it('should return 401 when authentication is missing', async () => {
            const response = await request(app).get(`/api/v1/leads/${mockLeadId}`).expect(401);

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
