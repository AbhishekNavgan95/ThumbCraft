-- Create one database per service (single Postgres instance for local dev)
CREATE DATABASE auth_db;
CREATE DATABASE generation_db;
CREATE DATABASE wallet_db;
CREATE DATABASE notification_db;

-- Dedicated DBs for Vitest (wiped between tests; never use for local app data)
CREATE DATABASE generation_test;
CREATE DATABASE wallet_test;
