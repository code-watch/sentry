from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sentry.spans.grouping.result import SpanGroupingResults
from sentry.spans.grouping.strategy.base import (
    CallableStrategy,
    SpanGroupingStrategy,
    loose_normalized_db_span_in_condition_strategy,
    normalized_db_span_in_condition_strategy,
    parametrize_db_span_strategy,
    remove_http_client_query_string_strategy,
    remove_redis_command_arguments_strategy,
)


@dataclass(frozen=True)
class SpanGroupingConfig:
    id: str
    strategy: SpanGroupingStrategy

    def execute_strategy(self, event_data: Any) -> SpanGroupingResults:
        # If there are hashes using the same grouping config stored
        # in the data, they should be reused. Otherwise, fall back to
        # generating new hashes using the data.
        grouping_results = SpanGroupingResults.from_event(event_data)
        if grouping_results is not None and grouping_results.id == self.id:
            return grouping_results

        results = self.strategy.execute(event_data)
        return SpanGroupingResults(self.id, results)

    def execute_strategy_standalone(self, spans: list[Any]) -> SpanGroupingResults:
        results = self.strategy.execute_standalone(spans)
        return SpanGroupingResults(self.id, results)


CONFIGURATIONS: dict[str, SpanGroupingConfig] = {}


def register_configuration(config_id: str, strategies: Sequence[CallableStrategy]) -> None:
    if config_id in CONFIGURATIONS:
        raise ValueError(f"Duplicate configuration id: {config_id}")

    strategy = SpanGroupingStrategy(config_id, [] if strategies is None else strategies)
    CONFIGURATIONS[config_id] = SpanGroupingConfig(config_id, strategy)


DEFAULT_CONFIG_ID = "default:2022-10-27"

register_configuration(
    "default:2021-08-25",
    strategies=[
        normalized_db_span_in_condition_strategy,
        remove_http_client_query_string_strategy,
        remove_redis_command_arguments_strategy,
    ],
)

register_configuration(
    "default:2022-10-04",
    strategies=[
        loose_normalized_db_span_in_condition_strategy,
        remove_http_client_query_string_strategy,
        remove_redis_command_arguments_strategy,
    ],
)

register_configuration(
    "default:2022-10-27",
    strategies=[
        parametrize_db_span_strategy,
        remove_http_client_query_string_strategy,
        remove_redis_command_arguments_strategy,
    ],
)
