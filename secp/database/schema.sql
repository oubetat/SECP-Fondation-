-- SECP PostgreSQL Database Schema
-- Phase 0 Foundation

CREATE TABLE IF NOT EXISTS secp_projects (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version VARCHAR(32) DEFAULT '0.1.0'
);

CREATE TABLE IF NOT EXISTS secp_cad_assets (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES secp_projects(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(32) NOT NULL,
    byte_size BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secp_provenance_logs (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES secp_projects(id),
    action_type VARCHAR(64) NOT NULL,
    author_id VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(32) DEFAULT 'VERIFIED'
);

CREATE TABLE IF NOT EXISTS secp_structural_revisions (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES secp_projects(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    nodes_count INT DEFAULT 0,
    elements_count INT DEFAULT 0,
    stiffness_matrix_hash VARCHAR(64)
);
