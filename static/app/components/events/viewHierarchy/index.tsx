import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Node} from 'sentry/components/events/viewHierarchy/node';
import {Wireframe} from 'sentry/components/events/viewHierarchy/wireframe';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {UseVirtualizedTreeProps} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {useVirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import type {VirtualizedTreeRenderedRow} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {DetailsPanel} from './detailsPanel';
import {RenderingSystem} from './renderingSystem';

function getNodeLabel({
  node,
  nodeField,
}: {
  node: ViewHierarchyWindow;
  nodeField: ViewHierarchyNodeField;
}) {
  const label = node[nodeField] ?? 'type';
  const {identifier} = node;
  return identifier ? `${label} - ${identifier}` : label;
}

function onScrollToNode(
  node: VirtualizedTreeRenderedRow<ViewHierarchyWindow>,
  scrollContainer: HTMLElement | HTMLElement[] | null,
  coordinates: {depth: number; top: number} | undefined
) {
  if (node) {
    // When a user keyboard navigates to a node that's rendered in the "overscroll"
    const lastCell = node.ref?.lastChild as HTMLElement | null | undefined;
    if (lastCell) {
      lastCell.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    }
  } else if (coordinates) {
    // When a user clicks on a wireframe node that's not rendered in the "overscroll"
    // we need to scroll to where the node would be rendered
    const left = coordinates.depth * 16;
    if (Array.isArray(scrollContainer)) {
      scrollContainer.forEach(container => {
        container.scrollBy({
          left,
        });
      });
    } else if (scrollContainer) {
      scrollContainer.scrollBy({
        left,
      });
    }
  }
}

// there can be many other properties, but we only care about a few
export type ViewHierarchyWindow = {
  alpha?: number;
  children?: ViewHierarchyWindow[];
  depth?: number;
  height?: number;
  identifier?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  width?: number;
  x?: number;
  y?: number;
};

export type ViewHierarchyData = {
  rendering_system: string;
  windows: ViewHierarchyWindow[];
};

export type ViewHierarchyNodeField = 'type' | 'name';

type ViewHierarchyProps = {
  emptyMessage: string;
  nodeField: ViewHierarchyNodeField;
  showWireframe: boolean;
  viewHierarchy: ViewHierarchyData;
  platform?: string;
};

function ViewHierarchy({
  viewHierarchy,
  emptyMessage,
  showWireframe,
  platform,
  nodeField,
}: ViewHierarchyProps) {
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const [scrollContainerRef, setScrollContainerRef] = useState<HTMLDivElement | null>(
    null
  );
  const [selectedNode, setSelectedNode] = useState<ViewHierarchyWindow | undefined>(
    viewHierarchy.windows[0]
  );
  const [userHasSelected, setUserHasSelected] = useState(false);
  const hierarchy = useMemo(() => {
    return viewHierarchy.windows;
  }, [viewHierarchy.windows]);

  const renderRow: UseVirtualizedTreeProps<ViewHierarchyWindow>['renderRow'] = (
    r,
    {
      handleExpandTreeNode,
      handleRowMouseEnter,
      handleRowClick,
      handleRowKeyDown,
      selectedNodeIndex,
    }
  ) => {
    const key = `view-hierarchy-node-${r.key}`;

    if (selectedNodeIndex === r.key && selectedNode !== r.item.node) {
      // Workaround because rows don't take up the whole width of the scroll container
      // so the onClick handler won't fire
      setSelectedNode(r.item.node);
      r.ref?.focus({preventScroll: true});
      setUserHasSelected(true);
    }

    return (
      <TreeItem
        key={key}
        ref={n => {
          r.ref = n;
        }}
        style={r.styles}
        tabIndex={selectedNodeIndex === r.key ? 0 : 1}
        onMouseEnter={handleRowMouseEnter}
        onKeyDown={handleRowKeyDown}
        onClick={e => {
          handleRowClick(e);
          trackAnalytics('issue_details.view_hierarchy.select_from_tree', {
            organization,
            platform,
            user_org_role: organization.orgRole,
          });
        }}
      >
        {r.item.depth !== 0 && <DepthMarker depth={r.item.depth} />}
        <Node
          id={key}
          label={getNodeLabel({node: r.item.node, nodeField})}
          onExpandClick={() =>
            handleExpandTreeNode(r.item, !r.item.expanded, {expandChildren: false})
          }
          collapsible={!!r.item.node.children?.length}
          isExpanded={r.item.expanded}
          isFocused={selectedNodeIndex === r.key}
        />
      </TreeItem>
    );
  };

  const {
    renderedItems,
    containerStyles,
    scrollContainerStyles,
    hoveredGhostRowRef,
    clickedGhostRowRef,
    handleScrollTo,
  } = useVirtualizedTree({
    renderRow,
    rowHeight: 20,
    scrollContainer: scrollContainerRef,
    tree: hierarchy,
    expanded: true,
    overscroll: 10,
    initialSelectedNodeIndex: 0,
    onScrollToNode,
  });

  // Scroll to the selected node when it changes
  const onWireframeNodeSelect = useCallback(
    (node?: ViewHierarchyWindow) => {
      setUserHasSelected(true);
      setSelectedNode(node);
      handleScrollTo(item => item === node);
      trackAnalytics('issue_details.view_hierarchy.select_from_wireframe', {
        organization,
        platform,
        user_org_role: organization.orgRole,
      });
    },
    [handleScrollTo, organization, platform]
  );

  if (!hierarchy.length) {
    return (
      <EmptyStateContainer>
        <EmptyStateWarning small>{emptyMessage}</EmptyStateWarning>
      </EmptyStateContainer>
    );
  }

  const viewHierarchyContent = (
    <Fragment>
      <RenderingSystem platform={platform} system={viewHierarchy.rendering_system} />
      <Content>
        <Left hasRight={showWireframe}>
          <TreeContainer>
            <div ref={hoveredGhostRowRef} />
            <div ref={clickedGhostRowRef} />
            <ScrollContainer ref={setScrollContainerRef} style={scrollContainerStyles}>
              <RenderedItemsContainer style={containerStyles}>
                {renderedItems}
              </RenderedItemsContainer>
            </ScrollContainer>
          </TreeContainer>
          {defined(selectedNode) && (
            <DetailsContainer>
              <DetailsPanel
                data={selectedNode}
                getTitle={node => getNodeLabel({node, nodeField})}
              />
            </DetailsContainer>
          )}
        </Left>
        {showWireframe && (
          <Right>
            <Wireframe
              hierarchy={hierarchy}
              selectedNode={userHasSelected ? selectedNode : undefined}
              onNodeSelect={onWireframeNodeSelect}
              platform={platform}
            />
          </Right>
        )}
      </Content>
    </Fragment>
  );

  return hasStreamlinedUI ? (
    <Container>{viewHierarchyContent}</Container>
  ) : (
    viewHierarchyContent
  );
}

export {ViewHierarchy};

const Container = styled('div')`
  position: relative;
  margin-left: ${space(2)};
`;

const Content = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  height: 700px;
`;

const Left = styled('div')<{hasRight?: boolean}>`
  width: ${p => (p.hasRight ? '40%' : '100%')};
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;

const Right = styled('div')`
  width: 60%;
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const TreeContainer = styled('div')`
  position: relative;
  height: 70%;
  overflow: hidden;
  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  border-top-left-radius: 0;
`;

const DetailsContainer = styled('div')`
  max-height: 30%;
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  overflow: auto;
`;

const ScrollContainer = styled('div')`
  padding: 0 ${space(1.5)} ${space(1.5)} ${space(1.5)};
`;

const RenderedItemsContainer = styled('div')`
  position: relative;
`;

const TreeItem = styled('div')`
  display: flex;
  height: 20px;
  width: 100%;

  :focus {
    outline: none;
  }
`;

// Draw a 1px wide gray marker every 15px
const DepthMarker = styled('div')<{depth: number}>`
  padding-left: calc(${space(2)} * ${p => p.depth});

  background-image: repeating-linear-gradient(
    90deg,
    ${p => p.theme.gray200} 5px,
    ${p => p.theme.gray200} 6px,
    transparent 6px,
    transparent 21px
  );
`;

const EmptyStateContainer = styled('div')`
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;
