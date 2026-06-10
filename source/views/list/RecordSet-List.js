const libPictRecordSetRecordView = require('../RecordSet-RecordBaseView.js');

const viewHeaderList = require('./RecordSet-List-HeaderList.js');
const viewTitle = require('./RecordSet-List-Title.js');
const viewFilters = require('../RecordSet-Filters.js');
const viewPaginationTop = require('./RecordSet-List-PaginationTop.js');
const viewRecordList = require('./RecordSet-List-RecordList.js');
const viewRecordListHeader = require('./RecordSet-List-RecordListHeader.js');
const viewRecordListEntry = require('./RecordSet-List-RecordListEntry.js');
const viewPaginationBottom = require('./RecordSet-List-PaginationBottom.js');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION__List = (
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

		CSS: /*css*/`
	.prsp-list-loading { display: flex; align-items: center; justify-content: center; min-height: 240px; width: 100%; }
	.prsp-list-loading-inner { display: inline-flex; align-items: center; gap: 0.6em; color: var(--theme-color-text-muted, #64748b); font-size: 1.05rem; }
	.prsp-list-spinner { display: inline-flex; animation: prsp-list-spin 0.9s linear infinite; }
	@keyframes prsp-list-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	`,
		CSSPriority: 500,

		Templates:
			[
				{
					Hash: 'PRSP-List-Template',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Template] -->
	<section id="PRSP_List_Container">
		{~V:PRSP-List-Title~}
		{~V:PRSP-List-HeaderList~}
		<section id="PRSP_Filters_Container">
			{~FV:PRSP-Filters:List~}
		</section>
		<div id="PRSP_PaginationTop_Container">{~V:PRSP-List-PaginationTop~}</div>
		<div id="PRSP_RecordList_Container">{~V:PRSP-List-RecordList~}</div>
		<div id="PRSP_PaginationBottom_Container">{~V:PRSP-List-PaginationBottom~}</div>
	</section>
	<!-- DefaultPackage end view template:  [PRSP-List-Template] -->
	`
				},
				{
					Hash: 'PRSP-List-Template-Record',
					Template: /*html*/`
	<!-- DefaultPackage end view template:  [PRSP-List-Template] -->
	`
				},
				{
					Hash: 'PRSP-List-LoadingShell',
					Template: /*html*/`
	<section id="PRSP_List_Loading" class="prsp-list-loading">
		<div class="prsp-list-loading-inner">
			<span class="prsp-list-spinner" aria-hidden="true">{~I:Refresh~}</span>
			<span class="prsp-list-loading-label">Loading…</span>
		</div>
	</section>
	`
				}
			],

		Renderables:
			[
				{
					RenderableHash: 'PRSP_Renderable_List',
					TemplateHash: 'PRSP-List-Template',
					DestinationAddress: '#PRSP_Container',
					RenderMethod: 'replace'
				}
			],

		Manifests: {}
	});

class viewRecordSetList extends libPictRecordSetRecordView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION__List, pOptions);
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

		// Identity (`RecordSet::FilterString::FilterExperience`) of the list currently painted into the DOM.
		// When a route only changes the page (Offset/PageSize) and this still matches, we re-render just the
		// rows + pagination instead of the whole view — see handleRecordSetListRoute / _paintRecordList.
		this._renderedListIdentity = null;
	}

	handleRecordSetListRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet List view route handler called with invalid route payload.`);
		}

		//_Pict.PictSectionRecordSet.recordSetProviderConfigurations['Book'], 'RSP-Provider-Book'
		// FIXME: Not in love with this but good enough to start.
		// FIXME: Typescript mumbo jumbo
		// if (!('PictSectionRecordSet' in this.pict))
		// {
		// 	return false;
		// }
		const tmpProviderConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[pRoutePayload.data.RecordSet];
		const tmpProviderHash = `RSP-Provider-${pRoutePayload.data.RecordSet}`;

		const tmpFilterString = pRoutePayload.data.FilterString || '';
		const tmpFilterExperience = pRoutePayload.data.FilterExperience || '';

		const tmpOffset = pRoutePayload.data.Offset ? pRoutePayload.data.Offset : 0;
		const tmpPageSize = pRoutePayload.data.PageSize ? pRoutePayload.data.PageSize : 100;

		// Surgical page render: when only the page changed (same RecordSet, FilterString, and
		// FilterExperience), re-render just the rows + pagination rather than the whole list view. A full
		// re-render rebuilds the filter view — including all of its picker/control state — which is by far
		// the most expensive part of a list paint and entirely wasted when only paging. Requires the list to
		// already be in the DOM (its rows container exists); otherwise we fall through to a full render.
		const tmpListIdentity = `${pRoutePayload.data.RecordSet}::${tmpFilterString}::${tmpFilterExperience}`;
		const tmpRenderBodyOnly = (this._renderedListIdentity === tmpListIdentity)
			&& (this.pict.ContentAssignment.getElement('#PRSP_RecordList_Container').length > 0);
		this._renderedListIdentity = tmpListIdentity;

		return this.renderList(tmpProviderConfiguration, tmpProviderHash, tmpFilterString, tmpFilterExperience, tmpOffset, tmpPageSize, tmpRenderBodyOnly);
	}

	addRoutes(pPictRouter)
	{
		pPictRouter.router.on('/PSRS/:RecordSet/List/FilterExperience/:FilterExperience', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List/FilteredTo/:FilterString/FilterExperience/:FilterExperience', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List/FilteredTo/:FilterString/:Offset/:PageSize/FilterExperience/:FilterExperience', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List/FilteredTo/:FilterString/:Offset/:PageSize', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List/FilteredTo/:FilterString', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List/:Offset/:PageSize/FilterExperience/:FilterExperience', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List/:Offset/:PageSize', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List/:Offset', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.on('/PSRS/:RecordSet/List', this.handleRecordSetListRoute.bind(this));
		pPictRouter.router.resolve();
		return true;
	}

	onBeforeRenderList(pRecordListData)
	{
		return pRecordListData;
	}

	/**
	 * Paint a loading shell into the list destination synchronously, before the data
	 * fetch, so the previous page doesn't sit silently while a slow query runs. The
	 * real list render (RenderMethod 'replace' into the same destination) overwrites
	 * it when data arrives. Opt out with RecordSetListShowLoadingShell:false.
	 * @param {Record<string, any>} pRecordListData
	 */
	_projectLoadingShell(pRecordListData)
	{
		try
		{
			const tmpConfig = pRecordListData && pRecordListData.RecordSetConfiguration;
			if (tmpConfig && tmpConfig.RecordSetListShowLoadingShell === false)
			{
				return;
			}
			if (!pRecordListData || !pRecordListData.RenderDestination)
			{
				return;
			}
			// When the list is already on screen, scope the spinner to just the rows area so the title,
			// filters, and pagination stay put (and the expensive filter view isn't disturbed). On the first
			// render the rows container doesn't exist yet, so fall back to the whole list destination.
			const tmpRowsContainerPresent = this.pict.ContentAssignment.getElement('#PRSP_RecordList_Container').length > 0;
			const tmpDestination = tmpRowsContainerPresent ? '#PRSP_RecordList_Container' : pRecordListData.RenderDestination;
			this.pict.CSSMap.injectCSS();
			this.pict.ContentAssignment.assignContent(tmpDestination, this.pict.parseTemplateByHash('PRSP-List-LoadingShell', pRecordListData));
		}
		catch (pError)
		{
			// The loading shell is purely cosmetic; never let it break the list render.
			this.log.warn(`RecordSetList: loading shell render failed: ${ pError && pError.message }`);
		}
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
						'Key': tmpColumn,
						'DisplayName': tmpProperties?.[tmpColumn].title || tmpColumn,
						'PictDashboard': {
							'ValueTemplate': '{~ProcessCell:Record.Data.Key~}'
						}
					});
				}
			}
		}
		return pRecordListData;
	}

	/**
	 * @param {Record<string, any>} pRecordSetConfiguration
	 * @param {string} pProviderHash
	 * @param {string} pFilterString
	 * @param {string} pSerializedFilterExperience
	 * @param {number} pOffset
	 * @param {number} pPageSize
	 * @param {boolean} [pBodyOnly] - When true, re-render only the rows + pagination (page change), leaving the filter view intact.
	 *
	 * @return {Promise<void>}
	 */
	async renderList(pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize, pBodyOnly)
	{
		// Get the records
		if (!(pProviderHash in this.pict.providers))
		{
			this.pict.log.error(`RecordSetList: No provider found for ${pProviderHash} in RecordSet ${(pRecordSetConfiguration || {}).RecordSet}.  List Render failed.`);
			return;
		}

		if (pRecordSetConfiguration.RecordSetListManifestOnly)
		{
			const tmpManifestHash = pRecordSetConfiguration.RecordSetListDefaultManifest || pRecordSetConfiguration.RecordSetListManifests?.[0];
			const tmpManifest = this.pict.PictSectionRecordSet.manifestDefinitions[tmpManifestHash];
			if (!tmpManifest)
			{
				this.pict.log.error(`RecordSetList: No manifest found for ${pRecordSetConfiguration.RecordSet}.  List Render failed.`);
			}
			else
			{
				return this.renderListFromManifest(tmpManifest, pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize, pBodyOnly);
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

		let tmpRecordListData =
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
		// Paint a loading shell before the (potentially slow) fetch so the prior page
		// doesn't sit silently; the real list render replaces it when data arrives.
		this._projectLoadingShell(tmpRecordListData);
		// Fetch the records
		const [ tmpRecords, tmpTotalRecordCount, tmpRecordSchema ] = await Promise.all([
			this.pict.providers[pProviderHash].getRecords(tmpRecordListData),
			this.pict.providers[pProviderHash].getRecordSetCount(tmpRecordListData),
			this.pict.providers[pProviderHash].getRecordSchema(),
		]);
		tmpRecordListData.Records = tmpRecords;
		// Get the total record count
		tmpRecordListData.TotalRecordCount = tmpTotalRecordCount;
		// Get the record schema
		tmpRecordListData.RecordSchema = tmpRecordSchema;

		// TODO: This should be coming from the schema but that can come after we discuss how we deal with default routing
		tmpRecordListData.GUIDAddress = this.pict.providers[pProviderHash].getGUIDField();

		// Get the "page end record number" for the current page (e.g. for messaging like Record 700 to 800 of 75,000)
		tmpRecordListData.PageEnd = Number(tmpRecordListData.Offset) + tmpRecordListData.Records.Records.length;

		// Compute the number of pages total
		tmpRecordListData.PageCount = Math.ceil(tmpRecordListData.TotalRecordCount.Count / tmpRecordListData.PageSize);

		// Generate each page's links.
		// TODO: This is fast and cool; any reason not to?
		// Get "bookmarks" as references to the array of page links.
		tmpRecordListData.PageLinkBookmarks = (
			{
				Current: Math.floor(tmpRecordListData.Offset / tmpRecordListData.PageSize)
			});
		tmpRecordListData.PageLinks = [];
		for (let i = 0; i < tmpRecordListData.PageCount; i++)
		{
			if (tmpRecordListData.FilterString)
			{
				tmpRecordListData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/FilteredTo/${tmpRecordListData.FilterString}/${i * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			else
			{
				tmpRecordListData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/${i * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordListData.PageLinks[tmpRecordListData.PageLinks.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		//FIXME: short-term workaround to not blow up the tempplate rendering with way too many links
		const linkRangeStart = Math.max(0, tmpRecordListData.PageLinkBookmarks.Current - 10);
		const linkRangeEnd = Math.min(tmpRecordListData.PageLinks.length, tmpRecordListData.PageLinkBookmarks.Current + 10);
		tmpRecordListData.PageLinksLimited = tmpRecordListData.PageLinks.slice(linkRangeStart, linkRangeEnd);
		if (linkRangeStart > 0)
		{
			if (tmpRecordListData.FilterString)
			{
				tmpRecordListData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/FilteredTo/${tmpRecordListData.FilterString}/${tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			else
			{
				tmpRecordListData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/${0}/${tmpRecordListData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordListData.PageLinksLimited[tmpRecordListData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}
		if (linkRangeEnd < tmpRecordListData.PageLinks.length)
		{
			if (tmpRecordListData.FilterString)
			{
				tmpRecordListData.PageLinksLimited.push(
					{
						Page: tmpRecordListData.PageCount,
						RelativeOffset: (tmpRecordListData.PageCount - 1) - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/FilteredTo/${tmpRecordListData.FilterString}/${(tmpRecordListData.PageCount - 1) * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			else
			{
				tmpRecordListData.PageLinksLimited.push(
					{
						Page: tmpRecordListData.PageCount,
						RelativeOffset: (tmpRecordListData.PageCount - 1) - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/${(tmpRecordListData.PageCount - 1) * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordListData.PageLinksLimited[tmpRecordListData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		tmpRecordListData.PageLinkBookmarks.Previous = tmpRecordListData.PageLinkBookmarks.Current - 1;
		tmpRecordListData.PageLinkBookmarks.Next = tmpRecordListData.PageLinkBookmarks.Current + 1;
		tmpRecordListData.PageLinkBookmarks.ShowPreviousLink = true;
		tmpRecordListData.PageLinkBookmarks.ShowNextLink = true;
		if (tmpRecordListData.PageLinkBookmarks.Previous < 0)
		{
			tmpRecordListData.PageLinkBookmarks.PreviousLink = false;
			tmpRecordListData.PageLinkBookmarks.ShowPreviousLink = false;
		}
		else
		{
			tmpRecordListData.PageLinkBookmarks.PreviousLink = tmpRecordListData.PageLinks[tmpRecordListData.PageLinkBookmarks.Previous];
		}
		if (tmpRecordListData.PageLinkBookmarks.Next >= tmpRecordListData.PageLinks.length)
		{
			tmpRecordListData.PageLinkBookmarks.NextLink = false;
			tmpRecordListData.PageLinkBookmarks.ShowNextLink = false;
		}
		else
		{
			tmpRecordListData.PageLinkBookmarks.NextLink = tmpRecordListData.PageLinks[tmpRecordListData.PageLinkBookmarks.Next];
		}

		// When there is only a single page there is nothing to paginate: hide the page
		// buttons and the previous/next links. The "Showing X to Y of Z" summary stays.
		if (tmpRecordListData.PageCount <= 1)
		{
			tmpRecordListData.PageLinksLimited = [];
			tmpRecordListData.PageLinkBookmarks.ShowPreviousLink = false;
			tmpRecordListData.PageLinkBookmarks.ShowNextLink = false;
		}
		// Put code here to preprocess columns into other data parts.
		if (tmpRecordListData.RecordSetConfiguration.hasOwnProperty('RecordSetListColumns'))
		{
			tmpRecordListData.TableCells = tmpRecordListData.RecordSetConfiguration.RecordSetListColumns.map((key) =>
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
						if (!key.PictDashboard)
						{
							key.PictDashboard =
							{
								ValueTemplate: '{~ProcessCell:Record.Data.Key~}',
							};
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
			this.dynamicallyGenerateColumns(tmpRecordListData);
		}
		tmpRecordListData = this.onBeforeRenderList(tmpRecordListData);

		this._paintRecordList(tmpRecordListData, pBodyOnly);
	}

	/**
	 * @param {object} pManifest
	 * @param {Record<string, any>} pRecordSetConfiguration
	 * @param {string} pProviderHash
	 * @param {string} pFilterString
	 * @param {string} pSerializedFilterExperience
	 * @param {number} pOffset
	 * @param {number} pPageSize
	 * @param {boolean} [pBodyOnly] - When true, re-render only the rows + pagination (page change), leaving the filter view intact.
	 *
	 * @return {Promise<void>}
	 */
	async renderListFromManifest(pManifest, pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize, pBodyOnly)
	{
		if (!pRecordSetConfiguration)
		{
			this.pict.log.error(`RecordSetList: No record set configuration found.  List Render failed.`);
			return;
		}
		// Get the records
		if (!(pProviderHash in this.pict.providers))
		{
			this.pict.log.error(`RecordSetList: No provider found for ${pProviderHash} in ${pRecordSetConfiguration.RecordSet}.  List Render failed.`);
			return;
		}

		let tmpTitle = pRecordSetConfiguration.Title || pRecordSetConfiguration.RecordSet;
		if (pManifest && pManifest.TitleTemplate)
		{
			tmpTitle = this.pict.parseTemplate(pManifest.TitleTemplate, pRecordSetConfiguration);
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

		let tmpRecordListData =
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
		};

		// TODO: There are still problems with the way these have nested data.  Discuss how we might move that around
		// Paint a loading shell before the (potentially slow) fetch so the prior page
		// doesn't sit silently; the real list render replaces it when data arrives.
		this._projectLoadingShell(tmpRecordListData);
		// Fetch the records
		tmpRecordListData.Records = await this.pict.providers[pProviderHash].getDecoratedRecords(tmpRecordListData);
		// Get the total record count
		tmpRecordListData.TotalRecordCount = await this.pict.providers[pProviderHash].getRecordSetCount(tmpRecordListData);
		// Get the record schema
		tmpRecordListData.RecordSchema = await this.pict.providers[pProviderHash].getRecordSchema();

		// TODO: This should be coming from the schema but that can come after we discuss how we deal with default routing
		tmpRecordListData.GUIDAddress = this.pict.providers[pProviderHash].getGUIDField();

		// Get the "page end record number" for the current page (e.g. for messaging like Record 700 to 800 of 75,000)
		const tmpOffset = Number(tmpRecordListData.Offset);
		tmpRecordListData.PageEnd = tmpOffset + tmpRecordListData.Records.Records.length;

		// Compute the number of pages total
		tmpRecordListData.PageCount = Math.ceil(tmpRecordListData.TotalRecordCount.Count / tmpRecordListData.PageSize);

		// Generate each page's links.
		// TODO: This is fast and cool; any reason not to?
		// Get "bookmarks" as references to the array of page links.
		tmpRecordListData.PageLinkBookmarks = (
			{
				Current: Math.floor(tmpRecordListData.Offset / tmpRecordListData.PageSize)
			});
		tmpRecordListData.PageLinks = [];
		for (let i = 0; i < tmpRecordListData.PageCount; i++)
		{
			if (tmpRecordListData.FilterString)
			{
				tmpRecordListData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/FilteredTo/${tmpRecordListData.FilterString}/${i * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			else
			{
				tmpRecordListData.PageLinks.push(
					{
						Page: i + 1,
						RelativeOffset: i - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/${i * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordListData.PageLinks[tmpRecordListData.PageLinks.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		//FIXME: short-term workaround to not blow up the tempplate rendering with way too many links
		const linkRangeStart = Math.max(0, tmpRecordListData.PageLinkBookmarks.Current - 10);
		const linkRangeEnd = Math.min(tmpRecordListData.PageLinks.length, tmpRecordListData.PageLinkBookmarks.Current + 10);
		tmpRecordListData.PageLinksLimited = tmpRecordListData.PageLinks.slice(linkRangeStart, linkRangeEnd);
		if (linkRangeStart > 0)
		{
			if (tmpRecordListData.FilterString)
			{
				tmpRecordListData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/FilteredTo/${tmpRecordListData.FilterString}/0/${tmpRecordListData.PageSize}`
					});
			}
			else
			{
				tmpRecordListData.PageLinksLimited.unshift(
					{
						Page: 1,
						RelativeOffset: -tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/0/${tmpRecordListData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordListData.PageLinksLimited[tmpRecordListData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}
		if (linkRangeEnd < tmpRecordListData.PageLinks.length)
		{
			if (tmpRecordListData.FilterString)
			{
				tmpRecordListData.PageLinksLimited.push(
					{
						Page: tmpRecordListData.PageCount,
						RelativeOffset: (tmpRecordListData.PageCount - 1) - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/FilteredTo/${tmpRecordListData.FilterString}/${(tmpRecordListData.PageCount - 1) * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			else
			{
				tmpRecordListData.PageLinksLimited.push(
					{
						Page: tmpRecordListData.PageCount,
						RelativeOffset: (tmpRecordListData.PageCount - 1) - tmpRecordListData.PageLinkBookmarks.Current,
						URL: `#/PSRS/${tmpRecordListData.RecordSet}/List/${(tmpRecordListData.PageCount - 1) * tmpRecordListData.PageSize}/${tmpRecordListData.PageSize}`
					});
			}
			if (tmpEncodedFilterExperience)
			{
				tmpRecordListData.PageLinksLimited[tmpRecordListData.PageLinksLimited.length - 1].URL += `/FilterExperience/${tmpEncodedFilterExperience}`;
			}
		}

		tmpRecordListData.PageLinkBookmarks.Previous = tmpRecordListData.PageLinkBookmarks.Current - 1;
		tmpRecordListData.PageLinkBookmarks.Next = tmpRecordListData.PageLinkBookmarks.Current + 1;
		tmpRecordListData.PageLinkBookmarks.ShowPreviousLink = true;
		tmpRecordListData.PageLinkBookmarks.ShowNextLink = true;
		if (tmpRecordListData.PageLinkBookmarks.Previous < 0)
		{
			tmpRecordListData.PageLinkBookmarks.PreviousLink = false;
			tmpRecordListData.PageLinkBookmarks.ShowPreviousLink = false;
		}
		else
		{
			tmpRecordListData.PageLinkBookmarks.PreviousLink = tmpRecordListData.PageLinks[tmpRecordListData.PageLinkBookmarks.Previous];
		}
		if (tmpRecordListData.PageLinkBookmarks.Next >= tmpRecordListData.PageLinks.length)
		{
			tmpRecordListData.PageLinkBookmarks.NextLink = false;
			tmpRecordListData.PageLinkBookmarks.ShowNextLink = false;
		}
		else
		{
			tmpRecordListData.PageLinkBookmarks.NextLink = tmpRecordListData.PageLinks[tmpRecordListData.PageLinkBookmarks.Next];
		}

		// When there is only a single page there is nothing to paginate: hide the page
		// buttons and the previous/next links. The "Showing X to Y of Z" summary stays.
		if (tmpRecordListData.PageCount <= 1)
		{
			tmpRecordListData.PageLinksLimited = [];
			tmpRecordListData.PageLinkBookmarks.ShowPreviousLink = false;
			tmpRecordListData.PageLinkBookmarks.ShowNextLink = false;
		}
		tmpRecordListData.TableCells = pManifest?.TableCells;

		if (!tmpRecordListData.TableCells)
		{
			if (tmpRecordListData.RecordSetConfiguration.hasOwnProperty('RecordSetListColumns'))
			{
				tmpRecordListData.TableCells = tmpRecordListData.RecordSetConfiguration.RecordSetListColumns.map((key) =>
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
				this.dynamicallyGenerateColumns(tmpRecordListData);
			}
		}

		tmpRecordListData = this.onBeforeRenderList(tmpRecordListData);

		this.pict.providers.DynamicRecordsetSolver.solveDashboard(pManifest, tmpRecordListData.Records.Records);

		this._paintRecordList(tmpRecordListData, pBodyOnly);
	}

	/**
	 * Paint the computed record-list data into the DOM.
	 *
	 * Full render (pBodyOnly falsy): render the whole `PRSP_Renderable_List` (title, header, filters,
	 * pagination, rows) into the list destination — the original behavior.
	 *
	 * Body-only render (pBodyOnly true): only the page changed, so re-render just the rows and the two
	 * pagination strips into their stable containers, leaving the filter view (and its picker/control state)
	 * completely untouched. Each child is rendered with the freshly-computed record passed as an object, so
	 * it produces exactly what the inline `{~V:~}` render would have.
	 *
	 * @param {Record<string, any>} pRecordListData - The fully-computed list data (records, pagination, cells).
	 * @param {boolean} [pBodyOnly] - When true, surgically re-render only rows + pagination.
	 * @return {void}
	 */
	_paintRecordList(pRecordListData, pBodyOnly)
	{
		const fLogRendered = function (pError)
		{
			if (pError)
			{
				this.pict.log.error(`RecordSetList: Error rendering list ${pError}`, pRecordListData);
				return;
			}
			if (this.pict.LogNoisiness > 0)
			{
				this.pict.log.info(`RecordSetList: Rendered list ${pRecordListData.RecordSet} with ${pRecordListData.Records.Records.length} records.`, pRecordListData);
			}
			else
			{
				this.pict.log.info(`RecordSetList: Rendered list ${pRecordListData.RecordSet} with ${pRecordListData.Records.Records.length} records.`);
			}
		}.bind(this);

		if (!pBodyOnly)
		{
			this.renderAsync('PRSP_Renderable_List', pRecordListData.RenderDestination, pRecordListData, fLogRendered);
			return;
		}

		// Page-only change: re-render the two pagination strips (current page + "showing X of Y") and the
		// rows, each into its own stable container. The filter view, title, and header list are left as-is.
		this.childViews.paginationTop.renderAsync('PRSP_Renderable_PaginationTop', '#PRSP_PaginationTop_Container', pRecordListData, null, () => { });
		this.childViews.paginationBottom.renderAsync('PRSP_Renderable_PaginationBottom', '#PRSP_PaginationBottom_Container', pRecordListData, null, () => { });
		this.childViews.recordList.renderAsync('PRSP_Renderable_RecordList', '#PRSP_RecordList_Container', pRecordListData, null, fLogRendered);
	}

	onInitialize()
	{
		this.childViews.headerList = this.pict.addView('PRSP-List-HeaderList', viewHeaderList.default_configuration, viewHeaderList);
		this.childViews.title = this.pict.addView('PRSP-List-Title', viewTitle.default_configuration, viewTitle);
		this.childViews.filters = this.pict.views['PRSP-Filters'] || this.pict.addView('PRSP-Filters', { }, viewFilters);
		this.childViews.paginationTop = this.pict.addView('PRSP-List-PaginationTop', viewPaginationTop.default_configuration, viewPaginationTop);
		this.childViews.recordList = this.pict.addView('PRSP-List-RecordList', viewRecordList.default_configuration, viewRecordList);
		this.childViews.recordListHeader = this.pict.addView('PRSP-List-RecordListHeader', viewRecordListHeader.default_configuration, viewRecordListHeader);
		this.childViews.recordListEntry = this.pict.addView('PRSP-List-RecordListEntry', viewRecordListEntry.default_configuration, viewRecordListEntry);
		this.childViews.paginationBottom = this.pict.addView('PRSP-List-PaginationBottom', viewPaginationBottom.default_configuration, viewPaginationBottom);

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

module.exports = viewRecordSetList;

module.exports.default_configuration = _DEFAULT_CONFIGURATION__List;

