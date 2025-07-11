import type {ChangeEvent, FocusEvent, MouseEvent, RefObject} from 'react';
import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token, TokenFreeText} from 'sentry/components/arithmeticBuilder/token';
import {
  isTokenFreeText,
  isTokenFunction,
  isTokenLiteral,
  isTokenOperator,
  isTokenParenthesis,
  TokenKind,
} from 'sentry/components/arithmeticBuilder/token';
import {
  nextSimilarTokenKey,
  nextTokenKeyOfKind,
  tokenizeExpression,
} from 'sentry/components/arithmeticBuilder/tokenizer';
import type {
  SelectOptionWithKey,
  SelectSectionWithKey,
} from 'sentry/components/core/compactSelect/types';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconClose} from 'sentry/icons/iconClose';
import {IconDivide} from 'sentry/icons/iconDivide';
import {IconParenthesis} from 'sentry/icons/iconParenthesis';
import {IconSubtract} from 'sentry/icons/iconSubtract';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {AggregateParameter} from 'sentry/utils/fields';

interface ArithmeticTokenFreeTextProps {
  item: Node<Token>;
  nextAllowedTokenKinds: TokenKind[];
  showPlaceholder: boolean;
  state: ListState<Token>;
  token: TokenFreeText;
}

export function ArithmeticTokenFreeText({
  showPlaceholder,
  item,
  state,
  token,
  nextAllowedTokenKinds,
}: ArithmeticTokenFreeTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: true,
  });

  return (
    <Row
      {...rowProps}
      ref={ref}
      tabIndex={-1}
      aria-label={token.text}
      aria-invalid={false}
    >
      <GridCell {...gridCellProps} onClick={stopPropagation}>
        <InternalInput
          showPlaceholder={showPlaceholder}
          nextAllowedTokenKinds={nextAllowedTokenKinds}
          item={item}
          state={state}
          token={token}
          rowRef={ref}
        />
      </GridCell>
    </Row>
  );
}

type FocusTokenFunction = {
  func: string;
  kind: TokenKind.FUNCTION;
};

type FocusTokenLiteral = {
  kind: TokenKind.LITERAL;
};

type FocusToken = FocusTokenFunction | FocusTokenLiteral;

interface InternalInputProps extends ArithmeticTokenFreeTextProps {
  rowRef: RefObject<HTMLDivElement | null>;
}

function InternalInput({
  showPlaceholder,
  item,
  state,
  token,
  rowRef,
  nextAllowedTokenKinds,
}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedTokenValue = token.text.trim();
  const [inputValue, setInputValue] = useState(trimmedTokenValue);
  const [_selectionIndex, setSelectionIndex] = useState(0); // TODO
  const [_isOpen, setIsOpen] = useState(false); // TODO

  const filterValue = inputValue.trim();

  // When token value changes, reset the input value
  const [prevValue, setPrevValue] = useState(inputValue);
  if (trimmedTokenValue !== prevValue) {
    setPrevValue(trimmedTokenValue);
    setInputValue(trimmedTokenValue);
  }

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? 0);
  }, [setSelectionIndex]);

  const resetInputValue = useCallback(() => {
    setInputValue(trimmedTokenValue);
    updateSelectionIndex();
  }, [trimmedTokenValue, updateSelectionIndex]);

  const {dispatch, aggregations, getFieldDefinition} = useArithmeticBuilder();

  const getNextFocusOverride = useCallback(
    (focusToken?: FocusToken): string => {
      if (defined(focusToken)) {
        if (focusToken.kind === TokenKind.FUNCTION) {
          const definition = getFieldDefinition(focusToken.func);
          const parameterDefinitions: AggregateParameter[] = definition?.parameters ?? [];
          if (parameterDefinitions.length > 0) {
            // if they selected a function with arguments, move focus into the function argument
            return nextTokenKeyOfKind(state, token, TokenKind.FUNCTION);
          }
        } else if (focusToken.kind === TokenKind.LITERAL) {
          return nextTokenKeyOfKind(state, token, TokenKind.LITERAL);
        }
      }

      // if they selected a function without arguments/parenthesis/operator, move focus into next free text
      return nextSimilarTokenKey(token.key);
    },
    [getFieldDefinition, state, token]
  );

  const getFunctionDefault = useCallback(
    (func: string): string => {
      const definition = getFieldDefinition(func);
      const parameterDefinitions: AggregateParameter[] = definition?.parameters ?? [];
      const parameters: string[] = parameterDefinitions.map(
        parameterDefinition => parameterDefinition.defaultValue ?? ''
      );
      return `${func}(${parameters.join(',')})`;
    },
    [getFieldDefinition]
  );

  const items: Array<SelectSectionWithKey<string>> = useSuggestionItems({
    nextAllowedTokenKinds,
    allowedFunctions: aggregations,
    filterValue,
  });

  const shouldCloseOnInteractOutside = useCallback(
    (el: Element) => !rowRef.current?.contains(el),
    [rowRef]
  );

  const onClick = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const onInputBlur = useCallback(() => {
    dispatch({
      type: 'REPLACE_TOKEN',
      token,
      text: inputValue.trim(),
    });
    resetInputValue();
  }, [dispatch, inputValue, token, resetInputValue]);

  const onInputChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      const text = evt.target.value;

      const tokens = tokenizeExpression(text);

      for (const tok of tokens) {
        if (isTokenParenthesis(tok) || isTokenOperator(tok)) {
          dispatch({
            type: 'REPLACE_TOKEN',
            token,
            text,
            focusOverride: {
              itemKey: getNextFocusOverride(),
            },
          });
          resetInputValue();
          return;
        }

        if (isTokenFunction(tok)) {
          dispatch({
            type: 'REPLACE_TOKEN',
            token,
            text,
            focusOverride: {
              itemKey: getNextFocusOverride({
                kind: TokenKind.FUNCTION,
                func: tok.function,
              }),
            },
          });
          resetInputValue();
          return;
        }

        if (isTokenLiteral(tok)) {
          dispatch({
            type: 'REPLACE_TOKEN',
            token,
            text,
            focusOverride: {
              itemKey: getNextFocusOverride({
                kind: TokenKind.LITERAL,
              }),
            },
          });
          resetInputValue();
          return;
        }

        if (isTokenFreeText(tok)) {
          const input = text.trim();
          if (input.endsWith('(')) {
            const pos = input.lastIndexOf(' ');
            const maybeFunc = input.substring(pos + 1, input.length - 1);
            if (aggregations.includes(maybeFunc)) {
              dispatch({
                type: 'REPLACE_TOKEN',
                token,
                text: `${input.substring(0, pos + 1)}${getFunctionDefault(maybeFunc)}`,
                focusOverride: {
                  itemKey: getNextFocusOverride({
                    kind: TokenKind.FUNCTION,
                    func: maybeFunc,
                  }),
                },
              });
              resetInputValue();
              return;
            }
          }
        }
      }

      setInputValue(evt.target.value);
      setSelectionIndex(evt.target.selectionStart ?? 0);
    },
    [
      aggregations,
      dispatch,
      getNextFocusOverride,
      getFunctionDefault,
      resetInputValue,
      token,
    ]
  );

  const onInputCommit = useCallback(() => {
    dispatch({
      type: 'REPLACE_TOKEN',
      token,
      text: inputValue.trim(),
    });
    resetInputValue();
  }, [dispatch, inputValue, token, resetInputValue]);

  const onInputEscape = useCallback(() => {
    dispatch({
      type: 'REPLACE_TOKEN',
      token,
      text: inputValue,
    });
    resetInputValue();
  }, [dispatch, token, inputValue, resetInputValue]);

  const onInputFocus = useCallback((_evt: FocusEvent<HTMLInputElement>) => {
    // TODO
  }, []);

  const onKeyDownCapture = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      // At start and pressing left arrow, focus the previous full token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'ArrowLeft'
      ) {
        focusTarget(state, state.collection.getKeyBefore(item.key));
        return;
      }

      // At end and pressing right arrow, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'ArrowRight'
      ) {
        focusTarget(state, state.collection.getKeyAfter(item.key));
        return;
      }
    },
    [state, item]
  );

  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      // TODO: handle meta keys

      // At start and pressing backspace, focus the previous full token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'Backspace'
      ) {
        focusTarget(state, state.collection.getKeyBefore(item.key));
        return;
      }

      // At end and pressing delete, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'Delete'
      ) {
        focusTarget(state, state.collection.getKeyAfter(item.key));
        return;
      }
    },
    [state, item]
  );

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      const isFunction =
        typeof option.key === 'string' && option.key.startsWith(`${TokenKind.FUNCTION}:`);

      dispatch({
        type: 'REPLACE_TOKEN',
        token,
        text: isFunction ? getFunctionDefault(option.value) : option.value,
        focusOverride: {
          itemKey: getNextFocusOverride(
            isFunction ? {kind: TokenKind.FUNCTION, func: option.value} : undefined
          ),
        },
      });
      resetInputValue();
    },
    [dispatch, getNextFocusOverride, getFunctionDefault, token, resetInputValue]
  );

  const onPaste = useCallback((_evt: React.ClipboardEvent<HTMLInputElement>) => {
    // TODO
  }, []);

  return (
    <Fragment>
      <ComboBox
        ref={inputRef}
        items={items}
        placeholder={showPlaceholder ? t('Enter equation') : ''}
        inputLabel={t('Add a term')}
        inputValue={inputValue}
        filterValue={filterValue}
        tabIndex={item.key === state.selectionManager.focusedKey ? 0 : -1}
        shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
        onClick={onClick}
        onInputBlur={onInputBlur}
        onInputChange={onInputChange}
        onInputCommit={onInputCommit}
        onInputEscape={onInputEscape}
        onInputFocus={onInputFocus}
        onKeyDown={onKeyDown}
        onKeyDownCapture={onKeyDownCapture}
        onOpenChange={setIsOpen}
        onOptionSelected={onOptionSelected}
        onPaste={onPaste}
        data-test-id={
          state.collection.getLastKey() === item.key
            ? 'arithmetic-builder-input'
            : undefined
        }
      >
        {keyItem =>
          itemIsSection(keyItem) ? (
            <Section title={keyItem.label} key={keyItem.key}>
              {keyItem.options.map(child => (
                <Item {...child} key={child.key}>
                  {child.label}
                </Item>
              ))}
            </Section>
          ) : (
            <Item {...keyItem} key={keyItem.key}>
              {keyItem.label}
            </Item>
          )
        }
      </ComboBox>
    </Fragment>
  );
}

function useSuggestionItems({
  allowedFunctions,
  filterValue,
  nextAllowedTokenKinds,
}: {
  allowedFunctions: string[];
  filterValue: string;
  nextAllowedTokenKinds: TokenKind[];
}): Array<SelectSectionWithKey<string>> {
  const parenthesisItems = useParenthesisItems({
    nextAllowedTokenKinds,
  });
  const operatorItems = useOperatorItems({
    nextAllowedTokenKinds,
  });
  const functionItems = useFunctionItems({
    allowedFunctions,
    filterValue,
    nextAllowedTokenKinds,
  });

  return useMemo(() => {
    return [...parenthesisItems, ...operatorItems, ...functionItems];
  }, [parenthesisItems, operatorItems, functionItems]);
}

function useParenthesisItems({
  nextAllowedTokenKinds,
}: {
  nextAllowedTokenKinds: TokenKind[];
}): Array<SelectSectionWithKey<string>> {
  return useMemo(() => {
    const options = [];

    if (nextAllowedTokenKinds.includes(TokenKind.OPEN_PARENTHESIS)) {
      options.push({
        key: `${TokenKind.OPEN_PARENTHESIS}:open`,
        label: <IconParenthesis side="left" height={26} />,
        value: '(',
        textValue: '(',
        hideCheck: true,
      });
    }

    if (nextAllowedTokenKinds.includes(TokenKind.CLOSE_PARENTHESIS)) {
      options.push({
        key: `${TokenKind.CLOSE_PARENTHESIS}:close`,
        label: <IconParenthesis side="right" height={26} />,
        value: ')',
        textValue: ')',
        hideCheck: true,
      });
    }

    if (!options.length) {
      return [];
    }

    return [
      {
        key: 'parenthesis',
        label: t('parenthesis'),
        options,
      },
    ];
  }, [nextAllowedTokenKinds]);
}

function useOperatorItems({
  nextAllowedTokenKinds,
}: {
  nextAllowedTokenKinds: TokenKind[];
}): Array<SelectSectionWithKey<string>> {
  return useMemo(() => {
    if (!nextAllowedTokenKinds.includes(TokenKind.OPERATOR)) {
      return [];
    }

    const options = [
      {
        key: `${TokenKind.OPERATOR}:plus`,
        label: <IconAdd height={26} />,
        value: '+',
        textValue: '+',
        hideCheck: true,
      },
      {
        key: `${TokenKind.OPERATOR}:subtract`,
        label: <IconSubtract height={26} />,
        value: '-',
        textValue: '-',
        hideCheck: true,
      },
      {
        key: `${TokenKind.OPERATOR}:multiply`,
        label: <IconClose height={26} data-test-id="icon-multiply" />,
        value: '*',
        textValue: '*',
        hideCheck: true,
      },
      {
        key: `${TokenKind.OPERATOR}:divide`,
        label: <IconDivide height={26} />,
        value: '/',
        textValue: '/',
        hideCheck: true,
      },
    ];

    if (!options.length) {
      return [];
    }

    return [
      {
        key: 'operator',
        label: t('operator'),
        options,
      },
    ];
  }, [nextAllowedTokenKinds]);
}

function useFunctionItems({
  allowedFunctions,
  filterValue,
  nextAllowedTokenKinds,
}: {
  allowedFunctions: string[];
  filterValue: string;
  nextAllowedTokenKinds: TokenKind[];
}): Array<SelectSectionWithKey<string>> {
  return useMemo(() => {
    if (!nextAllowedTokenKinds.includes(TokenKind.FUNCTION)) {
      return [];
    }

    const items = filterValue
      ? allowedFunctions.filter(agg => agg.includes(filterValue))
      : allowedFunctions;

    return [
      {
        key: 'functions',
        label: t('functions'),
        options: items.map(item => ({
          key: `${TokenKind.FUNCTION}:${item}`,
          label: item,
          value: item,
          textValue: item,
          hideCheck: true,
        })),
      },
    ];
  }, [allowedFunctions, filterValue, nextAllowedTokenKinds]);
}

function stopPropagation(evt: MouseEvent<HTMLElement>) {
  evt.stopPropagation();
}

const Row = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 24px;
  max-width: 100%;

  &:last-child {
    flex-grow: 1;
  }

  &[aria-invalid='true'] {
    input {
      color: ${p => p.theme.red400};
    }
  }

  &[aria-selected='true'] {
    [data-hidden-text='true']::before {
      content: '';
      position: absolute;
      left: ${space(0.5)};
      right: ${space(0.5)};
      top: 0;
      bottom: 0;
      background-color: ${p => p.theme.gray100};
    }
  }
`;

const GridCell = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;

  input {
    padding: 0 ${space(0.5)};
    min-width: 9px;
    width: 100%;
  }
`;
