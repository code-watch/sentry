import {defined} from 'sentry/utils';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  DAY,
  formatAbbreviatedNumberWithDynamicPrecision,
  HOUR,
  MICROSECOND,
  MILLISECOND,
  MINUTE,
  MONTH,
  NANOSECOND,
  SECOND,
  WEEK,
} from 'sentry/utils/formatters';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';

function formatDuration(seconds: number): string {
  if (!seconds) {
    return '0ms';
  }
  const absValue = Math.abs(seconds * 1000);
  // value in milliseconds
  const msValue = seconds * 1000;

  let unit: FormattingSupportedMetricUnit | 'month' = 'nanosecond';
  let value = msValue / NANOSECOND;

  if (absValue >= MONTH) {
    unit = 'month';
    value = msValue / MONTH;
  } else if (absValue >= WEEK) {
    unit = 'week';
    value = msValue / WEEK;
  } else if (absValue >= DAY) {
    unit = 'day';
    value = msValue / DAY;
  } else if (absValue >= HOUR) {
    unit = 'hour';
    value = msValue / HOUR;
  } else if (absValue >= MINUTE) {
    unit = 'minute';
    value = msValue / MINUTE;
  } else if (absValue >= SECOND) {
    unit = 'second';
    value = msValue / SECOND;
  } else if (absValue >= MILLISECOND) {
    unit = 'millisecond';
    value = msValue;
  } else if (absValue >= MICROSECOND) {
    unit = 'microsecond';
    value = msValue / MICROSECOND;
  }

  return `${formatNumberWithDynamicDecimalPoints(value)}${
    unit === 'month' ? 'mo' : formattingSupportedMetricUnits[unit]
  }`;
}

// The metric units that we have support for in the UI
// others will still be displayed, but will not have any effect on formatting
type FormattingSupportedMetricUnit = keyof typeof formattingSupportedMetricUnits;

const formattingSupportedMetricUnits = {
  nanosecond: 'ns',
  nanoseconds: 'ns',
  microsecond: 'μs',
  microseconds: 'μs',
  millisecond: 'ms',
  milliseconds: 'ms',
  second: 's',
  seconds: 's',
  minute: 'min',
  minutes: 'min',
  hour: 'hr',
  hours: 'hr',
  day: 'day',
  days: 'day',
  week: 'wk',
  weeks: 'wk',
  ratio: '%',
  percent: '%',
  percents: '%',
  bit: 'b',
  bits: 'b',
  byte: 'B',
  bytes: 'B',
  kibibyte: 'KiB',
  kibibytes: 'KiB',
  kilobyte: 'KB',
  kilobytes: 'KB',
  mebibyte: 'MiB',
  mebibytes: 'MiB',
  megabyte: 'MB',
  megabytes: 'MB',
  gibibyte: 'GiB',
  gibibytes: 'GiB',
  gigabyte: 'GB',
  gigabytes: 'GB',
  tebibyte: 'TiB',
  tebibytes: 'TiB',
  terabyte: 'TB',
  terabytes: 'TB',
  pebibyte: 'PiB',
  pebibytes: 'PiB',
  petabyte: 'PB',
  petabytes: 'PB',
  exbibyte: 'EiB',
  exbibytes: 'EiB',
  exabyte: 'EB',
  exabytes: 'EB',
  none: '',
} as const satisfies Record<string, string>;

export function formatMetricUsingUnit(value: number | null, unit: string) {
  if (!defined(value) || Math.abs(value) === Infinity) {
    return '\u2014';
  }

  switch (unit as FormattingSupportedMetricUnit) {
    case 'nanosecond':
    case 'nanoseconds':
      return formatDuration(value / 1000000000);
    case 'microsecond':
    case 'microseconds':
      return formatDuration(value / 1000000);
    case 'millisecond':
    case 'milliseconds':
      return formatDuration(value / 1000);
    case 'second':
    case 'seconds':
      return formatDuration(value);
    case 'minute':
    case 'minutes':
      return formatDuration(value * 60);
    case 'hour':
    case 'hours':
      return formatDuration(value * 60 * 60);
    case 'day':
    case 'days':
      return formatDuration(value * 60 * 60 * 24);
    case 'week':
    case 'weeks':
      return formatDuration(value * 60 * 60 * 24 * 7);
    case 'ratio':
      return `${formatNumberWithDynamicDecimalPoints(value * 100)}%`;
    case 'percent':
    case 'percents':
      return `${formatNumberWithDynamicDecimalPoints(value)}%`;
    case 'bit':
    case 'bits':
      return formatBytesBase2(value / 8);
    case 'byte':
    case 'bytes':
      return formatBytesBase10(value);
    // Only used internally to support normalized byte metrics while preserving base 2 formatting
    case 'byte2' as FormattingSupportedMetricUnit:
      return formatBytesBase2(value);
    case 'kibibyte':
    case 'kibibytes':
      return formatBytesBase2(value * 1024);
    case 'kilobyte':
    case 'kilobytes':
      return formatBytesBase10(value, 1);
    case 'mebibyte':
    case 'mebibytes':
      return formatBytesBase2(value * 1024 ** 2);
    case 'megabyte':
    case 'megabytes':
      return formatBytesBase10(value, 2);
    case 'gibibyte':
    case 'gibibytes':
      return formatBytesBase2(value * 1024 ** 3);
    case 'gigabyte':
    case 'gigabytes':
      return formatBytesBase10(value, 3);
    case 'tebibyte':
    case 'tebibytes':
      return formatBytesBase2(value * 1024 ** 4);
    case 'terabyte':
    case 'terabytes':
      return formatBytesBase10(value, 4);
    case 'pebibyte':
    case 'pebibytes':
      return formatBytesBase2(value * 1024 ** 5);
    case 'petabyte':
    case 'petabytes':
      return formatBytesBase10(value, 5);
    case 'exbibyte':
    case 'exbibytes':
      return formatBytesBase2(value * 1024 ** 6);
    case 'exabyte':
    case 'exabytes':
      return formatBytesBase10(value, 6);
    case 'none':
    default:
      return formatAbbreviatedNumberWithDynamicPrecision(value);
  }
}
