# CopSight AI - API Documentation

This document outlines the core API endpoints available in the CopSight AI platform.

## Base URL
The API is served locally at `http://localhost:8080/api`

## Authentication

All endpoints (except login) require a valid JWT token sent in the `Authorization` header as a Bearer token.

```
Authorization: Bearer <your_token>
```

### 1. `POST /api/auth/login`
Authenticates a user and returns a JWT token.
- **Body:** `{ "username": "admin", "password": "password" }`
- **Response:** `{ "token": "jwt...", "user": { ... } }`

## Users (Admin Only)

### 2. `GET /api/users`
Returns a list of all registered users in the system.

### 3. `POST /api/users`
Creates a new user.
- **Body:** `{ "username": "newuser", "password": "tempPassword", "role": "io" }`

## Cases

### 4. `GET /api/cases`
Returns a list of all active cases. Investigating Officers (IO) will only see cases assigned to them.

### 5. `POST /api/cases` (Admin Only)
Creates a new forensic case.
- **Body:** `{ "title": "Operation Alpha", "assignedTo": "io_user_id" }`

## Query & Analysis

### 6. `POST /api/query/case/:id`
Executes an AI-driven natural language query against the extracted forensic data for the given case ID.
- **Body:** `{ "query": "Find all messages related to bank transfers." }`
- **Response:** `{ "answer": "Based on the evidence...", "sources": [...] }`

## Reports

### 7. `POST /api/reports/case/:id/generate`
Generates a comprehensive PDF report for the case.
- **Body:** `{ "sections": ["messages", "calls", "timeline"] }`
- **Response:** Returns the PDF file stream.
