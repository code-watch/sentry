from datetime import datetime, timedelta

from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.rules.history.base import TimeSeriesValue
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscriptionDataSourceHandler, SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import default_detector_config_data
from sentry.workflow_engine.endpoints.serializers import TimeSeriesValueSerializer
from sentry.workflow_engine.models import Action, DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestDetectorSerializer(TestCase):
    def test_serialize_simple(self):
        detector = self.create_detector(
            project_id=self.project.id, name="Test Detector", type=MetricIssue.slug
        )
        result = serialize(detector)

        assert result == {
            "id": str(detector.id),
            "projectId": str(detector.project_id),
            "name": "Test Detector",
            "type": MetricIssue.slug,
            "createdBy": None,
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": None,
            "conditionGroup": None,
            "workflowIds": [],
            "config": default_detector_config_data[MetricIssue.slug],
            "owner": None,
            "enabled": detector.enabled,
        }

    def test_serialize_full(self):
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={
                "target_identifier": "123",
                "target_type": ActionTarget.USER.value,
            },
        )
        self.create_data_condition_group_action(condition_group=condition_group, action=action)
        detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricIssue.slug,
            workflow_condition_group=condition_group,
            owner_user_id=self.user.id,
            created_by_id=self.user.id,
        )
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count()",
            timedelta(minutes=1),
            timedelta(minutes=1),
            None,
        )
        subscription = create_snuba_subscription(
            self.project, INCIDENTS_SNUBA_SUBSCRIPTION_TYPE, snuba_query
        )
        type_name = data_source_type_registry.get_key(QuerySubscriptionDataSourceHandler)
        data_source = self.create_data_source(
            organization=self.organization,
            type=type_name,
            source_id=str(subscription.id),
        )
        data_source.detectors.set([detector])
        workflow = self.create_workflow(
            organization=self.organization,
        )
        self.create_detector_workflow(detector=detector, workflow=workflow)

        result = serialize(detector)
        assert result == {
            "id": str(detector.id),
            "projectId": str(detector.project_id),
            "name": "Test Detector",
            "type": MetricIssue.slug,
            "createdBy": str(self.user.id),
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": [
                {
                    "id": str(data_source.id),
                    "organizationId": str(self.organization.id),
                    "type": type_name,
                    "sourceId": str(subscription.id),
                    "queryObj": {
                        "id": str(subscription.id),
                        "snubaQuery": {
                            "aggregate": "count()",
                            "dataset": "events",
                            "environment": None,
                            "id": str(snuba_query.id),
                            "query": "hello",
                            "timeWindow": 60,
                        },
                        "status": 1,
                        "subscription": None,
                    },
                }
            ],
            "conditionGroup": {
                "id": str(condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY.value,
                "conditions": [
                    {
                        "id": str(condition.id),
                        "type": Condition.GREATER.value,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH.value,
                    }
                ],
                "actions": [
                    {
                        "id": str(action.id),
                        "type": "email",
                        "data": {},
                        "integrationId": None,
                        "config": {"target_type": 1, "target_identifier": "123"},
                    }
                ],
            },
            "workflowIds": [str(workflow.id)],
            "config": default_detector_config_data[MetricIssue.slug],
            "owner": self.user.get_actor_identifier(),
            "enabled": detector.enabled,
        }

    def test_serialize_bulk(self):
        detectors = [
            self.create_detector(
                project_id=self.project.id,
                name=f"Test Detector {i}",
                type=MetricIssue.slug,
            )
            for i in range(2)
        ]

        result = serialize(detectors)

        assert len(result) == 2
        assert all(d["name"] in ["Test Detector 0", "Test Detector 1"] for d in result)


class TestDataSourceSerializer(TestCase):
    def test_serialize(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count()",
            timedelta(minutes=1),
            timedelta(minutes=1),
            None,
        )
        type_name = data_source_type_registry.get_key(QuerySubscriptionDataSourceHandler)
        subscription = create_snuba_subscription(
            self.project, INCIDENTS_SNUBA_SUBSCRIPTION_TYPE, snuba_query
        )

        data_source = self.create_data_source(
            organization=self.organization,
            type=type_name,
            source_id=str(subscription.id),
        )

        result = serialize(data_source)

        assert result == {
            "id": str(data_source.id),
            "organizationId": str(self.organization.id),
            "type": type_name,
            "sourceId": str(subscription.id),
            "queryObj": {
                "id": str(subscription.id),
                "snubaQuery": {
                    "aggregate": "count()",
                    "dataset": "events",
                    "environment": None,
                    "id": str(snuba_query.id),
                    "query": "hello",
                    "timeWindow": 60,
                },
                "status": 1,
                "subscription": None,
            },
        }


class TestDataConditionGroupSerializer(TestCase):
    def test_serialize_simple(self):
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [],
            "actions": [],
        }

    def test_serialize_full(self):
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={
                "target_identifier": "123",
                "target_type": ActionTarget.USER.value,
            },
        )

        self.create_data_condition_group_action(condition_group=condition_group, action=action)

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [
                {
                    "id": str(condition.id),
                    "type": "gt",
                    "comparison": 100,
                    "conditionResult": DetectorPriorityLevel.HIGH,
                }
            ],
            "actions": [
                {
                    "id": str(action.id),
                    "type": "email",
                    "data": {},
                    "integrationId": None,
                    "config": {"target_type": 1, "target_identifier": "123"},
                }
            ],
        }


class TestActionSerializer(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            provider="slack",
            name="example-integration",
            external_id="123-id",
            metadata={},
            organization=self.organization,
        )

    def test_serialize_simple(self):
        action = self.create_action(
            type=Action.Type.PLUGIN,
            data={},
        )

        result = serialize(action)

        assert result == {
            "id": str(action.id),
            "type": "plugin",
            "data": {},
            "integrationId": None,
            "config": {},
        }

    def test_serialize_with_integration(self):

        action = self.create_action(
            type=Action.Type.OPSGENIE,
            data={"priority": "P1"},
            integration_id=self.integration.id,
            config={
                "target_identifier": "123",
                "target_type": ActionTarget.SPECIFIC.value,
            },
        )

        result = serialize(action)

        assert result == {
            "id": str(action.id),
            "type": "opsgenie",
            "data": {"priority": "P1"},
            "integrationId": str(self.integration.id),
            "config": {"target_type": 0, "target_identifier": "123"},
        }

    def test_serialize_with_integration_and_config(self):

        action2 = self.create_action(
            type=Action.Type.SLACK,
            data={"tags": "bar"},
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_display": "freddy frog",
                "target_identifier": "123-id",
            },
        )

        result2 = serialize(action2)

        assert result2 == {
            "id": str(action2.id),
            "type": "slack",
            "data": {"tags": "bar"},
            "integrationId": str(self.integration.id),
            "config": {
                "target_type": 0,
                "target_display": "freddy frog",
                "target_identifier": "123-id",
            },
        }


class TestWorkflowSerializer(TestCase):
    def test_serialize_simple(self):
        workflow = self.create_workflow(
            name="hojicha",
            organization_id=self.organization.id,
            config={},
        )

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "name": str(workflow.name),
            "organizationId": str(self.organization.id),
            "config": {},
            "createdBy": None,
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggers": None,
            "actionFilters": [],
            "environment": None,
            "detectorIds": [],
            "enabled": workflow.enabled,
        }

    def test_serialize_full(self):
        when_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        trigger_condition = self.create_data_condition(
            condition_group=when_condition_group,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        workflow = self.create_workflow(
            name="hojicha",
            organization_id=self.organization.id,
            config={},
            when_condition_group=when_condition_group,
            environment=self.environment,
            created_by_id=self.user.id,
        )

        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ALL,
        )
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={
                "target_identifier": "123",
                "target_type": ActionTarget.USER.value,
            },
        )
        self.create_data_condition_group_action(condition_group=condition_group, action=action)
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.create_workflow_data_condition_group(
            condition_group=condition_group,
            workflow=workflow,
        )

        detector = self.create_detector()
        self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "name": str(workflow.name),
            "organizationId": str(self.organization.id),
            "config": {},
            "createdBy": str(self.user.id),
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggers": {
                "id": str(when_condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY.value,
                "conditions": [
                    {
                        "id": str(trigger_condition.id),
                        "type": "first_seen_event",
                        "comparison": True,
                        "conditionResult": True,
                    }
                ],
                "actions": [],
            },
            "actionFilters": [
                {
                    "id": str(condition_group.id),
                    "organizationId": str(self.organization.id),
                    "logicType": DataConditionGroup.Type.ALL.value,
                    "conditions": [
                        {
                            "id": str(condition.id),
                            "type": "gt",
                            "comparison": 100,
                            "conditionResult": DetectorPriorityLevel.HIGH.value,
                        }
                    ],
                    "actions": [
                        {
                            "id": str(action.id),
                            "type": "email",
                            "data": {},
                            "integrationId": None,
                            "config": {"target_type": 1, "target_identifier": "123"},
                        }
                    ],
                },
            ],
            "environment": self.environment.name,
            "detectorIds": [str(detector.id)],
            "enabled": workflow.enabled,
        }


class TimeSeriesValueSerializerTest(TestCase):
    def test(self):
        time_series_value = TimeSeriesValue(datetime.now(), 30)
        result = serialize([time_series_value], self.user, TimeSeriesValueSerializer())
        assert result == [
            {
                "date": time_series_value.bucket,
                "count": time_series_value.count,
            }
        ]
