# Generated by Django 5.1.1 on 2024-11-22 19:12

from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = False

    dependencies = [
        ("sentry", "0793_remove_db_constraint_alert_rule_exclusion"),
    ]

    operations = [
        SafeRemoveField(
            model_name="alertrule",
            name="excluded_projects",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
        migrations.AlterField(
            model_name="alertrule",
            name="include_all_projects",
            field=models.BooleanField(default=False, null=True),
        ),
        SafeRemoveField(
            model_name="alertrule",
            name="include_all_projects",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
