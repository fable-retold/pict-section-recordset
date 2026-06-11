export = viewRecordSetList;
declare class viewRecordSetList extends libPictRecordSetRecordView {
    childViews: {
        headerList: any;
        title: any;
        paginationTop: any;
        recordList: any;
        recordListHeader: any;
        recordListEntry: any;
        paginationBottom: any;
        columnChooser: any;
    };
    _renderedListIdentity: string;
    _lastRecordListData: {
        Title: any;
        RecordSet: any;
        RecordSetConfiguration: Record<string, any>;
        RenderDestination: any;
        FilterString: string;
        Records: {
            Records: any[];
        };
        TotalRecordCount: {
            Count: number;
        };
        Offset: number;
        PageSize: number;
    } | {
        Title: any;
        RecordSet: any;
        RecordSetConfiguration: Record<string, any>;
        RenderDestination: any;
        FilterString: string;
        Records: {
            Records: any[];
        };
        TotalRecordCount: {
            Count: number;
        };
        Offset: number;
        PageSize: number;
    };
    _lastListRenderArgs: {
        Method: string;
        Args: (string | number | Record<string, any>)[];
    } | {
        Method: string;
        Args: any[];
    };
    handleRecordSetListRoute(pRoutePayload: any): Promise<void>;
    onBeforeRenderList(pRecordListData: any): any;
    /**
     * Paint a loading shell into the list destination synchronously, before the data
     * fetch, so the previous page doesn't sit silently while a slow query runs. The
     * real list render (RenderMethod 'replace' into the same destination) overwrites
     * it when data arrives. Opt out with RecordSetListShowLoadingShell:false.
     * @param {Record<string, any>} pRecordListData
     */
    _projectLoadingShell(pRecordListData: Record<string, any>): void;
    /**
     * The schema columns that never become list columns automatically: the entity's own
     * identity pair plus the audit stamps. (Hosts that want one of these in the column
     * chooser declare it as a curated column, optionally with DefaultHidden.)
     *
     * @param {string} pEntity - The entity name (for the ID/GUID identity columns)
     * @return {Array<string>} The excluded column names.
     */
    _getExcludedSchemaColumns(pEntity: string): Array<string>;
    dynamicallyGenerateColumns(pRecordListData: any): any;
    excludedByDefaultCells: string[];
    /**
     * Map column name -> Meadow column Type from the entity schema, when available. The schema
     * endpoint nests the canonical column array at MeadowSchema.MeadowSchema.Schema (with a
     * legacy flat MeadowSchema.Schema fallback). Returns null when neither is present (e.g.
     * non-Meadow providers) so callers can skip type-based exclusions.
     *
     * @param {Record<string, any>} pRecordSchema - The schema from getRecordSchema()
     * @return {Record<string, string>|null} Column name -> Type map, or null.
     */
    _getMeadowColumnTypes(pRecordSchema: Record<string, any>): Record<string, string> | null;
    /**
     * Whether a column candidate is effectively visible: an explicit user override wins,
     * otherwise the candidate's default (visible unless DefaultHidden).
     *
     * @param {Record<string, any>} pCandidate - A ColumnCandidates entry
     * @param {Record<string, boolean>} pOverrides - The per-recordset override map
     * @return {boolean}
     */
    _effectiveColumnVisibility(pCandidate: Record<string, any>, pOverrides: Record<string, boolean>): boolean;
    /**
     * Compute the visible TableCells for a paint from the pristine candidate list + the user's
     * current overrides. Cells are per-paint shallow copies so host hooks can mutate them without
     * bleeding into the candidates. An override set that hides everything falls back to the
     * default-visible set (a fully empty table is a confusing dead end).
     *
     * @param {Array<Record<string, any>>} pCandidates - The pristine ColumnCandidates
     * @param {string} pRecordSet - The record set (for the override lookup)
     * @return {Array<Record<string, any>>} The visible cells, in candidate order.
     */
    _computeVisibleTableCells(pCandidates: Array<Record<string, any>>, pRecordSet: string): Array<Record<string, any>>;
    /**
     * Compose the column-chooser candidate pool and reduce TableCells to the visible subset.
     *
     * No-op unless the recordset opts in with RecordSetListColumnChooser: true — the flag off
     * leaves TableCells exactly as the existing paths computed it (including the manifest's
     * shared array reference).
     *
     * Candidates are two tiers, in order:
     *  - Curated: the host-declared columns (manifest Descriptors or RecordSetListColumns),
     *    shallow-copied (the shared manifest TableCells entries are never mutated), default
     *    visible unless the column/descriptor declares DefaultHidden: true.
     *  - Schema: remaining scalar entity columns (identity/audit fields and blob Text/JSON
     *    columns excluded), default hidden, rendered via the generic ProcessCell template
     *    (entity-reference ID* columns resolve names exactly like dynamic columns do).
     *
     * The pristine candidates ride on pRecordListData.ColumnCandidates (module-owned — host
     * hooks must not mutate it); TableCells becomes per-paint copies of the visible subset.
     *
     * @param {Record<string, any>} pRecordListData - The list data (TableCells already computed)
     * @return {Record<string, any>} The same list data, candidates composed.
     */
    _composeColumnCandidates(pRecordListData: Record<string, any>): Record<string, any>;
    /**
     * @param {Record<string, any>} pRecordSetConfiguration
     * @param {string} pProviderHash
     * @param {string} pFilterString
     * @param {string} pSerializedFilterExperience
     * @param {number} pOffset
     * @param {number} pPageSize
     * @param {boolean} [pBodyOnly] - When true, re-render only the rows + pagination (page change), leaving the filter view intact.
     *
     * @return {Promise<void>}
     */
    renderList(pRecordSetConfiguration: Record<string, any>, pProviderHash: string, pFilterString: string, pSerializedFilterExperience: string, pOffset: number, pPageSize: number, pBodyOnly?: boolean): Promise<void>;
    /**
     * @param {object} pManifest
     * @param {Record<string, any>} pRecordSetConfiguration
     * @param {string} pProviderHash
     * @param {string} pFilterString
     * @param {string} pSerializedFilterExperience
     * @param {number} pOffset
     * @param {number} pPageSize
     * @param {boolean} [pBodyOnly] - When true, re-render only the rows + pagination (page change), leaving the filter view intact.
     *
     * @return {Promise<void>}
     */
    renderListFromManifest(pManifest: object, pRecordSetConfiguration: Record<string, any>, pProviderHash: string, pFilterString: string, pSerializedFilterExperience: string, pOffset: number, pPageSize: number, pBodyOnly?: boolean): Promise<void>;
    /**
     * Paint the computed record-list data into the DOM.
     *
     * Full render (pBodyOnly falsy): render the whole `PRSP_Renderable_List` (title, header, filters,
     * pagination, rows) into the list destination — the original behavior.
     *
     * Body-only render (pBodyOnly true): only the page changed, so re-render just the rows and the two
     * pagination strips into their stable containers, leaving the filter view (and its picker/control state)
     * completely untouched. Each child is rendered with the freshly-computed record passed as an object, so
     * it produces exactly what the inline `{~V:~}` render would have.
     *
     * @param {Record<string, any>} pRecordListData - The fully-computed list data (records, pagination, cells).
     * @param {boolean} [pBodyOnly] - When true, surgically re-render only rows + pagination.
     * @return {void}
     */
    _paintRecordList(pRecordListData: Record<string, any>, pBodyOnly?: boolean): void;
    /**
     * Set a column's visibility for the currently rendered list (called by the column chooser).
     *
     * Persists the override, then repaints the rows + pagination body-only from the data already
     * in hand — except when a Lite-fetched list is showing a schema-tier column whose values were
     * never fetched, in which case the same render is rerun so the provider widens the projection.
     *
     * @param {string} pRecordSet - The record set the column belongs to (stale-chooser guard)
     * @param {string} pKey - The column key
     * @param {boolean} pVisible - Whether the column should be visible
     * @return {boolean} The column's resulting visibility.
     */
    setColumnVisibility(pRecordSet: string, pKey: string, pVisible: boolean): boolean;
    /**
     * Clear every column-visibility override for the currently rendered list and repaint with the
     * defaults (called by the column chooser's Reset). Never needs a refetch: resetting only
     * restores curated columns (always fetched) and hides schema extras.
     *
     * @param {string} pRecordSet - The record set to reset (stale-chooser guard)
     * @return {boolean} True when the reset happened.
     */
    resetColumnVisibility(pRecordSet: string): boolean;
    /**
     * Repaint the rows + pagination (body-only) from the last composed list data, with TableCells
     * recomputed from the pristine candidates + current overrides. onBeforeRenderList is re-invoked
     * — it is the documented seam where hosts append custom cells, and rebuilding TableCells from
     * candidates each paint means hook mutations apply exactly once per paint. (Hosts that decorate
     * Records in the hook must keep that decoration idempotent; the hook already re-runs on every
     * page change.) No loading shell: the data is already in hand, so the swap is immediate.
     *
     * @return {void}
     */
    _repaintWithColumnState(): void;
    /**
     * Rerun the last list render with the same arguments (body-only — the list shell and filters
     * are already on screen). Used when a column toggle needs a refetch under Lite.
     *
     * @return {Promise<void>|undefined}
     */
    _rerunLastListRender(): Promise<void> | undefined;
}
declare namespace viewRecordSetList {
    export { _DEFAULT_CONFIGURATION__List as default_configuration };
}
import libPictRecordSetRecordView = require("../RecordSet-RecordBaseView.js");
/** @type {Record<string, any>} */
declare const _DEFAULT_CONFIGURATION__List: Record<string, any>;
//# sourceMappingURL=RecordSet-List.d.ts.map