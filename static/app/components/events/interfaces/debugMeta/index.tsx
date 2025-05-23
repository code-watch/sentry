import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import type {ListRowProps} from 'react-virtualized';
import {AutoSizer, CellMeasurer, CellMeasurerCache, List} from 'react-virtualized';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal, openReprocessEventModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import type {SelectOption, SelectSection} from 'sentry/components/core/compactSelect';
import {
  DebugImageDetails,
  modalCss,
} from 'sentry/components/events/interfaces/debugMeta/debugImageDetails';
import SearchBarAction from 'sentry/components/events/interfaces/searchBarAction';
import {getImageRange, parseAddress} from 'sentry/components/events/interfaces/utils';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import DebugMetaStore from 'sentry/stores/debugMetaStore';
import {space} from 'sentry/styles/space';
import type {Image, ImageWithCombinedStatus} from 'sentry/types/debugImage';
import {ImageStatus} from 'sentry/types/debugImage';
import type {EntryDebugMeta, Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import SectionToggleButton from 'sentry/views/issueDetails/sectionToggleButton';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import Status from './debugImage/status';
import DebugImage from './debugImage';
import layout from './layout';
import {
  combineStatus,
  getFileName,
  IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT,
  normalizeId,
} from './utils';

function shouldSkipSection(
  filteredImages: Image[],
  images: EntryDebugMeta['data']['images']
) {
  if (filteredImages.length) {
    return false;
  }

  const definedImages = images?.filter(image => defined(image));

  if (!definedImages?.length) {
    return true;
  }

  if (definedImages.every(image => image.type === 'proguard')) {
    return true;
  }

  return false;
}

interface DebugMetaProps {
  data: EntryDebugMeta['data'];
  event: Event;
  projectSlug: Project['slug'];
  groupId?: Group['id'];
}

interface FilterState {
  allImages: ImageWithCombinedStatus[];
  filterOptions: Array<SelectSection<string>>;
  filterSelections: Array<SelectOption<string>>;
}

const cache = new CellMeasurerCache({
  fixedWidth: true,
  defaultHeight: 81,
});

function applyImageFilters(
  images: ImageWithCombinedStatus[],
  filterSelections: Array<SelectOption<string>>,
  searchTerm: string
) {
  const selections = new Set(filterSelections.map(option => option.value));

  let filteredImages = images;

  if (selections.size > 0) {
    filteredImages = filteredImages.filter(image => selections.has(image.status));
  }

  if (searchTerm !== '') {
    filteredImages = filteredImages.filter(image => {
      const term = searchTerm.toLowerCase();
      // When searching for an address, check for the address range of the image
      // instead of an exact match.  Note that images cannot be found by index
      // if they are at 0x0.  For those relative addressing has to be used.
      if (term.indexOf('0x') === 0) {
        const needle = parseAddress(term);
        if (needle > 0 && image.image_addr !== '0x0') {
          const [startAddress, endAddress] = getImageRange(image);
          return needle >= startAddress! && needle < endAddress!;
        }
      }

      // the searchTerm ending at "!" is the end of the ID search.
      const relMatch = term.match(/^\s*(.*?)!/); // debug_id!address
      const idSearchTerm = normalizeId(relMatch?.[1] || term);

      return (
        // Prefix match for identifiers
        normalizeId(image.code_id).indexOf(idSearchTerm) === 0 ||
        normalizeId(image.debug_id).indexOf(idSearchTerm) === 0 ||
        // Any match for file paths
        (image.code_file?.toLowerCase() || '').includes(term) ||
        (image.debug_file?.toLowerCase() || '').includes(term)
      );
    });
  }

  return filteredImages;
}

export function DebugMeta({data, projectSlug, groupId, event}: DebugMetaProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const listRef = useRef<List>(null);
  const panelTableRef = useRef<HTMLDivElement>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    filterOptions: [],
    filterSelections: [],
    allImages: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const hasStreamlinedUI = useHasStreamlinedUI();

  const getRelevantImages = useCallback(() => {
    // There are a bunch of images in debug_meta that are not relevant to this
    // component. Filter those out to reduce the noise. Most importantly, this
    // includes proguard images, which are rendered separately.

    const relevantImages = data.images?.filter((image): image is Image => {
      // in particular proguard images do not have a code file, skip them
      if (image === null || image.code_file === null || image.type === 'proguard') {
        return false;
      }

      if (getFileName(image.code_file) === 'dyld_sim') {
        // this is only for simulator builds
        return false;
      }

      return true;
    });

    if (!relevantImages?.length) {
      return;
    }

    const formattedRelevantImages = relevantImages.map<ImageWithCombinedStatus>(
      releventImage => {
        return {
          ...releventImage,
          // 'debug_status' and 'unwind_status' are only used by native platforms
          status: combineStatus(releventImage.debug_status, releventImage.unwind_status),
        };
      }
    );

    // Sort images by their start address. We assume that images have
    // non-overlapping ranges. Each address is given as hex string (e.g.
    // "0xbeef").
    formattedRelevantImages.sort(
      (a, b) => parseAddress(a.image_addr) - parseAddress(b.image_addr)
    );

    const unusedImages: ImageWithCombinedStatus[] = [];

    const usedImages = formattedRelevantImages.filter(image => {
      if (image.debug_status === ImageStatus.UNUSED) {
        unusedImages.push(image);
        return false;
      }
      return true;
    });

    const allImages: ImageWithCombinedStatus[] = [...usedImages, ...unusedImages];

    const filterOptions = [
      {
        label: t('Status'),
        options: [...new Set(allImages.map(image => image.status))].map(status => ({
          value: status,
          textValue: status,
          label: <Status status={status} />,
        })),
      },
    ];

    const defaultFilterSelections = (
      'options' in filterOptions[0]! ? filterOptions[0].options : []
    ).filter(opt => opt.value !== ImageStatus.UNUSED);

    setFilterState({
      allImages,
      filterOptions,
      filterSelections: defaultFilterSelections,
    });
  }, [data]);

  const handleReprocessEvent = useCallback(
    (id: Group['id']) => {
      openReprocessEventModal({
        organization,
        groupId: id,
      });
    },
    [organization]
  );

  const getScrollbarWidth = useCallback(() => {
    const panelTableWidth = panelTableRef?.current?.clientWidth ?? 0;

    const gridInnerWidth =
      panelTableRef?.current?.querySelector(
        '.ReactVirtualized__Grid__innerScrollContainer'
      )?.clientWidth ?? 0;

    setScrollbarWidth(panelTableWidth - gridInnerWidth);
  }, [panelTableRef]);

  const updateGrid = useCallback(() => {
    if (listRef.current) {
      cache.clearAll();
      listRef.current.forceUpdateGrid();
      getScrollbarWidth();
    }
  }, [listRef, getScrollbarWidth]);

  const getEmptyMessage = useCallback(
    (images: ImageWithCombinedStatus[]) => {
      const {filterSelections} = filterState;

      if (images.length) {
        return {};
      }

      if (searchTerm && !images.length) {
        const hasActiveFilter = filterSelections.length > 0;

        return {
          emptyMessage: t('No images match your search query'),
          emptyAction: hasActiveFilter ? (
            <Button
              onClick={() => setFilterState(fs => ({...fs, filterSelections: []}))}
              priority="primary"
            >
              {t('Reset filter')}
            </Button>
          ) : (
            <Button onClick={() => setSearchTerm('')} priority="primary">
              {t('Clear search bar')}
            </Button>
          ),
        };
      }

      return {
        emptyMessage: t('There are no images to be displayed'),
      };
    },
    [filterState, searchTerm]
  );

  const handleOpenImageDetailsModal = useCallback(
    (image: ImageWithCombinedStatus) => {
      openModal(
        deps => (
          <DebugImageDetails
            {...deps}
            image={image}
            organization={organization}
            projSlug={projectSlug}
            event={event}
            onReprocessEvent={
              defined(groupId) ? () => handleReprocessEvent(groupId) : undefined
            }
          />
        ),
        {modalCss: modalCss(theme)}
      );
    },
    [event, groupId, handleReprocessEvent, organization, projectSlug, theme]
  );

  // This hook replaces the componentDidMount/WillUnmount calls from its class component
  useEffect(() => {
    const removeListener = DebugMetaStore.listen((store: {filter: string}) => {
      setSearchTerm(store.filter);
      setIsOpen(true);
    }, undefined);
    cache.clearAll();
    getRelevantImages();
    return () => {
      removeListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    //  componentDidUpdate
    getRelevantImages();
    updateGrid();
  }, [event, getRelevantImages, updateGrid]);

  useEffect(() => {
    updateGrid();
  }, [filterState, updateGrid]);

  function renderRow({
    index,
    key,
    parent,
    style,
    images,
  }: ListRowProps & {images: ImageWithCombinedStatus[]}) {
    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <DebugImage
          style={style}
          image={images[index]!}
          onOpenImageDetailsModal={handleOpenImageDetailsModal}
        />
      </CellMeasurer>
    );
  }

  function renderList(images: ImageWithCombinedStatus[]) {
    return (
      <AutoSizer disableHeight onResize={updateGrid}>
        {({width}) => (
          <StyledList
            ref={listRef}
            deferredMeasurementCache={cache}
            height={IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT}
            overscanRowCount={5}
            rowCount={images.length}
            rowHeight={cache.rowHeight}
            rowRenderer={(listRowProps: any) => renderRow({...listRowProps, images})}
            width={width}
            isScrolling={false}
          />
        )}
      </AutoSizer>
    );
  }

  const {allImages, filterOptions, filterSelections} = filterState;

  const filteredImages = applyImageFilters(allImages, filterSelections, searchTerm);

  if (shouldSkipSection(filteredImages, data.images)) {
    return null;
  }

  const showFilters = filterOptions.some(
    section => 'options' in section && section.options.length > 1
  );

  const actions = hasStreamlinedUI ? null : (
    <SectionToggleButton
      isExpanded={isOpen}
      onExpandChange={() => {
        setIsOpen(open => !open);
      }}
    />
  );

  return (
    <InterimSection
      type={SectionKey.DEBUGMETA}
      title={t('Images Loaded')}
      help={t(
        'A list of dynamic libraries, shared objects or source maps loaded into process memory at the time of the crash. Images contribute to the application code that is referenced in stack traces.'
      )}
      actions={actions}
      initialCollapse
    >
      {isOpen || hasStreamlinedUI ? (
        <Fragment>
          <StyledSearchBarAction
            placeholder={t('Search images')}
            onChange={value => DebugMetaStore.updateFilter(value)}
            query={searchTerm}
            filterOptions={showFilters ? filterOptions : undefined}
            onFilterChange={selections => {
              setFilterState(fs => ({
                ...fs,
                filterSelections: selections,
              }));
            }}
            filterSelections={filterSelections}
          />
          <StyledPanelTable
            isEmpty={!filteredImages.length}
            scrollbarWidth={scrollbarWidth}
            headers={[t('Status'), t('Image'), t('Processing'), t('Details'), '']}
            {...getEmptyMessage(filteredImages)}
          >
            <div ref={panelTableRef}>{renderList(filteredImages)}</div>
          </StyledPanelTable>
        </Fragment>
      ) : null}
    </InterimSection>
  );
}

const StyledPanelTable = styled(PanelTable)<{scrollbarWidth?: number}>`
  overflow: hidden;
  > * {
    :nth-child(-n + 5) {
      ${p => p.theme.overflowEllipsis};
      border-bottom: 1px solid ${p => p.theme.border};
      :nth-child(5n) {
        height: 100%;
        ${p => !p.scrollbarWidth && `display: none`}
      }
    }

    :nth-child(n + 6) {
      grid-column: 1/-1;
      ${p =>
        !p.isEmpty &&
        css`
          display: grid;
          padding: 0;
        `}
    }
  }

  ${p => layout(p.theme, p.scrollbarWidth)}
`;

// XXX(ts): Emotion11 has some trouble with List's defaultProps
const StyledList = styled(List as any)<React.ComponentProps<typeof List>>`
  height: auto !important;
  max-height: ${p => p.height}px;
  overflow-y: auto !important;
  outline: none;
`;

const StyledSearchBarAction = styled(SearchBarAction)`
  z-index: 1;
  margin-bottom: ${space(1)};
`;
