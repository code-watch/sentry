from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import TypedDict, cast

from django.db.models import Count, Max, OuterRef, Subquery
from django.db.models.functions import TruncHour

from sentry.api.paginator import OffsetPaginator
from sentry.models.group import Group
from sentry.rules.history.base import TimeSeriesValue
from sentry.utils.cursors import Cursor, CursorResult
from sentry.workflow_engine.endpoints.serializers import WorkflowGroupHistory
from sentry.workflow_engine.models import Workflow, WorkflowFireHistory


class _Result(TypedDict):
    group: int
    count: int
    last_triggered: datetime
    event_id: str


def convert_results(results: Sequence[_Result]) -> Sequence[WorkflowGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}
    return [
        WorkflowGroupHistory(
            group_lookup[r["group"]], r["count"], r["last_triggered"], r["event_id"]
        )
        for r in results
    ]


def fetch_workflow_groups_paginated(
    workflow: Workflow,
    start: datetime,
    end: datetime,
    cursor: Cursor | None = None,
    per_page: int = 25,
) -> CursorResult[Group]:
    filtered_history = WorkflowFireHistory.objects.filter(
        workflow=workflow,
        date_added__gte=start,
        date_added__lt=end,
    )

    # subquery that retrieves row with the largest date in a group
    group_max_dates = filtered_history.filter(group=OuterRef("group")).order_by("-date_added")[:1]
    qs = (
        filtered_history.select_related("group")
        .values("group")
        .annotate(count=Count("group"))
        .annotate(event_id=Subquery(group_max_dates.values("event_id")))
        .annotate(last_triggered=Max("date_added"))
    )

    return cast(
        CursorResult[Group],
        OffsetPaginator(
            qs, order_by=("-count", "-last_triggered"), on_results=convert_results
        ).get_result(per_page, cursor),
    )


def fetch_workflow_hourly_stats(
    workflow: Workflow, start: datetime, end: datetime
) -> Sequence[TimeSeriesValue]:
    start = start.replace(tzinfo=timezone.utc)
    end = end.replace(tzinfo=timezone.utc)
    qs = (
        WorkflowFireHistory.objects.filter(
            workflow=workflow,
            date_added__gte=start,
            date_added__lt=end,
        )
        .annotate(bucket=TruncHour("date_added"))
        .order_by("bucket")
        .values("bucket")
        .annotate(count=Count("id"))
    )
    existing_data = {row["bucket"]: TimeSeriesValue(row["bucket"], row["count"]) for row in qs}

    results = []
    current = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    while current <= end.replace(minute=0, second=0, microsecond=0):
        results.append(existing_data.get(current, TimeSeriesValue(current, 0)))
        current += timedelta(hours=1)
    return results
