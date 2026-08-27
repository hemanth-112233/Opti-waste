# OptiWaste

A Closed-Loop Decision Framework for Cloud Waste Risk Assessment and Recommendation Verification for Cloud Cost Optimization.

## Overview
OptiWaste is a modern cloud-native FinOps platform that enables organizations to:
- Monitor cloud spending
- Detect idle resources
- Assess cloud waste risk via the Cloud Waste Risk Assessment Framework (CWRAF)
- Generate & Verify recommendations via the Recommendation Verification Engine (RVE)
- Iteratively improve recommendations using the Closed-Loop Feedback Engine (CLFE)

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (Apple VisionOS Aesthetics)
- **Backend**: FastAPI, Python 3.12, SQLAlchemy, PostgreSQL
- **DevOps**: Docker, Docker Compose

## Setting up for Development
1. Clone the repository
2. Local run without Docker:
    - Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
    - Frontend: `cd frontend && npm install && npm run dev`
3. Running with Docker Compose:
    - Run `docker-compose up --build` at the root directory of the project.

## Architecture
OptiWaste implements **Clean Architecture** patterns. Business rules are independent of UI and database logic.
