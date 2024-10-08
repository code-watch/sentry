# Generated by Django 5.1.1 on 2024-09-27 17:47

import django.db.models.deletion
from django.db import migrations

import sentry.db.models.fields.foreignkey
from sentry.new_migrations.migrations import CheckedMigration


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
        ("workflow_engine", "0006_data_conditions"),
    ]

    operations = [
        migrations.AlterField(
            model_name="workflowaction",
            name="workflow",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                db_constraint=False,
                on_delete=django.db.models.deletion.CASCADE,
                to="workflow_engine.workflow",
            ),
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[migrations.DeleteModel(name="WorkflowAction")],
            database_operations=[],
        ),
    ]
