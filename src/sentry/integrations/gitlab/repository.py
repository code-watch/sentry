from typing import Any

from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError


class GitlabRepositoryProvider(IntegrationRepositoryProvider):
    name = "Gitlab"
    repo_provider = IntegrationProviderSlug.GITLAB.value

    def get_repository_data(self, organization, config):
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()

        repo_id = config["identifier"]
        instance = installation.model.metadata["instance"]

        try:
            project = client.get_project(repo_id)
        except Exception as e:
            raise installation.raise_error(e)
        config.update(
            {
                "instance": instance,
                "path": project["path_with_namespace"],
                "name": project["name_with_namespace"],
                "external_id": "{}:{}".format(instance, project["id"]),
                "project_id": project["id"],
                "url": project["web_url"],
            }
        )
        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: dict[str, Any]
    ) -> RepositoryConfig:

        installation = self.get_installation(data.get("installation"), organization.id)
        client = installation.get_client()
        try:
            hook_id = client.create_project_webhook(data["project_id"])
        except Exception as e:
            raise installation.raise_error(e)
        return {
            "name": data["name"],
            "external_id": data["external_id"],
            "url": data["url"],
            "config": {
                "instance": data["instance"],
                "path": data["path"],
                "webhook_id": hook_id,
                "project_id": data["project_id"],
            },
            "integration_id": data["installation"],
        }

    def on_delete_repository(self, repo):
        """Clean up the attached webhook"""
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        try:
            client.delete_project_webhook(repo.config["project_id"], repo.config["webhook_id"])
        except ApiError as e:
            if e.code == 404:
                return
            raise installation.raise_error(e)

    def compare_commits(self, repo, start_sha, end_sha):
        """Fetch the commit list and diffed files between two SHAs"""
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        try:
            if start_sha is None:
                res = client.get_last_commits(repo.config["project_id"], end_sha)
                return self._format_commits(client, repo, res)
            else:
                res = client.compare_commits(repo.config["project_id"], start_sha, end_sha)
                return self._format_commits(client, repo, res["commits"])
        except Exception as e:
            raise installation.raise_error(e)

    def _format_commits(self, client, repo, commit_list):
        """Convert GitLab commits into our internal format"""
        return [
            {
                "id": c["id"],
                "repository": repo.name,
                "author_email": c["author_email"],
                "author_name": c["author_name"],
                "message": c["title"],
                "timestamp": self.format_date(c["created_at"]),
                "patch_set": self._get_patchset(client, repo, c["id"]),
            }
            for c in commit_list
        ]

    def _get_patchset(self, client, repo, sha):
        """GitLab commit lists don't come with diffs so we have
        to make additional round trips.
        """
        diffs = client.get_diff(repo.config["project_id"], sha)
        return self._transform_patchset(diffs)

    def _transform_patchset(self, patch_set):
        file_changes = []
        for changed_file in patch_set:
            if changed_file["new_file"]:
                file_changes.append({"path": changed_file["new_path"], "type": "A"})
            elif changed_file["deleted_file"]:
                file_changes.append({"path": changed_file["old_path"], "type": "D"})
            elif changed_file["renamed_file"]:
                file_changes.append({"path": changed_file["old_path"], "type": "D"})
                file_changes.append({"path": changed_file["new_path"], "type": "A"})
            else:
                file_changes.append({"path": changed_file["new_path"], "type": "M"})

        return file_changes

    def pull_request_url(self, repo, pull_request):
        return f"{repo.url}/merge_requests/{pull_request.key}"

    def repository_external_slug(self, repo):
        return repo.config["project_id"]
