const libFableServiceProviderBase = require('fable-serviceproviderbase');

const ViewDefinitionRecordSetErrorNotFound = require('../views/error/RecordSet-Error-NotFound.json');
const ViewRecordSetList = require('../views/list/RecordSet-List.js');
const ViewRecordSetRead = require('../views/read/RecordSet-Read.js');
const ViewRecordSetCreate = require('../views/create/RecordSet-Create.js');
const ViewRecordSetDashboard = require('../views/dashboard/RecordSet-Dashboard.js');

//_Pict.addProvider('BooksProvider', { Entity: 'Book', URLPrefix: 'http://www.datadebase.com:8086/1.0/' }, require('../source/providers/RecordSet-RecordProvider-MeadowEndpoints.js'));
const ProviderBase = require('../providers/RecordSet-RecordProvider-Base.js');
const ProviderMeadowEndpoints = require('../providers/RecordSet-RecordProvider-MeadowEndpoints.js');

const ProviderLinkManager = require('../providers/RecordSet-Link-Manager.js');
const libProviderColumnData = require('../providers/Column-Data-Provider.js');

const ProviderRouter = require('../providers/RecordSet-Router.js');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION =
	{
		DefaultMeadowURLPrefix: '/1.0/'
	};

const libFormsTemplateProvider = require('pict-section-form').PictFormTemplateProvider;

class RecordSetMetacontroller extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		/** @type {import('pict') & { PictSectionRecordSet: any, addAndInstantiateSingletonService: (hash: string, options: any, prototype: any) => any, newManyfest: (rec: any) => any }} */
		this.fable;
		this.pict = this.fable;
		/** @type {any} */
		this.log;
		/** @type {any} */
		this.options;
		/** @type {string} */
		this.UUID;

		this.childViews = {
			list: null,
			create: null,
			read: null,
			dashboard: null
		};

		/** @type {Record<string, import('pict-provider')>} */
		this.recordSetProviders = {};
		/** @type {Record<string, Record<string, any>>} */
		this.recordSetProviderConfigurations = {};

		/** @type {Record<string, Record<string, any>>} */
		this.dashboardConfigurations = {};

		/** @type {Array<(pCapability: string) => Promise<boolean>>} */
		this.sessionProviders = [];

		/** @type {Record<string, Record<string, any>>} */
		this.manifestDefinitions = {};
		/** @type {Record<string, import('manyfest')>} */
		this.manifests = { Default: this.pict.manifest };

		this.has_initialized = false;

		//FIXME: this duplicates a behavior in pict-section-form - figure out how we want this coupled dependency to work.
		this.fable.addProviderSingleton('PictFormSectionDefaultTemplateProvider', libFormsTemplateProvider.default_configuration, libFormsTemplateProvider);

		this.pict.MetaTemplate.addPatternBoth('{~ProcessCell:', '~}', (pHash, pData, fCallback)=>
		{ 
			const field = this.pict.resolveStateFromAddress(pHash, pData, fCallback);
			return fCallback(null, this.pict.manifest.getValueByHash(pData.Payload, field));
		}, async (pHash, pData, fCallback) =>
		{
			const field = this.pict.resolveStateFromAddress(pHash, pData, fCallback);
			let value = this.pict.manifest.getValueByHash(pData.Payload, field);
			const IDPrefixes = ['Parent', 'Child', 'Creating', 'Updating', 'Deleting'];
			let sanitizedField = field;
			for (let p of IDPrefixes)
			{
				sanitizedField = sanitizedField.replace(`${ p }ID`, 'ID');
			}
			if (sanitizedField?.startsWith('ID'))
			{
				if (!value)
				{
					return fCallback(null, '');
				}
				const remote = field.split('ID')[1];
				try
				{
					const entity = await new Promise((resolve, reject) =>
					{
						this.pict.EntityProvider.getEntity(remote, value, (pError, pResult) =>
						{
							if (pError)
							{
								return reject(pError);
							}
							resolve(pResult);
						});
					});
					// A dangling reference (the target row no longer exists — e.g. a system user id that
					// was never seeded) comes back as the endpoint's error body rather than an entity.
					// Render the raw id, unlinked: it carries more information than a blank cell, and
					// matches how a found-but-nameless entity already renders.
					if (!entity || (entity.Error && entity.StatusCode))
					{
						return fCallback(null, value);
					}
					if (remote === 'User')
					{
						// Compose what the user record actually has; fall back through the common
						// name fields rather than printing "undefined undefined".
						const tmpUserName = [ entity.NameFirst, entity.NameLast ].filter((pPart) => (typeof(pPart) === 'string') && pPart.trim().length > 0).join(' ');
						value = tmpUserName || entity.FullName || entity.Name || entity.LoginID || value;
					}
					else if (entity?.Name)
					{
						value = entity.Name;
					}
					else if (entity?.Title)
					{
						value = entity.Title;
					}
					else if (entity?.Hash)
					{
						value = entity.Hash;
					}
					if (this.pict.PictSectionRecordSet.recordSetProviderConfigurations[remote])
					{
						const url = this.pict.parseTemplateByHash('PRSP-Read-Link-URL-Template', { Payload: { Payload: { RecordSet: remote, GUIDAddress: `GUID${ remote }` }, Data: entity }});
						value = `<a href="${ url }">${ value }</a>`;
					}
				}
				catch (e)
				{
					this.pict.log.error(`[RecordSet-MetaController]  Unable to fetch entity: ${ e }`);
					return fCallback(e, '');
				}
			}
			return fCallback(null, value);
		});
	}

	/*
		"DefaultRecordSetConfigurations":
			[
				{
					"RecordSet": "Book",

					"RecordSetType": "MeadowEndpoint", // Could be "Custom" which would require a provider to already be created for the record set.
					"RecordSetMeadowEntity": "Book",   // This leverages the /Schema endpoint to get the record set columns.

					"RecordSetURLPrefix": "http://www.datadebase.com:8086/1.0/"
				},
				{
					"RecordSet": "Author",

					"RecordSetType": "MeadowEndpoint",
					"RecordSetMeadowEntity": "Author",

					"RecordSetURLPrefix": "http://www.datadebase.com:8086/1.0/"
				},
				{
					"RecordSet": "RandomizedValues",

					"RecordSetType": "Custom" // This means the `PS-RSP-RandomizedValues` provider will be checked for to get records.
				}
			]
	 */

	/**
	 * @param {string} pRecordSet - The RecordSet name to get the configuration for.
	 *
	 * @return {Record<string, any>} - The registered configuration for the RecordSet
	 */
	getRecordSetConfiguration(pRecordSet)
	{
		return this.recordSetProviderConfigurations[pRecordSet];
	}

	/**
	 * @param {Record<string, any>} pRecordSetConfiguration - The RecordSet configuration to load.
	 */
	loadRecordSetConfiguration(pRecordSetConfiguration)
	{
		if (typeof pRecordSetConfiguration !== 'object')
		{
			this.fable.log.error(`RecordSetMetacontroller: ${this.UUID} loadRecordSetConfiguration called with invalid configuration.`);
			return false;
		}
		if ((!('RecordSet' in pRecordSetConfiguration)) || (pRecordSetConfiguration.RecordSet === ''))
		{
			this.fable.log.error(`RecordSetMetacontroller: ${this.UUID} loadRecordSetConfiguration called with invalid configuration. Missing RecordSet.`);
			return false;
		}

		// Normalize the whole-row-click opt-in to a STRICT boolean. The action-cell and column-header
		// templates branch on it with TIfAbs's TRUE/FALSE operators, which test `=== true` / `=== false`.
		// An absent (undefined) or loose ('true') value would satisfy neither branch, leaving the actions
		// column empty — so coerce it to a real true/false here, once, for every render path.
		pRecordSetConfiguration.RowClickOpensRecord = (pRecordSetConfiguration.RowClickOpensRecord === true || pRecordSetConfiguration.RowClickOpensRecord === 'true');

		let tmpExtraColumnHeaderTemplateHash = `RecordSet-List-ExtraColumnHeader-${pRecordSetConfiguration.RecordSet}`;
		pRecordSetConfiguration.RecordSetListExtraColumnsHeaderTemplateHash = tmpExtraColumnHeaderTemplateHash;
		let tmpExtraColumnRowTemplateHash = `RecordSet-List-ExtraColumnRow-${pRecordSetConfiguration.RecordSet}`;
		pRecordSetConfiguration.RecordSetListExtraColumnRowTemplateHash = tmpExtraColumnRowTemplateHash;
		if (pRecordSetConfiguration.RecordSetListHasExtraColumns)
		{
			let tmpRecordSetExtraColumnHeaderTemplate = pRecordSetConfiguration.RecordSetListExtraColumnsHeaderTemplate;
			if (tmpRecordSetExtraColumnHeaderTemplate === undefined)
			{
				tmpRecordSetExtraColumnHeaderTemplate = '';
			}
			let tmpRecordSetExtraColumnRowTemplate = pRecordSetConfiguration.RecordSetListExtraColumnRowTemplate;
			if (tmpRecordSetExtraColumnRowTemplate === undefined)
			{
				tmpRecordSetExtraColumnRowTemplate = '';
			}
			this.fable.TemplateProvider.addTemplate(tmpExtraColumnHeaderTemplateHash, tmpRecordSetExtraColumnHeaderTemplate);
			this.fable.TemplateProvider.addTemplate(tmpExtraColumnRowTemplateHash, tmpRecordSetExtraColumnRowTemplate);
		}
		else
		{
			this.fable.TemplateProvider.addTemplate(tmpExtraColumnHeaderTemplateHash, '');
			this.fable.TemplateProvider.addTemplate(tmpExtraColumnRowTemplateHash, '');
		}

		let tmpProvider = false;

		const providerConfiguration = Object.assign({}, {Hash: `RSP-Provider-${pRecordSetConfiguration.RecordSet}`}, pRecordSetConfiguration);
		this.recordSetProviderConfigurations[providerConfiguration.RecordSet] = providerConfiguration;

		switch (pRecordSetConfiguration.RecordSetType)
		{
			case 'MeadowEndpoint':
				// Create a Meadow Endpoints provider
				// Allow the Record Set to optionally point to a different entity
				if (`RecordSetMeadowEntity` in pRecordSetConfiguration)
				{
					providerConfiguration.Entity = pRecordSetConfiguration.RecordSetMeadowEntity;
				}
				else
				{
					providerConfiguration.Entity = pRecordSetConfiguration.RecordSet;
				}
				if (`FilterEndpointOverride` in pRecordSetConfiguration)
				{
					providerConfiguration.FilterEndpointOverride = pRecordSetConfiguration.FilterEndpointOverride;
				}
				else
				{
					providerConfiguration.FilterEndpointOverride = null;
				}
				// Default the URLPrefix to the base URLPrefix
				if (`RecordSetURLPrefix` in pRecordSetConfiguration)
				{
					providerConfiguration.URLPrefix = pRecordSetConfiguration.RecordSetURLPrefix;
				}
				else
				{
					providerConfiguration.URLPrefix = '/1.0/';
				}
				if (`RecordSetIgnoreFilterFields` in pRecordSetConfiguration)
				{
					providerConfiguration.IgnoreFilterFields = pRecordSetConfiguration.RecordSetIgnoreFilterFields;
				}
				else
				{
					providerConfiguration.IgnoreFilterFields = [ 'Deleted', 'DeletingIDUser', 'DeleteDate' ];
				}
				if (`RecordSetFieldFilterClauses` in pRecordSetConfiguration)
				{
					providerConfiguration.FieldFilterClauses = pRecordSetConfiguration.RecordSetFieldFilterClauses;
				}

				tmpProvider = this.recordSetProviders[pRecordSetConfiguration.RecordSet] = this.fable.addProvider(providerConfiguration.Hash, providerConfiguration, ProviderMeadowEndpoints);
				break;
			default:
			case 'Custom':
				// Create a custom provider
				if (`ProviderHash` in providerConfiguration)
				{
					if (!(providerConfiguration.ProviderHash in this.fable.servicesMap))
					{
						this.fable.log.error(`RecordSetMetacontroller: ${this.UUID} loadRecordSetConfiguration called with invalid configuration. ProviderHash ${providerConfiguration.ProviderHash} not found.  Falling back to base.`);
						tmpProvider = this.recordSetProviders[providerConfiguration.RecordSet] = this.fable.servicesMap[providerConfiguration.ProviderHash];
					}
					else
					{
						tmpProvider = this.recordSetProviders[providerConfiguration.RecordSet] = this.fable.addProvider(providerConfiguration.Hash, providerConfiguration, ProviderBase);
					}
				}
				else
				{
					tmpProvider = this.recordSetProviders[providerConfiguration.RecordSet] = this.fable.addProvider(providerConfiguration.Hash, providerConfiguration, ProviderBase);
				}
				break;
		}

		return tmpProvider;
	}

	/**
	 * @param {Array<Record<string, any>>} pRecordSetConfigurationArray - An array of RecordSet configurations to load.
	 */
	loadRecordSetConfigurationArray(pRecordSetConfigurationArray)
	{
		if (!Array.isArray(pRecordSetConfigurationArray))
		{
			this.fable.log.error(`RecordSetMetacontroller: ${this.UUID} loadRecordSetConfigurationArray called with invalid configuration.`);
			return false;
		}
		if (pRecordSetConfigurationArray.length === 0)
		{
			this.fable.log.error(`RecordSetMetacontroller: ${this.UUID} loadRecordSetConfigurationArray called with empty configuration.`);
			return false;
		}
		for (let i = 0; i < pRecordSetConfigurationArray.length; i++)
		{
			if (!this.loadRecordSetConfiguration(pRecordSetConfigurationArray[i]))
			{
				this.fable.log.error(`RecordSetMetacontroller: ${this.UUID} loadRecordSetConfigurationArray called with invalid configuration:`,pRecordSetConfigurationArray[i]);
			}
		}
	}

	/**
	 * @param {Record<string, any> | string} pRecordSet - The RecordSet configuration or hash to load dynamically.
	 * @param {string} [pEntity] - (optional) The Entity type to use (defaults to the RecordSet name if not provided).
	 * @param {string} [pDefaultFilter] - (optional) The default filter to use.
	 */
	loadRecordSetDynamically(pRecordSet, pEntity, pDefaultFilter)
	{
		if (typeof(pRecordSet) === 'object')
		{
			const tmpRecordSetProviderHash = `RSP-Provider-${pRecordSet.RecordSet}`;
			this.loadRecordSetConfiguration(pRecordSet);

			return this.fable.providers[tmpRecordSetProviderHash].initializeAsync((pError) =>
				{
					if (pError)
					{
						this.log.error(`RecordSet [${pRecordSet.RecordSet}] dynamically loaded with error: ${pError.message || pError}`, { Stack: pError.stack });
						return;
					}
					this.log.trace(`RecordSet [${pRecordSet.RecordSet} dynamically loaded.`);
				})
		}

		if (typeof(pRecordSet) === 'string')
		{
			const tmpRecordSet = pRecordSet;
			const tmpRecordSetProviderHash = `RSP-Provider-${tmpRecordSet}`;

			const tmpEntity = (typeof(pEntity) === 'string') ? pEntity : tmpRecordSet;
			const tmpDefaultFilter = (typeof(pDefaultFilter) === 'string') ? pDefaultFilter : '';
			const tmpRecordSetConfiguration = {
				"RecordSet": tmpRecordSet,


				"RecordSetType": "MeadowEndpoint",
				"RecordSetMeadowEntity": tmpEntity,
				"RecordSetDefaultFilter": tmpDefaultFilter,

				"RecordSetURLPrefix": "/1.0/"
			};

			this.loadRecordSetConfiguration(tmpRecordSetConfiguration);
			return this.fable.providers[tmpRecordSetProviderHash].initializeAsync(
				(pError) =>
				{
					if (pError)
					{
						this.log.error(`RecordSet [${tmpRecordSet}] dynamically loaded with error: ${pError.message || pError}`, { Stack: pError.stack });
						return;
					}
					this.log.trace(`RecordSet [${tmpRecordSetConfiguration.RecordSet} dynamically loaded.`);
				});
		}

		this.log.error(`RecordSet MetaController loadRecordSetDynamically called with invalid parameter (expected an Object or String - parameter was ${typeof(pRecordSet)}.`);
		return false;
	}

	/**
	 * @param {Record<string, any>} pRoutePayload - The route payload containing the RecordSet and optional Entity and DefaultFilter.
	 */
	handleLoadDynamicRecordSetRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet List view route handler called with invalid route payload.`);
		}

		const tmpRecordSet = pRoutePayload.data.RecordSet;

		const tmpEntity = pRoutePayload.data.Entity ? pRoutePayload.data.Entity : tmpRecordSet;
		const tmpDefaultFilter = pRoutePayload.data.DefaultFilter ? pRoutePayload.data.DefaultFilter : '';

		return this.loadRecordSetDynamically(tmpRecordSet, tmpEntity, tmpDefaultFilter);
	}

	/**
	 * @param {import('pict-router')} pPictRouter - The Pict Router to add the routes to.
	 */
	addRoutes(pPictRouter)
	{
		pPictRouter.addRoute('/PSRS/:RecordSet/LoadDynamic', this.handleLoadDynamicRecordSetRoute.bind(this));
		pPictRouter.addRoute('/PSRS/:RecordSet/LoadDynamic/:Entity', this.handleLoadDynamicRecordSetRoute.bind(this));
		pPictRouter.addRoute('/PSRS/:RecordSet/LoadDynamic/:Entity/:DefaultFilter', this.handleLoadDynamicRecordSetRoute.bind(this));
		return true;
	}

	/**
	 * @param {string} pCapability - The capability to check for.
	 */
	async checkSession(pCapability)
	{
		for (const sessionProvider of this.sessionProviders)
		{
			if (!await sessionProvider(pCapability))
			{
				return false;
			}
		}
		return true;
	}

	/**
	 * @param {string} pNameTemplate - The name template for the record link.
	 * @param {string} pURLTemplate - The URL template for the record link.
	 * @param {boolean} pDefault - Whether this is a default link template.
	 *
	 * @return {Record<string, any>} - The link template object that was added.
	 */
	addRecordLinkTemplate(pNameTemplate, pURLTemplate, pDefault)
	{
		return this.fable.providers.RecordSetLinkManager.addRecordLinkTemplate(pNameTemplate, pURLTemplate, pDefault);
	}

	initialize()
	{
		if (this.has_initialized)
		{
			this.fable.log.warn(`RecordSetMetacontroller: ${this.UUID} already initialized and initialized was called a second time.`);
			return this;
		}

		this.fable.addProvider('RecordSetLinkManager', {}, ProviderLinkManager);

		// Column visibility persistence — only register the built-in localStorage provider when the
		// host hasn't supplied its own (the documented seam for server-side per-user persistence).
		if (!('ColumnDataProvider' in this.fable.providers))
		{
			this.fable.addProvider('ColumnDataProvider', libProviderColumnData.default_configuration, libProviderColumnData);
		}

		// Add the subviews internally and externally
		this.pict.addTemplate(require('../templates/Pict-Template-FilterView.js'));
		this.pict.addTemplate(require('../templates/Pict-Template-FilterInstanceViews.js'));
		this.pict.addTemplate(require('../views/filters').Base);
		this.childViews.errorNotFound = this.fable.addView('RSP-RecordSet-Error-NotFound', ViewDefinitionRecordSetErrorNotFound);
		this.childViews.list = this.fable.addView('RSP-RecordSet-List', this.options, ViewRecordSetList);
		this.childViews.read = this.fable.addView('RSP-RecordSet-Read', this.options, ViewRecordSetRead);
		this.childViews.create = this.fable.addView('RSP-RecordSet-Create', this.options, ViewRecordSetCreate);
		this.childViews.dashboard = this.fable.addView('RSP-RecordSet-Dashboard', this.options, ViewRecordSetDashboard);

		// Initialize the subviews
		this.childViews.list.initialize();
		this.childViews.read.initialize();
		this.childViews.create.initialize();
		this.childViews.dashboard.initialize();

		// Now initialize the router

		if (this.fable.settings.hasOwnProperty('Filters') && typeof this.fable.settings.Filters === 'object')
		{
			for (const tmpFilterKey of Object.keys(this.fable.settings.Filters))
			{
				const filterArray = Array.isArray(this.fable.settings.Filters[tmpFilterKey]) ? this.fable.settings.Filters[tmpFilterKey] : [this.fable.settings.Filters[tmpFilterKey]];
				for (let x = 0; x < filterArray.length; x++)
				{
					if (!filterArray[x].DisplayName)
					{
						filterArray[x].DisplayName = filterArray[x].Label || tmpFilterKey;
					}
					this.pict.providers.FilterManager.addFilter(filterArray[x].FilterKey || `${ tmpFilterKey }${ x ? `_${ x }` : '' }`, filterArray[x]);
				}
			}
		}

		if (this.fable.settings.hasOwnProperty('FilterCriteria') && typeof this.fable.settings.FilterCriteria === 'object')
		{
			for (const tmpFilterCriterionKey of Object.keys(this.fable.settings.FilterCriteria))
			{
				this.pict.providers.FilterManager.addFilterCriteria(tmpFilterCriterionKey, this.fable.settings.FilterCriteria[tmpFilterCriterionKey]);
			}
		}

		if (this.fable.settings.hasOwnProperty('DefaultRecordSetConfigurations'))
		{
			this.loadRecordSetConfigurationArray(this.fable.settings.DefaultRecordSetConfigurations);
		}

		for (const [ tmpManifestKey, tmpManifest ] of Object.entries(this.fable.settings.Manifests || {}))
		{
			if (!tmpManifest || !tmpManifest.Scope || !tmpManifest.Descriptors)
			{
				this.pict.log.error(`RecordSetDashboard: Invalid manifest: ${tmpManifestKey}.`, tmpManifest);
				continue;
			}
			if (tmpManifestKey !== tmpManifest.Scope)
			{
				this.pict.log.error(`RecordSetDashboard: Manifest key ${tmpManifestKey} does not match manifest scope ${tmpManifest.Scope}.  This is bad.  Fix it.`);
			}
			if (!tmpManifest.Form)
			{
				this.generateManifestTableCells(tmpManifest);
			}
			this.manifestDefinitions[tmpManifest.Scope] = tmpManifest;
			this.manifests[tmpManifest.Scope] = tmpManifest.Form ? tmpManifest : this.pict.newManyfest(tmpManifest);
		}

		this.has_initialized = true;

		// Load pict-router if it isn't loaded
		if (!('RecordSetRouter' in this.fable.providers))
		{
			this.fable.addProvider('RecordSetRouter', {}, ProviderRouter);
			this.fable.providers.RecordSetRouter.initialize();
		}

		return true;
	}

	getManifest(pScope)
	{
		return this.manifests[pScope];
	}

	/**
	 * Register a manifest at runtime, after initialization. This is the
	 * equivalent of adding a manifest to `fable.settings.Manifests` before
	 * init, but callable after the fact.
	 *
	 * @param {Record<string, any>} pManifest - The manifest to register. Must have `Scope` and `Descriptors`.
	 */
	addManifest(pManifest)
	{
		if (!pManifest || !pManifest.Scope || !pManifest.Descriptors)
		{
			this.pict.log.error(`RecordSetMetacontroller: addManifest called with invalid manifest.`, pManifest);
			return;
		}
		if (!pManifest.Form)
		{
			this.generateManifestTableCells(pManifest);
		}
		this.manifestDefinitions[pManifest.Scope] = pManifest;
		this.manifests[pManifest.Scope] = pManifest.Form ? pManifest : this.pict.newManyfest(pManifest);
	}

	/**
	 * @param {Record<string, any>} pManifest - The manifest to generate table cells for.
	 */
	generateManifestTableCells(pManifest)
	{
		if (!pManifest || !pManifest.Descriptors || !pManifest.Scope)
		{
			this.pict.log.error(`RecordSetDashboard: No manifest or descriptors found for ${pManifest}.  Cannot generate table cells.`);
			if (pManifest)
			{
				pManifest.TableCells = [];
			}
			return;
		}
		const tmpTableCells = Object.entries(pManifest.Descriptors || {}).filter(([ key, descriptor ]) => descriptor.PictDashboard).map(([ key, descriptor ]) =>
		{
			const tmpPictDashboard = descriptor.PictDashboard;
			if (tmpPictDashboard?.Equation && !tmpPictDashboard.ValueTemplate)
			{
				//FIXME: is this the right mapping?
				if (tmpPictDashboard.EquationNamespaceScope === 'Full')
				{
					tmpPictDashboard.ValueTemplate = '{~SBR:Record.Data.PictDashboard.Equation::Pict.PictSectionRecordSet.getManifest(Record.Data.ManifestHash)~}';
				}
				else
				{
					tmpPictDashboard.ValueTemplate = '{~SBR:Record.Data.PictDashboard.Equation:Record.Payload:Pict.PictSectionRecordSet.getManifest(Record.Data.ManifestHash)~}';
				}
			}
			if (!tmpPictDashboard.ValueTemplate)
			{
				tmpPictDashboard.ValueTemplate = '{~ProcessCell:Record.Data.Key~}';
			}
			return {
				Key: key,
				DisplayName: descriptor.Name || key,
				ManifestHash: pManifest.Scope,
				PictDashboard: tmpPictDashboard,
				// Column-chooser default visibility: a descriptor can ship hidden-by-default and be
				// turned on by the user (when the recordset enables RecordSetListColumnChooser).
				DefaultHidden: (descriptor.DefaultHidden === true),
			};
		});
		pManifest.TableCells = tmpTableCells;
	}

}

module.exports = RecordSetMetacontroller;

RecordSetMetacontroller.default_configuration = _DEFAULT_CONFIGURATION;
