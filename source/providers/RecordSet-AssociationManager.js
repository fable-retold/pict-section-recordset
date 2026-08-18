const libPictProvider = require('pict-provider');

/** @type {Record<string, any>} */
const _DEFAULT_PROVIDER_CONFIGURATION =
{
	ProviderIdentifier: 'Pict-RecordSet-AssociationManager',

	AutoInitialize: true,
	AutoInitializeOrdinal: 0
};

/**
 * Central registry + data layer for joined-entity ASSOCIATIONS (the `XxxYyyJoin` convention: a join
 * row carrying its own `ID<Join>` plus an `ID<X>` and an `ID<Y>` pointing at either side).
 *
 * One `Association` is defined ONCE, symmetrically, with a `SideA` and a `SideB`. The UI (the
 * read-tab Association Editor and the Bulk Associate screen) resolves which side is "this side" by
 * matching the rendering recordset's name against the two sides — so opting Book→Authors and
 * Author→Books in are independent, light-config decisions.
 *
 * All join + display reads/writes go through the shared, cached `pict.EntityProvider` (the same one
 * the picker uses), so there is no bespoke REST plumbing and lookups de-duplicate across the app.
 */
class PictRecordSetAssociationManager extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_PROVIDER_CONFIGURATION, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		/** @type {Record<string, any>} */
		this.options;
		/** @type {import('pict')} */
		this.pict;

		/** @type {Record<string, Record<string, any>>} - Registered associations keyed by hash. */
		this.associations = {};

		/** @type {Record<string, any>} - Lazily-created EntityProviders scoped to a non-default URL prefix. */
		this._scopedEntityProviders = {};

		/** @type {string} - EntityProvider cache scope for join-list reads; cleared on every join write so
		 * the editor and pickers never show a stale (cached) association list after an add or remove. */
		this._cacheScope = 'RecordSetAssociation';
	}

	/**
	 * Invalidate the cached join-list reads after a write so the next list reflects it immediately
	 * (pict's EntityProvider caches getEntitySet by filter for ~10s; clearScope no-ops on the default
	 * empty scope, which is why join reads run under a dedicated scope).
	 * @param {Record<string, any>} pEntityProvider - the (scoped) EntityProvider used for the join.
	 */
	_clearAssociationCache(pEntityProvider)
	{
		try
		{
			if (pEntityProvider && (typeof pEntityProvider.clearScope === 'function'))
			{
				pEntityProvider.clearScope(this._cacheScope);
			}
		}
		catch (pError)
		{
			this.pict.log.warn(`AssociationManager: association cache clear failed: ${pError.message || pError}`);
		}
	}

	/**
	 * Normalize one side definition, filling the light-config defaults: `Entity` falls back to
	 * `RecordSet`, `IDField` to `ID<Entity>`, `DisplayField` to `Name`, `SearchFields` to
	 * `[DisplayField]`, and `Sort` to `DisplayField`.
	 *
	 * @param {Record<string, any>} pSide
	 * @return {Record<string, any>}
	 */
	_normalizeSide(pSide)
	{
		const tmpSide = pSide || {};
		const tmpEntity = tmpSide.Entity || tmpSide.RecordSet;
		const tmpDisplayField = tmpSide.DisplayField || 'Name';
		const tmpIDField = tmpSide.IDField || `ID${tmpEntity}`;
		return {
			RecordSet: tmpSide.RecordSet || tmpEntity,
			Entity: tmpEntity,
			// The field on THIS SIDE's record that identifies it for association purposes — the picker
			// value, the display lookup key, and (by default) the value stored in the join. Usually the
			// primary key (`ID<Entity>`), but can be any unique field (e.g. ObservationManifest is keyed
			// by 'Name' on its join, so its side is { IDField: 'Name' }).
			IDField: tmpIDField,
			// The column on the JOIN ENTITY that references this side. Defaults to IDField — the common
			// case where the join column has the same name as the side's id field. Set it when the join
			// names this side differently: ProjectObservationManifestJoin stores the manifest by
			// 'ObservationManifestName', so the manifest side is { IDField: 'Name', JoinField: 'ObservationManifestName' }.
			JoinField: tmpSide.JoinField || tmpIDField,
			DisplayField: tmpDisplayField,
			SearchFields: (Array.isArray(tmpSide.SearchFields) && tmpSide.SearchFields.length > 0) ? tmpSide.SearchFields : [ tmpDisplayField ],
			// No default sort: alphabetical-by-display sorts empty values first (blank rows). The picker's
			// natural (PK) order is predictable; a host can opt into a Sort column explicitly.
			Sort: tmpSide.Sort || false,
			Title: tmpSide.Title || false,
			URLPrefix: tmpSide.URLPrefix || '',
			// Extra fields rendered as disambiguation chips in the picker (and the editor list), e.g.
			// ['ISBN'] or [{ Field: 'PublicationYear', Label: 'Year' }]. Passed to the picker as EntityTags.
			ChipFields: Array.isArray(tmpSide.ChipFields) ? tmpSide.ChipFields : [],
			// Pin-to-top: value-ids (or a `(context) => ids | Promise<ids>` resolver) for THIS side's records
			// to float to the top of the add-picker's first browse page. Forwarded to the picker as
			// PriorityValues; a function form receives the anchor context (which record is being associated to)
			// so a host can pin a runtime-derived record — e.g. an Organization side pinning the anchor line
			// item's project Prime Contractor. Only meaningful on the OTHER (picked) side.
			PriorityValues: tmpSide.PriorityValues || false,
			// Columns for the matrix screen's record table — for picking complex records by several fields.
			TableColumns: this._normalizeColumns(tmpSide.TableColumns, tmpDisplayField),
		};
	}

	/**
	 * Normalize a side's TableColumns into `{ Key, DisplayName, Template? }` entries (string shorthand →
	 * `{ Key, DisplayName: Key }`). Defaults to a single column on the DisplayField when unset.
	 *
	 * @param {Array<string|Record<string, any>>|undefined} pColumns @param {string} pDisplayField
	 * @return {Array<Record<string, any>>}
	 */
	_normalizeColumns(pColumns, pDisplayField)
	{
		if (!Array.isArray(pColumns) || pColumns.length < 1)
		{
			return [ { Key: pDisplayField, DisplayName: pDisplayField } ];
		}
		return pColumns.map((pColumn) =>
		{
			if (typeof pColumn === 'string') { return { Key: pColumn, DisplayName: pColumn, DefaultHidden: false }; }
			return { Key: pColumn.Key, DisplayName: pColumn.DisplayName || pColumn.Key, Template: pColumn.Template || false, DefaultHidden: (pColumn.DefaultHidden === true) };
		});
	}

	/**
	 * Build a FoxHound LIKE filter for a search term across one or more fields (single → AND, multiple →
	 * OR'd in a paren group), mirroring the picker's entity search. Used by the matrix table fetch.
	 *
	 * @param {Array<string>} pSearchFields @param {string} pTerm
	 * @return {string}
	 */
	_buildSearchFilter(pSearchFields, pTerm)
	{
		const tmpEncoded = encodeURIComponent(`%${pTerm}%`);
		if (pSearchFields.length === 1)
		{
			return `FBV~${pSearchFields[0]}~LK~${tmpEncoded}`;
		}
		const tmpInner = pSearchFields.map((pField, pIndex) => `${pIndex === 0 ? 'FBV' : 'FBVOR'}~${pField}~LK~${tmpEncoded}`).join('~');
		return `FOP~0~(~0~${tmpInner}~FCP~0~)~0`;
	}

	/**
	 * URL-encode each value and comma-join, for `INN`/`NIN` filter lists. Numeric ids pass through; this
	 * keeps string keys (e.g. manifest names with spaces) intact when a side is keyed by a name column.
	 * @param {Array<string|number>} pValues
	 * @return {string}
	 */
	_encodeList(pValues)
	{
		return (Array.isArray(pValues) ? pValues : []).map((pValue) => encodeURIComponent(pValue)).join(',');
	}

	/**
	 * Fetch one page of a side's records for the matrix table (search across its SearchFields + optional
	 * Sort, offset/limit paging). Returns the raw records + a `hasMore` flag.
	 *
	 * @param {string} pAssociationHash @param {string} pRecordSetName
	 * @param {string} pSearch @param {number} pCursor @param {number} pPageSize
	 * @return {Promise<{records: Array<Record<string, any>>, hasMore: boolean}>}
	 */
	fetchSidePage(pAssociationHash, pRecordSetName, pSearch, pCursor, pPageSize)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pRecordSetName);
		if (!tmpSides)
		{
			return Promise.resolve({ records: [], hasMore: false });
		}
		const tmpSide = tmpSides.thisSide;
		const tmpEntityProvider = this._entityProvider(tmpSide.URLPrefix);
		const tmpStanzas = [];
		if (pSearch) { tmpStanzas.push(this._buildSearchFilter(tmpSide.SearchFields, pSearch)); }
		if (tmpSide.Sort) { tmpStanzas.push(`FSF~${tmpSide.Sort}~ASC~0`); }
		const tmpFilter = tmpStanzas.filter(Boolean).join('~');
		return new Promise((resolve) =>
		{
			tmpEntityProvider.getEntitySetPage(tmpSide.Entity, tmpFilter, pCursor, pPageSize, (pError, pRecords) =>
			{
				const tmpList = (!pError && Array.isArray(pRecords)) ? pRecords : [];
				if (pError) { this.pict.log.warn(`AssociationManager: matrix fetch failed for ${tmpSide.Entity}.`, pError); }
				return resolve({ records: tmpList, hasMore: (tmpList.length >= pPageSize) });
			});
		});
	}

	/**
	 * Register (or replace) an association definition.
	 *
	 * @param {string} pHash - Unique association hash (the `Association` key hosts reference).
	 * @param {Record<string, any>} pDefinition - `{ JoinEntity, JoinURLPrefix?, DefaultJoinValues?, SideA, SideB }`.
	 * @return {Record<string, any>|false} The normalized association, or false on invalid input.
	 */
	addAssociation(pHash, pDefinition)
	{
		if (!pHash || !pDefinition || !pDefinition.JoinEntity || !pDefinition.SideA || !pDefinition.SideB)
		{
			this.pict.log.error(`AssociationManager: addAssociation called with invalid definition for [${pHash}].`, pDefinition);
			return false;
		}
		const tmpAssociation = {
			Hash: pHash,
			JoinEntity: pDefinition.JoinEntity,
			JoinURLPrefix: pDefinition.JoinURLPrefix || '',
			DefaultJoinValues: pDefinition.DefaultJoinValues || {},
			// Per-join config columns the editor renders as inline-editable on each association row — for
			// "rich" joins that carry settings (e.g. Journal/Spreadsheet/Ordinal). Each entry:
			// { Field, Label?, Type? ('checkbox'|'number'|'text'|'select'), Options?, Width? }.
			JoinEditableFields: Array.isArray(pDefinition.JoinEditableFields) ? pDefinition.JoinEditableFields : [],
			// The defaults lifecycle hook — the overridable seam the host implements. An async
			// `(context) => Array<{ value, joinValues? }>` returning the OTHER side's key values (+ optional
			// per-join config) to seed for an anchor record. PSRS owns APPLYING them (dedupe + createJoin),
			// so every association synthesizes defaults the same way; the host only decides what they are.
			SynthesizeDefaults: (typeof pDefinition.SynthesizeDefaults === 'function') ? pDefinition.SynthesizeDefaults : false,
			// Opt-in: auto-run synthesizeDefaults the first time the editor opens an anchor with zero joins.
			AutoSynthesizeWhenEmpty: (pDefinition.AutoSynthesizeWhenEmpty === true),
			SideA: this._normalizeSide(pDefinition.SideA),
			SideB: this._normalizeSide(pDefinition.SideB),
		};
		this.associations[pHash] = tmpAssociation;
		return tmpAssociation;
	}

	/**
	 * @param {string} pHash
	 * @return {Record<string, any>|undefined}
	 */
	getAssociation(pHash)
	{
		return this.associations[pHash];
	}

	/**
	 * The hashes of every registered association that has the given recordset on either side (matched by
	 * RecordSet or Entity, the same way resolveSides matches). Drives reassociation-on-delete: to reassign
	 * a record's relationships before deleting it, we need every many-to-many join it participates in.
	 *
	 * @param {string} pRecordSetName
	 * @return {Array<string>}
	 */
	getAssociationsForRecordSet(pRecordSetName)
	{
		const tmpHashes = [];
		for (const tmpHash of Object.keys(this.associations))
		{
			const tmpAssociation = this.associations[tmpHash];
			if (tmpAssociation.SideA.RecordSet === pRecordSetName || tmpAssociation.SideA.Entity === pRecordSetName
				|| tmpAssociation.SideB.RecordSet === pRecordSetName || tmpAssociation.SideB.Entity === pRecordSetName)
			{
				tmpHashes.push(tmpHash);
			}
		}
		return tmpHashes;
	}

	/**
	 * Resolve which side of an association is "this side" (the rendering recordset) vs the "other side"
	 * (the one being associated). Matches on `RecordSet` first, then `Entity`.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @return {{ association: Record<string, any>, thisSide: Record<string, any>, otherSide: Record<string, any> }|false}
	 */
	resolveSides(pAssociationHash, pThisRecordSetName)
	{
		const tmpAssociation = this.associations[pAssociationHash];
		if (!tmpAssociation)
		{
			this.pict.log.warn(`AssociationManager: no association registered for hash [${pAssociationHash}].`);
			return false;
		}
		if (tmpAssociation.SideA.RecordSet === pThisRecordSetName || tmpAssociation.SideA.Entity === pThisRecordSetName)
		{
			return { association: tmpAssociation, thisSide: tmpAssociation.SideA, otherSide: tmpAssociation.SideB };
		}
		if (tmpAssociation.SideB.RecordSet === pThisRecordSetName || tmpAssociation.SideB.Entity === pThisRecordSetName)
		{
			return { association: tmpAssociation, thisSide: tmpAssociation.SideB, otherSide: tmpAssociation.SideA };
		}
		this.pict.log.warn(`AssociationManager: recordset [${pThisRecordSetName}] is neither side of association [${pAssociationHash}].`);
		return false;
	}

	/**
	 * The EntityProvider to use for a given URL prefix. The shared (cached) `pict.EntityProvider` for the
	 * default prefix; a lazily-created, prefix-scoped instance otherwise (mirrors the recordset provider).
	 *
	 * @param {string} [pURLPrefix]
	 * @return {any}
	 */
	_entityProvider(pURLPrefix)
	{
		if (!pURLPrefix)
		{
			return this.pict.EntityProvider;
		}
		if (!this._scopedEntityProviders[pURLPrefix])
		{
			const tmpProvider = this.pict.instantiateServiceProviderWithoutRegistration('EntityProvider');
			tmpProvider.options.urlPrefix = pURLPrefix;
			this._scopedEntityProviders[pURLPrefix] = tmpProvider;
		}
		return this._scopedEntityProviders[pURLPrefix];
	}

	/**
	 * The join entity's identity column for an association (`ID<JoinEntity>`).
	 * @param {Record<string, any>} pAssociation
	 * @return {string}
	 */
	getJoinIDField(pAssociation)
	{
		return `ID${pAssociation.JoinEntity}`;
	}

	/**
	 * Compose a side's ChipFields into display chip strings for a record — the same `ISBN` / `{Field,
	 * Label, Template}` spec the picker's EntityTags uses, so the editor's current-associations list shows
	 * the same disambiguation chips as the add picker.
	 *
	 * @param {Array<string|Record<string, any>>} pChipFields
	 * @param {Record<string, any>} pRecord
	 * @return {Array<any>}
	 */
	composeChips(pChipFields, pRecord)
	{
		if (!Array.isArray(pChipFields) || pChipFields.length < 1 || !pRecord)
		{
			return [];
		}
		return pChipFields
			.map((pSpec) =>
			{
				if (typeof pSpec === 'string') { return pRecord[pSpec]; }
				if (pSpec && typeof pSpec === 'object')
				{
					const tmpValue = pSpec.Template ? this.pict.parseTemplate(pSpec.Template, pRecord) : pRecord[pSpec.Field];
					if (tmpValue === undefined || tmpValue === null || tmpValue === '') { return ''; }
					return pSpec.Label ? `${pSpec.Label}: ${tmpValue}` : tmpValue;
				}
				return '';
			})
			.filter((pChip) => (pChip !== undefined && pChip !== null && pChip !== ''));
	}

	/**
	 * Fetch the raw join rows for one anchor record (this side's id).
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @param {string|number} pThisID
	 * @return {Promise<Array<Record<string, any>>>}
	 */
	listJoinRecords(pAssociationHash, pThisRecordSetName, pThisID)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides || pThisID === undefined || pThisID === null || pThisID === '')
		{
			return Promise.resolve([]);
		}
		const tmpEntityProvider = this._entityProvider(tmpSides.association.JoinURLPrefix);
		const tmpFilter = `FBV~${tmpSides.thisSide.JoinField}~EQ~${encodeURIComponent(pThisID)}`;
		return new Promise((resolve) =>
		{
			tmpEntityProvider.getEntitySet(tmpSides.association.JoinEntity, tmpFilter, (pError, pRecords) =>
			{
				if (pError)
				{
					this.pict.log.warn(`AssociationManager: failed to list ${tmpSides.association.JoinEntity} for ${tmpSides.thisSide.IDField}=${pThisID}.`, pError);
					return resolve([]);
				}
				return resolve(Array.isArray(pRecords) ? pRecords : []);
			}, '', { Scope: this._cacheScope, NoCount: true });
		});
	}

	/**
	 * Fetch the join rows for MANY "this side" ids at once (`FBL~<thisIDField>~INN~<ids>`). Drives the
	 * dual-column matrix screen's existing-pair dedup, so cross-linking never creates duplicate joins.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @param {Array<string|number>} pThisIDs
	 * @return {Promise<Array<Record<string, any>>>}
	 */
	listJoinRecordsForIDs(pAssociationHash, pThisRecordSetName, pThisIDs)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides || !Array.isArray(pThisIDs) || pThisIDs.length < 1)
		{
			return Promise.resolve([]);
		}
		const tmpEntityProvider = this._entityProvider(tmpSides.association.JoinURLPrefix);
		const tmpFilter = `FBL~${tmpSides.thisSide.JoinField}~INN~${this._encodeList(pThisIDs)}`;
		return new Promise((resolve) =>
		{
			tmpEntityProvider.getEntitySet(tmpSides.association.JoinEntity, tmpFilter, (pError, pRecords) =>
			{
				if (pError)
				{
					this.pict.log.warn(`AssociationManager: failed to list ${tmpSides.association.JoinEntity} for ${tmpSides.thisSide.IDField} IN (${pThisIDs.join(',')}).`, pError);
					return resolve([]);
				}
				return resolve(Array.isArray(pRecords) ? pRecords : []);
			}, '', { Scope: this._cacheScope, NoCount: true });
		});
	}

	/**
	 * The other-side ids currently associated with one anchor record (for culling the picker).
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @param {string|number} pThisID
	 * @return {Promise<Array<any>>}
	 */
	/**
	 * Does this join row reference a real other-side record? An unset key (undefined / null / '') is
	 * not an association; nor is 0 / '0' on an id-keyed side, where 0 is never a real auto-increment id
	 * (Meadow ids start at 1). Some hosts park sentinel rows in the join table — e.g. a "default set"
	 * keyed by IDProject = 0 that a SynthesizeDefaults hook reads — and those must not surface as broken
	 * "#0" rows in the editor. The 0-guard is gated to id-keyed sides (JoinField === IDField) so a
	 * name-keyed side, where '0' could pathologically be a real key, is never affected.
	 *
	 * @param {Record<string, any>} pJoin - a join row.
	 * @param {Record<string, any>} pOtherSide - the resolved other side.
	 * @return {Boolean}
	 */
	_joinReferencesRealRecord(pJoin, pOtherSide)
	{
		const tmpValue = pJoin[pOtherSide.JoinField];
		if ((tmpValue === undefined) || (tmpValue === null) || (tmpValue === ''))
		{
			return false;
		}
		if ((pOtherSide.JoinField === pOtherSide.IDField) && ((tmpValue === 0) || (tmpValue === '0')))
		{
			return false;
		}
		return true;
	}

	async listAssociatedIDs(pAssociationHash, pThisRecordSetName, pThisID)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides)
		{
			return [];
		}
		const tmpJoins = await this.listJoinRecords(pAssociationHash, pThisRecordSetName, pThisID);
		return tmpJoins
			.filter((pJoin) => this._joinReferencesRealRecord(pJoin, tmpSides.otherSide))
			.map((pJoin) => pJoin[tmpSides.otherSide.JoinField]);
	}

	/**
	 * Resolve the other-side records currently associated with one anchor, decorated for the list UI:
	 * `{ JoinID, OtherID, Display, OtherRecord, JoinRecord }`. One join row per item (so the remove
	 * button can delete the exact join record), with the other-side display resolved in a single
	 * `FBL~<otherIDField>~INN~<ids>` fetch.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @param {string|number} pThisID
	 * @return {Promise<Array<Record<string, any>>>}
	 */
	async listAssociatedRecords(pAssociationHash, pThisRecordSetName, pThisID)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides)
		{
			return [];
		}
		const tmpJoinIDField = this.getJoinIDField(tmpSides.association);
		const tmpJoins = await this.listJoinRecords(pAssociationHash, pThisRecordSetName, pThisID);
		// Drop sentinel / unset rows (e.g. a "default set" keyed by other-side id 0) so they don't
		// surface as broken "#0" rows; everything downstream works off the real-association set.
		const tmpRealJoins = tmpJoins.filter((pJoin) => this._joinReferencesRealRecord(pJoin, tmpSides.otherSide));
		const tmpOtherIDs = tmpRealJoins.map((pJoin) => pJoin[tmpSides.otherSide.JoinField]);

		let tmpByID = {};
		if (tmpOtherIDs.length > 0)
		{
			const tmpEntityProvider = this._entityProvider(tmpSides.otherSide.URLPrefix);
			const tmpFilter = `FBL~${tmpSides.otherSide.IDField}~INN~${this._encodeList(tmpOtherIDs)}`;
			const tmpOthers = await new Promise((resolve) =>
			{
				tmpEntityProvider.getEntitySet(tmpSides.otherSide.Entity, tmpFilter, (pError, pRecords) =>
				{
					if (pError)
					{
						this.pict.log.warn(`AssociationManager: failed to resolve ${tmpSides.otherSide.Entity} display records.`, pError);
						return resolve([]);
					}
					return resolve(Array.isArray(pRecords) ? pRecords : []);
				});
			});
			for (let i = 0; i < tmpOthers.length; i++)
			{
				tmpByID[tmpOthers[i][tmpSides.otherSide.IDField]] = tmpOthers[i];
			}
		}

		return tmpRealJoins
			.map((pJoin) =>
			{
				const tmpOtherID = pJoin[tmpSides.otherSide.JoinField];
				const tmpOtherRecord = tmpByID[tmpOtherID] || {};
				const tmpDisplay = (tmpOtherRecord[tmpSides.otherSide.DisplayField] !== undefined && tmpOtherRecord[tmpSides.otherSide.DisplayField] !== null && tmpOtherRecord[tmpSides.otherSide.DisplayField] !== '')
					? tmpOtherRecord[tmpSides.otherSide.DisplayField]
					: `#${tmpOtherID}`;
				return {
					JoinID: pJoin[tmpJoinIDField],
					OtherID: tmpOtherID,
					Display: tmpDisplay,
					Chips: this.composeChips(tmpSides.otherSide.ChipFields, tmpOtherRecord).map((pChip) => ({ Text: pChip })),
					OtherRecord: tmpOtherRecord,
					JoinRecord: pJoin,
				};
			});
	}

	/**
	 * Create one join row linking an anchor record to an other-side record. Stamps any configured
	 * `DefaultJoinValues` (e.g. a constant tenant id). The join's GUID is auto-generated server-side.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @param {string|number} pThisID
	 * @param {string|number} pOtherID
	 * @param {Record<string, any>} [pJoinValues] - Optional extra columns to stamp on the join row (e.g.
	 *   per-association config like { Journal: 1, Ordinal: 3 } from a synthesized default).
	 * @return {Promise<Record<string, any>>}
	 */
	createJoin(pAssociationHash, pThisRecordSetName, pThisID, pOtherID, pJoinValues)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides)
		{
			return Promise.reject(new Error(`AssociationManager: cannot create join for [${pAssociationHash}] from [${pThisRecordSetName}].`));
		}
		const tmpRecord = Object.assign({}, tmpSides.association.DefaultJoinValues, pJoinValues || {});
		tmpRecord[tmpSides.thisSide.JoinField] = pThisID;
		tmpRecord[tmpSides.otherSide.JoinField] = pOtherID;
		const tmpEntityProvider = this._entityProvider(tmpSides.association.JoinURLPrefix);
		return new Promise((resolve, reject) =>
		{
			tmpEntityProvider.createEntity(tmpSides.association.JoinEntity, tmpRecord, (pError, pBody) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				this._clearAssociationCache(tmpEntityProvider);
				return resolve(pBody);
			});
		});
	}

	/**
	 * Delete one join row (the row a list item carries as `JoinRecord`, or any record with the join id).
	 *
	 * @param {string} pAssociationHash
	 * @param {Record<string, any>} pJoinRecord
	 * @return {Promise<Record<string, any>>}
	 */
	removeJoin(pAssociationHash, pJoinRecord)
	{
		const tmpAssociation = this.associations[pAssociationHash];
		if (!tmpAssociation || !pJoinRecord)
		{
			return Promise.reject(new Error(`AssociationManager: cannot remove join for [${pAssociationHash}].`));
		}
		const tmpJoinID = pJoinRecord[this.getJoinIDField(tmpAssociation)];
		const tmpEntityProvider = this._entityProvider(tmpAssociation.JoinURLPrefix);
		return new Promise((resolve, reject) =>
		{
			tmpEntityProvider.deleteEntity(tmpAssociation.JoinEntity, tmpJoinID, (pError, pBody) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				this._clearAssociationCache(tmpEntityProvider);
				return resolve(pBody);
			});
		});
	}

	/**
	 * Update the config columns of an existing join row (a "rich" join's per-association settings, e.g.
	 * Journal / Spreadsheet / Ordinal). Merges pValues over the join record and PUTs it.
	 *
	 * @param {string} pAssociationHash
	 * @param {Record<string, any>} pJoinRecord - the full join row (as carried by listAssociatedRecords).
	 * @param {Record<string, any>} pValues - the columns to change.
	 * @return {Promise<Record<string, any>>}
	 */
	updateJoin(pAssociationHash, pJoinRecord, pValues)
	{
		const tmpAssociation = this.associations[pAssociationHash];
		if (!tmpAssociation || !pJoinRecord)
		{
			return Promise.reject(new Error(`AssociationManager: cannot update join for [${pAssociationHash}].`));
		}
		// Minimal update — the join id + only the changed columns. The read-decorated join row can carry
		// derived, non-column fields (e.g. a joined ModuleConfig) that the server rejects on write; Meadow
		// updates only the fields provided, so a minimal record is both correct and safe.
		const tmpJoinIDField = this.getJoinIDField(tmpAssociation);
		const tmpRecord = Object.assign({ [tmpJoinIDField]: pJoinRecord[tmpJoinIDField] }, pValues || {});
		const tmpEntityProvider = this._entityProvider(tmpAssociation.JoinURLPrefix);
		return new Promise((resolve, reject) =>
		{
			tmpEntityProvider.updateEntity(tmpAssociation.JoinEntity, tmpRecord, (pError, pBody) =>
			{
				if (pError)
				{
					return reject(pError);
				}
				// Meadow returns a non-2xx error in the body (not the callback) — surface it as a failure.
				if (pBody && pBody.ErrorCode)
				{
					return reject(new Error(`AssociationManager: join update rejected (ErrorCode ${pBody.ErrorCode}).`));
				}
				this._clearAssociationCache(tmpEntityProvider);
				return resolve(pBody);
			});
		});
	}

	/**
	 * Repoint every join row that references `pFromID` (on the given recordset's side) so it references
	 * `pToID` instead — the many-to-many half of reassociation-on-delete ("this author's books now belong
	 * to that author"). For each of the from-record's joins: if `pToID` is ALREADY joined to the same
	 * other-side record, the from-join is deleted (repointing it would create a duplicate pair); otherwise
	 * the join's this-side column is repointed via a minimal update, which preserves any rich-join config
	 * columns (Journal/Ordinal/…). `pToID`'s existing joins are snapshotted up front so the dedup read is
	 * clean, and each repoint extends the dedup set so two from-joins to the same other-side record can't
	 * duplicate either.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName - the recordset being deleted-from (pFromID and pToID are ids on THIS side).
	 * @param {string|number} pFromID - the id being removed; its joins move away.
	 * @param {string|number} pToID - the replacement id; the joins move to it.
	 * @return {Promise<{ repointed: number, deletedDuplicate: number, failed: number }>}
	 */
	async repointJoins(pAssociationHash, pThisRecordSetName, pFromID, pToID)
	{
		const tmpResult = { repointed: 0, deletedDuplicate: 0, failed: 0 };
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides || pFromID === undefined || pFromID === null || pFromID === '' || pToID === undefined || pToID === null || pToID === '')
		{
			return tmpResult;
		}
		// Self-repoint is a no-op: moving a record's joins onto itself changes nothing, and a later delete
		// of pFromID would then strand exactly the joins we thought we "kept".
		if (String(pFromID) === String(pToID))
		{
			return tmpResult;
		}

		const tmpFromJoins = await this.listJoinRecords(pAssociationHash, pThisRecordSetName, pFromID);
		const tmpToJoins = await this.listJoinRecords(pAssociationHash, pThisRecordSetName, pToID);

		// The other-side ids pToID already links — repointing a from-join onto any of these would duplicate
		// the pair, so those from-joins are dropped instead.
		const tmpToOtherIDs = {};
		for (let i = 0; i < tmpToJoins.length; i++)
		{
			const tmpOtherID = tmpToJoins[i][tmpSides.otherSide.JoinField];
			if (tmpOtherID !== undefined && tmpOtherID !== null && tmpOtherID !== '')
			{
				tmpToOtherIDs[`${tmpOtherID}`] = true;
			}
		}

		for (let i = 0; i < tmpFromJoins.length; i++)
		{
			const tmpJoin = tmpFromJoins[i];
			const tmpOtherID = tmpJoin[tmpSides.otherSide.JoinField];
			const tmpReal = (tmpOtherID !== undefined) && (tmpOtherID !== null) && (tmpOtherID !== '');
			try
			{
				if (tmpReal && tmpToOtherIDs[`${tmpOtherID}`])
				{
					// pToID already links this other-side record — drop the would-be duplicate join.
					await this.removeJoin(pAssociationHash, tmpJoin);
					tmpResult.deletedDuplicate++;
				}
				else
				{
					// Repoint this side's column on the join row to pToID.
					await this.updateJoin(pAssociationHash, tmpJoin, { [tmpSides.thisSide.JoinField]: pToID });
					if (tmpReal) { tmpToOtherIDs[`${tmpOtherID}`] = true; }
					tmpResult.repointed++;
				}
			}
			catch (pError)
			{
				tmpResult.failed++;
				this.pict.log.error(`AssociationManager: repointJoins failed for a [${pAssociationHash}] join (${pThisRecordSetName} ${pFromID} -> ${pToID}): ${pError.message || pError}`);
			}
		}
		return tmpResult;
	}

	/**
	 * The per-join config columns an association exposes as inline-editable (empty for a plain join).
	 * @param {string} pAssociationHash
	 * @return {Array<Record<string, any>>}
	 */
	getJoinEditableFields(pAssociationHash)
	{
		const tmpAssociation = this.associations[pAssociationHash];
		return (tmpAssociation && Array.isArray(tmpAssociation.JoinEditableFields)) ? tmpAssociation.JoinEditableFields : [];
	}

	/**
	 * Whether an association has a host-provided defaults synthesizer registered.
	 * @param {string} pAssociationHash
	 * @return {boolean}
	 */
	hasDefaultSynthesizer(pAssociationHash)
	{
		const tmpAssociation = this.associations[pAssociationHash];
		return !!(tmpAssociation && (typeof tmpAssociation.SynthesizeDefaults === 'function'));
	}

	/**
	 * Synthesize default associations for one anchor record — THE consistent defaults lifecycle function.
	 * PSRS owns the "apply" half (dedupe against existing joins, then createJoin each new one with its
	 * config); the host owns only WHAT the defaults are, via the association's overridable
	 * `SynthesizeDefaults(context)` hook. No-op when no hook is registered.
	 *
	 * The hook receives `{ association, thisSide, otherSide, thisID, existingJoins, manager, pict }` and
	 * returns `Array<{ value, joinValues? }>` — `value` is the OTHER side's key value (what goes in the
	 * join's other JoinField), `joinValues` is optional extra config to stamp on that join row.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @param {string|number} pThisID
	 * @return {Promise<{ created: number, skipped: number }>}
	 */
	async synthesizeDefaults(pAssociationHash, pThisRecordSetName, pThisID)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides || !this.hasDefaultSynthesizer(pAssociationHash) || pThisID === undefined || pThisID === null || pThisID === '')
		{
			return { created: 0, skipped: 0 };
		}
		const tmpExistingJoins = await this.listJoinRecords(pAssociationHash, pThisRecordSetName, pThisID);
		const tmpExisting = {};
		tmpExistingJoins.forEach((pJoin) =>
		{
			const tmpValue = pJoin[tmpSides.otherSide.JoinField];
			if (tmpValue !== undefined && tmpValue !== null && tmpValue !== '') { tmpExisting[`${tmpValue}`] = true; }
		});

		let tmpDefaults = [];
		try
		{
			tmpDefaults = await tmpSides.association.SynthesizeDefaults(
				{
					association: tmpSides.association,
					thisSide: tmpSides.thisSide,
					otherSide: tmpSides.otherSide,
					thisID: pThisID,
					existingJoins: tmpExistingJoins,
					manager: this,
					pict: this.pict,
				});
		}
		catch (pError)
		{
			this.pict.log.error(`AssociationManager: SynthesizeDefaults hook for [${pAssociationHash}] threw: ${pError.message || pError}`);
			return { created: 0, skipped: 0 };
		}

		let tmpCreated = 0;
		let tmpSkipped = 0;
		const tmpList = Array.isArray(tmpDefaults) ? tmpDefaults : [];
		for (let i = 0; i < tmpList.length; i++)
		{
			const tmpDefault = tmpList[i] || {};
			const tmpValue = (tmpDefault.value !== undefined) ? tmpDefault.value : tmpDefault.Value;
			if (tmpValue === undefined || tmpValue === null || tmpValue === '' || tmpExisting[`${tmpValue}`])
			{
				tmpSkipped++;
				continue;
			}
			try
			{
				await this.createJoin(pAssociationHash, pThisRecordSetName, pThisID, tmpValue, tmpDefault.joinValues || tmpDefault.JoinValues || {});
				tmpExisting[`${tmpValue}`] = true;
				tmpCreated++;
			}
			catch (pError)
			{
				this.pict.log.warn(`AssociationManager: synthesize createJoin failed for [${pAssociationHash}] value [${tmpValue}]: ${pError.message || pError}`);
				tmpSkipped++;
			}
		}
		return { created: tmpCreated, skipped: tmpSkipped };
	}

	/**
	 * Build a `createEntityPicker` config for one side, optionally culling a live set of ids (a function
	 * so the cull re-evaluates on every search as associations change).
	 *
	 * @param {Record<string, any>} pSide - A normalized side.
	 * @param {(() => Array<any>)|false} pGetExcludedIDsFn - Returns ids to exclude (NIN), or falsy for none.
	 * @param {Record<string, any>} [pOverrides] - Extra picker options (DestinationAddress, ValueAddress, Mode, OnChange, …).
	 * @param {Record<string, any>} [pPriorityContext] - Anchor context merged into a function-form PriorityValues
	 *   resolver's argument (e.g. `{ ThisID, ThisRecordSet }`), so a host pin can be derived from the anchor record.
	 * @return {Record<string, any>}
	 */
	_pickerConfigForSide(pSide, pGetExcludedIDsFn, pOverrides, pPriorityContext)
	{
		const tmpConfig = {
			Entity: pSide.Entity,
			ValueField: pSide.IDField,
			TextField: pSide.DisplayField,
			SearchFields: pSide.SearchFields,
			Sort: pSide.Sort,
		};
		// Disambiguation chips (ISBN, year, …) — the picker renders these as badges on each option/chip.
		// TagLast so they sit AFTER the label ("Title  ISBN  Year"), matching the editor list rows.
		if (Array.isArray(pSide.ChipFields) && pSide.ChipFields.length > 0)
		{
			tmpConfig.EntityTags = pSide.ChipFields;
			tmpConfig.TagLast = true;
		}
		// Pin-to-top (module policy): forward the side's PriorityValues to the picker's DataProvider. A
		// function form is wrapped so the host resolver receives the anchor context (which record we're
		// associating to) — the prime-contractor-at-top case needs the anchor to resolve its project.
		if (pSide.PriorityValues)
		{
			tmpConfig.PriorityValues = (typeof pSide.PriorityValues === 'function')
				? (() => pSide.PriorityValues(Object.assign({ side: pSide, manager: this, pict: this.pict }, pPriorityContext || {})))
				: pSide.PriorityValues;
		}
		if (typeof pGetExcludedIDsFn === 'function')
		{
			tmpConfig.BaseFilter = () =>
			{
				const tmpIDs = pGetExcludedIDsFn();
				return (Array.isArray(tmpIDs) && tmpIDs.length > 0) ? `FBL~${pSide.IDField}~NIN~${this._encodeList(tmpIDs)}` : '';
			};
		}
		// Field decoration (module policy, resolved per entity by the metacontroller): when this side's
		// entity is opted in, the picker offers a ⚙ to pin an extra column onto each row (the "six
		// Volkerts" disambiguation). Caller overrides still win in the Object.assign below.
		if (this.pict.PictSectionRecordSet)
		{
			this.pict.PictSectionRecordSet.applyFieldDecoration(tmpConfig, pSide.Entity);
		}
		return Object.assign(tmpConfig, pOverrides || {});
	}

	/**
	 * Picker config for the OTHER side of an association (the records being associated), culling the
	 * currently-associated ids.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pThisRecordSetName
	 * @param {(() => Array<any>)|false} pGetExcludedIDsFn
	 * @param {Record<string, any>} [pOverrides]
	 * @param {Record<string, any>} [pAnchorContext] - The anchor record context (e.g. `{ ThisID, ThisRecordSet }`),
	 *   passed to a function-form PriorityValues resolver on the other side so a pin can be derived from the anchor.
	 * @return {Record<string, any>|false}
	 */
	buildOtherPickerConfig(pAssociationHash, pThisRecordSetName, pGetExcludedIDsFn, pOverrides, pAnchorContext)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pThisRecordSetName);
		if (!tmpSides)
		{
			return false;
		}
		const tmpPriorityContext = Object.assign(
			{ association: tmpSides.association, thisSide: tmpSides.thisSide, otherSide: tmpSides.otherSide },
			pAnchorContext || {});
		return this._pickerConfigForSide(tmpSides.otherSide, pGetExcludedIDsFn, pOverrides, tmpPriorityContext);
	}

	/**
	 * Picker config for the ANCHOR side of an association (the bulk screen's "pick a record to associate
	 * to" control). No cull.
	 *
	 * @param {string} pAssociationHash
	 * @param {string} pAnchorRecordSetName
	 * @param {Record<string, any>} [pOverrides]
	 * @return {Record<string, any>|false}
	 */
	buildAnchorPickerConfig(pAssociationHash, pAnchorRecordSetName, pOverrides)
	{
		const tmpSides = this.resolveSides(pAssociationHash, pAnchorRecordSetName);
		if (!tmpSides)
		{
			return false;
		}
		return this._pickerConfigForSide(tmpSides.thisSide, false, pOverrides);
	}
}

module.exports = PictRecordSetAssociationManager;
module.exports.default_configuration = _DEFAULT_PROVIDER_CONFIGURATION;
