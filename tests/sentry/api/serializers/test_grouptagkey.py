from sentry.api.serializers import serialize
from sentry.tagstore.types import GroupTagKey
from sentry.testutils.cases import TestCase


class GroupTagKeySerializerTest(TestCase):
    def test(self) -> None:
        user = self.create_user()
        grouptagkey = GroupTagKey(group_id=0, key="key", values_seen=1)

        result = serialize(grouptagkey, user)
        assert result["key"] == "key"
        assert result["uniqueValues"] == 1
