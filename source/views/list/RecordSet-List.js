const libPictRecordSetRecordView = require('../RecordSet-RecordBaseView.js');

const viewHeaderList = require('./RecordSet-List-HeaderList.js');
const viewTitle = require('./RecordSet-List-Title.js');
const viewFilters = require('../RecordSet-Filters.js');
const viewPaginationTop = require('./RecordSet-List-PaginationTop.js');
const viewRecordList = require('./RecordSet-List-RecordList.js');
const viewRecordListHeader = require('./RecordSet-List-RecordListHeader.js');
const viewRecordListEntry = require('./RecordSet-List-RecordListEntry.js');
const viewPaginationBottom = require('./RecordSet-List-PaginationBottom.js');
const viewColumnChooser = require('./RecordSet-List-ColumnChooser.js');

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
	.prsp-list-loading { width: 100%; padding: 0.25rem 0 0.5rem; }
	.prsp-list-loading-inner { display: inline-flex; align-items: center; gap: 0.55em; color: var(--theme-color-text-muted, #64748b); font-size: 1rem; padding: 0.5rem 0.25rem 0.7rem; }
	.prsp-list-spinner { display: inline-flex; animation: prsp-list-spin 0.9s linear infinite; }
	@keyframes prsp-list-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	/* Skeleton ghost rows: a few light, theme-colored bars that fill the loading area so the preserved
	   row height doesn't read as a white void. A bottom fade blends the last rows into the page. */
	.prsp-list-skeleton { position: relative; animation: prsp-list-skeleton-pulse 1.8s ease-in-out infinite; }
	@keyframes prsp-list-skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
	.prsp-list-skeleton-row { height: 2.6rem; margin: 0 0 0.7rem; border-radius: 8px; background: var(--theme-color-background-tertiary, #eceef2); }
	.prsp-list-skeleton-row:nth-child(4n) { width: 94%; }
	.prsp-list-skeleton-row:nth-child(5n) { width: 97%; }
	.prsp-list-skeleton-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 4.5rem; background: linear-gradient(to bottom, transparent, var(--theme-color-background-primary, #fff)); pointer-events: none; }
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
		<div id="PRSP_ColumnChooser_Container">{~V:PRSP-List-ColumnChooser~}</div>
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
	<div id="PRSP_List_Loading" class="prsp-list-loading">
		<div class="prsp-list-loading-inner">
			<span class="prsp-list-spinner" aria-hidden="true">{~I:Refresh~}</span>
			<span class="prsp-list-loading-label">Loading…</span>
		</div>
		<div class="prsp-list-skeleton" aria-hidden="true">
			{~TS:PRSP-List-Skeleton-Row:Record.SkeletonRows~}
			<div class="prsp-list-skeleton-fade"></div>
		</div>
	</div>
	`
				},
				{
					Hash: 'PRSP-List-Skeleton-Row',
					Template: /*html*/`<div class="prsp-list-skeleton-row"></div>`
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
			paginationBottom: null,
			columnChooser: null
		};

		// Identity (`RecordSet::FilterString::FilterExperience`) of the list currently painted into the DOM.
		// When a route only changes the page (Offset/PageSize) and this still matches, we re-render just the
		// rows + pagination instead of the whole view — see handleRecordSetListRoute / _paintRecordList.
		this._renderedListIdentity = null;

		// The last fully-composed list data (carrying the pristine ColumnCandidates) and the arguments of
		// the last render call — together they let a column-visibility toggle repaint the rows from data
		// already in hand (or, when a Lite fetch is missing the column, rerun the same render to refetch).
		this._lastRecordListData = null;
		this._lastListRenderArgs = null;
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
			const tmpRowsElements = this.pict.ContentAssignment.getElement('#PRSP_RecordList_Container');
			const tmpRowsContainerPresent = tmpRowsElements.length > 0;
			const tmpDestination = tmpRowsContainerPresent ? '#PRSP_RecordList_Container' : pRecordListData.RenderDestination;
			// Fill roughly the visible viewport with ghost rows (each skeleton row occupies ~53px), capped to
			// the preserved height so a short list doesn't over-fill, and clamped to a sane range.
			const tmpViewportHeight = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 800;
			let tmpFillHeight = tmpViewportHeight + 200;
			if (tmpRowsContainerPresent)
			{
				// Pin the rows area to its current height before swapping in the spinner, so the page doesn't
				// collapse and yank the content below it — pagination, the page's footer/colored fill — up into
				// the fold and back. The floor is released once the real rows render (see _paintRecordList).
				const tmpCurrentHeight = tmpRowsElements[0].offsetHeight;
				if (tmpCurrentHeight > 0)
				{
					tmpRowsElements[0].style.minHeight = `${ tmpCurrentHeight }px`;
					tmpFillHeight = Math.min(tmpCurrentHeight, tmpFillHeight);
				}
			}
			const tmpSkeletonRowCount = Math.max(6, Math.min(60, Math.ceil(tmpFillHeight / 53)));
			this.pict.CSSMap.injectCSS();
			// Render the spinner + enough skeleton ghost rows to fill the visible area (so no white void shows).
			const tmpLoadingShellData = { SkeletonRows: new Array(tmpSkeletonRowCount).fill(0) };
			this.pict.ContentAssignment.assignContent(tmpDestination, this.pict.parseTemplateByHash('PRSP-List-LoadingShell', tmpLoadingShellData));
		}
		catch (pError)
		{
			// The loading shell is purely cosmetic; never let it break the list render.
			this.log.warn(`RecordSetList: loading shell render failed: ${ pError && pError.message }`);
		}
	}

	/**
	 * The schema columns that never become list columns automatically: the entity's own
	 * identity pair plus the audit stamps. (Hosts that want one of these in the column
	 * chooser declare it as a curated column, optionally with DefaultHidden.)
	 *
	 * @param {string} pEntity - The entity name (for the ID/GUID identity columns)
	 * @return {Array<string>} The excluded column names.
	 */
	_getExcludedSchemaColumns(pEntity)
	{
		return [
			'ID' + pEntity,
			'GUID' + pEntity,
			'CreateDate',
			'CreatingIDUser',
			'DeleteDate',
			'Deleted',
			'DeletingIDUser',
			'UpdateDate',
			'UpdatingIDUser',
		];
	}

	dynamicallyGenerateColumns(pRecordListData)
	{
		pRecordListData.TableCells = [];
		const tmpEntity = pRecordListData.RecordSetConfiguration.Entity;
		this.excludedByDefaultCells = this._getExcludedSchemaColumns(tmpEntity);

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
	 * Map column name -> Meadow column Type from the entity schema, when available. The schema
	 * endpoint nests the canonical column array at MeadowSchema.MeadowSchema.Schema (with a
	 * legacy flat MeadowSchema.Schema fallback). Returns null when neither is present (e.g.
	 * non-Meadow providers) so callers can skip type-based exclusions.
	 *
	 * @param {Record<string, any>} pRecordSchema - The schema from getRecordSchema()
	 * @return {Record<string, string>|null} Column name -> Type map, or null.
	 */
	_getMeadowColumnTypes(pRecordSchema)
	{
		const tmpSchemaColumns = pRecordSchema?.MeadowSchema?.MeadowSchema?.Schema || pRecordSchema?.MeadowSchema?.Schema;
		if (!Array.isArray(tmpSchemaColumns) || tmpSchemaColumns.length < 1)
		{
			return null;
		}
		/** @type {Record<string, string>} */
		const tmpColumnTypes = {};
		for (const tmpColumn of tmpSchemaColumns)
		{
			if (tmpColumn && tmpColumn.Column)
			{
				tmpColumnTypes[tmpColumn.Column] = tmpColumn.Type;
			}
		}
		return tmpColumnTypes;
	}

	/**
	 * Whether a column candidate is effectively visible: an explicit user override wins,
	 * otherwise the candidate's default (visible unless DefaultHidden).
	 *
	 * @param {Record<string, any>} pCandidate - A ColumnCandidates entry
	 * @param {Record<string, boolean>} pOverrides - The per-recordset override map
	 * @return {boolean}
	 */
	_effectiveColumnVisibility(pCandidate, pOverrides)
	{
		if (pOverrides && (pCandidate.Key in pOverrides))
		{
			return (pOverrides[pCandidate.Key] === true);
		}
		return (pCandidate.DefaultHidden !== true);
	}

	/**
	 * Compute the visible TableCells for a paint from the pristine candidate list + the user's
	 * current overrides. Cells are per-paint shallow copies so host hooks can mutate them without
	 * bleeding into the candidates. An override set that hides everything falls back to the
	 * default-visible set (a fully empty table is a confusing dead end).
	 *
	 * @param {Array<Record<string, any>>} pCandidates - The pristine ColumnCandidates
	 * @param {string} pRecordSet - The record set (for the override lookup)
	 * @return {Array<Record<string, any>>} The visible cells, in candidate order.
	 */
	_computeVisibleTableCells(pCandidates, pRecordSet)
	{
		const tmpColumnProvider = this.pict.providers.ColumnDataProvider;
		const tmpOverrides = tmpColumnProvider ? tmpColumnProvider.getColumnVisibilityOverrides(pRecordSet, 'List') : {};
		let tmpVisibleCells = pCandidates
			.filter((pCandidate) => this._effectiveColumnVisibility(pCandidate, tmpOverrides))
			.map((pCell) => Object.assign({}, pCell));
		if (tmpVisibleCells.length < 1)
		{
			this.log.warn(`RecordSetList: column visibility overrides for [${pRecordSet}] hid every column; rendering the default-visible set instead.`);
			tmpVisibleCells = pCandidates
				.filter((pCandidate) => pCandidate.DefaultHidden !== true)
				.map((pCell) => Object.assign({}, pCell));
		}
		return tmpVisibleCells;
	}

	/**
	 * Compose the column-chooser candidate pool and reduce TableCells to the visible subset.
	 *
	 * No-op unless the recordset opts in with RecordSetListColumnChooser: true — the flag off
	 * leaves TableCells exactly as the existing paths computed it (including the manifest's
	 * shared array reference).
	 *
	 * Candidates are two tiers, in order:
	 *  - Curated: the host-declared columns (manifest Descriptors or RecordSetListColumns),
	 *    shallow-copied (the shared manifest TableCells entries are never mutated), default
	 *    visible unless the column/descriptor declares DefaultHidden: true.
	 *  - Schema: remaining scalar entity columns (identity/audit fields and blob Text/JSON
	 *    columns excluded), default hidden, rendered via the generic ProcessCell template
	 *    (entity-reference ID* columns resolve names exactly like dynamic columns do).
	 *
	 * The pristine candidates ride on pRecordListData.ColumnCandidates (module-owned — host
	 * hooks must not mutate it); TableCells becomes per-paint copies of the visible subset.
	 *
	 * @param {Record<string, any>} pRecordListData - The list data (TableCells already computed)
	 * @return {Record<string, any>} The same list data, candidates composed.
	 */
	_composeColumnCandidates(pRecordListData)
	{
		// Always an array (empty = render nothing): a missing address would make the chooser
		// button's {~TS:~} iterate the record object's own keys instead of rendering nothing.
		pRecordListData.ColumnChooserSlot = [];
		const tmpConfig = pRecordListData.RecordSetConfiguration;
		if (!tmpConfig || tmpConfig.RecordSetListColumnChooser !== true)
		{
			return pRecordListData;
		}

		// Curated tier: shallow copies of whatever the host declared, flagged with source + default.
		const tmpCandidates = (pRecordListData.TableCells || []).map((pCell) =>
			Object.assign({}, pCell, { Source: 'Curated', DefaultHidden: (pCell.DefaultHidden === true) }));
		const tmpCuratedKeys = {};
		for (const tmpCell of tmpCandidates)
		{
			tmpCuratedKeys[tmpCell.Key] = true;
		}

		// Schema tier: every remaining scalar entity column, default hidden.
		const tmpExcludedColumns = this._getExcludedSchemaColumns(tmpConfig.Entity);
		const tmpProperties = pRecordListData.RecordSchema?.properties;
		const tmpMeadowColumnTypes = this._getMeadowColumnTypes(pRecordListData.RecordSchema);
		const tmpBlobTypes = { 'Text': true, 'JSON': true };
		const tmpSchemaCandidates = [];
		for (const tmpColumn in tmpProperties)
		{
			if (!tmpProperties.hasOwnProperty(tmpColumn) || tmpCuratedKeys[tmpColumn] || tmpExcludedColumns.includes(tmpColumn))
			{
				continue;
			}
			// When the Meadow schema is available, only offer real non-blob columns — a JSON-schema-only
			// property is not fetchable by a Lite projection, and blob columns are why Lite exists.
			if (tmpMeadowColumnTypes && (!(tmpColumn in tmpMeadowColumnTypes) || tmpBlobTypes[tmpMeadowColumnTypes[tmpColumn]]))
			{
				continue;
			}
			tmpSchemaCandidates.push(
				{
					Key: tmpColumn,
					DisplayName: tmpProperties[tmpColumn].title || tmpColumn,
					ManifestHash: 'Default',
					PictDashboard: { ValueTemplate: '{~ProcessCell:Record.Data.Key~}' },
					Source: 'Schema',
					DefaultHidden: true,
				});
		}
		tmpSchemaCandidates.sort((pA, pB) => String(pA.DisplayName).localeCompare(String(pB.DisplayName)));

		// Audit tier: the identity pair + audit stamps, with friendly labels, trailing the schema
		// tier. Default hidden; the create/update/delete user references resolve names via the same
		// ProcessCell path as any other entity-reference column. (Pair with the show-deleted filter
		// — RecordSetListShowDeletedFilter — to make the three Deleted* columns meaningful.)
		const tmpAuditColumnLabels =
		{
			[`ID${tmpConfig.Entity}`]: 'ID',
			[`GUID${tmpConfig.Entity}`]: 'GUID',
			'CreateDate': 'Created',
			'CreatingIDUser': 'Created by',
			'UpdateDate': 'Updated',
			'UpdatingIDUser': 'Updated by',
			'Deleted': 'Deleted',
			'DeleteDate': 'Deleted on',
			'DeletingIDUser': 'Deleted by',
		};
		const tmpAuditCandidates = [];
		for (const tmpColumn of Object.keys(tmpAuditColumnLabels))
		{
			if (!tmpProperties || !tmpProperties.hasOwnProperty(tmpColumn) || tmpCuratedKeys[tmpColumn])
			{
				continue;
			}
			tmpAuditCandidates.push(
				{
					Key: tmpColumn,
					DisplayName: tmpAuditColumnLabels[tmpColumn],
					ManifestHash: 'Default',
					PictDashboard: { ValueTemplate: '{~ProcessCell:Record.Data.Key~}' },
					Source: 'Audit',
					DefaultHidden: true,
				});
		}

		pRecordListData.ColumnCandidates = tmpCandidates.concat(tmpSchemaCandidates, tmpAuditCandidates);
		pRecordListData.TableCells = this._computeVisibleTableCells(pRecordListData.ColumnCandidates, pRecordListData.RecordSet);
		// One-or-zero-element array driving the chooser button render (the {~TS:~} conditional trick).
		pRecordListData.ColumnChooserSlot = [ { RecordSet: pRecordListData.RecordSet } ];
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

		// Remember how this list was rendered so a column-visibility change can rerun the exact same
		// render (the manifest delegation below overwrites this with its own, which is what we want).
		this._lastListRenderArgs = { Method: 'renderList', Args: [ pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize ] };

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
		this._composeColumnCandidates(tmpRecordListData);
		this._lastRecordListData = tmpRecordListData;
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

		// Remember how this list was rendered so a column-visibility change can rerun the exact same
		// render. When renderList delegated here this overwrite wins — a rerun skips re-resolving the
		// manifest — and hosts that call renderListFromManifest directly are covered the same way.
		this._lastListRenderArgs = { Method: 'renderListFromManifest', Args: [ pManifest, pRecordSetConfiguration, pProviderHash, pFilterString, pSerializedFilterExperience, pOffset, pPageSize ] };

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

		this._composeColumnCandidates(tmpRecordListData);
		this._lastRecordListData = tmpRecordListData;
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
		this.childViews.recordList.renderAsync('PRSP_Renderable_RecordList', '#PRSP_RecordList_Container', pRecordListData, null,
			function (pError)
			{
				// Release the height floor that was pinned while the spinner showed (see _projectLoadingShell),
				// now that the real rows are back in and the container can size to its content again.
				const tmpRows = this.pict.ContentAssignment.getElement('#PRSP_RecordList_Container');
				if (tmpRows.length)
				{
					tmpRows[0].style.minHeight = '';
				}
				fLogRendered(pError);
			}.bind(this));
	}

	/**
	 * Set a column's visibility for the currently rendered list (called by the column chooser).
	 *
	 * Persists the override, then repaints the rows + pagination body-only from the data already
	 * in hand — except when a Lite-fetched list is showing a schema-tier column whose values were
	 * never fetched, in which case the same render is rerun so the provider widens the projection.
	 *
	 * @param {string} pRecordSet - The record set the column belongs to (stale-chooser guard)
	 * @param {string} pKey - The column key
	 * @param {boolean} pVisible - Whether the column should be visible
	 * @return {boolean} The column's resulting visibility.
	 */
	setColumnVisibility(pRecordSet, pKey, pVisible)
	{
		const tmpListData = this._lastRecordListData;
		if (!tmpListData || tmpListData.RecordSet !== pRecordSet || !Array.isArray(tmpListData.ColumnCandidates))
		{
			this.log.warn(`RecordSetList: setColumnVisibility for [${pRecordSet}.${pKey}] ignored — that list is not the one currently rendered.`);
			return false;
		}
		const tmpCandidate = tmpListData.ColumnCandidates.find((pCandidate) => pCandidate.Key === pKey);
		if (!tmpCandidate)
		{
			this.log.warn(`RecordSetList: setColumnVisibility for unknown column [${pKey}] on [${pRecordSet}] ignored.`);
			return false;
		}
		const tmpColumnProvider = this.pict.providers.ColumnDataProvider;
		if (!tmpColumnProvider)
		{
			return this._effectiveColumnVisibility(tmpCandidate, {});
		}
		// Keep at least one column visible — an all-hidden table is a confusing dead end.
		if (pVisible !== true)
		{
			const tmpOverrides = tmpColumnProvider.getColumnVisibilityOverrides(pRecordSet, 'List');
			const tmpVisibleCount = tmpListData.ColumnCandidates.filter((pCandidate) => this._effectiveColumnVisibility(pCandidate, tmpOverrides)).length;
			if ((tmpVisibleCount <= 1) && this._effectiveColumnVisibility(tmpCandidate, tmpOverrides))
			{
				this.log.warn(`RecordSetList: refusing to hide the last visible column [${pKey}] on [${pRecordSet}].`);
				return true;
			}
		}
		tmpColumnProvider.setColumnVisibilityOverride(pRecordSet, 'List', pKey, (pVisible === true));

		// Lite projections omit unrequested columns entirely, so a newly shown schema- or audit-tier
		// column with no data in the fetched records needs one refetch (the provider reads the override
		// map at fetch time and widens the projection). Curated/manifest columns are always fetched or
		// solved, and schema/audit keys are flat — a first-record key check is sound. (The identity pair,
		// CreatingIDUser, and UpdateDate ride free in every Lite record, so they pass the key check.)
		const tmpRecords = (tmpListData.Records && Array.isArray(tmpListData.Records.Records)) ? tmpListData.Records.Records : [];
		const tmpNeedsRefetch = (pVisible === true)
			&& (tmpCandidate.Source !== 'Curated')
			&& (tmpListData.RecordSetConfiguration && tmpListData.RecordSetConfiguration.RecordSetListLiteFetch === true)
			&& (tmpRecords.length > 0)
			&& !(pKey in tmpRecords[0]);
		if (tmpNeedsRefetch)
		{
			this._rerunLastListRender();
		}
		else
		{
			this._repaintWithColumnState();
		}
		return (pVisible === true);
	}

	/**
	 * Clear every column-visibility override for the currently rendered list and repaint with the
	 * defaults (called by the column chooser's Reset). Never needs a refetch: resetting only
	 * restores curated columns (always fetched) and hides schema extras.
	 *
	 * @param {string} pRecordSet - The record set to reset (stale-chooser guard)
	 * @return {boolean} True when the reset happened.
	 */
	resetColumnVisibility(pRecordSet)
	{
		const tmpListData = this._lastRecordListData;
		if (!tmpListData || tmpListData.RecordSet !== pRecordSet)
		{
			this.log.warn(`RecordSetList: resetColumnVisibility for [${pRecordSet}] ignored — that list is not the one currently rendered.`);
			return false;
		}
		const tmpColumnProvider = this.pict.providers.ColumnDataProvider;
		if (tmpColumnProvider)
		{
			tmpColumnProvider.clearColumnVisibilityOverrides(pRecordSet, 'List');
		}
		this._repaintWithColumnState();
		return true;
	}

	/**
	 * Repaint the rows + pagination (body-only) from the last composed list data, with TableCells
	 * recomputed from the pristine candidates + current overrides. onBeforeRenderList is re-invoked
	 * — it is the documented seam where hosts append custom cells, and rebuilding TableCells from
	 * candidates each paint means hook mutations apply exactly once per paint. (Hosts that decorate
	 * Records in the hook must keep that decoration idempotent; the hook already re-runs on every
	 * page change.) No loading shell: the data is already in hand, so the swap is immediate.
	 *
	 * @return {void}
	 */
	_repaintWithColumnState()
	{
		const tmpSourceData = this._lastRecordListData;
		if (!tmpSourceData || !Array.isArray(tmpSourceData.ColumnCandidates))
		{
			return;
		}
		let tmpPaintData = Object.assign({}, tmpSourceData);
		tmpPaintData.TableCells = this._computeVisibleTableCells(tmpSourceData.ColumnCandidates, tmpSourceData.RecordSet);
		tmpPaintData = this.onBeforeRenderList(tmpPaintData);
		this._paintRecordList(tmpPaintData, true);
	}

	/**
	 * Rerun the last list render with the same arguments (body-only — the list shell and filters
	 * are already on screen). Used when a column toggle needs a refetch under Lite.
	 *
	 * @return {Promise<void>|undefined}
	 */
	_rerunLastListRender()
	{
		if (!this._lastListRenderArgs)
		{
			return;
		}
		const tmpArgs = this._lastListRenderArgs.Args.concat([ true ]);
		return this[this._lastListRenderArgs.Method](...tmpArgs);
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
		this.childViews.columnChooser = this.pict.addView('PRSP-List-ColumnChooser', viewColumnChooser.default_configuration, viewColumnChooser);

		// Initialize the subviews
		this.childViews.headerList.initialize();
		this.childViews.title.initialize();
		this.childViews.paginationTop.initialize();
		this.childViews.recordList.initialize();
		this.childViews.recordListHeader.initialize();
		this.childViews.recordListEntry.initialize();
		this.childViews.paginationBottom.initialize();
		this.childViews.columnChooser.initialize();

		return super.onInitialize();
	}
}

module.exports = viewRecordSetList;

module.exports.default_configuration = _DEFAULT_CONFIGURATION__List;

