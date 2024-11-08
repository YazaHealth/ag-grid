import type { DetailGridInfo } from '../api/gridApi';
import type { BeanCollection } from '../context/context';
import type { SelectionEventSourceType } from '../events';
import { _getRowIdCallback } from '../gridOptionsUtils';
import type { IServerSideStore } from '../interfaces/IServerSideStore';
import type { IEventEmitter } from '../interfaces/iEventEmitter';
import type { IFrameworkEventListenerService } from '../interfaces/iFrameworkEventListenerService';
import type {
    AgRowNodeEventListener,
    CellChangedEvent,
    DataChangedEvent,
    IRowNode,
    RowNodeEvent,
    RowNodeEventType,
    RowPinnedType,
} from '../interfaces/iRowNode';
import { LocalEventService } from '../localEventService';
import { _error, _warn } from '../validation/logging';
import type { AgColumn } from './agColumn';

/**
 * This is used only when using tree data.
 * Implementation in enterprise-modules/row-grouping/src/rowGrouping/groupStage/treeStrategy/treeNode.ts
 */
export interface ITreeNode {
    /** The key of this node */
    readonly key: string;

    /** Updated during commit to be the same as row.sourceRowIndex */
    readonly sourceIdx: number;

    invalidate(): void;
    invalidateOrder(): void;
}

export const ROW_ID_PREFIX_ROW_GROUP = 'row-group-';
export const ROW_ID_PREFIX_TOP_PINNED = 't-';
export const ROW_ID_PREFIX_BOTTOM_PINNED = 'b-';

let OBJECT_ID_SEQUENCE = 0;

export type RowHighlightPosition = 'Above' | 'Below';

export class RowNode<TData = any> implements IEventEmitter<RowNodeEventType>, IRowNode<TData> {
    /** Unique ID for the node. Either provided by the application, or generated by the grid if not. */
    public id: string | undefined;

    /** If using row grouping, contains the group values for this group. */
    public groupData: { [key: string]: any | null } | null;

    /** If using row grouping and aggregation, contains the aggregation data. */
    public aggData: any;

    /**
     * The data as provided by the application.
     * Can be `undefined` when using row grouping or during grid initialisation.
     */
    public data: TData | undefined;

    /** The parent node to this node, or empty if top level */
    public parent: RowNode<TData> | null;

    /** How many levels this node is from the top when grouping. */
    public level: number;

    /** How many levels this node is from the top when grouping in the UI (only different to `parent` when `groupHideParentOfSingleChild=true`)*/
    public uiLevel: number;

    /**
     * If doing in-memory (client-side) grouping, this is the index of the group column this cell is for.
     * This will always be the same as the level, unless we are collapsing groups, i.e. `groupHideParentOfSingleChild=true`.
     */
    public rowGroupIndex: number | null;

    /** `true` if this node is a group node (i.e. it has children) */
    public group: boolean | undefined;

    /** `true` if this row is getting dragged */
    public dragging: boolean;

    /** `true` if this row is a master row, part of master / detail (ie row can be expanded to show detail) */
    public master: boolean = false;

    /** `true` if this row is a detail row, part of master / detail (ie child row of an expanded master row)*/
    public detail: boolean | undefined = undefined;

    /** If this row is a master row that was expanded, this points to the associated detail row. */
    public detailNode: RowNode;

    /** If master detail, this contains details about the detail grid */
    public detailGridInfo: DetailGridInfo | null;

    /** `true` if this node is a group and the group is the bottom level in the tree. */
    public leafGroup: boolean | undefined;

    public firstChild: boolean;
    public lastChild: boolean;
    public childIndex: number;

    /** The current row index. If the row is filtered out or in a collapsed group, this value will be `null`. */
    public rowIndex: number | null = null;

    /**
     * Either 'top' or 'bottom' if row pinned, otherwise `undefined` or `null`.
     * If re-naming this property, you must also update `IGNORED_SIBLING_PROPERTIES`
     */
    public rowPinned: RowPinnedType;

    /** When true, this row will appear in the top */
    public sticky: boolean;

    /** If row is pinned, then pinnedRowTop is used rather than rowTop */
    public stickyRowTop: number;

    /** If using quick filter, stores a string representation of the row for searching against. */
    public quickFilterAggregateText: string | null;

    /** `true` if row is a footer. Footers have `group = true` and `footer = true`. */
    public footer: boolean | undefined;

    /** The field we are grouping on eg 'country'. */
    public field: string | null;

    /** The row group column used for this group, e.g. the Country column instance. */
    public rowGroupColumn: AgColumn | null;

    /** The key for the group eg Ireland, UK, USA */
    public key: string | null = null;

    /** Used by server-side row model. `true` if this row node is a stub. A stub is a placeholder row with loading icon while waiting from row to be loaded. */
    public stub: boolean | undefined;

    /** Used by server side row model, true if this row node failed a load */
    public failedLoad: boolean | undefined;

    /** Used by server side row model, true if this node needs refreshed by the server when in viewport */
    public __needsRefreshWhenVisible: boolean;

    /**
     * The index of the row in the source rowData array including any updates via transactions.
     * It does not change when sorting, filtering, grouping, pivoting or any other UI related operations.
     * If this is a filler node (a visual row created by AG Grid in tree data or grouping) the value will be `-1`.
     *
     * Generally readonly. It is modified only by:
     * - ClientSideNodeManager, cast to ClientSideNodeManagerRowNode
     * - ClientSideRowModel, cast to ClientSideRowModelRowNode
     */
    public readonly sourceRowIndex: number = -1;

    /**
     * All lowest level nodes beneath this node, no groups.
     * In the root node, this array contains all rows, and is computed by the ClientSideRowModel.
     * Do not modify this array directly. The grouping module relies on mutable references to the array.
     * The array might also br frozen (immutable).
     *
     * Generally readonly. It is modified only by:
     * - ClientSideNodeManager, cast to ClientSideNodeManagerRootNode
     * - GroupStrategy, cast to GroupRow
     * - TreeStrategy, cast to TreeRow
     */
    public readonly allLeafChildren: RowNode<TData>[] | null;

    /**
     * Children of this group. If multi levels of grouping, shows only immediate children.
     * Do not modify this array directly. The grouping module relies on mutable references to the array.
     *
     * Generally readonly. It is modified only by:
     * - ClientSideNodeManager, cast to ClientSideNodeManagerRootNode
     * - GroupStrategy, cast to GroupRow
     * - TreeStrategy, cast to TreeRow
     */
    public readonly childrenAfterGroup: RowNode<TData>[] | null;

    /** Filtered children of this group. */
    public childrenAfterFilter: RowNode<TData>[] | null;

    /** Aggregated and re-filtered children of this group. */
    public childrenAfterAggFilter: RowNode<TData>[] | null;

    /** Sorted children of this group. */
    public childrenAfterSort: RowNode<TData>[] | null;

    /** Number of children and grand children. */
    public allChildrenCount: number | null;

    /**
     * Children mapped by the pivot columns.
     *
     * TODO: this field is currently used only by the GroupStrategy and Pivot.
     * TreeStrategy does not use it, and pivot cannot be enabled with tree data.
     * Creating a new object for every row when not pivoting and not grouping
     * consumes memory unnecessarily. Setting it to null however currently breaks
     * transactional updates in groups so this requires a deeper investigation on GroupStrategy.
     */
    public childrenMapped: { [key: string]: any } | null = {};

    /** The TreeNode associated to this row. Used only with tree data. */
    public readonly treeNode: ITreeNode | null = null;

    /** The flags associated to this node. Used only with tree data. */
    public readonly treeNodeFlags: number = 0;

    /** Server Side Row Model Only - the children are in an infinite cache. */
    public childStore: IServerSideStore | null;

    /** `true` if group is expanded, otherwise `false`. */
    public expanded: boolean;

    /** If using footers, reference to the footer node for this group. */
    public sibling: RowNode;

    /** The height, in pixels, of this row */
    public rowHeight: number | null | undefined;

    /** Dynamic row heights are done on demand, only when row is visible. However for row virtualisation
     * we need a row height to do the 'what rows are in viewport' maths. So we assign a row height to each
     * row based on defaults and rowHeightEstimated=true, then when the row is needed for drawing we do
     * the row height calculation and set rowHeightEstimated=false.*/
    public rowHeightEstimated: boolean;

    /**
     * This will be `true` if it has a rowIndex assigned, otherwise `false`.
     */
    public displayed: boolean = false;

    /** The row top position in pixels. */
    public rowTop: number | null = null;

    /** The top pixel for this row last time, makes sense if data set was ordered or filtered,
     * it is used so new rows can animate in from their old position. */
    public oldRowTop: number | null = null;

    /** `true` by default - can be overridden via gridOptions.isRowSelectable(rowNode) */
    public selectable = true;

    /** `true` if this node is a daemon. This means row is not part of the model. Can happen when then
     * the row is selected and then the user sets a different ID onto the node. The nodes is then
     * representing a different entity, so the selection controller, if the node is selected, takes
     * a copy where daemon=true. */
    public __daemon: boolean;

    /** Used by the value service, stores values for a particular change detection turn. */
    public __cacheData: { [colId: string]: any };
    public __cacheVersion: number;

    /**
     * Used by sorting service - to give deterministic sort to groups. Previously we
     * just id for this, however id is a string and had slower sorting compared to numbers.
     * If re-naming this property, you must also update `IGNORED_SIBLING_PROPERTIES`
     */
    public __objectId: number = OBJECT_ID_SEQUENCE++;

    /** We cache the result of hasChildren() so that we can be aware of when it has changed, and hence
     * fire the event. Really we should just have hasChildren as an attribute and do away with hasChildren()
     * method, however that would be a breaking change. */
    private __hasChildren: boolean;

    /**
     * When one or more Columns are using autoHeight, this keeps track of height of each autoHeight Cell,
     * indexed by the Column ID.
     * If re-naming this property, you must also update `IGNORED_SIBLING_PROPERTIES`
     */
    public __autoHeights?: { [id: string]: number | undefined };

    /** `true` when nodes with the same id are being removed and added as part of the same batch transaction */
    public alreadyRendered = false;

    public highlighted: RowHighlightPosition | null = null;

    private hovered: boolean = false;

    public __selected: boolean | undefined = false;
    /** If re-naming this property, you must also update `IGNORED_SIBLING_PROPERTIES` */
    public __localEventService: LocalEventService<RowNodeEventType> | null;
    private frameworkEventListenerService?: IFrameworkEventListenerService<any, any>;

    private beans: BeanCollection;

    /** If re-naming this property, you must also update `IGNORED_SIBLING_PROPERTIES` */
    public __checkAutoHeightsDebounced: () => void;

    constructor(beans: BeanCollection) {
        this.beans = beans;
    }

    /**
     * Replaces the data on the `rowNode`. When this method is called, the grid will refresh the entire rendered row if it is displayed.
     */
    public setData(data: TData): void {
        this.setDataCommon(data, false);
    }

    // similar to setRowData, however it is expected that the data is the same data item. this
    // is intended to be used with Redux type stores, where the whole data can be changed. we are
    // guaranteed that the data is the same entity (so grid doesn't need to worry about the id of the
    // underlying data changing, hence doesn't need to worry about selection). the grid, upon receiving
    // dataChanged event, will refresh the cells rather than rip them all out (so user can show transitions).

    /**
     * Updates the data on the `rowNode`. When this method is called, the grid will refresh the entire rendered row if it is displayed.
     */
    public updateData(data: TData): void {
        this.setDataCommon(data, true);
    }

    private setDataCommon(data: TData, update: boolean): void {
        const oldData = this.data;

        this.data = data;
        this.beans.valueCache?.onDataChanged();
        this.updateDataOnDetailNode();
        this.beans.selectionSvc?.checkRowSelectable(this);
        this.resetQuickFilterAggregateText();

        const event: DataChangedEvent<TData> = this.createDataChangedEvent(data, oldData, update);

        this.__localEventService?.dispatchEvent(event);
    }

    // when we are doing master / detail, the detail node is lazy created, but then kept around.
    // so if we show / hide the detail, the same detail rowNode is used. so we need to keep the data
    // in sync, otherwise expand/collapse of the detail would still show the old values.
    private updateDataOnDetailNode(): void {
        if (this.detailNode) {
            this.detailNode.data = this.data;
        }
    }

    private createDataChangedEvent(
        newData: TData,
        oldData: TData | undefined,
        update: boolean
    ): DataChangedEvent<TData> {
        return {
            type: 'dataChanged',
            node: this,
            oldData: oldData,
            newData: newData,
            update: update,
        };
    }

    public getRowIndexString(): string | null {
        if (this.rowIndex == null) {
            // Row has been removed so no index
            _error(13);
            return null;
        }

        if (this.rowPinned === 'top') {
            return ROW_ID_PREFIX_TOP_PINNED + this.rowIndex;
        }

        if (this.rowPinned === 'bottom') {
            return ROW_ID_PREFIX_BOTTOM_PINNED + this.rowIndex;
        }

        return this.rowIndex.toString();
    }

    public setDataAndId(data: TData, id: string | undefined): void {
        const { selectionSvc } = this.beans;
        const oldNode = selectionSvc?.createDaemonNode?.(this);
        const oldData = this.data;

        this.data = data;
        this.updateDataOnDetailNode();
        this.setId(id);
        if (selectionSvc) {
            selectionSvc.checkRowSelectable(this);
            selectionSvc.syncInRowNode(this, oldNode);
        }

        const event: DataChangedEvent<TData> = this.createDataChangedEvent(data, oldData, false);

        this.__localEventService?.dispatchEvent(event);
    }

    private setId(id?: string): void {
        // see if user is providing the id's
        const getRowIdFunc = _getRowIdCallback(this.beans.gos);

        if (getRowIdFunc) {
            // if user is providing the id's, then we set the id only after the data has been set.
            // this is important for virtual pagination and viewport, where empty rows exist.
            if (this.data) {
                // we pass 'true' as we skip this level when generating keys,
                // as we don't always have the key for this level (eg when updating
                // data via transaction on SSRM, we are getting key to look up the
                // RowNode, don't have the RowNode yet, thus no way to get the current key)
                const parentKeys = this.parent?.getRoute() ?? [];
                this.id = getRowIdFunc({
                    data: this.data,
                    parentKeys: parentKeys.length > 0 ? parentKeys : undefined,
                    level: this.level,
                    rowPinned: this.rowPinned,
                });

                // make sure id provided doesn't start with 'row-group-' as this is reserved.
                if (this.id.startsWith(ROW_ID_PREFIX_ROW_GROUP)) {
                    _error(14, {
                        groupPrefix: ROW_ID_PREFIX_ROW_GROUP,
                    });
                }
            } else {
                // this can happen if user has set blank into the rowNode after the row previously
                // having data. this happens in virtual page row model, when data is delete and
                // the page is refreshed.
                this.id = undefined;
            }
        } else {
            this.id = id;
        }
    }

    public setRowTop(rowTop: number | null): void {
        this.oldRowTop = this.rowTop;

        if (this.rowTop === rowTop) {
            return;
        }

        this.rowTop = rowTop;

        this.dispatchRowEvent('topChanged');

        this.setDisplayed(rowTop !== null);
    }

    public clearRowTopAndRowIndex(): void {
        this.oldRowTop = null;
        this.setRowTop(null);
        this.setRowIndex(null);
    }

    public setHovered(hovered: boolean): void {
        this.hovered = hovered;
    }

    public isHovered(): boolean {
        return this.hovered;
    }

    /**
     * Sets the row height.
     * Call if you want to change the height initially assigned to the row.
     * After calling, you must call `api.onRowHeightChanged()` so the grid knows it needs to work out the placement of the rows. */
    public setRowHeight(rowHeight: number | undefined | null, estimated: boolean = false): void {
        this.rowHeight = rowHeight;
        this.rowHeightEstimated = estimated;

        this.dispatchRowEvent('heightChanged');
    }

    public setExpanded(expanded: boolean, e?: MouseEvent | KeyboardEvent, forceSync?: boolean): void {
        this.beans.expansionSvc?.setExpanded(this, expanded, e, forceSync);
    }

    /**
     * Replaces the value on the `rowNode` for the specified column. When complete,
     * the grid will refresh the rendered cell on the required row only.
     * **Note**: This method only fires `onCellEditRequest` when the Grid is in **Read Only** mode.
     *
     * @param colKey The column where the value should be updated
     * @param newValue The new value
     * @param eventSource The source of the event
     * @returns `true` if the value was changed, otherwise `false`.
     */
    public setDataValue(colKey: string | AgColumn, newValue: any, eventSource?: string): boolean {
        // When it is done via the editors, no 'cell changed' event gets fired, as it's assumed that
        // the cell knows about the change given it's in charge of the editing.
        // this method is for the client to call, so the cell listens for the change
        // event, and also flashes the cell when the change occurs.
        const { colModel, valueSvc, gos, selectionSvc } = this.beans;

        // if in pivot mode, grid columns wont include primary columns
        const column = typeof colKey !== 'string' ? colKey : colModel.getCol(colKey) ?? colModel.getColDefCol(colKey);
        if (!column) {
            return false;
        }
        const oldValue = valueSvc.getValueForDisplay(column, this);

        if (gos.get('readOnlyEdit')) {
            const {
                beans: { eventSvc },
                data,
                rowIndex,
                rowPinned,
            } = this;
            eventSvc.dispatchEvent({
                type: 'cellEditRequest',
                event: null,
                rowIndex,
                rowPinned,
                column,
                colDef: column.colDef,
                data,
                node: this,
                oldValue,
                newValue,
                value: newValue,
                source: eventSource,
            });
            return false;
        }

        const valueChanged = valueSvc.setValue(this, column, newValue, eventSource);

        this.dispatchCellChangedEvent(column, newValue, oldValue);
        selectionSvc?.checkRowSelectable(this);

        return valueChanged;
    }

    public updateHasChildren(): void {
        // in CSRM, the group property will be set before the childrenAfterGroup property, check both to prevent flickering
        let newValue: boolean | null =
            (this.group && !this.footer) || (this.childrenAfterGroup && this.childrenAfterGroup.length > 0);

        const { rowChildrenSvc } = this.beans;
        if (rowChildrenSvc) {
            newValue = rowChildrenSvc.getHasChildrenValue(this);
        }

        if (newValue !== this.__hasChildren) {
            this.__hasChildren = !!newValue;
            this.dispatchRowEvent('hasChildrenChanged');
        }
    }

    public hasChildren(): boolean {
        if (this.__hasChildren == null) {
            this.updateHasChildren();
        }
        return this.__hasChildren;
    }

    public dispatchCellChangedEvent(column: AgColumn, newValue: TData, oldValue: TData): void {
        const cellChangedEvent: CellChangedEvent<TData> = {
            type: 'cellChanged',
            node: this,
            column: column,
            newValue: newValue,
            oldValue: oldValue,
        };
        this.__localEventService?.dispatchEvent(cellChangedEvent);
    }

    /**
     * The first time `quickFilter` runs, the grid creates a one-off string representation of the row.
     * This string is then used for the quick filter instead of hitting each column separately.
     * When you edit, using grid editing, this string gets cleared down.
     * However if you edit without using grid editing, you will need to clear this string down for the row to be updated with the new values.
     * Otherwise new values will not work with the `quickFilter`. */
    public resetQuickFilterAggregateText(): void {
        this.quickFilterAggregateText = null;
    }

    /** Returns:
     * - `true` if the node can be expanded, i.e it is a group or master row.
     * - `false` if the node cannot be expanded
     */
    public isExpandable(): boolean {
        return this.beans.expansionSvc?.isExpandable(this) ?? false;
    }

    /** Returns:
     * - `true` if node is selected,
     * - `false` if the node isn't selected
     * - `undefined` if it's partially selected (group where not all children are selected). */
    public isSelected(): boolean | undefined {
        // for footers, we just return what our sibling selected state is, as cannot select a footer
        if (this.footer) {
            return this.sibling.isSelected();
        }

        return this.__selected;
    }

    /** Perform a depth-first search of this node and its children. */
    public depthFirstSearch(callback: (rowNode: RowNode<TData>) => void): void {
        this.childrenAfterGroup?.forEach((child) => child.depthFirstSearch(callback));
        callback(this);
    }

    public dispatchRowEvent<T extends RowNodeEventType>(type: T): void {
        this.__localEventService?.dispatchEvent({
            type: type,
            node: this,
        } as RowNodeEvent<T, TData>);
    }

    /**
     * Select (or deselect) the node.
     * @param newValue -`true` for selection, `false` for deselection.
     * @param clearSelection - If selecting, then passing `true` will select the node exclusively (i.e. NOT do multi select). If doing deselection, `clearSelection` has no impact.
     * @param source - Source property that will appear in the `selectionChanged` event.
     */
    public setSelected(
        newValue: boolean,
        clearSelection: boolean = false,
        source: SelectionEventSourceType = 'api'
    ): void {
        this.beans.selectionSvc?.setSelectedParams({
            rowNode: this,
            newValue,
            clearSelection,
            rangeSelect: false,
            source,
        });
    }

    /**
     * Returns:
     * - `true` if node is either pinned to the `top` or `bottom`
     * - `false` if the node isn't pinned
     */
    public isRowPinned(): boolean {
        return !!this.rowPinned;
    }

    /** Add an event listener. */
    public addEventListener<T extends RowNodeEventType>(eventType: T, userListener: AgRowNodeEventListener<T>): void {
        this.beans.validation?.checkRowEvents(eventType);
        if (!this.__localEventService) {
            this.__localEventService = new LocalEventService();
        }
        this.frameworkEventListenerService = this.beans.frameworkOverrides.createLocalEventListenerWrapper?.(
            this.frameworkEventListenerService,
            this.__localEventService
        );

        const listener = this.frameworkEventListenerService?.wrap(userListener) ?? userListener;
        this.__localEventService.addEventListener(eventType, listener);
    }

    /** Remove event listener. */
    public removeEventListener<T extends RowNodeEventType>(
        eventType: T,
        userListener: AgRowNodeEventListener<T>
    ): void {
        if (!this.__localEventService) {
            return;
        }

        const listener = this.frameworkEventListenerService?.unwrap(userListener) ?? userListener;
        this.__localEventService.removeEventListener(eventType, listener);
        if (this.__localEventService.noRegisteredListenersExist()) {
            this.__localEventService = null;
        }
    }

    /**
     * @deprecated v32.2.0 Check `node.detail` then user provided callback `isFullWidthRow` instead.
     *
     * Returns:
     * - `true` if the node is a full width cell
     * - `false` if the node is not a full width cell
     */
    public isFullWidthCell(): boolean {
        // log deprecation
        _warn(61);

        if (this.detail) {
            return true;
        }

        const isFullWidthCellFunc = this.beans.gos.getCallback('isFullWidthRow');
        return isFullWidthCellFunc ? isFullWidthCellFunc({ rowNode: this }) : false;
    }

    /**
     * Returns the route of keys to the row node. Returns undefined if the node has no key.
     */
    public getRoute(): string[] | undefined {
        // root node is still a valid route
        if (this.level === -1) {
            return [];
        }

        if (this.key == null) {
            return undefined;
        }

        const res: string[] = [];
        let pointer: RowNode | null = this;
        while (pointer && pointer.key != null) {
            res.push(pointer.key);
            pointer = pointer.parent;
        }

        return res.reverse();
    }

    public setFirstChild(firstChild: boolean): void {
        if (this.firstChild !== firstChild) {
            this.firstChild = firstChild;
            this.dispatchRowEvent('firstChildChanged');
        }
    }

    private setDisplayed(displayed: boolean): void {
        if (this.displayed !== displayed) {
            this.displayed = displayed;
            this.dispatchRowEvent('displayedChanged');
        }
    }

    public setRowIndex(rowIndex: number | null): void {
        if (this.rowIndex !== rowIndex) {
            this.rowIndex = rowIndex;
            this.dispatchRowEvent('rowIndexChanged');
        }
    }

    public setAllChildrenCount(allChildrenCount: number | null): void {
        if (this.allChildrenCount !== allChildrenCount) {
            this.allChildrenCount = allChildrenCount;
            this.dispatchRowEvent('allChildrenCountChanged');
        }
    }

    public setUiLevel(uiLevel: number): void {
        if (this.uiLevel !== uiLevel) {
            this.uiLevel = uiLevel;
            this.dispatchRowEvent('uiLevelChanged');
        }
    }
}
