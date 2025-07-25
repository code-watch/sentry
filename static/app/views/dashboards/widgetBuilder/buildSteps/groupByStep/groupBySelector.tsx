import {Fragment, useMemo, useState} from 'react';
import {closestCenter, DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {OnDemandWarningIcon} from 'sentry/components/alerts/onDemandMetricAlert';
import {Button} from 'sentry/components/core/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  OnDemandExtractionState,
  type ValidateWidgetResponse,
  type WidgetType,
} from 'sentry/views/dashboards/types';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import type {generateFieldOptions} from 'sentry/views/discover/utils';

import {QueryField} from './queryField';
import {SortableQueryField} from './sortableQueryField';

const GROUP_BY_LIMIT = 20;
const EMPTY_FIELD: QueryFieldValue = {kind: FieldValueKind.FIELD, field: ''};

type FieldOptions = ReturnType<typeof generateFieldOptions>;
interface Props {
  fieldOptions: FieldOptions;
  onChange: (fields: QueryFieldValue[]) => void;
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
  columns?: QueryFieldValue[];
  disable?: boolean;
  style?: React.CSSProperties;
  widgetType?: WidgetType;
}

export function GroupBySelector({
  fieldOptions,
  columns = [],
  onChange,
  validatedWidgetResponse,
  style,
  widgetType,
  disable,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const organization = useOrganization();
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();
  const builderVersion = WidgetBuilderVersion.SLIDEOUT;

  function handleAdd() {
    const newColumns =
      columns.length === 0
        ? [{...EMPTY_FIELD}, {...EMPTY_FIELD}]
        : [...columns, {...EMPTY_FIELD}];
    onChange(newColumns);
    trackAnalytics('dashboards_views.widget_builder.change', {
      builder_version: builderVersion,
      field: 'groupBy.add',
      from: source,
      new_widget: !isEditing,
      value: '',
      widget_type: widgetType ?? '',
      organization,
    });
  }

  function handleSelect(value: QueryFieldValue, index?: number) {
    const newColumns = [...columns];
    if (columns.length === 0) {
      newColumns.push(value);
    } else if (defined(index)) {
      newColumns[index] = value;
    }
    onChange(newColumns);
    trackAnalytics('dashboards_views.widget_builder.change', {
      builder_version: builderVersion,
      field: 'groupBy.update',
      from: source,
      new_widget: !isEditing,
      value: '',
      widget_type: widgetType ?? '',
      organization,
    });
  }

  function handleRemove(index: number) {
    const newColumns = [...columns];
    newColumns.splice(index, 1);
    onChange(newColumns);
    trackAnalytics('dashboards_views.widget_builder.change', {
      builder_version: builderVersion,
      field: 'groupBy.delete',
      from: source,
      new_widget: !isEditing,
      value: '',
      widget_type: widgetType ?? '',
      organization,
    });
  }

  const hasOnlySingleColumnWithValue =
    columns.length === 1 &&
    columns[0]!.kind === FieldValueKind.FIELD &&
    columns[0]?.field !== '';

  const canDrag = columns.length > 1;
  const canDelete = canDrag || hasOnlySingleColumnWithValue;
  const columnFieldsAsString = columns.map(generateFieldAsString);

  const {filteredFieldOptions, columnsAsFieldOptions} = useMemo(() => {
    return Object.keys(fieldOptions).reduce<{
      columnsAsFieldOptions: FieldOptions[];
      filteredFieldOptions: FieldOptions;
    }>(
      (acc, key) => {
        const value = fieldOptions[key]!;
        const optionInColumnsIndex = columnFieldsAsString.indexOf(value.value.meta.name);
        if (optionInColumnsIndex === -1) {
          acc.filteredFieldOptions[key] = value;
          return acc;
        }
        acc.columnsAsFieldOptions[optionInColumnsIndex] = {[key]: value};
        return acc;
      },
      {
        filteredFieldOptions: {},
        columnsAsFieldOptions: [],
      }
    );
  }, [fieldOptions, columnFieldsAsString]);

  const items = useMemo(() => {
    return columns.reduce<string[]>((acc, _column, index) => {
      acc.push(String(index));
      return acc;
    }, []);
  }, [columns]);

  return (
    <Fragment>
      <StyledField inline={false} style={style} flexibleControlStateSize stacked>
        {columns.length === 0 ? (
          <QueryField
            value={EMPTY_FIELD}
            fieldOptions={filteredFieldOptions}
            onChange={value => handleSelect(value, 0)}
            canDelete={canDelete}
            disabled={disable}
          />
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={({active}) => {
              setActiveId(active.id.toString());
            }}
            onDragEnd={({over, active}) => {
              setActiveId(null);

              if (over) {
                const getIndex = items.indexOf.bind(items);
                const activeIndex = getIndex(active.id);
                const overIndex = getIndex(over.id);

                if (activeIndex !== overIndex) {
                  onChange(arrayMove(columns, activeIndex, overIndex));
                }
              }
            }}
            onDragCancel={() => {
              setActiveId(null);
            }}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <SortableQueryFields>
                {columns.map((column, index) => (
                  <SortableQueryField
                    key={items[index]}
                    dragId={items[index]!}
                    value={column}
                    fieldOptions={{
                      ...filteredFieldOptions,
                      ...columnsAsFieldOptions[index],
                    }}
                    fieldValidationError={
                      <FieldValidationErrors
                        column={column}
                        validatedWidgetResponse={validatedWidgetResponse}
                      />
                    }
                    onChange={value => handleSelect(value, index)}
                    onDelete={() => handleRemove(index)}
                    canDrag={canDrag}
                    canDelete={canDelete}
                    disabled={disable}
                  />
                ))}
              </SortableQueryFields>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId ? (
                <Ghost>
                  <QueryField
                    value={columns[Number(activeId)]!}
                    fieldOptions={{
                      ...filteredFieldOptions,
                      ...columnsAsFieldOptions[Number(activeId)],
                    }}
                    onChange={value => handleSelect(value, Number(activeId))}
                    canDrag={canDrag}
                    canDelete={canDelete}
                    disabled={disable}
                  />
                </Ghost>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </StyledField>
      {columns.length < GROUP_BY_LIMIT && (
        <Button
          size="sm"
          priority="link"
          onClick={handleAdd}
          aria-label={t('Add Group')}
          disabled={disable}
        >
          {t('+ Add Group')}
        </Button>
      )}
    </Fragment>
  );
}

function FieldValidationErrors(props: {
  column: QueryFieldValue;
  validatedWidgetResponse: Props['validatedWidgetResponse'];
}) {
  const organization = useOrganization();
  if (!hasOnDemandMetricWidgetFeature(organization)) {
    return null;
  }

  return props.column.kind === 'field' &&
    props.validatedWidgetResponse.data?.warnings?.columns[props.column.field ?? ''] ===
      OnDemandExtractionState.DISABLED_HIGH_CARDINALITY ? (
    <OnDemandWarningIcon
      color="yellow300"
      msg={t('This group has too many unique values to collect metrics for it.')}
    />
  ) : null;
}

const StyledField = styled(FieldGroup)`
  padding-bottom: ${space(1)};
`;

const SortableQueryFields = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
`;

const Ghost = styled('div')`
  position: absolute;
  background: ${p => p.theme.background};
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  opacity: 0.8;
  cursor: grabbing;
  padding-right: ${space(2)};
  width: 100%;

  button {
    cursor: grabbing;
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 710px;
  }
`;
