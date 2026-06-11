
const libPictProvider = require('pict-provider');

/**
 * Default configuration for the RecordSetProvider provider.
 * @type {Record<string, any>}
 */
const _DefaultProviderConfiguration = {
	ProviderIdentifier: 'Pict-RecordSetProvider',
	AutoInitialize: true,
	AutoInitializeOrdinal: 1, // initialize after other providers if initialized during app init
	AutoSolveWithApp: false,
};

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
class RecordSetProviderBase extends libPictProvider
{
	/**
	 * Creates an instance of RecordSetProvider.
	 * @param {import('pict')} pFable - The Fable object.
	 * @param {Record<string, any>} [pOptions] - Custom options for the provider.
	 * @param {string} [pServiceHash] - The service hash.
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		const tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultProviderConfiguration)), pOptions);

		super(pFable, tmpOptions, pServiceHash);

		/** @type {Record<string, any>} */
		this.options;
		/** @type {import('pict')} */
		this.fable;
		/** @type {import('pict')} */
		this.pict;

		/** @type {Record<string, any>} */
		this._FilterSchema = { };
	}

	/**
	 * Get a record by its ID or GUID.
	 *
	 * @param {string|number} pIDOrGuid - The ID or GUID of the record.
	 */
	async getRecord(pIDOrGuid)
	{
		this.pict.log.info(`RecordSetProviderBase.getRecord(${pIDOrGuid})`);
		return { };
	}

	/**
	 * Get a record by its ID or GUID.
	 *
	 * @param {string|number} pGuid - The ID or GUID of the record.
	 */
	async getRecordByGUID(pGuid)
	{
		this.pict.log.info(`RecordSetProviderBase.getRecordByGUID(${pGuid})`);
		return { };
	}

	/*
	get availableFilters()
	{
		return { IDBook: [ 'NumericMatch', 'NumericRange', 'ExternalJoinBookByAuthor' ], Title: [ 'StringMatch', 'StringRange' ] };
	}
	*/

	getGUIDField()
	{ 
		return `GUID${ this.options.Entity }`;
	}

	getIDField()
	{ 
		return `ID${ this.options.Entity }`;
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {RecordSetFilter} pOptions - Options for the read operation.
	 * @return {Promise<RecordSetResult>} - The result of the read operation.
	 */
	async getRecords(pOptions)
	{
		this.pict.log.info(`RecordSetProviderBase.getRecords(${JSON.stringify(pOptions)})`);
		return { Records: [], Facets: { } };
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {RecordSetFilter} pOptions - Options for the read operation.
	 *
	 * @return {Promise<RecordSetResult>} - The result of the read operation.
	 */
	async getDecoratedRecords(pOptions)
	{
		const tmpRecords = await this.getRecords(pOptions);
		await this.decorateCoreRecords(tmpRecords.Records);
		return tmpRecords;
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {string} [pFilterString] - The filter string to apply.
	 * @param {number} [pOffset] - The starting record number for pagination.
	 * @param {number} [pPageSize] - The number of records to return.
	 * @return {Promise<RecordSetResult>} - The result of the read operation.
	 */
	async getRecordsInline(pFilterString = '', pOffset = 0, pPageSize = 250)
	{
		this.pict.log.info(`RecordSetProviderBase.getRecordsInline(${pFilterString}, ${pOffset}, ${pPageSize})`);
		return { Records: [], Facets: { } };
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {RecordSetFilter} pOptions - Options for the read operation.
	 */
	async getRecordSetCount(pOptions)
	{
		this.pict.log.info(`RecordSetProviderBase.getRecordSetCount(${JSON.stringify(pOptions)})`);
		return { Count: 0 };
	}

	/**
	 * Create a new record.
	 *
	 * @param {Record<string, any>} pRecord - The record to create.
	 * @return {Promise<Record<string, any>>} - The created record.
	 */
	async createRecord(pRecord)
	{
		this.pict.log.info(`RecordSetProviderBase.createRecord(${JSON.stringify(pRecord)})`);
		return pRecord;
	}

	/**
	 * Update a record.
	 *
	 * @param {Record<string, any>} pRecord - The record to update.
	 * @return {Promise<Record<string, any>>} - The updated record.
	 */
	async updateRecord(pRecord)
	{
		this.pict.log.info(`RecordSetProviderBase.updateRecord(${JSON.stringify(pRecord)})`);
		return pRecord;
	}

	/**
	 * Delete a record.
	 *
	 * @param {Record<string, any>} pRecord - The record to delete.
	 * @return {Promise<void>}
	 */
	async deleteRecord(pRecord)
	{
		this.pict.log.info(`RecordSetProviderBase.deleteRecord(${JSON.stringify(pRecord)})`);
	}

	/**
	 * Read a record.
	 *
	 * @param {string|number} pIDOrGuid - The ID or GUID of the record.
	 */
	async readRecord(pIDOrGuid)
	{
		this.pict.log.info(`RecordSetProviderBase.readRecord(${pIDOrGuid})`);
		return { };
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {RecordSetFilter} pOptions - Options for the read operation.
	 * @return {Promise<RecordSetResult>} - The result of the read operation.
	 */
	async readRecords(pOptions)
	{
		this.pict.log.info(`RecordSetProviderBase.readRecords(${JSON.stringify(pOptions)})`);
		return { Records: [], Facets: { } };
	}

	/**
	 * Clone a record.
	 *
	 * @param {Record<string, any>} pRecord - The record to clone.
	 * @return {Promise<Record<string, any>>} - The cloned record.
	 */
	async cloneRecord(pRecord)
	{
		return this.createRecord(this.cleanRecord(pRecord));
	}

	/**
	 * Remove any intrinsic identifiers from a record.
	 *
	 * @param {Record<string, any>} pRecord - The record to clean.
	 */
	cleanRecord(pRecord)
	{
		return pRecord;
	}

	/**
	 * @return {Record<string, any>} The schema of the record.
	 */
	get recordSchema()
	{
		return { };
	}

	/**
	 * Abstract decoration method for core records. Subclasses should implement this method to decorate records with additional information.
	 *
	 * @param {Array<Record<string, any>>} pRecords - The records to decorate.
	 * @return {Promise<void>}
	 */
	async decorateCoreRecords(pRecords)
	{
	}

	/**
	 * @return {Promise<Record<string, any>>} The schema of the record.
	 */
	async getRecordSchema()
	{
		throw new Error(`getRecordSchema must be implemented in a sub-class`);
	}

	/**
	 * @return {Array<string>} The keys of the filter schema.
	 */
	getFilterSchemaKeys()
	{
		return Object.keys(this._FilterSchema);
	}

	/**
	 * @param {string} pFilterKey - The filter key to get the schema for.
	 *
	 * @return {Record<string, any>} The schema for the filter clause.
	 */
	getFilterClauseSchemaForKey(pFilterKey)
	{
		return this._FilterSchema?.[pFilterKey];
	}

	/**
	 * @return {Record<string, Record<string, any>>} The schema for the filter clauses.
	 */
	getFilterSchema()
	{
		//FIXME: risk here that the schema hasn't been loaded - but don't want to make this async...
		/** @type {Record<string, Record<string, any>>} */
		const tmpSchema = {};
		for (const tmpKey of this.getFilterSchemaKeys())
		{
			tmpSchema[tmpKey] = this.getFilterClauseSchemaForKey(tmpKey);
		}
		return tmpSchema;
	}

	/**
	 * @param {string} pFilterKey - The filter key to add the clause for.
	 * @param {string} pClauseKey - The clause key to add.
	 */
	addFilterClause(pFilterKey, pClauseKey)
	{
		let tmpClause = this.getFilterClauseSchemaForKey(pFilterKey)?.AvailableClauses?.find?.((c) => c.ClauseKey == pClauseKey);
		if (!tmpClause)
		{
			this.pict.log.error(`RecordSetProviderBase.addFilterClause() - No filter clause schema found for key ${pFilterKey} and clause ${pClauseKey}.`);
			return;
		}
		tmpClause = JSON.parse(JSON.stringify(tmpClause));
		tmpClause.Hash = `${pFilterKey}-${pClauseKey}-${this.pict.getUUID()}`;
		tmpClause.Label = tmpClause.Label || tmpClause.DisplayName;
		const tmpClauses = this.getFilterClauses();
		tmpClauses.push(tmpClause);
	}

	/**
	 */
	clearFilterClauses()
	{
		const tmpClauses = this.pict.Bundle._ActiveFilterState?.[this.options.RecordSet]?.FilterClauses;
		if (!Array.isArray(tmpClauses))
		{
			return;
		}
		tmpClauses.length = 0; // Clear the array
	}

	/**
	 * @param {string} pSpecificFilterClauseHash - The hash of the specific filter clause to remove.
	 */
	removeFilterClause(pSpecificFilterClauseHash)
	{
		const tmpClauses = this.pict.Bundle._ActiveFilterState?.[this.options.RecordSet]?.FilterClauses;
		if (!Array.isArray(tmpClauses))
		{
			this.pict.log.error('RecordSetProviderBase.removeFilterClause() - No filter clauses found.');
			return;
		}
		const tmpClauseIndex = tmpClauses.findIndex((c) => pSpecificFilterClauseHash == c.Hash);
		if (tmpClauseIndex < 0)
		{
			this.pict.log.error(`RecordSetProviderBase.removeFilterClause() - Filter clause with hash ${pSpecificFilterClauseHash} not found.`);
			return;
		}
		tmpClauses.splice(tmpClauseIndex, 1);
	}

	/**
	 * @return {Array<Record<string, any>>} The filter clauses.
	 */
	getFilterClauses()
	{
		let tmpClauses = this.pict.Bundle._ActiveFilterState?.[this.options.RecordSet]?.FilterClauses;
		if (!Array.isArray(tmpClauses))
		{
			tmpClauses = [];
			this.pict.Bundle._ActiveFilterState = this.pict.Bundle._ActiveFilterState || {};
			this.pict.Bundle._ActiveFilterState[this.options.RecordSet] = this.pict.Bundle._ActiveFilterState[this.options.RecordSet] || {};
			this.pict.Bundle._ActiveFilterState[this.options.RecordSet].FilterClauses = tmpClauses;
		}
		return tmpClauses;
	}

	// --- Quick Filters -----------------------------------------------------------------------------
	// A curated, one-interaction set of filters surfaced at the top of the drawer (fuzzy-search Title,
	// Created range, Created-by, …) so common filtering skips the "Add filter → pick field → pick type"
	// hunt. Each quick filter reuses a real clause descriptor from the field's AvailableClauses; its live
	// clause lives in the same FilterClauses array (tagged `QuickFilter:true`, keyed by `QuickFilterKey`)
	// so it serializes / applies / clears like any other clause — the drawer's clause list just skips it.

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
	getQuickFilterDefinitions(pAllowCleverDefaults)
	{
		const tmpConfig = this.options.QuickFilters;
		if (tmpConfig === false) { return []; }
		let tmpEntries;
		if (Array.isArray(tmpConfig)) { tmpEntries = tmpConfig; }
		else if (pAllowCleverDefaults === false) { tmpEntries = []; }
		else { tmpEntries = this._deriveDefaultQuickFilters(); }
		const tmpDefinitions = [];
		for (let i = 0; i < tmpEntries.length; i++)
		{
			const tmpEntry = (typeof tmpEntries[i] === 'string') ? { Field: tmpEntries[i] } : (tmpEntries[i] || {});
			const tmpDefinition = this._resolveQuickFilterDefinition(tmpEntry);
			if (tmpDefinition) { tmpDefinitions.push(tmpDefinition); }
		}
		return tmpDefinitions;
	}

	/**
	 * Clever defaults (zero config): the common things people filter on, detected by canonical Meadow
	 * column names on the fetched schema. Primary text (Title→Name), the audit date ranges, the audit
	 * user references. Absent `_Schema` (non-Meadow provider) → no defaults.
	 *
	 * @return {Array<{Field:string, Label?:string}>}
	 */
	_deriveDefaultQuickFilters()
	{
		const tmpProperties = (this._Schema && this._Schema.properties) || null;
		if (!tmpProperties) { return []; }
		const fHas = (pField) => Object.prototype.hasOwnProperty.call(tmpProperties, pField);
		const tmpDefaults = [];
		// `RequireControl` pins a default to its intended control: a "Created" default is only useful as
		// a date range, a "Created by" only as an entity picker. If the field can't offer that (e.g. a
		// schema that types its dates as plain strings), the default is dropped rather than degrading to
		// an odd text-search-a-timestamp. Host-configured QuickFilters carry no RequireControl, so they
		// take whatever clause the field offers.
		if (fHas('Title')) { tmpDefaults.push({ Field: 'Title' }); }
		else if (fHas('Name')) { tmpDefaults.push({ Field: 'Name' }); }
		if (fHas('CreateDate')) { tmpDefaults.push({ Field: 'CreateDate', Label: 'Created', RequireControl: 'daterange' }); }
		if (fHas('UpdateDate')) { tmpDefaults.push({ Field: 'UpdateDate', Label: 'Updated', RequireControl: 'daterange' }); }
		if (fHas('CreatingIDUser')) { tmpDefaults.push({ Field: 'CreatingIDUser', Label: 'Created by', RequireControl: 'entity' }); }
		if (fHas('UpdatingIDUser')) { tmpDefaults.push({ Field: 'UpdatingIDUser', Label: 'Updated by', RequireControl: 'entity' }); }
		return tmpDefaults;
	}

	/**
	 * Resolve one quick-filter config entry to a renderable definition: pick the clause (explicit
	 * `ClauseKey`, else the best for a quick filter) from the field's AvailableClauses + classify it to a
	 * control type. Returns null when the field has no usable clause.
	 *
	 * @param {Record<string, any>} pEntry @return {{Field:string, Label:string, Control:string, ClauseKey:string}|null}
	 */
	_resolveQuickFilterDefinition(pEntry)
	{
		if (!pEntry || !pEntry.Field) { return null; }
		const tmpFieldSchema = this.getFilterClauseSchemaForKey(pEntry.Field);
		const tmpAvailableClauses = tmpFieldSchema && Array.isArray(tmpFieldSchema.AvailableClauses) ? tmpFieldSchema.AvailableClauses : null;
		if (!tmpAvailableClauses || tmpAvailableClauses.length < 1) { return null; }
		const tmpClause = pEntry.ClauseKey
			? tmpAvailableClauses.find((pClause) => pClause.ClauseKey === pEntry.ClauseKey)
			: this._pickQuickClause(tmpAvailableClauses);
		if (!tmpClause) { return null; }
		const tmpControl = this._controlForClauseType(tmpClause.Type);
		if (!tmpControl) { return null; }
		// A default that demands a specific control (e.g. date range) is dropped when the field can't offer it.
		if (pEntry.RequireControl && tmpControl !== pEntry.RequireControl) { return null; }
		return {
			Field: pEntry.Field,
			Label: pEntry.Label || tmpFieldSchema.DisplayName || pEntry.Field,
			Control: tmpControl,
			ClauseKey: tmpClause.ClauseKey,
		};
	}

	/**
	 * Choose the clause a quick filter should drive for a field: an entity selected-value, else a fuzzy
	 * string match, else a range — i.e. the simplest one-interaction clause the field offers.
	 *
	 * @param {Array<Record<string, any>>} pAvailableClauses @return {Record<string, any>|undefined}
	 */
	_pickQuickClause(pAvailableClauses)
	{
		return pAvailableClauses.find((pClause) => pClause.Type === 'InternalJoinSelectedValue' || pClause.Type === 'InternalJoinSelectedValueList')
			|| pAvailableClauses.find((pClause) => pClause.Type === 'StringMatch' && pClause.ExactMatch === false)
			|| pAvailableClauses.find((pClause) => pClause.Type === 'DateRange')
			|| pAvailableClauses.find((pClause) => pClause.Type === 'NumericRange')
			|| pAvailableClauses[0];
	}

	/**
	 * Map a clause Type to the quick-bar control that drives it.
	 * @param {string} pType @return {string|null}
	 */
	_controlForClauseType(pType)
	{
		switch (pType)
		{
			case 'StringMatch': return 'text';
			case 'DateRange': return 'daterange';
			case 'InternalJoinSelectedValue':
			case 'InternalJoinSelectedValueList': return 'entity';
			default: return null;
		}
	}

	/**
	 * The entity's soft-delete column name. Subclasses with schema access override this
	 * (the Meadow provider resolves the column whose Type is 'Deleted').
	 * @return {string}
	 */
	getDeletedField()
	{
		return 'Deleted';
	}

	/** @return {boolean} Whether the show-deleted clause is currently active for this record set. */
	getShowDeletedFilterValue()
	{
		return this.getFilterClauses().some((pClause) => pClause.ShowDeletedKey === 'ShowDeleted');
	}

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
	setShowDeletedFilterValue(pOn)
	{
		const tmpClauses = this.getFilterClauses();
		const tmpIndex = tmpClauses.findIndex((pClause) => pClause.ShowDeletedKey === 'ShowDeleted');
		if (pOn === true)
		{
			if (tmpIndex < 0)
			{
				tmpClauses.push(
					{
						Type: 'RawFilter',
						ShowDeletedKey: 'ShowDeleted',
						Label: 'Show deleted',
						Value: `FBL~${this.getDeletedField()}~INN~0,1`,
					});
			}
			return true;
		}
		if (tmpIndex >= 0)
		{
			tmpClauses.splice(tmpIndex, 1);
		}
		return false;
	}

	/** @param {string} pField @return {any} The current value of a field's quick-filter clause, or ''. */
	getQuickFilterClauseValue(pField)
	{
		const tmpClause = this.getFilterClauses().find((pClause) => pClause.QuickFilterKey === `Quick-${pField}`);
		return tmpClause ? tmpClause.Value : '';
	}

	/**
	 * Upsert (or, when the value is empty, remove) a field's quick-filter clause with a scalar value.
	 * Creates the clause from the field's descriptor on first use, tagged so it renders in the quick bar
	 * and serializes/applies like any clause.
	 *
	 * @param {string} pField @param {string} pClauseKey @param {any} pValue
	 */
	upsertQuickFilterClauseValue(pField, pClauseKey, pValue)
	{
		const tmpClauses = this.getFilterClauses();
		const tmpQuickFilterKey = `Quick-${pField}`;
		const tmpExistingIndex = tmpClauses.findIndex((pClause) => pClause.QuickFilterKey === tmpQuickFilterKey);
		const tmpEmpty = (pValue === undefined || pValue === null || pValue === '');
		if (tmpEmpty)
		{
			if (tmpExistingIndex >= 0) { tmpClauses.splice(tmpExistingIndex, 1); }
			return;
		}
		if (tmpExistingIndex >= 0)
		{
			tmpClauses[tmpExistingIndex].Value = pValue;
			return;
		}
		const tmpClause = this._createQuickFilterClause(pField, pClauseKey, tmpQuickFilterKey);
		if (!tmpClause) { return; }
		tmpClause.Value = pValue;
		tmpClauses.push(tmpClause);
	}

	/** @param {string} pField @return {{Start:any, End:any}} The current DateRange quick-filter bounds. */
	getQuickFilterDateRangeValue(pField)
	{
		const tmpClause = this.getFilterClauses().find((pClause) => pClause.QuickFilterKey === `Quick-${pField}`);
		const tmpValues = (tmpClause && tmpClause.Values && typeof tmpClause.Values === 'object' && !Array.isArray(tmpClause.Values)) ? tmpClause.Values : {};
		return { Start: tmpValues.Start || '', End: tmpValues.End || '' };
	}

	/**
	 * Set one bound of a field's DateRange quick-filter clause (create on first use, remove when BOTH
	 * bounds are empty). Bounds live at `clause.Values.Start` / `.End` (the DateRange contract).
	 *
	 * @param {string} pField @param {string} pClauseKey @param {'start'|'end'} pWhich @param {any} pValue
	 */
	upsertQuickFilterDateRange(pField, pClauseKey, pWhich, pValue)
	{
		const tmpClauses = this.getFilterClauses();
		const tmpQuickFilterKey = `Quick-${pField}`;
		let tmpClause = tmpClauses.find((pClause) => pClause.QuickFilterKey === tmpQuickFilterKey);
		const tmpValue = (pValue === undefined || pValue === null) ? '' : pValue;
		if (!tmpClause)
		{
			if (tmpValue === '') { return; }
			tmpClause = this._createQuickFilterClause(pField, pClauseKey, tmpQuickFilterKey);
			if (!tmpClause) { return; }
			tmpClause.Values = {};
			tmpClauses.push(tmpClause);
		}
		if (!tmpClause.Values || typeof tmpClause.Values !== 'object' || Array.isArray(tmpClause.Values)) { tmpClause.Values = {}; }
		if (pWhich === 'start') { tmpClause.Values.Start = tmpValue; }
		else { tmpClause.Values.End = tmpValue; }
		const fEmpty = (pVal) => (pVal === undefined || pVal === null || pVal === '');
		if (fEmpty(tmpClause.Values.Start) && fEmpty(tmpClause.Values.End))
		{
			const tmpIndex = tmpClauses.findIndex((pClause) => pClause.QuickFilterKey === tmpQuickFilterKey);
			if (tmpIndex >= 0) { tmpClauses.splice(tmpIndex, 1); }
		}
	}

	/** @param {string} pField @return {Array<any>} The current entity quick-filter selected value(s). */
	getQuickFilterEntityValue(pField)
	{
		const tmpClause = this.getFilterClauses().find((pClause) => pClause.QuickFilterKey === `Quick-${pField}`);
		return (tmpClause && Array.isArray(tmpClause.Values)) ? tmpClause.Values : [];
	}

	/**
	 * Set a field's entity quick-filter clause to the picked value(s) (create on first use, remove when
	 * empty). Selected ids live at `clause.Values` (the entity-reference contract).
	 *
	 * @param {string} pField @param {string} pClauseKey @param {any} pValue scalar or array
	 */
	upsertQuickFilterEntity(pField, pClauseKey, pValue)
	{
		const tmpClauses = this.getFilterClauses();
		const tmpQuickFilterKey = `Quick-${pField}`;
		const tmpArray = (Array.isArray(pValue) ? pValue : ((pValue === undefined || pValue === null || pValue === '') ? [] : [ pValue ]))
			.filter((pVal) => pVal !== undefined && pVal !== null && pVal !== '');
		const tmpIndex = tmpClauses.findIndex((pClause) => pClause.QuickFilterKey === tmpQuickFilterKey);
		if (tmpArray.length === 0)
		{
			if (tmpIndex >= 0) { tmpClauses.splice(tmpIndex, 1); }
			return;
		}
		if (tmpIndex >= 0) { tmpClauses[tmpIndex].Values = tmpArray; return; }
		const tmpClause = this._createQuickFilterClause(pField, pClauseKey, tmpQuickFilterKey);
		if (!tmpClause) { return; }
		tmpClause.Values = tmpArray;
		tmpClauses.push(tmpClause);
	}

	/**
	 * Clone a field's clause descriptor into a fresh, tagged quick-filter clause (no value set yet), or
	 * null when the descriptor is missing. Shared by the text / date / entity upserts.
	 *
	 * @param {string} pField @param {string} pClauseKey @param {string} pQuickFilterKey
	 * @return {Record<string, any>|null}
	 */
	_createQuickFilterClause(pField, pClauseKey, pQuickFilterKey)
	{
		const tmpDescriptor = this.getFilterClauseSchemaForKey(pField)?.AvailableClauses?.find?.((pClause) => pClause.ClauseKey === pClauseKey);
		if (!tmpDescriptor)
		{
			this.pict.log.error(`RecordSetProviderBase quick filter: no clause schema for field ${pField} / clause ${pClauseKey}.`);
			return null;
		}
		const tmpClause = JSON.parse(JSON.stringify(tmpDescriptor));
		tmpClause.Hash = `${pField}-${pClauseKey}-${this.pict.getUUID()}`;
		tmpClause.Label = tmpClause.Label || tmpClause.DisplayName;
		tmpClause.QuickFilter = true;
		tmpClause.QuickFilterKey = pQuickFilterKey;
		return tmpClause;
	}

	/**
	 * @param {string} pSpecificFilterClauseHash - The hash of the specific filter clause to move.
	 * @param {number} pOrdinal - The ordinal position to move the filter clause to.
	 */
	moveFilterClauseTo(pSpecificFilterClauseHash, pOrdinal)
	{
		const tmpClauses = this.pict.Bundle._ActiveFilterState?.[this.options.RecordSet]?.FilterClauses;
		if (!Array.isArray(tmpClauses))
		{
			this.pict.log.error('RecordSetProviderBase.moveFilterClauseTo() - No filter clauses found.');
			return;
		}
		if (pOrdinal < 0 || pOrdinal >= tmpClauses.length)
		{
			this.pict.log.error(`RecordSetProviderBase.moveFilterClauseTo() - Invalid ordinal ${pOrdinal}.`);
			return;
		}
		const tmpClauseIndex = tmpClauses.indexOf((c) => pSpecificFilterClauseHash == c.Hash);
		if (tmpClauseIndex < 0)
		{
			this.pict.log.error(`RecordSetProviderBase.moveFilterClauseTo() - Filter clause with hash ${pSpecificFilterClauseHash} not found.`);
			return;
		}
		const tmpClause = tmpClauses.splice(tmpClauseIndex, 1)[0];
		tmpClauses.splice(pOrdinal, 0, tmpClause);
	}

	/**
	 * @param {string} pSpecificFilterClauseHash - The hash of the specific filter clause to move.
	 * @param {number} pOrdinalOffset - The ordinal offset to move the filter clause by.
	 */
	moveFilterClauseBy(pSpecificFilterClauseHash, pOrdinalOffset)
	{
		const tmpClauses = this.pict.Bundle._ActiveFilterState?.[this.options.RecordSet]?.FilterClauses;
		if (!Array.isArray(tmpClauses))
		{
			this.pict.log.error('RecordSetProviderBase.moveFilterClauseBy() - No filter clauses found.');
			return;
		}
		const tmpClauseIndex = tmpClauses.indexOf((c) => pSpecificFilterClauseHash == c.Hash);
		if (tmpClauseIndex < 0)
		{
			this.pict.log.error(`RecordSetProviderBase.moveFilterClauseBy() - Filter clause with hash ${pSpecificFilterClauseHash} not found.`);
			return;
		}
		const tmpNewOrdinal = tmpClauseIndex + pOrdinalOffset;
		if (tmpNewOrdinal < 0 || tmpNewOrdinal >= tmpClauses.length)
		{
			this.pict.log.error(`RecordSetProviderBase.moveFilterClauseBy() - Invalid new ordinal ${tmpNewOrdinal} (offset of ${pOrdinalOffset} for original ordinal ${tmpClauseIndex}).`);
			return;
		}
		const tmpClause = tmpClauses.splice(tmpClauseIndex, 1)[0];
		tmpClauses.splice(tmpNewOrdinal, 0, tmpClause);
	}
}

module.exports = RecordSetProviderBase;
module.exports.default_configuration = _DefaultProviderConfiguration;
