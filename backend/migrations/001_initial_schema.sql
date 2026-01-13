-- Migration V001: Initial Schema
-- Creates tables, indexes, and triggers for Lead Management with AI Qualification
-- Date: 2025-12-31
-- Feature: 001-lead-crud-ai

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- TRIGGER FUNCTIONS
-- =================================================================

-- Function: update_updated_at_column
-- Updates the updated_at timestamp whenever a row is modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_last_contacted_at_column
-- Sets last_contacted_at when status changes to contacted, qualified, or converted
CREATE OR REPLACE FUNCTION update_last_contacted_at_column()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('contacted', 'qualified', 'converted') AND
       OLD.status <> NEW.status THEN
        NEW.last_contacted_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_converted_at_column
-- Sets converted_at when status changes to converted
CREATE OR REPLACE FUNCTION update_converted_at_column()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'converted' AND OLD.status <> 'converted' THEN
        NEW.converted_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- TABLES
-- =================================================================

-- Table: users
-- Represents sales team members with system access and RBAC roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'sales_rep')),
    cognito_sub VARCHAR(255) NOT NULL UNIQUE,
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "in_app": true}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: leads
-- Core entity representing potential customers in the sales pipeline
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    company VARCHAR(255),
    lead_source VARCHAR(50) NOT NULL CHECK (lead_source IN ('website', 'referral', 'ad', 'cold_outreach')),
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
    qualification_status VARCHAR(50) NOT NULL DEFAULT 'not_qualified' CHECK (qualification_status IN ('not_qualified', 'in_progress', 'qualified', 'disqualified')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE
);

-- Table: lead_scores
-- Historical record of AI-generated BANT qualification scores
CREATE TABLE lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    budget_score INTEGER NOT NULL CHECK (budget_score BETWEEN 0 AND 25),
    authority_score INTEGER NOT NULL CHECK (authority_score BETWEEN 0 AND 25),
    need_score INTEGER NOT NULL CHECK (need_score BETWEEN 0 AND 25),
    timeline_score INTEGER NOT NULL CHECK (timeline_score BETWEEN 0 AND 25),
    total_score INTEGER GENERATED ALWAYS AS (budget_score + authority_score + need_score + timeline_score) STORED,
    reasoning TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence BETWEEN 0.00 AND 1.00),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: activity_logs
-- Audit trail of all actions performed on leads
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'qualify', 'assign', 'status_change', 'view')),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================
-- INDEXES
-- =================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cognito_sub ON users(cognito_sub);
CREATE INDEX idx_users_role ON users(role);

-- Leads indexes
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status_created ON leads(status, created_at DESC);
CREATE INDEX idx_leads_assigned_status ON leads(assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_leads_qualification_status ON leads(qualification_status);
CREATE INDEX idx_leads_lead_source ON leads(lead_source);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_metadata_gin ON leads USING gin(metadata);

-- Lead scores indexes
CREATE INDEX idx_lead_scores_lead_id ON lead_scores(lead_id, created_at DESC);
CREATE INDEX idx_lead_scores_total_score ON lead_scores(total_score DESC);
CREATE INDEX idx_lead_scores_created_at ON lead_scores(created_at DESC);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_lead_id ON activity_logs(lead_id, created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action, created_at DESC);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- =================================================================
-- TRIGGERS
-- =================================================================

-- Users triggers
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Leads triggers
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_last_contacted_at
BEFORE UPDATE ON leads
FOR EACH ROW
WHEN (NEW.status IN ('contacted', 'qualified', 'converted') AND OLD.status <> NEW.status)
EXECUTE FUNCTION update_last_contacted_at_column();

CREATE TRIGGER update_converted_at
BEFORE UPDATE ON leads
FOR EACH ROW
WHEN (NEW.status = 'converted' AND OLD.status <> 'converted')
EXECUTE FUNCTION update_converted_at_column();

-- =================================================================
-- MIGRATION COMPLETE
-- =================================================================
