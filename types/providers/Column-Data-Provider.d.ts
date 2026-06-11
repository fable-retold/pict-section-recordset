export = ColumnDataProvider;
/** Terminology for Column Data Provider (to avoid confusion):
 * A "Record Set" is a collection of records rendered as a list with columns.
 * A "Column Visibility Override" is a per-column user choice (true = show, false = hide)
 *   that overrides the column's default visibility (visible unless DefaultHidden).
 * Columns with no override entry render at their default visibility.

 * Behavior Summary:
 * - Save the per-recordset override map to LocalStorage under a key derived from
 *   Record Set and View Context.
 * - Mirror the override map into pict.Bundle._ActiveColumnState[RecordSet] so reads
 *   are synchronous and consistent within a session (the Meadow record provider reads
 *   this at fetch time to widen Lite projections before the list view composes columns).
 * - Clear both on "Reset to defaults".

 * Storage Key Structure:
 * - Column_Meta_{RecordSet}_{ViewContext} : stores the Column Meta JSON.

 * Object Shape for Column Meta:
 * {
 *   RecordSet: string, (auto-filled on save)
 *   ViewContext: string, (auto-filled on save; 'List' for the list view)
 *   Overrides: { [ColumnKey: string]: boolean },
 *   LastModifiedDate: string (ISO date) (auto-filled on save)
 * }

 * Host override contract:
 * - To persist column choices somewhere other than LocalStorage (e.g. a per-user
 *   server-side preference), register your own provider AS 'ColumnDataProvider'
 *   BEFORE PictSectionRecordSet.initialize() runs — the section only registers this
 *   one when no provider with that hash exists yet. Load remote prefs at app start
 *   and seed them through setColumnVisibilityOverride (or write the Bundle mirror
 *   directly); the read methods here must stay synchronous.
*/
declare class ColumnDataProvider extends libPictProvider {
    /**
     * @param {import('pict')} pFable - The Fable instance
     * @param {Record<string, any>} [pOptions] - The options for the provider
     * @param {string} [pServiceHash] - The service hash for the provider
     */
    constructor(pFable: import("pict"), pOptions?: Record<string, any>, pServiceHash?: string);
    storageProvider: any;
    keyCache: {};
    /**
     * Resolve the LocalStorage key for a record set's column visibility overrides.
     *
     * @param {string} pRecordSet - The record set the overrides belong to
     * @param {string} [pViewContext] - The view context (defaults to 'List')
     * @return {string} The storage key for the column meta record.
     */
    getColumnStorageKey(pRecordSet: string, pViewContext?: string): string;
    /**
     * Get the column visibility override map for a record set.
     *
     * Bundle-first: the session mirror in pict.Bundle._ActiveColumnState wins; on a
     * miss the stored meta is read and seeded into the Bundle so every later read
     * (including the Meadow provider's fetch-time read) is synchronous and consistent.
     *
     * @param {string} pRecordSet - The record set to get overrides for
     * @param {string} [pViewContext] - The view context (defaults to 'List')
     * @return {Record<string, boolean>} The override map (empty object when none).
     */
    getColumnVisibilityOverrides(pRecordSet: string, pViewContext?: string): Record<string, boolean>;
    /**
     * Set (and persist) a single column visibility override for a record set.
     *
     * @param {string} pRecordSet - The record set the column belongs to
     * @param {string} pViewContext - The view context ('List' for the list view; falsy defaults to 'List')
     * @param {string} pKey - The column key
     * @param {boolean} pVisible - Whether the column should be visible
     * @return {Record<string, boolean>} The updated override map.
     */
    setColumnVisibilityOverride(pRecordSet: string, pViewContext: string, pKey: string, pVisible: boolean): Record<string, boolean>;
    /**
     * Clear all column visibility overrides for a record set (Reset to defaults).
     *
     * @param {string} pRecordSet - The record set to clear overrides for
     * @param {string} [pViewContext] - The view context (defaults to 'List')
     * @return {boolean} True when the overrides have been cleared.
     */
    clearColumnVisibilityOverrides(pRecordSet: string, pViewContext?: string): boolean;
    /**
     * Write the session mirror of a record set's override map into the Bundle.
     *
     * @param {string} pRecordSet - The record set the overrides belong to
     * @param {Record<string, boolean>} pOverrides - The override map to mirror
     */
    _seedBundleColumnState(pRecordSet: string, pOverrides: Record<string, boolean>): void;
    /** ===== SIMPLE KEY-VALUE CACHE ============= */
    /**
     * @param {string} pKey - The key to get from the cache
     * @return {any} - The value associated with the key, or null if not found
     */
    getItem(pKey: string): any;
    /**
     * @param {string} pKey - The key to set in the cache
     * @param {any} pValue - The value to associate with the key
     */
    setItem(pKey: string, pValue: any): boolean;
    /**
     * @param {string} pKey - The key to remove from the cache
     * @return {boolean} - True if the item was removed, false if it was not found
     */
    removeItem(pKey: string): boolean;
}
declare namespace ColumnDataProvider {
    export { _DEFAULT_PROVIDER_CONFIGURATION as default_configuration };
}
import libPictProvider = require("pict-provider");
declare namespace _DEFAULT_PROVIDER_CONFIGURATION {
    let ProviderIdentifier: string;
    let AutoInitialize: boolean;
    let AutoInitializeOrdinal: number;
}
//# sourceMappingURL=Column-Data-Provider.d.ts.map