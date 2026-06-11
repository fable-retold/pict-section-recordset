const libPictProvider = require('pict-provider');

const _DEFAULT_PROVIDER_CONFIGURATION =
{
	ProviderIdentifier: 'ColumnDataProvider',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
};

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

class ColumnDataProvider extends libPictProvider
{
	/**
	 * @param {import('pict')} pFable - The Fable instance
	 * @param {Record<string, any>} [pOptions] - The options for the provider
	 * @param {string} [pServiceHash] - The service hash for the provider
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_PROVIDER_CONFIGURATION, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		// This allows unit tests to run
		this.storageProvider = this;
		this.keyCache = {};
		if ((typeof(window) === 'object') && (typeof(window.localStorage) === 'object'))
		{
			this.storageProvider = window.localStorage;
		}
	}

	/**
	 * Resolve the LocalStorage key for a record set's column visibility overrides.
	 *
	 * @param {string} pRecordSet - The record set the overrides belong to
	 * @param {string} [pViewContext] - The view context (defaults to 'List')
	 * @return {string} The storage key for the column meta record.
	 */
	getColumnStorageKey(pRecordSet, pViewContext)
	{
		return `Column_Meta_${pRecordSet}_${pViewContext || 'List'}`;
	}

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
	getColumnVisibilityOverrides(pRecordSet, pViewContext)
	{
		if (!pRecordSet)
		{
			return {};
		}
		const tmpActiveColumnState = this.pict.Bundle._ActiveColumnState;
		if (tmpActiveColumnState && tmpActiveColumnState[pRecordSet] && tmpActiveColumnState[pRecordSet].Overrides)
		{
			return tmpActiveColumnState[pRecordSet].Overrides;
		}
		/** @type {Record<string, boolean>} */
		let tmpOverrides = {};
		const tmpColumnMetaJSON = this.storageProvider.getItem(this.getColumnStorageKey(pRecordSet, pViewContext));
		if (tmpColumnMetaJSON)
		{
			try
			{
				const tmpColumnMeta = JSON.parse(tmpColumnMetaJSON);
				if (tmpColumnMeta && typeof(tmpColumnMeta.Overrides) === 'object' && tmpColumnMeta.Overrides !== null)
				{
					tmpOverrides = tmpColumnMeta.Overrides;
				}
			}
			catch (pError)
			{
				this.pict.log.warn(`ColumnDataProvider: could not parse stored column meta for [${pRecordSet}]: ${pError.message}`);
			}
		}
		this._seedBundleColumnState(pRecordSet, tmpOverrides);
		return tmpOverrides;
	}

	/**
	 * Set (and persist) a single column visibility override for a record set.
	 *
	 * @param {string} pRecordSet - The record set the column belongs to
	 * @param {string} pViewContext - The view context ('List' for the list view; falsy defaults to 'List')
	 * @param {string} pKey - The column key
	 * @param {boolean} pVisible - Whether the column should be visible
	 * @return {Record<string, boolean>} The updated override map.
	 */
	setColumnVisibilityOverride(pRecordSet, pViewContext, pKey, pVisible)
	{
		const tmpOverrides = this.getColumnVisibilityOverrides(pRecordSet, pViewContext);
		tmpOverrides[pKey] = (pVisible === true);
		this._seedBundleColumnState(pRecordSet, tmpOverrides);
		const tmpColumnMeta =
		{
			RecordSet: pRecordSet,
			ViewContext: pViewContext || 'List',
			Overrides: tmpOverrides,
			LastModifiedDate: new Date().toISOString(),
		};
		this.storageProvider.setItem(this.getColumnStorageKey(pRecordSet, pViewContext), JSON.stringify(tmpColumnMeta));
		return tmpOverrides;
	}

	/**
	 * Clear all column visibility overrides for a record set (Reset to defaults).
	 *
	 * @param {string} pRecordSet - The record set to clear overrides for
	 * @param {string} [pViewContext] - The view context (defaults to 'List')
	 * @return {boolean} True when the overrides have been cleared.
	 */
	clearColumnVisibilityOverrides(pRecordSet, pViewContext)
	{
		this.storageProvider.removeItem(this.getColumnStorageKey(pRecordSet, pViewContext));
		if (this.pict.Bundle._ActiveColumnState && this.pict.Bundle._ActiveColumnState[pRecordSet])
		{
			delete this.pict.Bundle._ActiveColumnState[pRecordSet];
		}
		return true;
	}

	/**
	 * Write the session mirror of a record set's override map into the Bundle.
	 *
	 * @param {string} pRecordSet - The record set the overrides belong to
	 * @param {Record<string, boolean>} pOverrides - The override map to mirror
	 */
	_seedBundleColumnState(pRecordSet, pOverrides)
	{
		if (!this.pict.Bundle._ActiveColumnState)
		{
			this.pict.Bundle._ActiveColumnState = {};
		}
		this.pict.Bundle._ActiveColumnState[pRecordSet] = { Overrides: pOverrides };
	}

	/** ===== SIMPLE KEY-VALUE CACHE ============= */

	/**
	 * @param {string} pKey - The key to get from the cache
	 * @return {any} - The value associated with the key, or null if not found
	 */
	getItem(pKey)
	{
		if (pKey in this.keyCache)
		{
			return this.keyCache[pKey];
		}
		return null;
	}

	/**
	 * @param {string} pKey - The key to set in the cache
	 * @param {any} pValue - The value to associate with the key
	 */
	setItem(pKey, pValue)
	{
		this.keyCache[pKey] = pValue;
		return true;
	}

	/**
	 * @param {string} pKey - The key to remove from the cache
	 * @return {boolean} - True if the item was removed, false if it was not found
	 */
	removeItem(pKey)
	{
		if (pKey in this.keyCache)
		{
			delete this.keyCache[pKey];
			return true;
		}
		return false;
	}
}

module.exports = ColumnDataProvider;
module.exports.default_configuration = _DEFAULT_PROVIDER_CONFIGURATION;
