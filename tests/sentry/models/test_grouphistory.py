from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, get_prev_history
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.actor import Actor

pytestmark = requires_snuba


class GroupHistoryTest(TestCase):
    def test_owner(self) -> None:
        team = self.create_team()

        GroupAssignee.objects.assign(self.group, self.user)
        history = GroupHistory.objects.filter(group_id=self.group.id).first()
        assert history

        actor = Actor.from_id(user_id=self.user.id)
        assert actor
        history.owner = actor

        owner = history.owner
        assert owner
        assert owner.identifier == actor.identifier
        assert history.user_id == self.user.id
        assert history.team_id is None

        actor = Actor.from_id(team_id=team.id)
        assert actor
        history.owner = actor
        owner = history.owner

        assert owner
        assert owner.identifier == actor.identifier
        assert history.team_id == team.id
        assert history.user_id is None


class FilterToTeamTest(TestCase):
    def test(self) -> None:
        GroupAssignee.objects.assign(self.group, self.user)
        proj_1_group_2 = self.store_event(data={}, project_id=self.project.id).group
        GroupAssignee.objects.assign(self.group, self.team)
        history = set(GroupHistory.objects.filter(group__in=[self.group, proj_1_group_2]))

        other_org = self.create_organization()
        other_team = self.create_team(other_org, members=[self.user])
        other_project = self.create_project(organization=other_org, teams=[other_team])
        other_group = self.store_event(data={}, project_id=other_project.id).group
        assert other_group is not None
        other_group_2 = self.store_event(data={}, project_id=other_project.id).group
        assert other_group_2 is not None
        GroupAssignee.objects.assign(other_group, self.user)
        GroupAssignee.objects.assign(other_group_2, other_team)
        other_history = set(GroupHistory.objects.filter(group__in=[other_group, other_group_2]))

        # Even though the user is a member of both orgs, and is assigned to both groups, we should
        # filter down to just the history that each team has access to here.
        assert set(GroupHistory.objects.filter_to_team(self.team)) == history
        assert set(GroupHistory.objects.filter_to_team(other_team)) == other_history


class GetPrevHistoryTest(TestCase):
    def test_no_history(self) -> None:
        # Test both statuses with/without a previous status
        assert get_prev_history(self.group, GroupHistoryStatus.UNRESOLVED) is None
        assert get_prev_history(self.group, GroupHistoryStatus.DELETED) is None

    def test_history(self) -> None:
        prev_history = self.create_group_history(self.group, GroupHistoryStatus.UNRESOLVED)
        assert get_prev_history(self.group, GroupHistoryStatus.RESOLVED) == prev_history
        assert get_prev_history(self.group, GroupHistoryStatus.DELETED) is None

    def test_multi_history(self) -> None:
        other_group = self.create_group()
        self.create_group_history(other_group, GroupHistoryStatus.UNRESOLVED)
        assert get_prev_history(self.group, GroupHistoryStatus.UNRESOLVED) is None
        prev_history = self.create_group_history(self.group, GroupHistoryStatus.UNRESOLVED)
        assert get_prev_history(self.group, GroupHistoryStatus.RESOLVED) == prev_history
        prev_history = self.create_group_history(
            self.group, GroupHistoryStatus.RESOLVED, prev_history=prev_history
        )
        assert get_prev_history(self.group, GroupHistoryStatus.UNRESOLVED) == prev_history
        prev_history = self.create_group_history(
            self.group, GroupHistoryStatus.UNRESOLVED, prev_history=prev_history
        )
        assert get_prev_history(self.group, GroupHistoryStatus.RESOLVED) == prev_history
