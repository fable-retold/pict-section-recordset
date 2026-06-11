export = MeadowEndpointsRecordSetProvider;
/**
 * @typedef {import('./RecordSet-RecordProvider-Base.js').RecordSetFilter} RecordSetFilter
 * @typedef {import('./RecordSet-RecordProvider-Base.js').RecordSetResult} RecordSetResult
 */
/**
 * Class representing a data change detection provider for Pict dynamic forms.
 * @extends libRecordSetProviderBase
 */
declare class MeadowEndpointsRecordSetProvider extends libRecordSetProviderBase {
    /** @type {import('pict') & {
     *      log: any,
     *      services:
     *      {
     *			PictSectionRecordSet: InstanceType<import('../Pict-Section-RecordSet.js')>,
     *			[key: string]: any,
     *		},
     *      instantiateServiceProviderWithoutRegistration: (hash: String) => any,
     *      PictSectionRecordSet: InstanceType<import('../Pict-Section-RecordSet.js')>
     *  }} */
    pict: import("pict") & {
        log: any;
        services: {
            PictSectionRecordSet: InstanceType<{
                new (pFable: any, pOptions: any, pServiceHash: any): import("../services/RecordsSet-MetaController.js");
                default_configuration: Record<string, any>;
                isFableService: boolean;
                CoreServiceProviderBase: typeof import("fable-serviceproviderbase");
                PictRecordSetApplication: typeof import("../application/Pict-Application-RecordSet.js");
                RecordSetProviderBase: typeof libRecordSetProviderBase;
                RecordSetProviderMeadowEndpoints: typeof MeadowEndpointsRecordSetProvider;
                ColumnDataProvider: typeof import("./Column-Data-Provider.js");
            }>;
            [key: string]: any;
        };
        instantiateServiceProviderWithoutRegistration: (hash: string) => any;
        PictSectionRecordSet: InstanceType<{
            new (pFable: any, pOptions: any, pServiceHash: any): import("../services/RecordsSet-MetaController.js");
            default_configuration: Record<string, any>;
            isFableService: boolean;
            CoreServiceProviderBase: typeof import("fable-serviceproviderbase");
            PictRecordSetApplication: typeof import("../application/Pict-Application-RecordSet.js");
            RecordSetProviderBase: typeof libRecordSetProviderBase;
            RecordSetProviderMeadowEndpoints: typeof MeadowEndpointsRecordSetProvider;
            ColumnDataProvider: typeof import("./Column-Data-Provider.js");
        }>;
    };
    fable: import("pict") & {
        log: any;
        services: {
            PictSectionRecordSet: InstanceType<{
                new (pFable: any, pOptions: any, pServiceHash: any): import("../services/RecordsSet-MetaController.js");
                default_configuration: Record<string, any>;
                isFableService: boolean;
                CoreServiceProviderBase: typeof import("fable-serviceproviderbase");
                PictRecordSetApplication: typeof import("../application/Pict-Application-RecordSet.js");
                RecordSetProviderBase: typeof libRecordSetProviderBase;
                RecordSetProviderMeadowEndpoints: typeof MeadowEndpointsRecordSetProvider;
                ColumnDataProvider: typeof import("./Column-Data-Provider.js");
            }>;
            [key: string]: any;
        };
        instantiateServiceProviderWithoutRegistration: (hash: string) => any;
        PictSectionRecordSet: InstanceType<{
            new (pFable: any, pOptions: any, pServiceHash: any): import("../services/RecordsSet-MetaController.js");
            default_configuration: Record<string, any>;
            isFableService: boolean;
            CoreServiceProviderBase: typeof import("fable-serviceproviderbase");
            PictRecordSetApplication: typeof import("../application/Pict-Application-RecordSet.js");
            RecordSetProviderBase: typeof libRecordSetProviderBase;
            RecordSetProviderMeadowEndpoints: typeof MeadowEndpointsRecordSetProvider;
            ColumnDataProvider: typeof import("./Column-Data-Provider.js");
        }>;
    };
    /** @type {Record<string, any>} */
    _Schema: Record<string, any>;
    /** @type {Record<string, Record<string, any>>} */
    _Experiences: Record<string, Record<string, any>>;
    /** @type {Record<string, Record<string, any>>} */
    _FiltersByField: Record<string, Record<string, any>>;
    /** @return {import('pict/types/source/Pict-Meadow-EntityProvider.js')} */
    get entityProvider(): import("pict/types/source/Pict-Meadow-EntityProvider.js");
    /** @type {import('pict/types/source/Pict-Meadow-EntityProvider.js')} */
    _EntityProvider: import("pict/types/source/Pict-Meadow-EntityProvider.js");
    /**
     * Fetch (and cache) the DISTINCT values of a column present in this recordset's data, via
     * Meadow's `<Entity>s/Distinct/<Column>` endpoint. Drives the `ScopeToRecordSet` filter knob:
     * an entity picker can be limited to `FBL~<Column>~INN~<these values>` so it only lists the
     * entities the data actually references, not the whole remote table. Cached per column.
     *
     * @param {string} pColumn @param {(pError: Error|null, pValues: Array<any>) => void} fCallback
     */
    getRecordSetColumnDistinct(pColumn: string, fCallback: (pError: Error | null, pValues: Array<any>) => void): void;
    _scopeDistinctCache: any;
    /**
     * @return {Array<string>} - The fields to ignore for filter availability.
     */
    get ignoreFilterFields(): Array<string>;
    /**
     * Get a record by its ID or GUID.
     *
     * @param {string|number} pIDOrGuid - The ID or GUID of the record.
     */
    getRecord(pIDOrGuid: string | number): Promise<any>;
    getGUIDField(): any;
    getIDField(): any;
    getDeletedField(): any;
    /**
     * Get a record by its ID or GUID.
     *
     * @param {string|number} pGuid - The ID or GUID of the record.
     * @param {boolean} [pIncludeDeleted] - When true, also match soft-deleted records (the explicit
     *                                      Deleted filter suppresses the automatic `Deleted = 0`).
     */
    getRecordByGUID(pGuid: string | number, pIncludeDeleted?: boolean): Promise<any>;
    _prepareFilterState(pEntity: any, pOptions: any, pFilterExperienceResultAddress?: string): any[];
    /**
     * Derive the Lite `ExtraColumns` for a list fetch from the manifest's displayed
     * columns. Lite already returns the ID-prefixed, GUID-prefixed, CreatingIDUser and
     * UpdateDate fields plus a computed Value, so we only request the remaining scalar
     * display columns — and only ones that are real, non-blob schema columns. Returns
     * [] (caller then does a safe full fetch) if the manifest columns or schema are
     * unavailable.
     * @param {string} pEntity - The entity being listed.
     * @param {Record<string, any>} pOptions - The list options (carries RecordSetConfiguration).
     * @return {Array<string>} The ExtraColumns to request.
     */
    _deriveLiteExtraColumns(pEntity: string, pOptions: Record<string, any>): Array<string>;
    /**
     * Read records from the provider.
     *
     * @param {RecordSetFilter} pOptions - Options for the read operation.
     */
    getRecordSetCount(pOptions: RecordSetFilter): Promise<any>;
    _RecordSetCountCache: {
        Key: string;
        Count: any;
    } | {
        Key: string;
        Count: any;
    };
    /**
     * Create a new record.
     *
     * @param {Record<string, any>} pRecord - The record to create.
     */
    createRecord(pRecord: Record<string, any>): Promise<any>;
    /**
     * Update a record.
     *
     * @param {Record<string, any>} pRecord - The record to update.
     */
    updateRecord(pRecord: Record<string, any>): Promise<any>;
    /**
     * Delete a record.
     *
     * @param {Record<string, any>} pRecord - The record to delete.
     */
    deleteRecord(pRecord: Record<string, any>): Promise<any>;
    /**
     * Read a record.
     *
     * @param {string|number} pIDOrGuid - The ID or GUID of the record.
     */
    readRecord(pIDOrGuid: string | number): Promise<any>;
    /**
     * Clone a record.
     *
     * @param {Record<string, any>} pRecord - The record to clone.
     */
    cloneRecord(pRecord: Record<string, any>): Promise<any>;
    /**
     * The "list entry" display template for an entity — how one of its records should read as a single line
     * in a picker option / selected chip. Returns a pict template string (rendered against the raw record by
     * the picker's TextTemplate), or null to fall back to a single display field.
     *
     * This is deliberately a small, overridable seam: today it hard-knows `User` (whose name lives across
     * NameFull / NameFirst+NameLast and needs an Email/LoginID disambiguator), but the intent is that this
     * eventually reads a per-entity template off the Stricture schema instead of branching here.
     *
     * @param {string} pEntityName - The entity (e.g. 'User').
     * @return {string|null}
     */
    getEntityListEntryTemplate(pEntityName: string): string | null;
    _entityListEntryTemplatesRegistered: boolean;
    /**
     * @param {string} pSchemaField - The schema field name.
     * @param {Record<string, any>} pColumn - The full column definition from the schema.
     * @param {Record<string, any>} [pMeadowSchemaField] - The meadow schema field definition.
     */
    getFieldFilterClauses(pSchemaField: string, pColumn: Record<string, any>, pMeadowSchemaField?: Record<string, any>): any;
    /**
     * @param {string} pEntity - The schema field name.
     * @return {string} - The human-readable name for the entity.
     */
    _getHumanReadableEntityName(pEntity: string): string;
    /**
     * @param {string} pSchemaField - The schema field name.
     * @return {string} - The human-readable name for the schema field.
     */
    getHumanReadableFieldName(pSchemaField: string): string;
    /**
     * @param {(error?: Error) => void} fCallback - The callback function.
     */
    initializeEntitySchema(fCallback: (error?: Error) => void): void;
    initializeFilterSchema(): void;
}
declare namespace MeadowEndpointsRecordSetProvider {
    export { RecordSetFilter, RecordSetResult };
}
import libRecordSetProviderBase = require("./RecordSet-RecordProvider-Base.js");
type RecordSetFilter = import("./RecordSet-RecordProvider-Base.js").RecordSetFilter;
type RecordSetResult = import("./RecordSet-RecordProvider-Base.js").RecordSetResult;
//# sourceMappingURL=RecordSet-RecordProvider-MeadowEndpoints.d.ts.map