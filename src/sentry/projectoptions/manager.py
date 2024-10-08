import bisect


class WellKnownProjectOption:
    def __init__(self, key, default=None, epoch_defaults=None):
        self.key = key
        self.default = default
        self.epoch_defaults = epoch_defaults
        self._epoch_default_list = sorted(epoch_defaults or ())

    def get_default(self, project=None, epoch=None):
        if self.epoch_defaults:
            if epoch is None:
                if project is None:
                    epoch = 1
                else:
                    epoch = project.get_option("sentry:option-epoch") or 1
            # Find where in the ordered epoch list the project's epoch would go
            idx = bisect.bisect(self._epoch_default_list, epoch)
            if idx > 0:
                # Return the value corresponding to the highest epoch which doesn't exceed the
                # project epoch
                return self.epoch_defaults[self._epoch_default_list[idx - 1]]
        return self.default


class ProjectOptionsManager:
    """Project options used to be implemented in a relatively ad-hoc manner
    in the past.  The project manager still uses the functionality of the
    project model and just dispatches to it.

    Options can be used without declaring defaults, but if defaults are
    declared they are returned without having to define a default at the
    time of the option lookup.
    """

    def __init__(self):
        self.registry = {}

    def lookup_well_known_key(self, key):
        return self.registry.get(key)

    def freeze_option_epoch(self, project, force=False):
        # The options are frozen in a receiver hook for project saves.
        # See `sentry.receivers.core.freeze_option_epoch_for_project`
        if force or project.get_option("sentry:option-epoch") is None:
            from .defaults import LATEST_EPOCH

            project.update_option("sentry:option-epoch", LATEST_EPOCH)

    def set(self, project, key, value):
        from sentry.models.options.project_option import ProjectOption

        return ProjectOption.objects.set_value(project, key, value)

    def isset(self, project, key):
        return project.get_option(key, default=Ellipsis) is not Ellipsis

    def get(self, project, key, default=None, validate=None):
        return project.get_option(key, default=default, validate=validate)

    def delete(self, project, key):
        from sentry.models.options.project_option import ProjectOption

        return ProjectOption.objects.unset_value(project, key)

    def register(self, key, default=None, epoch_defaults=None):
        self.registry[key] = WellKnownProjectOption(
            key=key, default=default, epoch_defaults=epoch_defaults
        )

    def all(self):
        """
        Return an iterator for all keys in the registry.
        """
        return self.registry.values()
