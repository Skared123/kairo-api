-- Runs only when the data volume is empty (first `pnpm db:up`). End-to-end tests use this database (decision 013).
CREATE DATABASE kairo_test OWNER kairo;
