from __future__ import annotations

from copy import deepcopy
from typing import Any
from unittest import TestCase

from sentry.utils.meta import Meta

input_meta = {"": {"err": ["existing"], "val": "original", "rem": [{"type": "x"}]}}

other_meta = {"": {"err": ["additional"], "val": "changed", "rem": [{"type": "y"}]}}

merged_meta = {"": {"err": ["existing", "additional"], "val": "changed", "rem": [{"type": "y"}]}}


class MetaTests(TestCase):
    def test_get_new(self) -> None:
        assert Meta().raw() == {}
        assert Meta().get() == {}
        assert list(Meta().iter_errors()) == []
        assert Meta().get_event_errors() == []

    def test_create_new(self) -> None:
        meta = Meta()
        assert meta.create() == {}
        assert meta.raw() == {"": {}}

    def test_merge_new(self) -> None:
        meta = Meta()
        assert meta.merge(Meta(other_meta)) == other_meta[""]
        assert meta.raw() == other_meta

    def test_add_error_new(self) -> None:
        meta = Meta()
        meta.add_error("additional", "changed")
        assert meta.raw() == {"": {"err": ["additional"], "val": "changed"}}

    def test_get_missing(self) -> None:
        assert Meta({}).raw() == {}
        assert Meta({}).get() == {}
        assert list(Meta({}).iter_errors()) == []
        assert Meta({}).get_event_errors() == []

    def test_create_missing(self) -> None:
        data: dict[str, Any] = {}
        meta = Meta(data)
        assert meta.create() == {}
        assert data == {"": {}}

    def test_merge_missing(self) -> None:
        data: dict[str, Any] = {}
        meta = Meta(data)
        assert meta.merge(Meta(other_meta)) == other_meta[""]
        assert data == other_meta

    def test_add_error_missing(self) -> None:
        data: dict[str, Any] = {}
        meta = Meta(data)
        meta.add_error("additional", "changed")
        assert data == {"": {"err": ["additional"], "val": "changed"}}

    def test_get_none(self) -> None:
        assert Meta({"": None}).raw() == {"": None}
        assert Meta({"": None}).get() == {}
        assert list(Meta({"": None}).iter_errors()) == []
        assert Meta({"": None}).get_event_errors() == []

    def test_create_none(self) -> None:
        data = {"": None}
        meta = Meta(data)
        assert meta.create() == {}
        assert data == {"": {}}

    def test_merge_none(self) -> None:
        data = {"": None}
        meta = Meta(data)
        assert meta.merge(Meta(other_meta)) == other_meta[""]
        assert data == other_meta

    def test_add_error_none(self) -> None:
        data = {"": None}
        meta = Meta(data)
        meta.add_error("additional", "changed")
        assert data == {"": {"err": ["additional"], "val": "changed"}}

    def test_get_empty(self) -> None:
        assert Meta({"": {}}).raw() == {"": {}}
        assert Meta({"": {}}).get() == {}
        assert list(Meta({"": {}}).iter_errors()) == []
        assert Meta({"": {}}).get_event_errors() == []

    def test_create_empty(self) -> None:
        data: dict[str, Any] = {"": {}}
        meta = Meta(data)
        assert meta.create() == {}
        assert data == {"": {}}

    def test_merge_empty(self) -> None:
        data: dict[str, Any] = {"": {}}
        meta = Meta(data)
        assert meta.merge(Meta(other_meta)) == other_meta[""]
        assert data == other_meta

    def test_add_error_empty(self) -> None:
        data: dict[str, Any] = {"": {}}
        meta = Meta(data)
        meta.add_error("additional", "changed")
        assert data == {"": {"err": ["additional"], "val": "changed"}}

    def test_get_root(self) -> None:
        assert Meta(input_meta).raw() == input_meta
        assert Meta(input_meta).get() == input_meta[""]
        assert list(Meta(input_meta).iter_errors()) == [["existing", {}]]
        assert Meta(input_meta).get_event_errors() == [{"type": "existing", "value": "original"}]

    def test_create_root(self) -> None:
        changed = deepcopy(input_meta)
        meta = Meta(changed)
        # should be idempotent
        assert meta.create() == input_meta[""]
        assert changed == input_meta

    def test_merge_root(self) -> None:
        changed = deepcopy(input_meta)
        meta = Meta(changed)
        assert meta.merge(Meta(other_meta)) == merged_meta[""]
        assert changed == merged_meta

    def test_add_error_root(self) -> None:
        changed = deepcopy(input_meta)
        meta = Meta(changed)
        meta.add_error("additional", "changed")
        assert meta.get() == {
            "err": ["existing", "additional"],
            "val": "changed",
            "rem": [{"type": "x"}],
        }

    def test_get_nested_missing(self) -> None:
        data: dict[str, Any] = {}
        assert Meta(data).enter("field").raw() == {}
        assert Meta(data).enter("field").get() == {}
        assert list(Meta(data).enter("field").iter_errors()) == []
        assert Meta(data).enter("field").get_event_errors() == []

    def test_create_nested_missing(self) -> None:
        data: dict[str, Any] = {}
        meta = Meta(data)
        assert meta.enter("field").create() == {}
        assert data == {"field": {"": {}}}

    def test_merge_nested_missing(self) -> None:
        data: dict[str, Any] = {}
        meta = Meta(data)
        assert meta.enter("field").merge(Meta(other_meta)) == other_meta[""]
        assert data == {"field": other_meta}

    def test_add_error_nested_missing(self) -> None:
        data: dict[str, Any] = {}
        meta = Meta(data)
        meta.enter("field").add_error("additional", "changed")
        assert meta.enter("field").get() == {"err": ["additional"], "val": "changed"}

    def test_get_nested_existing(self) -> None:
        data = {"field": input_meta}
        assert Meta(data).enter("field").raw() == input_meta
        assert Meta(data).enter("field").get() == input_meta[""]
        assert list(Meta(data).enter("field").iter_errors()) == [["existing", {}]]
        assert Meta(data).enter("field").get_event_errors() == [
            {"type": "existing", "name": "field", "value": "original"}
        ]

    def test_create_nested_existing(self) -> None:
        data = {"field": input_meta}
        changed = deepcopy(data)
        meta = Meta(changed)
        assert meta.enter("field").create() == input_meta[""]
        assert changed == data

    def test_merge_nested_existing(self) -> None:
        data = {"field": input_meta}
        changed = deepcopy(data)
        meta = Meta(changed)
        assert meta.enter("field").merge(Meta(other_meta)) == merged_meta[""]
        assert changed == {"field": merged_meta}

    def test_add_error_nested_existing(self) -> None:
        data = {"field": input_meta}
        changed = deepcopy(data)
        meta = Meta(changed)
        meta.enter("field").add_error("additional", "changed")
        assert meta.enter("field").get() == {
            "err": ["existing", "additional"],
            "val": "changed",
            "rem": [{"type": "x"}],
        }

    def test_get_nested_index(self) -> None:
        data = {"0": input_meta}
        assert Meta(data).enter(0).raw() == input_meta
        assert Meta(data).enter(0).get() == input_meta[""]
        assert list(Meta(data).enter(0).iter_errors()) == [["existing", {}]]

    def test_create_nested_index(self) -> None:
        data: dict[str, Any] = {}
        meta = Meta(data)
        assert meta.enter(0).create() == {}
        assert data == {"0": {"": {}}}

    def test_stringify_error(self) -> None:
        meta = Meta()
        meta.add_error(ValueError("invalid stuff"), "changed")
        assert list(meta.iter_errors()) == [["invalid stuff", {}]]

    def test_error_with_data(self) -> None:
        meta = Meta()
        meta.add_error("invalid url", data={"url": "invalid"})
        assert list(meta.iter_errors()) == [["invalid url", {"url": "invalid"}]]

    def test_get_multiple_event_errors(self) -> None:
        # XXX: Value is only added to the first error, which is usually the
        # normalization error.
        assert Meta(merged_meta).get_event_errors() == [
            {"type": "existing", "value": "changed"},
            {"type": "additional"},
        ]

    def test_add_remark(self) -> None:
        meta = Meta()
        meta.add_remark({"rule_id": "react", "type": "s"})
        assert meta.get() == {
            "rem": [["react", "s"]],
        }
        meta.add_remark({"rule_id": "removal-rule", "type": "x"})
        assert meta.get() == {
            "rem": [["react", "s"], ["removal-rule", "x"]],
        }

    def test_add_remark_with_value(self) -> None:
        meta = Meta()
        meta.add_remark({"rule_id": "react", "type": "s"}, "Minified React error #109")
        assert meta.get() == {
            "rem": [["react", "s"]],
            "val": "Minified React error #109",
        }
