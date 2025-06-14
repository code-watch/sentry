from enum import Enum


class ApiOwner(Enum):
    """
    Used to track ownership of APIs
    Value should map to team's github group
    """

    ALERTS_NOTIFICATIONS = "alerts-notifications"
    BILLING = "revenue"
    CODECOV = "codecov"
    CRONS = "crons"
    ECOSYSTEM = "ecosystem"
    ENTERPRISE = "enterprise"
    FEEDBACK = "feedback-backend"
    FLAG = "replay-backend"
    HYBRID_CLOUD = "hybrid-cloud"
    INTEGRATIONS = "product-owners-settings-integrations"
    ISSUES = "issue-workflow"
    ML_AI = "machine-learning-ai"
    OWNERS_INGEST = "ingest"
    OWNERS_SNUBA = "owners-snuba"
    PERFORMANCE = "performance"
    PROFILING = "profiling"
    REPLAY = "replay-backend"
    SECURITY = "security"
    TELEMETRY_EXPERIENCE = "telemetry-experience"
    UNOWNED = "unowned"
    WEB_FRONTEND_SDKS = "team-web-sdk-frontend"
    GDX = "gdx"
    EMERGE_TOOLS = "emerge-tools"
