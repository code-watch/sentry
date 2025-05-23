--[[

Add a span to the span buffer.

KEYS:
- "project_id:trace_id" -- just for redis-cluster routing, all keys that the script uses are sharded like this/have this hashtag.

ARGS:
- payload -- str
- is_root_span -- bool
- span_id -- str
- parent_span_id -- str
- set_timeout -- int

]]--

local project_and_trace = KEYS[1]

local is_root_span = ARGV[1] == "true"
local span_id = ARGV[2]
local parent_span_id = ARGV[3]
local set_timeout = tonumber(ARGV[4])

local span_key = string.format("span-buf:s:{%s}:%s", project_and_trace, span_id)
local main_redirect_key = string.format("span-buf:sr:{%s}", project_and_trace)

local set_span_id = parent_span_id
local redirect_depth = 0

for i = 0, 10000 do  -- theoretically this limit means that segment trees of depth 10k may not be joined together correctly.
    local new_set_span = redis.call("hget", main_redirect_key, set_span_id)
    redirect_depth = i
    if not new_set_span or new_set_span == set_span_id then
        break
    end

    set_span_id = new_set_span
end

redis.call("hset", main_redirect_key, span_id, set_span_id)
redis.call("expire", main_redirect_key, set_timeout)

local set_key = string.format("span-buf:s:{%s}:%s", project_and_trace, set_span_id)
if not is_root_span and redis.call("scard", span_key) > 0 then
    redis.call("sunionstore", set_key, set_key, span_key)
    redis.call("unlink", span_key)
end

local parent_key = string.format("span-buf:s:{%s}:%s", project_and_trace, parent_span_id)
if set_span_id ~= parent_span_id and redis.call("scard", parent_key) > 0 then
    redis.call("sunionstore", set_key, set_key, parent_key)
    redis.call("unlink", parent_key)
end
redis.call("expire", set_key, set_timeout)

local has_root_span_key = string.format("span-buf:hrs:%s", set_key)
local has_root_span = redis.call("get", has_root_span_key) == "1" or is_root_span
if has_root_span then
    redis.call("setex", has_root_span_key, set_timeout, "1")
end

return {redirect_depth, span_key, set_key, has_root_span}
