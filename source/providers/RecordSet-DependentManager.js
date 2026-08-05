const libPictProvider = require('pict-provider');

/** @type {Record<string, any>} */
const _DEFAULT_PROVIDER_CONFIGURATION =
{
	ProviderIdentifier: 'Pict-RecordSet-DependentManager',

	AutoInitialize: true,
	AutoInitializeOrdinal: 0
};

/**
 * Registry + data layer for ONE-TO-MANY dependents: child entities that carry a foreign-key column
 * pointing back at a recordset's id (e.g. a `Sample` row with an `IDItem` column pointing at the `Item`
 * it belongs to). This is the one-to-many counterpart to the many-to-many `RecordSetAssociationManager`,
 * and it exists for reassociation-on-delete: when a duplicate parent record is deleted, its dependent
 * children are repointed to a replacement parent FIRST so they are never orphaned.
 *
 * Declared per recordset via `RecordSetDependents: [{ Entity, FKField, Title?, DisplayField?, SearchFields?,
 * ChildIDField?, URLPrefix? }]` and registered by the metacontroller. All reads/writes flow through the
 * shared, cached `pict.EntityProvider` (the same one associations + the recordset providers use).
 */
class PictRecordSetDependentManager extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_PROVIDER_CONFIGURATION, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		/** @type {Record<string, any>} */
		this.options;
		/** @type {import('pict')} */
		this.pict;

		/** @type {Record<string, Array<Record<string, any>>>} - Normalized dependents keyed by recordset name. */
		this.dependents = {};

		/** @type {Record<string, any>} - Lazily-created EntityProviders scoped to a non-default URL prefix. */
		this._scopedEntityProviders = {};

		/** @type {string} - EntityProvider cache scope for dependent-list reads; cleared after every repoint. */
		this._cacheScope = 'RecordSetDependent';
	}

	/**
	 * The EntityProvider for a URL prefix — the shared cached one for the default prefix, else a lazily
	 * created prefix-scoped instance (mirrors the association manager + recordset provider).
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
	 * Invalidate the cached dependent-list reads after a write so a subsequent list reflects it immediately.
	 * @param {Record<string, any>} pEntityProvider
	 */
	_clearDependentCache(pEntityProvider)
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
			this.pict.log.warn(`DependentManager: dependent cache clear failed: ${pError.message || pError}`);
		}
	}

	/**
	 * Normalize one dependent definition, filling the light-config defaults: `ChildIDField` falls back to
	 * `ID<Entity>`, `DisplayField` to `Name`, `SearchFields` to `[DisplayField]`, `Title` to `Entity`.
	 *
	 * @param {Record<string, any>} pDependent
	 * @return {Record<string, any>|false} The normalized dependent, or false when it is missing Entity/FKField.
	 */
	_normalizeDependent(pDependent)
	{
		if (!pDependent || !pDependent.Entity || !pDependent.FKField)
		{
			return false;
		}
		const tmpDisplayField = pDependent.DisplayField || 'Name';
		return {
			Entity: pDependent.Entity,
			// The column on the CHILD entity that references this recordset's id (e.g. Sample.IDItem).
			FKField: pDependent.FKField,
			// The child's own identity column, needed to address it on update. Defaults to ID<Entity>.
			ChildIDField: pDependent.ChildIDField || `ID${pDependent.Entity}`,
			DisplayField: tmpDisplayField,
			SearchFields: (Array.isArray(pDependent.SearchFields) && pDependent.SearchFields.length > 0) ? pDependent.SearchFields : [ tmpDisplayField ],
			Title: pDependent.Title || pDependent.Entity,
			URLPrefix: pDependent.URLPrefix || '',
		};
	}

	/**
	 * Register the one-to-many dependents for a recordset (replaces any previously registered set).
	 *
	 * @param {string} pRecordSetName
	 * @param {Array<Record<string, any>>} pDependents
	 * @return {Array<Record<string, any>>} The normalized, registered dependents.
	 */
	addDependents(pRecordSetName, pDependents)
	{
		if (!pRecordSetName || !Array.isArray(pDependents))
		{
			this.pict.log.error(`DependentManager: addDependents called with invalid arguments for [${pRecordSetName}].`, pDependents);
			return [];
		}
		const tmpNormalized = [];
		for (let i = 0; i < pDependents.length; i++)
		{
			const tmpDependent = this._normalizeDependent(pDependents[i]);
			if (!tmpDependent)
			{
				this.pict.log.error(`DependentManager: skipping invalid dependent (needs Entity + FKField) for [${pRecordSetName}].`, pDependents[i]);
				continue;
			}
			tmpNormalized.push(tmpDependent);
		}
		this.dependents[pRecordSetName] = tmpNormalized;
		return tmpNormalized;
	}

	/**
	 * The normalized dependents registered for a recordset (empty when none).
	 * @param {string} pRecordSetName
	 * @return {Array<Record<string, any>>}
	 */
	getDependentsForRecordSet(pRecordSetName)
	{
		return Array.isArray(this.dependents[pRecordSetName]) ? this.dependents[pRecordSetName] : [];
	}

	/**
	 * Fetch the child records currently pointing at an id through a dependent's FK column.
	 *
	 * @param {Record<string, any>} pDependent - a normalized dependent.
	 * @param {string|number} pParentID
	 * @return {Promise<Array<Record<string, any>>>}
	 */
	listDependentRecords(pDependent, pParentID)
	{
		if (!pDependent || pParentID === undefined || pParentID === null || pParentID === '')
		{
			return Promise.resolve([]);
		}
		const tmpEntityProvider = this._entityProvider(pDependent.URLPrefix);
		const tmpFilter = `FBV~${pDependent.FKField}~EQ~${encodeURIComponent(pParentID)}`;
		return new Promise((resolve) =>
		{
			tmpEntityProvider.getEntitySet(pDependent.Entity, tmpFilter, (pError, pRecords) =>
			{
				if (pError)
				{
					this.pict.log.warn(`DependentManager: failed to list ${pDependent.Entity} for ${pDependent.FKField}=${pParentID}.`, pError);
					return resolve([]);
				}
				return resolve(Array.isArray(pRecords) ? pRecords : []);
			}, '', { Scope: this._cacheScope, NoCount: true });
		});
	}

	/**
	 * Repoint every child of `pFromID` (through the dependent's FK column) to `pToID` — the one-to-many
	 * half of reassociation-on-delete. Each child gets a MINIMAL update (`{ childID, FKField: toID }`);
	 * this relies on Meadow-endpoints treating a partial body as a partial update, the same assumption the
	 * association manager's `updateJoin` makes. No dedup is needed — a foreign key simply repoints.
	 *
	 * @param {Record<string, any>} pDependent - a normalized dependent.
	 * @param {string|number} pFromID
	 * @param {string|number} pToID
	 * @return {Promise<{ repointed: number, failed: number }>}
	 */
	async repointDependent(pDependent, pFromID, pToID)
	{
		const tmpResult = { repointed: 0, failed: 0 };
		if (!pDependent || pFromID === undefined || pFromID === null || pFromID === '' || pToID === undefined || pToID === null || pToID === '')
		{
			return tmpResult;
		}
		// Self-repoint is a no-op (and a later delete of pFromID would then strand the children we "kept").
		if (String(pFromID) === String(pToID))
		{
			return tmpResult;
		}
		const tmpEntityProvider = this._entityProvider(pDependent.URLPrefix);
		const tmpChildren = await this.listDependentRecords(pDependent, pFromID);
		for (let i = 0; i < tmpChildren.length; i++)
		{
			const tmpChild = tmpChildren[i];
			const tmpUpdate = { [pDependent.ChildIDField]: tmpChild[pDependent.ChildIDField], [pDependent.FKField]: pToID };
			try
			{
				await new Promise((resolve, reject) =>
				{
					tmpEntityProvider.updateEntity(pDependent.Entity, tmpUpdate, (pError, pBody) =>
					{
						if (pError)
						{
							return reject(pError);
						}
						// Meadow returns a non-2xx error in the body (not the callback) — surface it as a failure.
						if (pBody && pBody.ErrorCode)
						{
							return reject(new Error(`DependentManager: ${pDependent.Entity} update rejected (ErrorCode ${pBody.ErrorCode}).`));
						}
						return resolve(pBody);
					});
				});
				tmpResult.repointed++;
			}
			catch (pError)
			{
				tmpResult.failed++;
				this.pict.log.error(`DependentManager: repointDependent failed for ${pDependent.Entity}.${pDependent.FKField} (${pFromID} -> ${pToID}): ${pError.message || pError}`);
			}
		}
		this._clearDependentCache(tmpEntityProvider);
		return tmpResult;
	}
}

module.exports = PictRecordSetDependentManager;
module.exports.default_configuration = _DEFAULT_PROVIDER_CONFIGURATION;
