
const libRecordSetProviderBase = require('./RecordSet-RecordProvider-Base.js');

/**
 * @typedef {import('./RecordSet-RecordProvider-Base.js').RecordSetFilter} RecordSetFilter
 * @typedef {import('./RecordSet-RecordProvider-Base.js').RecordSetResult} RecordSetResult
 */

/**
 * Class representing a data change detection provider for Pict dynamic forms.
 * @extends libRecordSetProviderBase
 */
class MeadowEndpointsRecordSetProvider extends libRecordSetProviderBase
{
	/**
	 * Creates an instance of RecordSetProvider.
	 * @param {import('pict')} pFable - The Fable object.
	 * @param {Record<string, any>} [pOptions] - Custom options for the provider.
	 * @param {string} [pServiceHash] - The service hash.
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		/** @type {Record<string, any>} */
		this.options;
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
		this.pict;
		this.fable = this.pict;
		/** @type {string} */
		this.Hash;
		/** @type {string} */
		this.UUID;
		//TODO: make this typedef better
		/** @type {Record<string, any>} */
		this._Schema;
		/** @type {Record<string, Record<string, any>>} */
		this._Experiences = { };
		/** @type {Record<string, Record<string, any>>} */
		this._FiltersByField = { };
	}

	/** @return {import('pict/types/source/Pict-Meadow-EntityProvider.js')} */
	get entityProvider()
	{
		if (!this._EntityProvider)
		{
			/** @type {import('pict/types/source/Pict-Meadow-EntityProvider.js')} */
			//TODO: figure out a pattern to share this with other consumers, to consolidate cache
			this._EntityProvider = this.pict.instantiateServiceProviderWithoutRegistration('EntityProvider');
			if (this.options.URLPrefix)
			{
				this._EntityProvider.options.urlPrefix = this.options.URLPrefix;
			}
		}

		return this._EntityProvider;
	}

	/**
	 * Fetch (and cache) the DISTINCT values of a column present in this recordset's data, via
	 * Meadow's `<Entity>s/Distinct/<Column>` endpoint. Drives the `ScopeToRecordSet` filter knob
	 * (an entity picker limited to `FBL~<Column>~INN~<these values>`) and the
	 * `DistinctSelectedValueList` filter type (a dropdown whose options ARE these values).
	 * Cached per column; the cache is cleared on create/update/delete through this provider.
	 *
	 * @param {string} pColumn
	 * @param {{ Filter?: string } | ((pError: Error|null, pValues: Array<any>) => void)} [pOptions] - Optional; `Filter` is a FoxHound stanza appended as `/FilteredTo/<Filter>` on the distinct query.
	 * @param {(pError: Error|null, pValues: Array<any>) => void} [fCallback]
	 */
	getRecordSetColumnDistinct(pColumn, pOptions, fCallback)
	{
		// Back-compat: (pColumn, fCallback)
		let tmpOptions = pOptions;
		let tmpCallback = fCallback;
		if (typeof tmpOptions === 'function')
		{
			tmpCallback = tmpOptions;
			tmpOptions = {};
		}
		tmpOptions = tmpOptions || {};
		// Unfiltered fetches keep the bare-column key (synchronous peeks elsewhere read it);
		// filtered fetches get their own key so the two never cross-pollinate.
		const tmpCacheKey = tmpOptions.Filter ? `${pColumn}::${tmpOptions.Filter}` : pColumn;
		this._scopeDistinctCache = this._scopeDistinctCache || {};
		if (Array.isArray(this._scopeDistinctCache[tmpCacheKey]))
		{
			return tmpCallback(null, this._scopeDistinctCache[tmpCacheKey]);
		}
		if (!this.options.Entity || !this.entityProvider || !this.entityProvider.restClient)
		{
			return tmpCallback(new Error('RecordSet provider cannot resolve a distinct request (missing Entity or rest client).'), []);
		}
		const tmpURL = `${this.options.URLPrefix || ''}${this.options.Entity}s/Distinct/${pColumn}${tmpOptions.Filter ? `/FilteredTo/${tmpOptions.Filter}` : ''}`;
		const tmpEntityProvider = this.entityProvider;
		const fHandleDistinctResult = (pError, pResponse, pBody) =>
		{
			if (pError || (pResponse && pResponse.statusCode > 299) || !Array.isArray(pBody))
			{
				this.pict.log.warn(`RecordSet [${this.options.RecordSet || this.options.Entity}] distinct fetch for [${pColumn}] failed; the scoped filter falls back to unscoped.`, { Error: pError && pError.message, URL: tmpURL });
				this._scopeDistinctCache[tmpCacheKey] = [];
				return tmpCallback(pError || new Error('distinct fetch returned a non-array'), []);
			}
			const tmpValues = [ ...new Set(pBody.map((pRecord) => pRecord && pRecord[pColumn]).filter((pValue) => pValue != null)) ];
			this._scopeDistinctCache[tmpCacheKey] = tmpValues;
			return tmpCallback(null, tmpValues);
		};
		// Route through POST /:Entity/Query (Distinct mode) when the endpoint
		// supports it — a long /FilteredTo/ stanza on the Distinct GET is the same
		// URI-length hazard the Query route exists to sidestep. Falls back to GET.
		const fResolveSupport = (typeof tmpEntityProvider.resolveEntityQuerySupport === 'function')
			? tmpEntityProvider.resolveEntityQuerySupport.bind(tmpEntityProvider)
			: (pEntity, pPrefix, fCb) => { return fCb(null, false); };
		fResolveSupport(this.options.Entity, this.options.URLPrefix, (pSupportError, pSupportsQuery) =>
		{
			if (pSupportsQuery)
			{
				const tmpBody = { Distinct: true, Columns: pColumn };
				if (tmpOptions.Filter)
				{
					// The Filter is URL-encoded by contract — it is interpolated verbatim into the
					// GET /FilteredTo/ path segment, which the server URL-decodes. A JSON body is not
					// URL-decoded, so decode it here to keep the POST semantics identical to the GET.
					let tmpFilter = tmpOptions.Filter;
					try
					{
						tmpFilter = decodeURIComponent(tmpOptions.Filter);
					}
					catch (pDecodeError)
					{
						this.pict.log.warn(`RecordSet [${this.options.RecordSet || this.options.Entity}] could not URL-decode the distinct filter for the Query body; sending it verbatim.`, { Error: pDecodeError && pDecodeError.message, Filter: tmpOptions.Filter });
					}
					tmpBody.Filter = tmpFilter;
				}
				return tmpEntityProvider.restClient.postJSON({ url: `${this.options.URLPrefix || ''}${this.options.Entity}s/Query`, body: tmpBody }, fHandleDistinctResult);
			}
			return tmpEntityProvider.restClient.getJSON(tmpURL, fHandleDistinctResult);
		});
	}

	/**
	 * @return {Array<string>} - The fields to ignore for filter availability.
	 */
	get ignoreFilterFields()
	{
		if (Array.isArray(this.options.IgnoreFilterFields))
		{
			return this.options.IgnoreFilterFields;
		}
		return [];
	}

	/**
	 * Get a record by its ID or GUID.
	 *
	 * @param {string|number} pIDOrGuid - The ID or GUID of the record.
	 */
	async getRecord(pIDOrGuid)
	{
		if (!this.options.Entity)
		{
			throw new Error('Entity is not defined in the provider options.');
		}
		// FIXME: The GUIDS are returning false to isNaN so this doesn't work
		if (typeof pIDOrGuid === 'string' && isNaN(parseInt(pIDOrGuid)))
		{
			return this.getRecordByGUID(pIDOrGuid);
		}
		if (this.pict.LogNoisiness > 1)
		{
			this.pict.log.info(`Reading ${this.options.Entity} record by ID`, { ID: pIDOrGuid });
		}
		return new Promise((resolve, reject) =>
		{
			this.entityProvider.getEntity(this.options.Entity, pIDOrGuid, (pError, pResult) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				resolve(pResult);
			});
		});
	}

	getGUIDField()
	{ 
		if (this._Schema?.MeadowSchema?.Schema?.length)
		{
			for (let field of this._Schema.MeadowSchema.Schema)
			{
				if (field.Type == 'AutoGUID')
				{
					return field.Column;
				}
			}
		}
		return `GUID${ this.options.Entity }`;
	}

	getIDField()
	{
		if (this._Schema?.MeadowSchema?.Schema?.length)
		{
			for (let field of this._Schema.MeadowSchema.Schema)
			{
				if (field.Type == 'AutoIdentity')
				{
					return field.Column;
				}
			}
		}
		return `ID${ this.options.Entity }`;
	}

	getDeletedField()
	{
		if (this._Schema?.MeadowSchema?.Schema?.length)
		{
			for (let field of this._Schema.MeadowSchema.Schema)
			{
				if (field.Type == 'Deleted')
				{
					return field.Column;
				}
			}
		}
		return 'Deleted';
	}

	/**
	 * Get a record by its ID or GUID.
	 *
	 * @param {string|number} pGuid - The ID or GUID of the record.
	 * @param {boolean} [pIncludeDeleted] - When true, also match soft-deleted records (the explicit
	 *                                      Deleted filter suppresses the automatic `Deleted = 0`).
	 */
	async getRecordByGUID(pGuid, pIncludeDeleted)
	{
		if (!this.options.Entity)
		{
			throw new Error('Entity is not defined in the provider options.');
		}
		if (this.pict.LogNoisiness > 1)
		{
			this.pict.log.info(`Reading ${this.options.Entity} record by GUID`, { GUID: pGuid });
		}
		let tmpFilterString = `FBV~${ this.getGUIDField() }~EQ~${encodeURIComponent(pGuid)}`;
		if (pIncludeDeleted === true)
		{
			tmpFilterString += `~FBL~${ this.getDeletedField() }~INN~0,1`;
		}
		return new Promise((resolve, reject) =>
		{
			this.entityProvider.getEntitySet(this.options.Entity, tmpFilterString, (pError, pResult) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				if (pResult.length > 1)
				{
					this.pict.log.error(`Multiple ${this.options.Entity} records found for GUID ${pGuid}`, { Records: pResult });
				}
				resolve(pResult[0]);
			});
		});
	}

	_prepareFilterState(pEntity, pOptions, pFilterExperienceResultAddress = 'Records')
	{
		const tmpClauses = [].concat(this.pict.Bundle._ActiveFilterState?.[pOptions.RecordSet || pOptions.Entity || this.options.Entity]?.FilterClauses || []);
		const tmpExperience = Object.assign({}, this.pict.Bundle._ActiveFilterState?.[pOptions.Entity || this.options.Entity]?.Experience || {});
		if (!tmpExperience.ResultDestinationAddress)
		{
			tmpExperience.ResultDestinationAddress = `Bundle._ActiveFilterState[\`${this.options.RecordSet}\`].${pFilterExperienceResultAddress}`;
		}
		if (!tmpExperience.Entity)
		{
			tmpExperience.Entity = pEntity;
		}
		if (pOptions.FilterString && typeof pOptions.FilterString === 'string' && pOptions.FilterString.trim().length > 0)
		{
			tmpClauses.push({ Type: 'RawFilter', Value: pOptions.FilterString });
		}
		// (The show-deleted switch needs no special handling here: it is a real RawFilter clause in
		// the active filter state — see setShowDeletedFilterValue on the base provider — so it rides
		// the FilterClauses concat above into both the records and count fetches.)
		return [ tmpClauses, tmpExperience ];
	}

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
	_deriveLiteExtraColumns(pEntity, pOptions)
	{
		const tmpConfig = pOptions && pOptions.RecordSetConfiguration;
		let tmpDescriptors = null;
		if (tmpConfig && this.pict.PictSectionRecordSet && this.pict.PictSectionRecordSet.manifestDefinitions)
		{
			const tmpManifestHash = tmpConfig.RecordSetListDefaultManifest || (Array.isArray(tmpConfig.RecordSetListManifests) ? tmpConfig.RecordSetListManifests[0] : null);
			const tmpManifest = tmpManifestHash ? this.pict.PictSectionRecordSet.manifestDefinitions[tmpManifestHash] : null;
			tmpDescriptors = (tmpManifest && tmpManifest.Descriptors) || null;
		}
		const tmpSchemaColumns = (this._Schema && this._Schema.MeadowSchema && Array.isArray(this._Schema.MeadowSchema.Schema)) ? this._Schema.MeadowSchema.Schema : [];
		if (!tmpDescriptors || tmpSchemaColumns.length < 1)
		{
			return [];
		}
		const tmpColumnType = {};
		for (const tmpColumn of tmpSchemaColumns)
		{
			if (tmpColumn && tmpColumn.Column)
			{
				tmpColumnType[tmpColumn.Column] = tmpColumn.Type;
			}
		}
		const tmpBlobTypes = { 'Text': true, 'JSON': true };
		const tmpColumns = [];
		for (const tmpKey of Object.keys(tmpDescriptors))
		{
			// ID*/GUID*/owner/update come back in every Lite record for free.
			if (tmpKey.startsWith('ID') || tmpKey.startsWith('GUID') || tmpKey === 'CreatingIDUser' || tmpKey === 'UpdateDate')
			{
				continue;
			}
			// Only request real, non-blob columns (a computed/templated manifest column
			// that is not a DB column would otherwise error the query).
			if (!(tmpKey in tmpColumnType) || tmpBlobTypes[tmpColumnType[tmpKey]])
			{
				continue;
			}
			if (!tmpColumns.includes(tmpKey))
			{
				tmpColumns.push(tmpKey);
			}
		}
		// Column chooser: union in user-shown schema-tier columns so a toggled-on column's data is
		// actually fetched. Same gauntlet as the descriptors; gated on the config flag so stale
		// stored overrides can never widen queries for lists that don't use the chooser.
		if (tmpConfig && tmpConfig.RecordSetListColumnChooser === true && this.pict.providers.ColumnDataProvider)
		{
			const tmpRecordSet = (pOptions && pOptions.RecordSet) || tmpConfig.RecordSet || pEntity;
			const tmpOverrides = this.pict.providers.ColumnDataProvider.getColumnVisibilityOverrides(tmpRecordSet, 'List');
			for (const tmpKey of Object.keys(tmpOverrides))
			{
				if (tmpOverrides[tmpKey] !== true)
				{
					continue;
				}
				if (tmpKey.startsWith('ID') || tmpKey.startsWith('GUID') || tmpKey === 'CreatingIDUser' || tmpKey === 'UpdateDate')
				{
					continue;
				}
				if (!(tmpKey in tmpColumnType) || tmpBlobTypes[tmpColumnType[tmpKey]])
				{
					continue;
				}
				if (!tmpColumns.includes(tmpKey))
				{
					tmpColumns.push(tmpKey);
				}
			}
		}
		return tmpColumns;
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {RecordSetFilter} pOptions - Options for the read operation.
	 * @return {Promise<RecordSetResult>} - The result of the read operation.
	 */
	async getRecords(pOptions)
	{
		if (!this.options.Entity && !pOptions.Entity)
		{
			throw new Error('Entity is not defined in the provider options.');
		}
		const tmpEntity = pOptions.Entity || this.options.Entity;

		// Lite projection (opt-in via RecordSetListLiteFetch): request only the columns
		// the manifest displays so the list stops pulling blob columns (FormData, etc.).
		// Lite (partial) records are NOT written to the entity cache (see getEntitySetPage) —
		// the list renders them straight from state — so they can never poison the global
		// cache that full-record consumers (row-click View, {~E:~}) rely on. The list's
		// reference entities (Project/User) are full records and stay in the global cache,
		// batched reliably by the connected-entity prefetch + the stale-read prune fix.
		const tmpLiteFetch = (this.options.RecordSetListLiteFetch === true) || !!(pOptions && pOptions.RecordSetConfiguration && pOptions.RecordSetConfiguration.RecordSetListLiteFetch);
		let tmpProjection = null;
		if (tmpLiteFetch)
		{
			// Ensure the entity schema is loaded so we only request real, non-blob columns.
			if (!this._Schema)
			{
				await this.getRecordSchema();
			}
			const tmpExtraColumns = this._deriveLiteExtraColumns(tmpEntity, pOptions);
			if (tmpExtraColumns.length > 0)
			{
				tmpProjection = { Mode: 'LiteExtended', ExtraColumns: tmpExtraColumns };
			}
		}

		if (this.pict.LogNoisiness > 1)
		{
			this.pict.log.info(`Reading ${tmpEntity} records`, { Options: pOptions });
		}
		return new Promise((resolve, reject) =>
		{
			const [ tmpClauses, tmpExperience ] = this._prepareFilterState(tmpEntity, pOptions);
			if (tmpProjection)
			{
				tmpExperience.Projection = tmpProjection;
			}
			if (this.options.FilterEndpointOverride)
			{
				// Call the filtering endpoint with the clauses and experience.
				this.entityProvider.restClient.postJSON({
					url: `${ this.options.URLPrefix }${ this.options.FilterEndpointOverride }/${ pOptions.Offset || 0 }/${ pOptions.PageSize || 250 }`,
					body: { Clauses: tmpClauses, Experience: tmpExperience },
				}, (pError, response, result) =>
				{
					if (pError)
					{
						return reject(pError);
					}
					this.fable.manifest.setValueByHash(this.pict, tmpExperience.ResultDestinationAddress, result);
					const recordsReturn = result;
					const IDFields = ['CreatingIDUser', 'UpdatingIDUser'];
					if (recordsReturn.length)
					{
						for (const k of Object.keys(recordsReturn[0]))
						{
							if (k.startsWith('ID') && k !== `ID${ tmpEntity }`)
							{
								IDFields.push(k);
							}
						}
					}
					this.pict.EntityProvider.cacheConnectedEntityRecordsWithoutCount(recordsReturn, IDFields, ['User', 'User'], false, () =>
					{
						resolve({ Records: recordsReturn, Facets: { } });
					});
				});
				return;
			}
			this.pict.providers.FilterManager.loadRecordPageByFilterUsingProvider(this.entityProvider, tmpClauses, tmpExperience, pOptions.Offset || 0, pOptions.PageSize || 250, (pError) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				const recordsReturn = this.pict.resolveStateFromAddress(tmpExperience.ResultDestinationAddress);
				const IDFields = ['CreatingIDUser', 'UpdatingIDUser'];
				if (recordsReturn.length)
				{
					for (const k of Object.keys(recordsReturn[0]))
					{
						if (k.startsWith('ID') && k !== `ID${ tmpEntity }`)
						{
							IDFields.push(k);
						}
					}
				}
				// Use the NoCount (lazy-page) batch: counts are very costly in this MySQL,
				// and the count-based variant serializes one slow COUNT per reference entity,
				// stalling the queue so later entities (e.g. Project) never batch and fall
				// back to per-row fetches. NoCount fetches each batch in one paged request
				// with real concurrency (maxOperations).
				this.pict.EntityProvider.cacheConnectedEntityRecordsWithoutCount(recordsReturn, IDFields, ['User', 'User'], false, () =>
				{
					resolve({ Records: recordsReturn, Facets: { } });
				});
			});
			// using a space here, otherwise you get a `//` in the URL which breaks some stuff
		});
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
		return this.getRecords({ FilterString: pFilterString, Offset: pOffset, PageSize: pPageSize });
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {RecordSetFilter} pOptions - Options for the read operation.
	 */
	async getRecordSetCount(pOptions)
	{
		if (!this.options.Entity && !pOptions.Entity)
		{
			throw new Error('Entity is not defined in the provider options.');
		}
		const tmpEntity = pOptions.Entity || this.options.Entity;
		if (this.pict.LogNoisiness > 1)
		{
			this.pict.log.info(`Counting ${tmpEntity} records`, { Options: pOptions });
		}
		//TODO: lite support / other variants?
		return new Promise((resolve, reject) =>
		{
			const [ tmpClauses, tmpExperience ] = this._prepareFilterState(tmpEntity, pOptions, 'Count');
			// The record count is identical for every page of the same filter, yet the list re-counts on each
			// pagination click. A COUNT is expensive on some database engines, so cache it keyed by the compiled
			// filter signature: same filter -> serve the cached count (no request); changed filter -> re-count.
			// Mutations through this provider clear the cache (see createRecord / updateRecord / deleteRecord).
			const tmpCountCacheKey = `${ tmpEntity }::${ JSON.stringify(tmpClauses) }`;
			if (this._RecordSetCountCache && this._RecordSetCountCache.Key === tmpCountCacheKey)
			{
				// Publish the cached count to the result address so downstream consumers behave identically to a fetch.
				this.fable.manifest.setValueByHash(this.pict, tmpExperience.ResultDestinationAddress, this._RecordSetCountCache.Count);
				return resolve({ Count: this._RecordSetCountCache.Count });
			}
			if (this.options.FilterEndpointOverride)
			{
				// Call the filtering endpoint with the clauses and experience.
				this.entityProvider.restClient.postJSON({
					url: `${ this.options.URLPrefix }${ this.options.FilterEndpointOverride }/Count`,
					body: { Clauses: tmpClauses, Experience: tmpExperience },
				}, (error, response, result) =>
				{
					if (error)
					{
						return reject(error);
					}
					const tmpCount = result?.Count || 0;
					this.fable.manifest.setValueByHash(this.pict, tmpExperience.ResultDestinationAddress, tmpCount);
					this._RecordSetCountCache = { Key: tmpCountCacheKey, Count: tmpCount };
					resolve(result);
				});
				return;
			}
			this.pict.providers.FilterManager.countRecordsByFilterUsingProivider(this.entityProvider, tmpClauses, tmpExperience, (pError) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				const tmpCount = this.pict.resolveStateFromAddress(tmpExperience.ResultDestinationAddress);
				this._RecordSetCountCache = { Key: tmpCountCacheKey, Count: tmpCount };
				resolve({ Count: tmpCount });
			});
		});
	}

	/**
	 * Create a new record.
	 *
	 * @param {Record<string, any>} pRecord - The record to create.
	 */
	async createRecord(pRecord)
	{
		return new Promise((resolve, reject) =>
		{
			if (this.pict.LogNoisiness > 1)
			{
				this.pict.log.info(`Creating record ${this.options.Entity}`, { Record: pRecord });
			}
			this.entityProvider.restClient.postJSON({
				url: `${this.options.URLPrefix}${this.options.Entity}`,
				body: pRecord,
			}, (error, response, result) =>
			{
				if (error)
				{
					return reject(error);
				}
				// A new record changes the total; drop the cached count so the next render re-counts.
				this._RecordSetCountCache = null;
				// Mutations can introduce/retire column values; drop the distinct cache so
				// ScopeToRecordSet scoping and DistinctSelectedValueList dropdowns refresh.
				this._scopeDistinctCache = null;
				// Drop this list's scoped cache too, so the next render re-fetches fresh.
				if (typeof this.pict.EntityProvider.clearScope === 'function')
				{
					this.pict.EntityProvider.clearScope(`RSList::${ this.options.RecordSet || this.options.Entity }`);
				}
				resolve(result);
			});
		});
	}

	/**
	 * Update a record.
	 *
	 * @param {Record<string, any>} pRecord - The record to update.
	 */
	async updateRecord(pRecord)
	{
		if (this.pict.LogNoisiness > 1)
		{
			this.pict.log.info(`Updating record ${this.options.Entity} ${pRecord[this.getIDField()]}`);
		}
		return new Promise((resolve, reject) =>
		{
			this.entityProvider.restClient.putJSON({
				url: `${this.options.URLPrefix}${this.options.Entity}`,
				body: pRecord,
			}, (error, response, result) =>
			{
				if (error)
				{
					return reject(error);
				}
				// An edit can move a record in or out of the active filter; drop the cached count to be safe.
				this._RecordSetCountCache = null;
				// Mutations can introduce/retire column values; drop the distinct cache so
				// ScopeToRecordSet scoping and DistinctSelectedValueList dropdowns refresh.
				this._scopeDistinctCache = null;
				// Drop this list's scoped cache too, so the next render re-fetches fresh.
				if (typeof this.pict.EntityProvider.clearScope === 'function')
				{
					this.pict.EntityProvider.clearScope(`RSList::${ this.options.RecordSet || this.options.Entity }`);
				}
				resolve(result);
			});
		});
	}

	/**
	 * Delete a record.
	 *
	 * @param {Record<string, any>} pRecord - The record to delete.
	 */
	async deleteRecord(pRecord)
	{
		if (this.pict.LogNoisiness > 1)
		{
			this.pict.log.info(`Deleting record ${this.options.Entity} ${pRecord[this.getIDField()]}`);
		}
		return new Promise((resolve, reject) =>
		{
			this.entityProvider.restClient.delJSON({
				url: `${this.options.URLPrefix}${this.options.Entity}/${pRecord[this.getIDField()]}`,
				body: pRecord,
			}, (error, response, result) =>
			{
				if (error)
				{
					return reject(error);
				}
				// A delete changes the total; drop the cached count so the next render re-counts.
				this._RecordSetCountCache = null;
				// Mutations can introduce/retire column values; drop the distinct cache so
				// ScopeToRecordSet scoping and DistinctSelectedValueList dropdowns refresh.
				this._scopeDistinctCache = null;
				// Drop this list's scoped cache too, so the next render re-fetches fresh.
				if (typeof this.pict.EntityProvider.clearScope === 'function')
				{
					this.pict.EntityProvider.clearScope(`RSList::${ this.options.RecordSet || this.options.Entity }`);
				}
				resolve(result);
			});
		});
	}

	/**
	 * Read a record.
	 *
	 * @param {string|number} pIDOrGuid - The ID or GUID of the record.
	 */
	async readRecord(pIDOrGuid)
	{
		return this.getRecord(pIDOrGuid);
	}

	/**
	 * Read records from the provider.
	 *
	 * @param {RecordSetFilter} pOptions - Options for the read operation.
	 * @return {Promise<RecordSetResult>} - The result of the read operation.
	 */
	async readRecords(pOptions)
	{
		return this.getRecords(pOptions);
	}

	/**
	 * Clone a record.
	 *
	 * @param {Record<string, any>} pRecord - The record to clone.
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
		delete pRecord[this.getIDField()];
		delete pRecord[this.getGUIDField()];
		return pRecord;
	}

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
	getEntityListEntryTemplate(pEntityName)
	{
		// Register the User branching fall-backs once. addTemplate is idempotent (keyed by hash), so the
		// guard is just to avoid the churn of re-registering on every descriptor build.
		if (!this._entityListEntryTemplatesRegistered)
		{
			this._entityListEntryTemplatesRegistered = true;
			// Name fallback: when NameFull is empty, compose it from the parts.
			this.pict.TemplateProvider.addTemplate('RSP-EntityListEntry-User-NameParts', '{~D:Record.NameFirst~} {~D:Record.NameLast~}');
			// Disambiguator fallback: when Email is empty, use the LoginID.
			this.pict.TemplateProvider.addTemplate('RSP-EntityListEntry-User-Login', '{~D:Record.LoginID~}');
		}

		switch (pEntityName)
		{
			case 'User':
				// "<name> (<email>)" — name is NameFull, else NameFirst+NameLast; the parenthetical is Email,
				// else LoginID. Stable across the three name-field variations and unique enough to tell apart
				// many same-named users.
				return '{~DWTF:Record.NameFull:RSP-EntityListEntry-User-NameParts~} ({~DWTF:Record.Email:RSP-EntityListEntry-User-Login~})';
			default:
				return null;
		}
	}

	/**
	 * @param {string} pSchemaField - The schema field name.
	 * @param {Record<string, any>} pColumn - The full column definition from the schema.
	 * @param {Record<string, any>} [pMeadowSchemaField] - The meadow schema field definition.
	 */
	getFieldFilterClauses(pSchemaField, pColumn, pMeadowSchemaField)
	{
		/** @type {Record<string, any>} */
		let tmpRangeClause;
		let tmpFieldFilterClauses = this.options.FieldFilterClauses?.[pSchemaField];
		if (!Array.isArray(tmpFieldFilterClauses))
		{
			let tmpFieldType = pColumn.type;
			if (pMeadowSchemaField && typeof pMeadowSchemaField.Type === 'string')
			{
				tmpFieldType = pMeadowSchemaField.Type.toLowerCase();
			}
			tmpFieldFilterClauses = [];
			const tmpFieldHumanName = this.getHumanReadableFieldName(pSchemaField);
			const isUserAuditField = ['CreatingIDUser', 'DeletingIDUser', 'UpdatingIDUser'].includes(pSchemaField);
			const customFilterClauses = this.options.Filters?.[pSchemaField];
			// The entity's own identity column (AutoIdentity / AutoGUID) — i.e. the primary key.
			const isOwnIdentityField = pMeadowSchemaField && (pMeadowSchemaField.Type === 'AutoIdentity' || pMeadowSchemaField.Type === 'AutoGUID');
			const isForeignKeyLike = pSchemaField.startsWith('ID') || pSchemaField.startsWith('ParentID') || isUserAuditField || customFilterClauses;
			if (isForeignKeyLike)
			{
				for (const customField of Array.isArray(customFilterClauses) ? customFilterClauses : [customFilterClauses])
				{
					// The table the picker pulls from: an explicit RemoteTable, else this
					// recordset's declared Entity when the column is our own primary key (the PK
					// references our own records), else the name peeled from the column for a
					// plain foreign key. Peeling alone is the defect — a lake PK like
					// `IDC182_HMA_MixDesign` peels to a table name that is not the entity name.
					const remoteTableName = customField?.RemoteTable || (isOwnIdentityField ? this.options.Entity : pSchemaField.split('ID')[1]);
					const fieldName = this.getHumanReadableFieldName(pSchemaField);
					tmpFieldFilterClauses.push(Object.assign(
					{
						"Label": `${ fieldName }`,
						"Type": "InternalJoinSelectedValueList",
						"ExternalFilterByColumns": remoteTableName === 'User' ? [ 'NameFirst', 'NameLast', 'Email', 'LoginID' ] : [ 'Name' ],
						"ExternalRecordDisplayTemplate": remoteTableName === 'User' ? '{~D:Record.Data.NameFirst~} {~D:Record.Data.NameLast~}' : '{~D:Record.Name~}',
						// The picker's option/selected display: a per-entity "list entry" template (the seam that
						// will eventually live on the Stricture schema). Disambiguates beyond a single column.
						"EntityListEntryTemplate": this.getEntityListEntryTemplate(remoteTableName),
						"CoreConnectionColumn": pSchemaField,
						"RemoteTable": `${ remoteTableName }`,
						"URLPrefix": this.options.URLPrefix,
						"JoinExternalConnectionColumn": `ID${ remoteTableName }`,
						"JoinInternalConnectionColumn": pSchemaField,
						'DisplayName': `Selected Records`,
						'Ordinal': tmpFieldFilterClauses.length + 1,
						'FilterKey': pSchemaField,
						'ClauseKey': `${pSchemaField}_Selected`
					}, customField));
				}
			}
			// The primary key is also a plain integer key, so it ALSO falls through to the
			// Exact / In Range clauses below. A real foreign key gets only the picker; ordinary
			// columns are matched by type.
			if (!isForeignKeyLike || isOwnIdentityField)
			{
				switch (tmpFieldType)
				{
					case 'string':
					case 'autoguid':
						tmpFieldFilterClauses.push({ FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Match_Exact`, Label: `${tmpFieldHumanName} Exact Match`, DisplayName: `Exact Match`, Type: 'StringMatch', FilterByColumn: pSchemaField, ExactMatch: true, Ordinal: tmpFieldFilterClauses.length + 1 });
						tmpFieldFilterClauses.push({ FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Match_Fuzzy`, Label: `${tmpFieldHumanName} Partial Match`, DisplayName: `Partial Match`, Type: 'StringMatch', FilterByColumn: pSchemaField, ExactMatch: false , Ordinal: tmpFieldFilterClauses.length + 1 });
						tmpRangeClause = { FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Range`, Label: `${tmpFieldHumanName} In Range`, DisplayName: `In Range`, Type: 'StringRange', FilterByColumn: pSchemaField , Ordinal: tmpFieldFilterClauses.length + 1 };
						tmpRangeClause.MinimumLabel = `Minimum ${tmpFieldHumanName}`;
						tmpRangeClause.MaximumLabel = `Maximum ${tmpFieldHumanName}`;
						tmpFieldFilterClauses.push(tmpRangeClause);
						break;
					case 'date':
					case 'datetime':
					case 'createdate':
					case 'updatedate':
					case 'deletedate':
						tmpFieldFilterClauses.push({ FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Match_Exact`, Label: `${tmpFieldHumanName} Exact Match`, DisplayName: `Exact Match`, Type: 'DateMatch', FilterByColumn: pSchemaField, ExactMatch: true , Ordinal: tmpFieldFilterClauses.length + 1 });
						tmpFieldFilterClauses.push({ FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Match_Fuzzy`, Label: `${tmpFieldHumanName} Partial Match`, DisplayName: `Partial Match`, Type: 'DateMatch', FilterByColumn: pSchemaField, ExactMatch: false , Ordinal: tmpFieldFilterClauses.length + 1 });
						tmpRangeClause = { FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Range`, Label: `${tmpFieldHumanName} In Range`, DisplayName: `In Range`, Type: 'DateRange', FilterByColumn: pSchemaField , Ordinal: tmpFieldFilterClauses.length + 1 };
						tmpRangeClause.MinimumLabel = `Minimum ${tmpFieldHumanName}`;
						tmpRangeClause.MaximumLabel = `Maximum ${tmpFieldHumanName}`;
						tmpFieldFilterClauses.push(tmpRangeClause);
						break;
					case 'boolean': //TODO: we didn't add filters for this - they are just numeric but it's weird for the user, maybe we should add views for this that account for the difference
					case 'deleted':
					case 'integer':
					case 'decimal':
					case 'autoidentity':
					case 'createiduser':
					case 'updateiduser':
					case 'deleteiduser':
						tmpFieldFilterClauses.push({ FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Match_Exact`, Label: `${tmpFieldHumanName} Exact Match`, DisplayName: `Exact Match`, Type: 'NumericMatch', FilterByColumn: pSchemaField, ExactMatch: true , Ordinal: tmpFieldFilterClauses.length + 1 });
						tmpFieldFilterClauses.push({ FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Match_Fuzzy`, Label: `${tmpFieldHumanName} Partial Match`, DisplayName: `Partial Match`, Type: 'NumericMatch', FilterByColumn: pSchemaField, ExactMatch: false , Ordinal: tmpFieldFilterClauses.length + 1 });
						tmpRangeClause = { FilterKey: pSchemaField, ClauseKey: `${pSchemaField}_Range`, Label: `${tmpFieldHumanName} In Range`, DisplayName: `In Range`, Type: 'NumericRange', FilterByColumn: pSchemaField , Ordinal: tmpFieldFilterClauses.length + 1 };
						tmpRangeClause.MinimumLabel = `Minimum ${tmpFieldHumanName}`;
						tmpRangeClause.MaximumLabel = `Maximum ${tmpFieldHumanName}`;
						tmpFieldFilterClauses.push(tmpRangeClause);
						break;
					default:
						this.pict.log.warn(`Unsupported field type ${pColumn.type} for field ${pSchemaField}`, { Schema: pColumn });
				}
			}
		}
		return tmpFieldFilterClauses;
	}

	/**
	 * @param {(error?: Error) => void} fCallback - The callback function.
	 */
	onInitializeAsync(fCallback)
	{
		super.onInitializeAsync((pError) =>
		{
			//FIXME: load the most recent experience from local storage using the other provider
			//       how do we control the initialization order of the providers?
			if (this.options.FilterExperiences && typeof this.options.FilterExperiences === 'object' && !Array.isArray(this.options.FilterExperiences))
			{
				this.pict.Bundle._ActiveFilterState = this.pict.Bundle._ActiveFilterState || {};
				this.pict.Bundle._ActiveFilterState[this.options.RecordSet] = this.pict.Bundle._ActiveFilterState[this.options.RecordSet] || {};
				const tmpEntityFilterState = this.pict.Bundle._ActiveFilterState[this.options.RecordSet];
				tmpEntityFilterState.Experience = tmpEntityFilterState.Experience || {};
				for (const tmpKey of Object.keys(this.options.FilterExperiences))
				{
					const tmpExperience = this.options.FilterExperiences[tmpKey];
					if (!tmpExperience.FilterCriteriaHash && !Array.isArray(tmpExperience.FilterClauses))
					{
						this.log.warn(`Filter experience ${tmpKey} has invalid Criteria`, { Experience: tmpExperience });
						continue;
					}
					if (tmpExperience.FilterCriteriaHash)
					{
						// load from hash
						const tmpClauses = this.pict.providers.FilterManager.getFilterCriteria(tmpExperience.FilterCriteriaHash);
						if (!tmpClauses)
						{
							this.pict.log.warn(`Filter experience ${tmpKey} filter criteria hash ${tmpExperience.FilterCriteriaHash} not found`, { Experience: tmpExperience });
							continue;
						}
						//TODO: handle Ordinal / generate if missing
						this._Experiences[tmpKey] = JSON.parse(JSON.stringify(tmpExperience));
						this._Experiences[tmpKey].FilterClauses = JSON.parse(JSON.stringify(tmpClauses));
						for (const tmpClause of this._Experiences[tmpKey].FilterClauses)
						{
							tmpClause.FilterCriteriaHash = tmpExperience.FilterCriteriaHash;
							if (!tmpClause.FilterByColumn && !tmpClause.CoreConnectionColumn && !tmpClause.JoinInternalConnectionColumn)
							{
								this.log.warn(`Filter experience ${tmpKey} clause does not have filter by column configured`, { Clause: tmpClause });
								continue;
							}
							if (tmpClause.FilterDefinitionHash)
							{
								const tmpFilter = this.pict.providers.FilterManager.getFilter(tmpClause.FilterDefinitionHash);
								if (!tmpFilter)
								{
									this.pict.log.warn(`Filter experience ${tmpKey} filter criteria hash ${tmpClause.FilterDefinitionHash} not found`, { Experience: tmpExperience });
									continue;
								}
								Object.assign(tmpClause, tmpFilter); //TODO: is there a risk of leakage here?
								if (tmpClause.FilterByColumn && typeof tmpClause.Type === 'string')
								{
									if (tmpClause.Type.startsWith('InternalJoin'))
									{
										tmpClause.JoinInternalConnectionColumn = tmpClause.FilterByColumn;
									}
									else if (tmpClause.Type.startsWith('ExternalJoin'))
									{
										tmpClause.CoreConnectionColumn = tmpClause.FilterByColumn;
									}
								}
							}
						}
						if (tmpExperience.Default && !tmpEntityFilterState.FilterClauses)
						{
							tmpEntityFilterState.FilterClauses = JSON.parse(JSON.stringify(this._Experiences[tmpKey].FilterClauses));
							for (const tmpClause of tmpEntityFilterState.FilterClauses)
							{
								tmpClause.Hash = `${tmpClause.FilterByColumn}-${tmpClause.Type}-${this.pict.getUUID()}`;
							}
						}
						continue;
					}
					this._Experiences[tmpKey] = JSON.parse(JSON.stringify(tmpExperience));
					if (tmpExperience.Default && !tmpEntityFilterState.FilterClauses)
					{
						tmpEntityFilterState.FilterClauses = JSON.parse(JSON.stringify(tmpExperience.FilterClauses));
					}
				}
			}
			this.initializeEntitySchema(() =>
			{
				if (pError)
				{
					return fCallback(pError);
				}
				this.initializeFilterSchema();
				return fCallback();
			});
		});
	}

	/**
	 * @param {string} pEntity - The schema field name.
	 * @return {string} - The human-readable name for the entity.
	 */
	_getHumanReadableEntityName(pEntity)
	{
		return pEntity.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space before capital letters
	}

	/**
	 * @param {string} pSchemaField - The schema field name.
	 * @return {string} - The human-readable name for the schema field.
	 */
	getHumanReadableFieldName(pSchemaField)
	{
		if (!this._Schema || !this._Schema.properties || !this._Schema.properties[pSchemaField])
		{
			return pSchemaField;
		}
		if (pSchemaField === this.getIDField())
		{
			return `${this._getHumanReadableEntityName(this.options.Entity)} Unique Database ID`;
		}
		if (pSchemaField === this.getGUIDField())
		{
			return `${this._getHumanReadableEntityName(this.options.Entity)} Unique Identifier`;
		}
		if (pSchemaField === 'CreatingIDUser')
		{
			return 'Created By User';
		}
		if (pSchemaField === 'CreateDate')
		{
			return 'Date Created';
		}
		if (pSchemaField === 'UpdatingIDUser')
		{
			return 'Last Updated By User';
		}
		if (pSchemaField === 'UpdateDate')
		{
			return 'Date Last Updated';
		}
		if (pSchemaField.startsWith('ID'))
		{
			return this._getHumanReadableEntityName(pSchemaField.split('ID')[1]);
		}
		if (pSchemaField.startsWith('ParentID'))
		{
			return 'Parent ' + this._getHumanReadableEntityName(pSchemaField.split('ID')[1]);
		}
		return pSchemaField.replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
	}

	/**
	 * @param {(error?: Error) => void} fCallback - The callback function.
	 */
	initializeEntitySchema(fCallback)
	{
		this.fable.log.info('Initializing RecordSetProvider-MeadowEndpoints');
		const checkSession = this.pict.services.PictSectionRecordSet ? this.pict.services.PictSectionRecordSet.checkSession.bind(this.pict.services.PictSectionRecordSet) : async () => true;
		checkSession('Schema').then(async (supported) =>
		{
			if (!supported)
			{
				return fCallback();
			}
			this.entityProvider.restClient.getJSON(`${this.options.URLPrefix}${this.options.Entity}/Schema`, (error, response, result) =>
			{
				if (error)
				{
					this.fable.log.error(`Error fetching schema: ${error?.message || error}`, { Stack: error?.stack });
					this._Schema = null;
					return fCallback(error);
				}
				this._Schema = result;
				// The schema response carries the endpoint's version/capability
				// metadata; seed the entity provider's capability cache from it so
				// reads avoid a redundant capability probe.
				if (this.entityProvider && typeof this.entityProvider.primeEntityCapabilityFromSchema === 'function')
				{
					this.entityProvider.primeEntityCapabilityFromSchema(this.options.Entity, result, this.options.URLPrefix);
				}
				return fCallback(null);
			});
		}).catch((error) =>
		{
			this._Schema = null;
			this.fable.log.error('Error checking session for schema', error);
			return fCallback(error);
		});
	}

	initializeFilterSchema()
	{
		const tmpSchema = this._Schema;
		if (!tmpSchema || !tmpSchema.properties)
		{
			return;
		}
		const tmpProperties = tmpSchema?.properties;
		// loop through the schema and add the columns to the tableCells
		let tmpOrdinal = 0;
		for (const tmpSchemaField in tmpProperties)
		{
			if (this.ignoreFilterFields.includes(tmpSchemaField))
			{
				continue;
			}
			++tmpOrdinal;
			const tmpColumn = tmpProperties[tmpSchemaField];
			// The Meadow schema endpoint nests its canonical column array (the one carrying each column's
			// semantic Type — CreateDate/UpdateDate/CreateIDUser/… — which is what distinguishes a date
			// column from a plain string; the JSON-schema `type` flattens both to "string"). Read the
			// nested path, falling back to the legacy flat path for older endpoints.
			const tmpMeadowSchemaArray = tmpSchema.MeadowSchema?.MeadowSchema?.Schema || tmpSchema.MeadowSchema?.Schema;
			const tmpMeadowSchemaField = Array.isArray(tmpMeadowSchemaArray) ? tmpMeadowSchemaArray.find((f) => f.Column === tmpSchemaField) : undefined;
			let tmpFieldFilterSchema = this._FilterSchema[tmpSchemaField];
			if (!tmpFieldFilterSchema)
			{
				this._FilterSchema[tmpSchemaField] = tmpFieldFilterSchema = { };
			}
			if (!tmpFieldFilterSchema.FilterKey)
			{
				tmpFieldFilterSchema.FilterKey = tmpSchemaField;
			}
			if (!tmpFieldFilterSchema.RecordSet)
			{
				tmpFieldFilterSchema.RecordSet = this.options.RecordSet;
			}
			if (!tmpFieldFilterSchema.DisplayName)
			{
				tmpFieldFilterSchema.DisplayName = this.getHumanReadableFieldName(tmpSchemaField);
			}
			if (!tmpFieldFilterSchema.Description)
			{
				tmpFieldFilterSchema.Description = `Filter by ${tmpFieldFilterSchema.DisplayName}`;
			}
			if (!tmpFieldFilterSchema.HelpText)
			{
				tmpFieldFilterSchema.HelpText = `Filter by ${tmpFieldFilterSchema.DisplayName} for the ${this._getHumanReadableEntityName(this.options.Entity)} entity.`;
			}
			if (tmpFieldFilterSchema.Ordinal == null)
			{
				tmpFieldFilterSchema.Ordinal = tmpOrdinal;
			}
			if (!Array.isArray(tmpFieldFilterSchema.AvailableClauses))
			{
				tmpFieldFilterSchema.AvailableClauses = [];
			}
			const tmpFieldFilterClauses = this.getFieldFilterClauses(tmpSchemaField, tmpColumn, tmpMeadowSchemaField);
			if (Array.isArray(tmpFieldFilterClauses) && tmpFieldFilterClauses.length > 0)
			{
				for (const tmpFilterClause of tmpFieldFilterClauses)
				{
					//TODO: allow customization of filter order
					tmpFilterClause.Ordinal = tmpFieldFilterSchema.AvailableClauses.length + 1;
					tmpFieldFilterSchema.AvailableClauses.push(tmpFilterClause);
				}
			}
		}
		if (typeof this.pict.providers.FilterManager.filters === 'object')
		{
			for (const tmpFilterKey of Object.keys(this.pict.providers.FilterManager.filters))
			{
				const tmpFilterClause = this.pict.providers.FilterManager.filters[tmpFilterKey];
				// Two recognised host-declared filter shapes:
				//   (1) Foreign-key join — `CoreConnectionColumn` equals this recordset's
				//       PK (e.g. a Sample filter whose data flow joins on IDSample). Folded
				//       into `_FilterSchema[FilterKey]` for back-compat with the existing
				//       behaviour.
				//   (2) Plain column filter — declares `FilterByColumn` and wants to surface
				//       as the column's filter entry. Folded into
				//       `_FilterSchema[FilterByColumn]` so the Add Filter popover / Quick
				//       Filter resolver find it under the same slot the schema-derived
				//       entries use.
				// Optional per-recordset scoping: when the filter clause declares a
				// `RecordSet`, only fold into providers whose `options.RecordSet` matches.
				// Lets a host register the same `FilterByColumn` under different definitions
				// per dashboard without cross-pollination.
				if (tmpFilterClause.RecordSet && tmpFilterClause.RecordSet !== this.options.RecordSet)
				{
					continue;
				}
				const tmpIsCoreConnection = (tmpFilterClause.CoreConnectionColumn === this.getIDField());
				const tmpHasFilterByColumn = !!tmpFilterClause.FilterByColumn;
				if (!tmpIsCoreConnection && !tmpHasFilterByColumn)
				{
					continue;
				}
				const tmpSlotKey = tmpIsCoreConnection ? tmpFilterKey : tmpFilterClause.FilterByColumn;
				if (this.ignoreFilterFields.includes(tmpSlotKey))
				{
					continue;
				}
				let tmpFieldFilterSchema = this._FilterSchema[tmpSlotKey];
				if (!tmpFieldFilterSchema)
				{
					this._FilterSchema[tmpSlotKey] = tmpFieldFilterSchema = { };
				}
				if (!tmpFieldFilterSchema.FilterKey)
				{
					tmpFieldFilterSchema.FilterKey = tmpSlotKey;
				}
				if (!tmpFieldFilterSchema.RecordSet)
				{
					tmpFieldFilterSchema.RecordSet = this.options.RecordSet;
				}
				const tmpFieldHumanName = this.getHumanReadableFieldName(tmpSlotKey);
				if (tmpFilterClause.DisplayName)
				{
					tmpFieldFilterSchema.DisplayName = tmpFilterClause.DisplayName;
				}
				if (!tmpFieldFilterSchema.DisplayName)
				{
					tmpFieldFilterSchema.DisplayName = tmpFieldHumanName;
				}
				if (!tmpFieldFilterSchema.Description)
				{
					tmpFieldFilterSchema.Description = tmpFilterClause.Description || `Filter by ${tmpFieldFilterSchema.DisplayName}`;
				}
				if (!tmpFieldFilterSchema.HelpText)
				{
					tmpFieldFilterSchema.HelpText = tmpFilterClause.HelpText || `Filter by ${tmpFieldFilterSchema.DisplayName} for the ${this._getHumanReadableEntityName(this.options.Entity)} entity.`;
				}
				if (tmpFieldFilterSchema.Ordinal == null)
				{
					tmpFieldFilterSchema.Ordinal = tmpOrdinal;
				}
				if (!Array.isArray(tmpFieldFilterSchema.AvailableClauses))
				{
					tmpFieldFilterSchema.AvailableClauses = [];
				}
				tmpFieldFilterSchema.AvailableClauses.push(tmpFilterClause.ClauseName ? Object.assign(tmpFilterClause, { DisplayName: tmpFilterClause.ClauseName }) : tmpFilterClause);
				if (!tmpFilterClause.FilterKey)
				{
					tmpFilterClause.FilterKey = tmpSlotKey;
				}
				if (!tmpFilterClause.ClauseKey)
				{
					tmpFilterClause.ClauseKey = tmpFilterKey;
				}
				if (!tmpFilterClause.DisplayName)
				{
					tmpFilterClause.DisplayName = tmpFieldHumanName;
				}
				tmpFilterClause.Ordinal = tmpFieldFilterSchema.AvailableClauses.length + 1;
			}
		}
	}

	/**
	 * @return {Promise<Record<string, any>>} The schema of the record.
	 */
	async getRecordSchema()
	{
		if (!this._Schema)
		{
			await new Promise((resolve, reject) => this.initializeEntitySchema((pError) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				this.initializeFilterSchema();
				resolve();
			}));
		}
		return this._Schema;
	}

	/**
	 * Abstract decoration method for core records. Subclasses should implement this method to decorate records with additional information.
	 *
	 * @param {Array<Record<string, any>>} pRecords - The records to decorate.
	 * @return {Promise<void>}
	 */
	async decorateCoreRecords(pRecords)
	{
		if (!this.options.RecordDecorationConfiguration)
		{
			return;
		}
		if (!Array.isArray(this.options.RecordDecorationConfiguration))
		{
			this.pict.log.error('RecordDecorationConfiguration is not an array', { RecordDecorationConfiguration: this.options.RecordDecorationConfiguration });
			return;
		}
		this.pict.Bundle[this.Hash] = { CoreEntityRecordSubset: pRecords };
		const config = [{ Type: 'SetStateAddress', StateAddress: `Bundle[${this.Hash}]` }].concat(this.options.RecordDecorationConfiguration);

		try
		{
			await new Promise((resolve, reject) => this.pict.EntityProvider.gatherDataFromServer(config, (err) =>
			{
				if (err)
				{
					return reject(err);
				}
				resolve();
			}));
		}
		catch (error)
		{
			this.pict.log.error(`MeadowEndpointsRecordSetProvider: Error gathering data from server for record decoration: ${error.message}`, { Stack: error.stack });
		}
	}
}

module.exports = MeadowEndpointsRecordSetProvider;
