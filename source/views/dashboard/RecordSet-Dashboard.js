const libPictRecordSetRecordView = require('../RecordSet-RecordBaseView.js');

const viewHeaderDashboard = require('./RecordSet-Dashboard-HeaderDashboard.js');
const viewTitle = require('./RecordSet-Dashboard-Title.js');
const viewFilters = require('../RecordSet-Filters.js');
const viewPaginationTop = require('./RecordSet-Dashboard-PaginationTop.js');
const viewRecordList = require('./RecordSet-Dashboard-RecordList.js');
const viewRecordListHeader = require('./RecordSet-Dashboard-RecordListHeader.js');
const viewRecordListEntry = require('./RecordSet-Dashboard-RecordListEntry.js');
const viewPaginationBottom = require('./RecordSet-Dashboard-PaginationBottom.js');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION__Dashboard = (
	{
		ViewIdentifier: 'PRSP-List',

		DefaultRenderable: 'PRSP_Renderable_List',
		DefaultDestinationAddress: '#PRSP_Container',
		DefaultTemplateRecordAddress: false,

		// If this is set to true, when the App initializes this will.
		// While the App initializes, initialize will be called.
		AutoInitialize: false,
		AutoInitializeOrdinal: 0,

		// If this is set to true, when the App autorenders (on load) this will.
		// After the App initializes, render will be called.
		AutoRender: false,
		AutoRenderOrdinal: 0,

		AutoSolveWithApp: false,
		AutoSolveOrdinal: 0,

		CSS: false,
		CSSPriority: 500,

		Templates:
			[
				{
					Hash: 'PRSP-Dashboard-Template',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-Dashboard-Template] -->
	<section id="PRSP_List_Container">
		{~V:PRSP-Dashboard-Title~}
		{~V:PRSP-Dashboard-HeaderDashboard~}
		<section id="PRSP_Filters_Container">
			{~FV:PRSP-Filters:Dashboard~}
		</section>
		{~V:PRSP-Dashboard-PaginationTop~}
		{~V:PRSP-Dashboard-RecordList~}
		{~V:PRSP-Dashboard-PaginationBottom~}
	</section>
	<!-- DefaultPackage end view template:  [PRSP-Dashboard-Template] -->
	`
				},
				{
					Hash: 'PRSP-Dashboard-Template-Form-With-Recordset-Data',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-Dashboard-Template-Form-With-Recordset-Data] -->
	<section id="PRSP_List_Container">
		{~V:PRSP-Dashboard-Title~}
		{~V:PRSP-Dashboard-HeaderDashboard~}
		<section id="PRSP_Filters_Container">
			{~FV:PRSP-Filters:Dashboard~}
		</section>
		{~V:PRSP-Dashboard-PaginationTop~}
		{~T:PRSP-Dashboard-RecordDashboard-Template~}
		{~V:PRSP-Dashboard-PaginationBottom~}
	</section>
	<!-- DefaultPackage end view template:  [PRSP-Dashboard-Template-Form-With-Recordset-Data] -->
	`
				},
				{
					Hash: 'PRSP-Dashboard-Template-Form',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-Dashboard-Template-Form] -->
	<section id="PRSP_List_Container">
		{~V:PRSP-Dashboard-Title~}
		{~V:PRSP-Dashboard-HeaderDashboard~}
		{~T:PRSP-Dashboard-RecordDashboard-Template~}
	</section>
	<!-- DefaultPackage end view template:  [PRSP-Dashboard-Template-Form] -->
	`
				},
				{
					Hash: 'PRSP-Dashboard-Template-Record',
					Template: /*html*/`
	<!-- DefaultPackage end view template:  [PRSP-Dashboard-Template] -->
	`
				}
			],

		Renderables:
			[
				{
					RenderableHash: 'PRSP_Renderable_List',
					TemplateHash: 'PRSP-Dashboard-Template',
					DestinationAddress: '#PRSP_Container',
					RenderMethod: 'replace'
				},
				{
					RenderableHash: 'PRSP_Renderable_Form_With_Recordset_Data',
					TemplateHash: 'PRSP-Dashboard-Template-Form-With-Recordset-Data',
					DestinationAddress: '#PRSP_Container',
					RenderMethod: 'replace'
				},
				{
					RenderableHash: 'PRSP_Renderable_Form',
					TemplateHash: 'PRSP-Dashboard-Template-Form',
					DestinationAddress: '#PRSP_Container',
					RenderMethod: 'replace'
				}
			],

		Manifests: {}
	});

class viewRecordSetDashboard extends libPictRecordSetRecordView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION__Dashboard, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.childViews = {
			headerList: null,
			title: null,
			paginationTop: null,
			recordList: null,
			recordListHeader: null,
			recordListEntry: null,
			paginationBottom: null
		};
	}

	handleRecordSetDashboardRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			return;
			//throw new Error(`Pict RecordSet List view route handler called with invalid route payload.`);
		}
		if (!pRoutePayload.data || !pRoutePayload.data.RecordSet)
		{
			return;
		}

		//_Pict.PictSectionRecordSet.recordSetProviderConfigurations['Book'], 'RSP-Provider-Book'
		// FIXME: Not in love with this but good enough to start.
		// FIXME: Typescript mumbo jumbo
		// if (!('PictSectionRecordSet' in this.pict))
		// {
		// 	return false;
		// }
		const tmpProviderConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[pRoutePayload.data.RecordSet];
		if (!tmpProviderConfiguration)
		{
			this.pict.log.error(`RecordSetDashboard: No record set configuration found for ${pRoutePayload.data.RecordSet}.  List Render failed.`);
			this.fable.providers.RecordSetRouter.pictRouter.navigate('/PSRS/404');
			return;
		}
		const tmpProviderHash = `RSP-Provider-${pRoutePayload.data.RecordSet}`;

		const tmpFilterString = pRoutePayload.data.FilterString || '';
		const tmpSerializedFilterExperience = pRoutePayload.data.FilterExperience || '';

		const tmpOffset = pRoutePayload.data.Offset ? pRoutePayload.data.Offset : 0;
		const tmpPageSize = pRoutePayload.data.PageSize ? pRoutePayload.data.PageSize : 100;

		if (pRoutePayload.data.DashboardHash)
		{
			return this.renderSpecificDashboard(pRoutePayload.data.DashboardHash, tmpProviderConfiguration, tmpProviderHash, tmpFilterString, tmpSerializedFilterExperience, tmpOffset, tmpPageSize);
		}
		return this.renderDashboard(tmpProviderConfiguration, tmpProviderHash, tmpFilterString, tmpSerializedFilterExperience, tmpOffset, tmpPageSize);
	}

	addRoutes(pPictRouter)
	{
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/FilteredTo/:FilterString/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/FilteredTo/:FilterString/:Offset/:PageSize/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/FilteredTo/:FilterString/:Offset/:PageSize', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/FilteredTo/:FilterString', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/:Offset/:PageSize/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/:Offset/:PageSize', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard/:Offset', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/Dashboard', this.handleRecordSetDashboardRoute.bind(this));

		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/FilteredTo/:FilterString/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/FilteredTo/:FilterString/:Offset/:PageSize/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/FilteredTo/:FilterString/:Offset/:PageSize', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/FilteredTo/:FilterString', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/:Offset/:PageSize/FilterExperience/:FilterExperience', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/:Offset/:PageSize', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash/:Offset', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/SpecificDashboard/:DashboardHash', this.handleRecordSetDashboardRoute.bind(this));
		pPictRouter.router.resolve();
		return true;
	}

	onBeforeRenderList(pRecordListData)
	{
		return pRecordListData;
	}

	dynamicallyGenerateColumns(pRecordListData)
	{
		pRecordListData.TableCells = [];
		const tmpEntity = pRecordListData.RecordSetConfiguration.Entity;
		this.excludedByDefaultCells = [
			'ID' + tmpEntity,
			'GUID' + tmpEntity,
			'CreateDate',
			'CreatingIDUser',
			'DeleteDate',
			'Deleted',
			'DeletingIDUser',
			'UpdateDate',
			'UpdatingIDUser',
			'IDCustomer', // meadow-endpoints/retold tenancy discriminator — server-managed, hidden from every record view
			'ExternalSyncDate', 'ExternalSyncGUID', // external-sync auditing stamps (Headlight integration sync)
		];

		const tmpSchema = pRecordListData.RecordSchema;
		const tmpProperties = tmpSchema?.properties;
		// loop throught the schema and add the columns to the tableCells
		for (const tmpColumn in tmpProperties)
		{
			if (tmpProperties.hasOwnProperty(tmpColumn))
			{
				// Check if the column is excluded by the default list of columns (or is not a GUID/ID)
				if (this.excludedByDefaultCells.includes(tmpColumn) === false)
				{
					pRecordListData.TableCells.push({
						Key: tmpColumn,
						DisplayName: tmpProperties?.[tmpColumn].title || tmpColumn,
						ManifestHash: 'Default',
						PictDashboard:
						{
							ValueTemplate: '{~ProcessCell:Record.Data.Key~}',
						},
					});
				}
			}
		}
		return pRecordListData;
	}

	/**
	 * @param {string} pDashboardHash
	 * @param {Record<string, any>} pRecordSetConfiguration
	 * @param {string} pProviderHash
	 * @param {string} pFilterString
	 * @param {string} pSerializedFilterExperience
	 * @param {number} pOffset
	 * @param {number} pPageSize
	 *
	 * @return {Promise<void>}
	 */
	async renderSpecificDashboard(pDashboardHash, pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize)
	{
		if (!pRecordSetConfiguration)
		{
			this.pict.log.error(`RecordSetDashboard: No record set configuration found for ${pDashboardHash}.  List Render failed.`);
			return;
		}
		// Get the records
		if (!(pProviderHash in this.pict.providers))
		{
			this.pict.log.error(`RecordSetDashboard: No provider found for ${pProviderHash} in ${pRecordSetConfiguration.RecordSet}.  List Render failed.`);
			return;
		}

		let tmpManifestDefinition;
		if (pDashboardHash)
		{
			tmpManifestDefinition = this.pict.PictSectionRecordSet.manifestDefinitions[pDashboardHash];
		}
		let tmpTitle = pRecordSetConfiguration.Title || pRecordSetConfiguration.RecordSet;
		if (tmpManifestDefinition && tmpManifestDefinition.TitleTemplate)
		{
			tmpTitle = this.pict.parseTemplate(tmpManifestDefinition.TitleTemplate, pRecordSetConfiguration);
		}

		const tmpEncodedFilterExperience = pSerializedFilterExperience && encodeURIComponent(pSerializedFilterExperience);
		if (tmpEncodedFilterExperience)
		{
			// shove filter xp into the active filters for this recordset
			const tmpExperienceFromURL = await this.pict.views['PRSP-Filters'].deserializeFilterExperience(pSerializedFilterExperience);
			if (tmpExperienceFromURL)
			{
				this.pict.manifest.setValueByHash(this.pict.Bundle, `_ActiveFilterState[${pRecordSetConfiguration.RecordSet}].FilterClauses`, tmpExperienceFromURL);
			}
		}

		let tmpRecordDashboardData =
		{
			"Title": tmpTitle,

			"RecordSet": pRecordSetConfiguration.RecordSet,
			"RecordSetConfiguration": pRecordSetConfiguration,

			"RenderDestination": this.options.DefaultDestinationAddress,

			"FilterString": pFilterString ? encodeURIComponent(pFilterString) : undefined,

			"Records": { "Records": [] },
			"TotalRecordCount": { "Count": -1 },

			"Offset": pOffset || 0,
			"PageSize": pPageSize || 100,
			"DashboardHash": pDashboardHash,
		};

		// TODO: There are still problems with the way these have nested data.  Discuss how we might move that around
		// Seed any configured default filter clauses (e.g. DefaultRelativeDays) BEFORE the
		// fetch, so the first paint is already filtered the way the dashboard is configured
		// rather than filtered only once the user presses Apply.
		if (this.pict.views['PRSP-Filters'] && (typeof this.pict.views['PRSP-Filters'].seedDefaultFilterClauses === 'function'))
		{
			await this.pict.views['PRSP-Filters'].seedDefaultFilterClauses(tmpRecordDashboardData.RecordSet);
		}
		// Fetch the records
		tmpRecordDashboardData.Records = await this.pict.providers[pProviderHash].getDecoratedRecords(tmpRecordDashboardData);
		// Get the total record count
		tmpRecordDashboardData.TotalRecordCount = await this.pict.providers[pProviderHash].getRecordSetCount(tmpRecordDashboardData);
		// Get the record schema
		tmpRecordDashboardData.RecordSchema = await this.pict.providers[pProviderHash].getRecordSchema();

		// TODO: This should be coming from the schema but that can come after we discuss how we deal with default routing
		tmpRecordDashboardData.GUIDAddress = this.pict.providers[pProviderHash].getGUIDField();

		// Get the "page end record number" for the current page (e.g. for messaging like Record 700 to 800 of 75,000)
		const tmpOffset = Number(tmpRecordDashboardData.Offset);
		tmpRecordDashboardData.PageEnd = tmpOffset + tmpRecordDashboardData.Records.Records.length;
		// 1-based start record number for the "Showing X to Y" counter (the raw 0-based Offset would read "0 to ..." on page 1)
		tmpRecordDashboardData.PageStart = (tmpRecordDashboardData.Records.Records.length > 0) ? (tmpOffset + 1) : 0;

		// Compute the number of pages total
		tmpRecordDashboardData.PageCount = Math.ceil(tmpRecordDashboardData.TotalRecordCount.Count / tmpRecordDashboardData.PageSize);

		// Generate each page's links.
		// TODO: This is fast and cool; any reason not to?
		// Get "bookmarks" as references to the array of page links.
		tmpRecordDashboardData.PageLinkBookmarks = (
			{
				Current: Math.floor(tmpRecordDashboardData.Offset / tmpRecordDashboardData.PageSize)
			});
		tmpRecordDashboardData.PageLinks = [];
		for (let i = 0; i < tmpRecordDashboardData.PageCount; i++)
		{
			if (tmpRecordDashboardData.FilterString)
			{
				tmpRecordDashboardData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/SpecificDashboard/${pDashboardHash}/FilteredTo/${tmpRecordDashboardData.FilterString}/${i * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			else
			{
				tmpRecordDashboardData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/SpecificDashboard/${pDashboardHash}/${i * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordDashboardData.PageLinks[tmpRecordDashboardData.PageLinks.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		//FIXME: short-term workaround to not blow up the tempplate rendering with way too many links
		const linkRangeStart = Math.max(0, tmpRecordDashboardData.PageLinkBookmarks.Current - 10);
		const linkRangeEnd = Math.min(tmpRecordDashboardData.PageLinks.length, tmpRecordDashboardData.PageLinkBookmarks.Current + 10);
		tmpRecordDashboardData.PageLinksLimited = tmpRecordDashboardData.PageLinks.slice(linkRangeStart, linkRangeEnd);
		if (linkRangeStart > 0)
		{
			if (tmpRecordDashboardData.FilterString)
			{
				tmpRecordDashboardData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/SpecificDashboard/${pDashboardHash}/FilteredTo/${tmpRecordDashboardData.FilterString}/0/${tmpRecordDashboardData.PageSize}`
					});
			}
			else
			{
				tmpRecordDashboardData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/SpecificDashboard/${pDashboardHash}/0/${tmpRecordDashboardData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordDashboardData.PageLinksLimited[tmpRecordDashboardData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}
		if (linkRangeEnd < tmpRecordDashboardData.PageLinks.length)
		{
			if (tmpRecordDashboardData.FilterString)
			{
				tmpRecordDashboardData.PageLinksLimited.push(
					{
						Page: tmpRecordDashboardData.PageCount,
						RelativeOffset: (tmpRecordDashboardData.PageCount - 1) - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/SpecificDashboard/${pDashboardHash}/FilteredTo/${tmpRecordDashboardData.FilterString}/${(tmpRecordDashboardData.PageCount - 1) * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			else
			{
				tmpRecordDashboardData.PageLinksLimited.push(
					{
						Page: tmpRecordDashboardData.PageCount,
						RelativeOffset: (tmpRecordDashboardData.PageCount - 1) - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/SpecificDashboard/${pDashboardHash}/${(tmpRecordDashboardData.PageCount - 1) * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordDashboardData.PageLinksLimited[tmpRecordDashboardData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		tmpRecordDashboardData.PageLinkBookmarks.Previous = tmpRecordDashboardData.PageLinkBookmarks.Current - 1;
		tmpRecordDashboardData.PageLinkBookmarks.Next = tmpRecordDashboardData.PageLinkBookmarks.Current + 1;
		tmpRecordDashboardData.PageLinkBookmarks.ShowPreviousLink = true;
		tmpRecordDashboardData.PageLinkBookmarks.ShowNextLink = true;
		if (tmpRecordDashboardData.PageLinkBookmarks.Previous < 0)
		{
			tmpRecordDashboardData.PageLinkBookmarks.PreviousLink = false;
			tmpRecordDashboardData.PageLinkBookmarks.ShowPreviousLink = false;
		}
		else
		{
			tmpRecordDashboardData.PageLinkBookmarks.PreviousLink = tmpRecordDashboardData.PageLinks[tmpRecordDashboardData.PageLinkBookmarks.Previous];
		}
		if (tmpRecordDashboardData.PageLinkBookmarks.Next >= tmpRecordDashboardData.PageLinks.length)
		{
			tmpRecordDashboardData.PageLinkBookmarks.NextLink = false;
			tmpRecordDashboardData.PageLinkBookmarks.ShowNextLink = false;
		}
		else
		{
			tmpRecordDashboardData.PageLinkBookmarks.NextLink = tmpRecordDashboardData.PageLinks[tmpRecordDashboardData.PageLinkBookmarks.Next];
		}

		if (pDashboardHash && !tmpManifestDefinition.Form)
		{
			tmpRecordDashboardData.TableCells = tmpManifestDefinition?.TableCells;
		}
		if (!tmpRecordDashboardData.TableCells && !tmpManifestDefinition.Form)
		{
			// Put code here to preprocess columns into other data parts.
			/*
				"RecordSetDashboardManifestOnly": false,

				"RecordSetListManifests": [ "Bestsellers", "Underdogs", "NewReleases" ],
				"RecordSetDashboardManifests": [ "Bestsellers" ],
			 */
			if (pRecordSetConfiguration.RecordSetDashboardManifestOnly)
			{
				const tmpManifestHash = pRecordSetConfiguration.RecordSetDashboardDefaultManifest || pRecordSetConfiguration.RecordSetDashboardManifests?.[0];
				const tmpManifest = this.pict.PictSectionRecordSet.getManifest(tmpManifestHash);
				if (!tmpManifest)
				{
					this.pict.log.error(`RecordSetDashboard: No manifest found for ${pRecordSetConfiguration.RecordSet}.  List Render failed.`);
				}
				else
				{
					// @ts-ignore
					tmpRecordDashboardData.TableCells = tmpManifest.TableCells;
				}
			}
			if (!tmpRecordDashboardData.TableCells)
			{
				if (tmpRecordDashboardData.RecordSetConfiguration.hasOwnProperty('RecordSetListColumns'))
				{
					tmpRecordDashboardData.TableCells = tmpRecordDashboardData.RecordSetConfiguration.RecordSetListColumns.map((key) =>
						{
							if (typeof key === 'object')
							{
								if (!key.DisplayName)
								{
									key.DisplayName = key.Key; //FIXME: use schema?
								}
								if (!key.ManifestHash)
								{
									key.ManifestHash = 'Default';
								}
								if (key.PictDashboard && !key.PictDashboard.ValueTemplate)
								{
									key.PictDashboard.ValueTemplate = '{~ProcessCell:Record.Data.Key~}';
								}
								return key;
							}
							return {
								Key: key,
								DisplayName: key, //FIXME: use schema?
								ManifestHash: 'Default',
								PictDashboard:
								{
									ValueTemplate: '{~ProcessCell:Record.Data.Key~}',
								},
							};
						});
				}
				else
				{
					this.dynamicallyGenerateColumns(tmpRecordDashboardData);
				}
			}
		}

		tmpRecordDashboardData = this.onBeforeRenderList(tmpRecordDashboardData);

		if (!tmpManifestDefinition.Form)
		{
			this.pict.providers.DynamicRecordsetSolver.solveDashboard(tmpManifestDefinition, tmpRecordDashboardData.Records.Records);
		}
		else
		{
			this.pict.AppData['PSRS-Dashboard-Data'] = tmpRecordDashboardData.Records.Records;
			this.pict.TemplateProvider.addTemplate('PRSP-Dashboard-RecordDashboard-Template', /*html*/`
				<!-- Manifest dynamic pict template: [PRSP-Dashboard-RecordDashboard-Template] -->
				<div>${ this._generateFormManifestTemplate(tmpManifestDefinition, 'RecordDashboard') }</div>
				<!-- Manifest dynamic pict end template: [PRSP-Dashboard-RecordDashboard-Template] -->
			`);
		}

		this.renderAsync(tmpManifestDefinition.Form ? (tmpManifestDefinition.WithRecordsetData ? 'PRSP_Renderable_Form_With_Recordset_Data' : 'PRSP_Renderable_Form') : 'PRSP_Renderable_List', tmpRecordDashboardData.RenderDestination, tmpRecordDashboardData,
			function (pError)
			{
				if (pError)
				{
					this.pict.log.error(`RecordSetDashboard: Error rendering list ${pError}`, tmpRecordDashboardData);
					return;
				}

				if (this.pict.LogNoisiness > 0)
				{
					this.pict.log.info(`RecordSetDashboard: Rendered list ${tmpRecordDashboardData.RecordSet} with ${tmpRecordDashboardData.Records.Records.length} records.`, tmpRecordDashboardData);
				}
				else
				{
					this.pict.log.info(`RecordSetDashboard: Rendered list ${tmpRecordDashboardData.RecordSet} with ${tmpRecordDashboardData.Records.Records.length} records.`);
				}
				for (const s of tmpManifestDefinition?.Sections || [])
				{
					this.pict.views[`PictSectionForm-${ s.Hash }`].render();
					this.pict.views[`PictSectionForm-${ s.Hash }`].marshalToView();
				}
			}.bind(this));
	}

	_generateFormManifestTemplate(tmpManifest, section)
	{
		if (!tmpManifest)
		{
			this.pict.log.error(`RecordSetDashboard: No manifest found for dashboard. Render failed.`);
			return '';
		}
		if (!tmpManifest.Descriptors)
		{
			this.pict.log.error(`RecordSetDashboard: No manifest descriptors found for manifest. Render failed.`);
			return '';
		}

		this.manifest = tmpManifest;
		let sectionsTemplate = '';
		for (const s of tmpManifest?.Sections || [])
		{
			delete this.pict.views[`PictSectionForm-${ s.Hash }`]
		}
		this.pict.views.PictFormMetacontroller.clearManifestDescription();
		this.pict.views.PictFormMetacontroller.bootstrapPictFormViewsFromManifest(tmpManifest);

		for (const pickList of tmpManifest?.PickLists || [])
		{
			this.pict.providers.DynamicMetaLists.rebuildListByHash(pickList.Hash);
		}

		for (const s of tmpManifest?.Sections || [])
		{
			const viewSectionID = `PSRS-Dashboard-${ section }-Section-${ s.Hash }`;
			sectionsTemplate += /*html*/`<div id="${ viewSectionID }"></div>`;
			this.pict.views[`PictSectionForm-${ s.Hash }`].viewMarshalDestination = 'AppData';
			this.pict.views[`PictSectionForm-${ s.Hash }`].options.DefaultDestinationAddress = `#${ viewSectionID }`;
			this.pict.views[`PictSectionForm-${ s.Hash }`].rebuildCustomTemplate();
		}
		return sectionsTemplate
	}

	/**
	 * @param {Record<string, any>} pRecordSetConfiguration
	 * @param {string} pProviderHash
	 * @param {string} pFilterString
	 * @param {string} pSerializedFilterExperience
	 * @param {number} pOffset
	 * @param {number} pPageSize
	 *
	 * @return {Promise<void>}
	 */
	async renderDashboard(pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize)
	{
		if (!pRecordSetConfiguration)
		{
			this.pict.log.error(`RecordSetDashboard: No record set configuration found.  List Render failed.`);
			return;
		}
		// Get the records
		if (!(pProviderHash in this.pict.providers))
		{
			this.pict.log.error(`RecordSetDashboard: No provider found for ${pProviderHash} in ${pRecordSetConfiguration.RecordSet}.  List Render failed.`);
			return;
		}
		if (pRecordSetConfiguration.RecordSetDashboardManifestOnly)
		{
			const tmpManifestHash = pRecordSetConfiguration.RecordSetDashboardDefaultManifest || pRecordSetConfiguration.RecordSetDashboardManifests?.[0];
			const tmpManifest = this.pict.PictSectionRecordSet.getManifest(tmpManifestHash);
			if (!tmpManifest)
			{
				this.pict.log.error(`RecordSetDashboard: No manifest found for ${pRecordSetConfiguration.RecordSet}.  List Render failed.`);
			}
			else
			{
				return this.renderSpecificDashboard(tmpManifestHash, pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize);
			}
		}

		const tmpEncodedFilterExperience = pSerializedFilterExperience && encodeURIComponent(pSerializedFilterExperience);
		if (tmpEncodedFilterExperience)
		{
			// shove filter xp into the active filters for this recordset
			const tmpExperienceFromURL = await this.pict.views['PRSP-Filters'].deserializeFilterExperience(pSerializedFilterExperience);
			if (tmpExperienceFromURL)
			{
				this.pict.manifest.setValueByHash(this.pict.Bundle, `_ActiveFilterState[${pRecordSetConfiguration.RecordSet}].FilterClauses`, tmpExperienceFromURL);
			}
		}

		let tmpRecordDashboardData =
		{
			"Title": pRecordSetConfiguration.Title || pRecordSetConfiguration.RecordSet,

			"RecordSet": pRecordSetConfiguration.RecordSet,
			"RecordSetConfiguration": pRecordSetConfiguration,

			"RenderDestination": this.options.DefaultDestinationAddress,

			"FilterString": pFilterString ? encodeURIComponent(pFilterString) : undefined,

			"Records": { "Records": [] },
			"TotalRecordCount": { "Count": -1 },

			"Offset": pOffset || 0,
			"PageSize": pPageSize || 100,
		};

		// TODO: There are still problems with the way these have nested data.  Discuss how we might move that around
		// Fetch the records
		// Seed any configured default filter clauses (e.g. DefaultRelativeDays) BEFORE the
		// fetch, so the first paint is already filtered the way the dashboard is configured
		// rather than filtered only once the user presses Apply.
		if (this.pict.views['PRSP-Filters'] && (typeof this.pict.views['PRSP-Filters'].seedDefaultFilterClauses === 'function'))
		{
			await this.pict.views['PRSP-Filters'].seedDefaultFilterClauses(tmpRecordDashboardData.RecordSet);
		}
		const [ tmpRecords, tmpTotalRecordCount, tmpRecordSchema ] = await Promise.all([
			this.pict.providers[pProviderHash].getDecoratedRecords(tmpRecordDashboardData),
			this.pict.providers[pProviderHash].getRecordSetCount(tmpRecordDashboardData),
			this.pict.providers[pProviderHash].getRecordSchema(),
		]);
		tmpRecordDashboardData.Records = tmpRecords;
		// Get the total record count
		tmpRecordDashboardData.TotalRecordCount = tmpTotalRecordCount;
		// Get the record schema
		tmpRecordDashboardData.RecordSchema = tmpRecordSchema;

		// TODO: This should be coming from the schema but that can come after we discuss how we deal with default routing
		tmpRecordDashboardData.GUIDAddress = this.pict.providers[pProviderHash].getGUIDField();

		// Get the "page end record number" for the current page (e.g. for messaging like Record 700 to 800 of 75,000)
		const tmpOffset = Number(tmpRecordDashboardData.Offset);
		tmpRecordDashboardData.PageEnd = tmpOffset + tmpRecordDashboardData.Records.Records.length;
		// 1-based start record number for the "Showing X to Y" counter (the raw 0-based Offset would read "0 to ..." on page 1)
		tmpRecordDashboardData.PageStart = (tmpRecordDashboardData.Records.Records.length > 0) ? (tmpOffset + 1) : 0;

		// Compute the number of pages total
		tmpRecordDashboardData.PageCount = Math.ceil(tmpRecordDashboardData.TotalRecordCount.Count / tmpRecordDashboardData.PageSize);

		// Generate each page's links.
		// TODO: This is fast and cool; any reason not to?
		// Get "bookmarks" as references to the array of page links.
		tmpRecordDashboardData.PageLinkBookmarks = (
			{
				Current: Math.floor(tmpRecordDashboardData.Offset / tmpRecordDashboardData.PageSize)
			});
		tmpRecordDashboardData.PageLinks = [];
		for (let i = 0; i < tmpRecordDashboardData.PageCount; i++)
		{
			if (tmpRecordDashboardData.FilterString)
			{
				tmpRecordDashboardData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/Dashboard/FilteredTo/${tmpRecordDashboardData.FilterString}/${i * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			else
			{
				tmpRecordDashboardData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/Dashboard/${i * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordDashboardData.PageLinks[tmpRecordDashboardData.PageLinks.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		//FIXME: short-term workaround to not blow up the tempplate rendering with way too many links
		const linkRangeStart = Math.max(0, tmpRecordDashboardData.PageLinkBookmarks.Current - 10);
		const linkRangeEnd = Math.min(tmpRecordDashboardData.PageLinks.length, tmpRecordDashboardData.PageLinkBookmarks.Current + 10);
		tmpRecordDashboardData.PageLinksLimited = tmpRecordDashboardData.PageLinks.slice(linkRangeStart, linkRangeEnd);
		if (linkRangeStart > 0)
		{
			if (tmpRecordDashboardData.FilterString)
			{
				tmpRecordDashboardData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/Dashboard/FilteredTo/${tmpRecordDashboardData.FilterString}/${tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			else
			{
				tmpRecordDashboardData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/Dashboard/${0}/${tmpRecordDashboardData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordDashboardData.PageLinksLimited[tmpRecordDashboardData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}
		if (linkRangeEnd < tmpRecordDashboardData.PageLinks.length)
		{
			if (tmpRecordDashboardData.FilterString)
			{
				tmpRecordDashboardData.PageLinksLimited.push(
					{
						Page: tmpRecordDashboardData.PageCount,
						RelativeOffset: (tmpRecordDashboardData.PageCount - 1) - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/Dashboard/FilteredTo/${tmpRecordDashboardData.FilterString}/${(tmpRecordDashboardData.PageCount - 1) * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			else
			{
				tmpRecordDashboardData.PageLinksLimited.push(
					{
						Page: tmpRecordDashboardData.PageCount,
						RelativeOffset: (tmpRecordDashboardData.PageCount - 1) - tmpRecordDashboardData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordDashboardData.RecordSet}/Dashboard/${(tmpRecordDashboardData.PageCount - 1) * tmpRecordDashboardData.PageSize}/${tmpRecordDashboardData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordDashboardData.PageLinksLimited[tmpRecordDashboardData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		tmpRecordDashboardData.PageLinkBookmarks.Previous = tmpRecordDashboardData.PageLinkBookmarks.Current - 1;
		tmpRecordDashboardData.PageLinkBookmarks.Next = tmpRecordDashboardData.PageLinkBookmarks.Current + 1;
		tmpRecordDashboardData.PageLinkBookmarks.ShowPreviousLink = true;
		tmpRecordDashboardData.PageLinkBookmarks.ShowNextLink = true;
		if (tmpRecordDashboardData.PageLinkBookmarks.Previous < 0)
		{
			tmpRecordDashboardData.PageLinkBookmarks.PreviousLink = false;
			tmpRecordDashboardData.PageLinkBookmarks.ShowPreviousLink = false;
		}
		else
		{
			tmpRecordDashboardData.PageLinkBookmarks.PreviousLink = tmpRecordDashboardData.PageLinks[tmpRecordDashboardData.PageLinkBookmarks.Previous];
		}
		if (tmpRecordDashboardData.PageLinkBookmarks.Next >= tmpRecordDashboardData.PageLinks.length)
		{
			tmpRecordDashboardData.PageLinkBookmarks.NextLink = false;
			tmpRecordDashboardData.PageLinkBookmarks.ShowNextLink = false;
		}
		else
		{
			tmpRecordDashboardData.PageLinkBookmarks.NextLink = tmpRecordDashboardData.PageLinks[tmpRecordDashboardData.PageLinkBookmarks.Next];
		}

		// Put code here to preprocess columns into other data parts.
		/*
			"RecordSetDashboardManifestOnly": false,

			"RecordSetListManifests": [ "Bestsellers", "Underdogs", "NewReleases" ],
			"RecordSetDashboardManifests": [ "Bestsellers" ],
		 */
		if (tmpRecordDashboardData.RecordSetConfiguration.hasOwnProperty('RecordSetListColumns'))
		{
			tmpRecordDashboardData.TableCells = tmpRecordDashboardData.RecordSetConfiguration.RecordSetListColumns.map((pKey) =>
				{
					if (typeof pKey === 'object')
					{
						const tmpTableCell = pKey;
						if (!tmpTableCell.DisplayName)
						{
							tmpTableCell.DisplayName = tmpTableCell.Key; //FIXME: use schema?
						}
						if (!tmpTableCell.ManifestHash)
						{
							tmpTableCell.ManifestHash = 'Default';
						}
						if (!tmpTableCell.PictDashboard)
						{
							tmpTableCell.PictDashboard = {};
						}
						if (!tmpTableCell.PictDashboard.ValueTemplate)
						{
							tmpTableCell.PictDashboard.ValueTemplate = '{~ProcessCell:Record.Data.Key~}';
						}
						return tmpTableCell;
					}
					return {
						Key: pKey,
						DisplayName: pKey, //FIXME: use schema?
						ManifestHash: 'Default',
						PictDashboard:
						{
							ValueTemplate: '{~ProcessCell:Record.Data.Key~}',
						},
					};
				});
		}
		else
		{
			this.dynamicallyGenerateColumns(tmpRecordDashboardData);
		}

		tmpRecordDashboardData = this.onBeforeRenderList(tmpRecordDashboardData);

		const tmpManifest = { Scope: 'Default', Descriptors: { }, TableCells: tmpRecordDashboardData.TableCells };
		for (const tmpCell of tmpRecordDashboardData.TableCells)
		{
			tmpManifest.Descriptors[tmpCell.Key] = { Hash: tmpCell.Key, PictDashboard: tmpCell.PictDashboard };
		}
		this.pict.providers.DynamicRecordsetSolver.solveDashboard(tmpManifest, tmpRecordDashboardData.Records.Records);

		this.renderAsync('PRSP_Renderable_List', tmpRecordDashboardData.RenderDestination, tmpRecordDashboardData,
			function (pError)
			{
				if (pError)
				{
					this.pict.log.error(`RecordSetDashboard: Error rendering list ${pError}`, tmpRecordDashboardData);
					return;
				}

				if (this.pict.LogNoisiness > 0)
				{
					this.pict.log.info(`RecordSetDashboard: Rendered list ${tmpRecordDashboardData.RecordSet} with ${tmpRecordDashboardData.Records.Records.length} records.`, tmpRecordDashboardData);
				}
				else
				{
					this.pict.log.info(`RecordSetDashboard: Rendered list ${tmpRecordDashboardData.RecordSet} with ${tmpRecordDashboardData.Records.Records.length} records.`);
				}
			}.bind(this));
	}

	onInitialize()
	{
		this.childViews.headerList = this.pict.addView('PRSP-Dashboard-HeaderDashboard', viewHeaderDashboard.default_configuration, viewHeaderDashboard);
		this.childViews.title = this.pict.addView('PRSP-Dashboard-Title', viewTitle.default_configuration, viewTitle);
		this.childViews.filters = this.pict.views['PRSP-Filters'] || this.pict.addView('PRSP-Filters', { }, viewFilters);
		this.childViews.paginationTop = this.pict.addView('PRSP-Dashboard-PaginationTop', viewPaginationTop.default_configuration, viewPaginationTop);
		this.childViews.recordList = this.pict.addView('PRSP-Dashboard-RecordList', viewRecordList.default_configuration, viewRecordList);
		this.childViews.recordListHeader = this.pict.addView('PRSP-Dashboard-RecordListHeader', viewRecordListHeader.default_configuration, viewRecordListHeader);
		this.childViews.recordListEntry = this.pict.addView('PRSP-Dashboard-RecordListEntry', viewRecordListEntry.default_configuration, viewRecordListEntry);
		this.childViews.paginationBottom = this.pict.addView('PRSP-Dashboard-PaginationBottom', viewPaginationBottom.default_configuration, viewPaginationBottom);

		// Initialize the subviews
		this.childViews.headerList.initialize();
		this.childViews.title.initialize();
		this.childViews.paginationTop.initialize();
		this.childViews.recordList.initialize();
		this.childViews.recordListHeader.initialize();
		this.childViews.recordListEntry.initialize();
		this.childViews.paginationBottom.initialize();

		return super.onInitialize();
	}
}

module.exports = viewRecordSetDashboard;

module.exports.default_configuration = _DEFAULT_CONFIGURATION__Dashboard;

