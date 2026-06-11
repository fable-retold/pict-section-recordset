export = RecordSetProviderBase;
/**
 * @typedef {Object} RecordSetSearchRangeFacet
 * @property {string} Field - The field to facet on. Only indexed fields can be faceted.
 * @property {any} Start - The start of the range. (ex. 1900)
 * @property {any} End - The end of the range. (ex. 2025)
 * @property {any} Gap - The gap between range values. (ex. 25)
 * TODO: Support auto-generating ranges based on the data at rest?
 */
/**
 * @typedef {Object} RecordSetSearchFacetPayload
 * @property {boolean} [ReturnRecords] - If false, search will return facets only, not records.
 * @property {Array<string>} Fields - Requests to facet on all unique values of the given fields.
 * @property {Array<RecordSetSearchRangeFacet>} Ranges - Requests to facet on given ranges of field values.
 * TODO: support facet on custom query?
 */
/**
 * @typedef {Object} RecordSetResult
 * @property {Array<Record<string, any>>} Records - The records returned from the provider.
 * @property {Record<string, Record<string, number>> & { ByRange?: Record<string, number> }} Facets - The facets returned from the provider.
 */
/**
 * @typedef {Object} RecordSetFilter
 * @property {string} [Entity] - The entity name. Can be used as an override to achieve LiteExtended, etc.
 * @property {string} [FilterString] - A meadow endpoint style filter to apply.
 * @property {number} [Offset] - The starting record number for pagination.
 * @property {number} [PageSize] - The starting record number for pagination.
 * @property {RecordSetSearchFacetPayload} [Facets] - The faceting config for the search.
 */
/**
 * Base record set provider.
 * @extends libPictProvider
 */
declare class RecordSetProviderBase extends libPictProvider {
    /**
     * Creates an instance of RecordSetProvider.
     * @param {import('pict')} pFable - The Fable object.
     * @param {Record<string, any>} [pOptions] - Custom options for the provider.
     * @param {string} [pServiceHash] - The service hash.
     */
    constructor(pFable: import("pict"), pOptions?: Record<string, any>, pServiceHash?: string);
    /** @type {import('pict')} */
    fable: import("pict");
    /** @type {import('pict')} */
    pict: import("pict");
    /** @type {Record<string, any>} */
    _FilterSchema: Record<string, any>;
    /**
     * Get a record by its ID or GUID.
     *
     * @param {string|number} pIDOrGuid - The ID or GUID of the record.
     */
    getRecord(pIDOrGuid: string | number): Promise<{}>;
    /**
     * Get a record by its ID or GUID.
     *
     * @param {string|number} pGuid - The ID or GUID of the record.
     */
    getRecordByGUID(pGuid: string | number): Promise<{}>;
    getGUIDField(): string;
    getIDField(): string;
    /**
     * Read records from the provider.
     *
     * @param {RecordSetFilter} pOptions - Options for the read operation.
     * @return {Promise<RecordSetResult>} - The result of the read operation.
     */
    getRecords(pOptions: RecordSetFilter): Promise<RecordSetResult>;
    /**
     * Read records from the provider.
     *
     * @param {RecordSetFilter} pOptions - Options for the read operation.
     *
     * @return {Promise<RecordSetResult>} - The result of the read operation.
     */
    getDecoratedRecords(pOptions: RecordSetFilter): Promise<RecordSetResult>;
    /**
     * Read records from the provider.
     *
     * @param {string} [pFilterString] - The filter string to apply.
     * @param {number} [pOffset] - The starting record number for pagination.
     * @param {number} [pPageSize] - The number of records to return.
     * @return {Promise<RecordSetResult>} - The result of the read operation.
     */
    getRecordsInline(pFilterString?: string, pOffset?: number, pPageSize?: number): Promise<RecordSetResult>;
    /**
     * Read records from the provider.
     *
     * @param {RecordSetFilter} pOptions - Options for the read operation.
     */
    getRecordSetCount(pOptions: RecordSetFilter): Promise<{
        Count: number;
    }>;
    /**
     * Create a new record.
     *
     * @param {Record<string, any>} pRecord - The record to create.
     * @return {Promise<Record<string, any>>} - The created record.
     */
    createRecord(pRecord: Record<string, any>): Promise<Record<string, any>>;
    /**
     * Update a record.
     *
     * @param {Record<string, any>} pRecord - The record to update.
     * @return {Promise<Record<string, any>>} - The updated record.
     */
    updateRecord(pRecord: Record<string, any>): Promise<Record<string, any>>;
    /**
     * Delete a record.
     *
     * @param {Record<string, any>} pRecord - The record to delete.
     * @return {Promise<void>}
     */
    deleteRecord(pRecord: Record<string, any>): Promise<void>;
    /**
     * Read a record.
     *
     * @param {string|number} pIDOrGuid - The ID or GUID of the record.
     */
    readRecord(pIDOrGuid: string | number): Promise<{}>;
    /**
     * Read records from the provider.
     *
     * @param {RecordSetFilter} pOptions - Options for the read operation.
     * @return {Promise<RecordSetResult>} - The result of the read operation.
     */
    readRecords(pOptions: RecordSetFilter): Promise<RecordSetResult>;
    /**
     * Clone a record.
     *
     * @param {Record<string, any>} pRecord - The record to clone.
     * @return {Promise<Record<string, any>>} - The cloned record.
     */
    cloneRecord(pRecord: Record<string, any>): Promise<Record<string, any>>;
    /**
     * Remove any intrinsic identifiers from a record.
     *
     * @param {Record<string, any>} pRecord - The record to clean.
     */
    cleanRecord(pRecord: Record<string, any>): Record<string, any>;
    /**
     * @return {Record<string, any>} The schema of the record.
     */
    get recordSchema(): Record<string, any>;
    /**
     * Abstract decoration method for core records. Subclasses should implement this method to decorate records with additional information.
     *
     * @param {Array<Record<string, any>>} pRecords - The records to decorate.
     * @return {Promise<void>}
     */
    decorateCoreRecords(pRecords: Array<Record<string, any>>): Promise<void>;
    /**
     * @return {Promise<Record<string, any>>} The schema of the record.
     */
    getRecordSchema(): Promise<Record<string, any>>;
    /**
     * @return {Array<string>} The keys of the filter schema.
     */
    getFilterSchemaKeys(): Array<string>;
    /**
     * @param {string} pFilterKey - The filter key to get the schema for.
     *
     * @return {Record<string, any>} The schema for the filter clause.
     */
    getFilterClauseSchemaForKey(pFilterKey: string): Record<string, any>;
    /**
     * @return {Record<string, Record<string, any>>} The schema for the filter clauses.
     */
    getFilterSchema(): Record<string, Record<string, any>>;
    /**
     * @param {string} pFilterKey - The filter key to add the clause for.
     * @param {string} pClauseKey - The clause key to add.
     */
    addFilterClause(pFilterKey: string, pClauseKey: string): void;
    /**
     */
    clearFilterClauses(): void;
    /**
     * @param {string} pSpecificFilterClauseHash - The hash of the specific filter clause to remove.
     */
    removeFilterClause(pSpecificFilterClauseHash: string): void;
    /**
     * @return {Array<Record<string, any>>} The filter clauses.
     */
    getFilterClauses(): Array<Record<string, any>>;
    /**
     * Resolve the quick-filter definitions for this record set. Precedence: a `QuickFilters` array config
     * (curated) → those; `QuickFilters: false` → none (explicit per-record-set opt-out); otherwise clever
     * defaults derived from the schema — UNLESS `pAllowCleverDefaults` is false (the host put quick filters
     * in opt-in-only mode, so a record set shows the bar only when it sets an explicit `QuickFilters`
     * array). Each definition resolves to a concrete clause descriptor from the field's `AvailableClauses`.
     *
     * @param {boolean} [pAllowCleverDefaults] - false → no clever defaults (opt-in only). Default true.
     * @return {Array<{Field:string, Label:string, Control:string, ClauseKey:string}>}
     */
    getQuickFilterDefinitions(pAllowCleverDefaults?: boolean): Array<{
        Field: string;
        Label: string;
        Control: string;
        ClauseKey: string;
    }>;
    /**
     * Clever defaults (zero config): the common things people filter on, detected by canonical Meadow
     * column names on the fetched schema. Primary text (Title→Name), the audit date ranges, the audit
     * user references. Absent `_Schema` (non-Meadow provider) → no defaults.
     *
     * @return {Array<{Field:string, Label?:string}>}
     */
    _deriveDefaultQuickFilters(): Array<{
        Field: string;
        Label?: string;
    }>;
    /**
     * Resolve one quick-filter config entry to a renderable definition: pick the clause (explicit
     * `ClauseKey`, else the best for a quick filter) from the field's AvailableClauses + classify it to a
     * control type. Returns null when the field has no usable clause.
     *
     * @param {Record<string, any>} pEntry @return {{Field:string, Label:string, Control:string, ClauseKey:string}|null}
     */
    _resolveQuickFilterDefinition(pEntry: Record<string, any>): {
        Field: string;
        Label: string;
        Control: string;
        ClauseKey: string;
    } | null;
    /**
     * Choose the clause a quick filter should drive for a field: an entity selected-value, else a fuzzy
     * string match, else a range — i.e. the simplest one-interaction clause the field offers.
     *
     * @param {Array<Record<string, any>>} pAvailableClauses @return {Record<string, any>|undefined}
     */
    _pickQuickClause(pAvailableClauses: Array<Record<string, any>>): Record<string, any> | undefined;
    /**
     * Map a clause Type to the quick-bar control that drives it.
     * @param {string} pType @return {string|null}
     */
    _controlForClauseType(pType: string): string | null;
    /**
     * The entity's soft-delete column name. Subclasses with schema access override this
     * (the Meadow provider resolves the column whose Type is 'Deleted').
     * @return {string}
     */
    getDeletedField(): string;
    /** @return {boolean} Whether the show-deleted clause is currently active for this record set. */
    getShowDeletedFilterValue(): boolean;
    /**
     * Toggle the show-deleted clause: a RawFilter stanza that references the Deleted column
     * explicitly, which suppresses the automatic `Deleted = 0` delete tracking so soft-deleted
     * rows enumerate. It is a real clause in the active filter state, so it serializes into the
     * filter experience (and the route URL) and clears with Clear like any other clause. The
     * clause list UI skips it (no filter view for RawFilter) — the drawer checkbox is its face.
     *
     * @param {boolean} pOn - Whether deleted records should be included.
     * @return {boolean} The resulting state.
     */
    setShowDeletedFilterValue(pOn: boolean): boolean;
    /** @param {string} pField @return {any} The current value of a field's quick-filter clause, or ''. */
    getQuickFilterClauseValue(pField: string): any;
    /**
     * Upsert (or, when the value is empty, remove) a field's quick-filter clause with a scalar value.
     * Creates the clause from the field's descriptor on first use, tagged so it renders in the quick bar
     * and serializes/applies like any clause.
     *
     * @param {string} pField @param {string} pClauseKey @param {any} pValue
     */
    upsertQuickFilterClauseValue(pField: string, pClauseKey: string, pValue: any): void;
    /** @param {string} pField @return {{Start:any, End:any}} The current DateRange quick-filter bounds. */
    getQuickFilterDateRangeValue(pField: string): {
        Start: any;
        End: any;
    };
    /**
     * Set one bound of a field's DateRange quick-filter clause (create on first use, remove when BOTH
     * bounds are empty). Bounds live at `clause.Values.Start` / `.End` (the DateRange contract).
     *
     * @param {string} pField @param {string} pClauseKey @param {'start'|'end'} pWhich @param {any} pValue
     */
    upsertQuickFilterDateRange(pField: string, pClauseKey: string, pWhich: "start" | "end", pValue: any): void;
    /** @param {string} pField @return {Array<any>} The current entity quick-filter selected value(s). */
    getQuickFilterEntityValue(pField: string): Array<any>;
    /**
     * Set a field's entity quick-filter clause to the picked value(s) (create on first use, remove when
     * empty). Selected ids live at `clause.Values` (the entity-reference contract).
     *
     * @param {string} pField @param {string} pClauseKey @param {any} pValue scalar or array
     */
    upsertQuickFilterEntity(pField: string, pClauseKey: string, pValue: any): void;
    /**
     * Clone a field's clause descriptor into a fresh, tagged quick-filter clause (no value set yet), or
     * null when the descriptor is missing. Shared by the text / date / entity upserts.
     *
     * @param {string} pField @param {string} pClauseKey @param {string} pQuickFilterKey
     * @return {Record<string, any>|null}
     */
    _createQuickFilterClause(pField: string, pClauseKey: string, pQuickFilterKey: string): Record<string, any> | null;
    /**
     * @param {string} pSpecificFilterClauseHash - The hash of the specific filter clause to move.
     * @param {number} pOrdinal - The ordinal position to move the filter clause to.
     */
    moveFilterClauseTo(pSpecificFilterClauseHash: string, pOrdinal: number): void;
    /**
     * @param {string} pSpecificFilterClauseHash - The hash of the specific filter clause to move.
     * @param {number} pOrdinalOffset - The ordinal offset to move the filter clause by.
     */
    moveFilterClauseBy(pSpecificFilterClauseHash: string, pOrdinalOffset: number): void;
}
declare namespace RecordSetProviderBase {
    export { _DefaultProviderConfiguration as default_configuration, RecordSetSearchRangeFacet, RecordSetSearchFacetPayload, RecordSetResult, RecordSetFilter };
}
import libPictProvider = require("pict-provider");
/**
 * Default configuration for the RecordSetProvider provider.
 * @type {Record<string, any>}
 */
declare const _DefaultProviderConfiguration: Record<string, any>;
type RecordSetSearchRangeFacet = {
    /**
     * - The field to facet on. Only indexed fields can be faceted.
     */
    Field: string;
    /**
     * - The start of the range. (ex. 1900)
     */
    Start: any;
    /**
     * - The end of the range. (ex. 2025)
     */
    End: any;
    /**
     * - The gap between range values. (ex. 25)
     * TODO: Support auto-generating ranges based on the data at rest?
     */
    Gap: any;
};
type RecordSetSearchFacetPayload = {
    /**
     * - If false, search will return facets only, not records.
     */
    ReturnRecords?: boolean;
    /**
     * - Requests to facet on all unique values of the given fields.
     */
    Fields: Array<string>;
    /**
     * - Requests to facet on given ranges of field values.
     * TODO: support facet on custom query?
     */
    Ranges: Array<RecordSetSearchRangeFacet>;
};
type RecordSetResult = {
    /**
     * - The records returned from the provider.
     */
    Records: Array<Record<string, any>>;
    /**
     * - The facets returned from the provider.
     */
    Facets: Record<string, Record<string, number>> & {
        ByRange?: Record<string, number>;
    };
};
type RecordSetFilter = {
    /**
     * - The entity name. Can be used as an override to achieve LiteExtended, etc.
     */
    Entity?: string;
    /**
     * - A meadow endpoint style filter to apply.
     */
    FilterString?: string;
    /**
     * - The starting record number for pagination.
     */
    Offset?: number;
    /**
     * - The starting record number for pagination.
     */
    PageSize?: number;
    /**
     * - The faceting config for the search.
     */
    Facets?: RecordSetSearchFacetPayload;
};
//# sourceMappingURL=RecordSet-RecordProvider-Base.d.ts.map