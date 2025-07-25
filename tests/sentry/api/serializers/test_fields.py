import unittest

from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail
from rest_framework.serializers import ListField

from sentry.api.fields.actor import ActorField
from sentry.testutils.cases import TestCase
from sentry.types.actor import ActorType


class ChildSerializer(serializers.Serializer):
    b_field = serializers.CharField(max_length=64)
    d_field = serializers.CharField(max_length=64)


class DummySerializer(serializers.Serializer):
    a_field = ListField(child=ChildSerializer(), required=False, allow_null=False)
    actor_field = ActorField(required=False)


class TestListField(unittest.TestCase):
    def test_simple(self) -> None:
        data = {"a_field": [{"b_field": "abcdefg", "d_field": "gfedcba"}]}

        serializer = DummySerializer(data=data)
        assert serializer.is_valid()
        assert serializer.validated_data == {
            "a_field": [{"b_field": "abcdefg", "d_field": "gfedcba"}]
        }

    def test_allow_null(self) -> None:
        data = {"a_field": [None]}

        serializer = DummySerializer(data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "a_field": [ErrorDetail(string="This field may not be null.", code="null")]
        }

    def test_child_validates(self) -> None:
        data = {"a_field": [{"b_field": "abcdefg"}]}

        serializer = DummySerializer(data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "a_field": {"d_field": [ErrorDetail(string="This field is required.", code="required")]}
        }


class TestActorField(TestCase):
    def test_simple(self) -> None:
        data = {"actor_field": f"user:{self.user.id}"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert serializer.is_valid()

        assert serializer.validated_data["actor_field"].is_user
        assert serializer.validated_data["actor_field"].id == self.user.id

    def test_legacy_user_fallback(self) -> None:
        data = {"actor_field": f"{self.user.id}"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert serializer.is_valid()

        assert serializer.validated_data["actor_field"].is_user
        assert serializer.validated_data["actor_field"].id == self.user.id

    def test_team(self) -> None:
        data = {"actor_field": f"team:{self.team.id}"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert serializer.is_valid()
        assert serializer.validated_data["actor_field"].actor_type == ActorType.TEAM
        assert serializer.validated_data["actor_field"].id == self.team.id

    def test_permissions(self) -> None:
        other_org = self.create_organization()
        serializer = DummySerializer(
            data={"actor_field": f"user:{self.user.id}"}, context={"organization": other_org}
        )
        assert not serializer.is_valid()
        assert serializer.errors["actor_field"] == [
            ErrorDetail("User is not a member of this organization", "invalid")
        ]

        serializer = DummySerializer(
            data={"actor_field": f"team:{self.team.id}"}, context={"organization": other_org}
        )
        assert not serializer.is_valid()
        assert serializer.errors["actor_field"] == [
            ErrorDetail("Team is not a member of this organization", "invalid")
        ]

    def test_validates(self) -> None:
        data = {"actor_field": "foo:1"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert not serializer.is_valid()
        assert serializer.errors == {
            "actor_field": [
                "Could not parse actor. Format should be `type:id` where type is `team` or `user`."
            ]
        }
