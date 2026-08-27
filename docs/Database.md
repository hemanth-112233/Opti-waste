# Database Documentation

## Architecture Overview
OptiWaste uses **MongoDB** as its primary datastore, utilizing the **Beanie ODM** to bridge the gap between FastAPI (Pydantic V2) and MongoDB (Motor). This completely replaces any previous PostgreSQL abstractions, providing a scalable document-oriented schema that works well with varying FinOps entity configurations, specifically cloud resources and cost records.

## Connection Management
- Connections and initialization are handled in `app/db/database.py` utilizing Motor (`AsyncIOMotorClient`).
- Beanie relies on `init_beanie`, which synchronously registers all 14 domain entity schemas at start-up time (`app.models`).
- Database string is configured dynamically in `app.core.config.Settings` (pulled from `.env` or system environment).

## Repositories
The platform uses a Repository Pattern inside the `app.repositories` module to encapsulate all MongoDB interactions (CRUD operations):
- Subclass of the generic `CRUDBase (app.repositories.base.CRUDBase)`.
- Replaces raw DB queries with `self.model.find_one(...)`, `self.model.insert()`, etc.

## Entity Models & Collections
Currently, the database maps out 14 collections. Each document model inherits from `TimestampedDocument` or `BaseUUIDDocument` to provide built-in timestamps and a UUID v4.

1. **Role** & **User**: Multi-tenant RBAC implementations with roles like Admin or Member.
2. **CloudProvider**: Represents integrations (AWS, GCP, Azure). 
3. **CloudResource**: Represents the individual cloud components.
4. **ResourceMetric** & **CostRecord**: Observability and daily/monthly cost tracking, often aggregating immense amounts of data.
5. **WasteRiskAssessment** & **WasteAssessmentHistory**: Contains the logic and histories for FinOps waste scoring (Risk indices).
6. **OptimizationRecommendation**, **RecommendationVerification**, **RecommendationHistory**: Core recommendation loops for savings.
7. **ClosedLoopFeedback**: Loop adjustments from end-users to optimize the AI recommendation model.
8. **SavingsAnalytics**: Financial impact models.
9. **AuditLog**: Platform operations compliance trail.

## Indexes
Indexes are implemented directly within each schema's `Settings.indexes` block:
- Standard unique indexes such as email in User: `email: Indexed(EmailStr, unique=True)`.
- Query-performance indexes such as `billing_period` on CostRecord, `status` and `region` on CloudResource, or specific IDs across recommendation relationships.

## Local Data Seeding
Run the seeding script to populate initial collections for development:
```bash
# from the current backend directory
set PYTHONPATH=.
python -m scripts.seed_db
```
