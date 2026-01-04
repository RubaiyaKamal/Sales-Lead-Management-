/**
 * Jest Test Setup
 * Loads test environment variables before running tests
 */

import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set NODE_ENV to test if not already set
process.env.NODE_ENV = 'test';
