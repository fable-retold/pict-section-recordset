const libPictView = require('pict-view');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_SUBSET_Filter =
{
	ViewIdentifier: 'PRSP-FilterType-Base',

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

	// Themeable filter-clause chrome. Every filter type renders through the shared
	// PRSP-Filter-Base-Template wrapper below (each type only plugs in its own value
	// input via getFilterFormTemplate()), so styling it here themes every clause for
	// every host app. This view (PRSP-FilterType-Base) is always constructed, and
	// pict-view registers a view's CSS into the global cascade at construction, so
	// these rules apply to all clauses regardless of which type rendered them.
	//
	// Host apps brand by defining the --theme-color-* tokens; the hardcoded values are
	// sensible fallbacks. CSS-first: native <select>s are de-nativized with
	// appearance:none + a custom chevron rather than swapped for a combobox widget
	// (that is a later upgrade with cross-browser quirks of its own).
	CSS: /*css*/`
.prsp-filters-clauses { display: flex; flex-direction: column; gap: 0.5rem; }

.prsp-filter { display: flex; align-items: flex-end; gap: 0.5rem; }
.prsp-filter *, .prsp-filter *::before, .prsp-filter *::after { box-sizing: border-box; }
.prsp-filter-body { flex: 1 1 auto; min-width: 0; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.4rem 0.75rem; }

/* Inputs rendered by pict-section-form inside a clause. Match the consolidated
   control's search box so clauses stop looking like bare native controls. */
.prsp-filter label { font: inherit; font-size: 0.78rem; font-weight: 600; display: block;
	margin: 0 0 0.2rem; color: var(--theme-color-text-secondary, #45505f); }
.prsp-filter input, .prsp-filter select, .prsp-filter textarea { font: inherit; font-size: 0.92rem; width: 100%;
	padding: 0.45rem 0.7rem; border-radius: 8px; border: 1px solid var(--theme-color-border-default, #d7dce3);
	background: var(--theme-color-background-primary, #fff); color: var(--theme-color-text-primary, #1f2733); }
.prsp-filter input:focus, .prsp-filter select:focus, .prsp-filter textarea:focus { outline: none;
	border-color: var(--theme-color-brand-primary, #156dd1);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 16%, transparent); }
/* De-nativize the <select>: drop the platform arrow, add a themed chevron + room for it. */
.prsp-filter select { appearance: none; -webkit-appearance: none; -moz-appearance: none; cursor: pointer;
	padding-right: 1.9rem;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7686' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
	background-repeat: no-repeat; background-position: right 0.6rem center; background-size: 1.05em; }

/* Remove (trash) control — one per clause, inherited by every filter type. */
.prsp-filter-remove { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
	width: 2.05rem; height: 2.05rem; padding: 0; cursor: pointer; line-height: 1;
	border-radius: 8px; border: 1px solid var(--theme-color-border-default, #d7dce3);
	background: var(--theme-color-background-primary, #fff); color: var(--theme-color-text-muted, #6b7686); }
.prsp-filter-remove:hover { border-color: var(--theme-color-status-error, #d64545); color: var(--theme-color-status-error, #d64545);
	background: color-mix(in srgb, var(--theme-color-status-error, #d64545) 12%, transparent); }
.prsp-filter-remove .pict-icon { font-size: 1.05rem; }
`,
	CSSPriority: 500,

	Manifests: {},

	DefaultRenderable: 'PRSP_Renderable_Filter_Base',

	Templates:
	[
		{
			Hash: 'PRSP-Filter-Base-Form',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-Filter-Base-Form] -->
	{~DJ:Record~}
	<!-- DefaultPackage end view template:	[PRSP-Filter-Base-Form] -->
`
		},
		{
			// The shared clause wrapper for every filter type. The type view plugs its own
			// value input in via getFilterFormTemplate(); the themed remove control is
			// inherited here (calls the base removeClause() method, reached through the
			// always-registered PRSP-FilterType-<Type> view) so no host app re-implements one.
			Hash: 'PRSP-Filter-Base-Template',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-Filter-Base-Template] -->
	<div class="prsp-filter" id="PRSP_Filter_Container_{~D:Record.Hash~}" data-i-filter-hash="{~D:Record.Hash~}">
		{~TBR:Context[0].getClauseBodyTemplate()~}
		<button type="button" class="prsp-filter-remove" title="Remove this filter" aria-label="Remove this filter"
			onclick="_Pict.views['PRSP-FilterType-{~D:Record.Type~}'].removeClause(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}', '{~D:Record.Hash~}');">
			{~I:Trash~}
		</button>
	</div>
	<!-- DefaultPackage end view template:	[PRSP-Filter-Base-Template] -->
`
		},
		{
			// Clause body as its own form, so Enter in any of its inputs commits the value (the browser
			// fires change before submit) and then applies the search. Ids are namespaced by clause hash,
			// and the hidden submit is bound to this form by id, so it can never submit a form the clause
			// does not own — e.g. a host form the filters were rendered inside.
			Hash: 'PRSP-Filter-Base-Body-Form',
			Template: /*html*/`
		<form class="prsp-filter-body" id="PRSP_Filter_Clause_Form_{~D:Record.Hash~}"
			onsubmit="event.preventDefault(); event.stopPropagation(); _Pict.views['PRSP-Filters'].handleSearch(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}'); return false;">
			{~TBR:Context[0].getFilterFormTemplate()~}
			<button type="submit" id="PRSP_Filter_Clause_Submit_{~D:Record.Hash~}" form="PRSP_Filter_Clause_Form_{~D:Record.Hash~}" hidden tabindex="-1" aria-hidden="true"></button>
		</form>
`
		},
		{
			// Clause body for types that render a form of their own inside it (forms cannot nest).
			Hash: 'PRSP-Filter-Base-Body',
			Template: /*html*/`
		<div class="prsp-filter-body">
			{~TBR:Context[0].getFilterFormTemplate()~}
		</div>
`
		},
	],

	Renderables:
	[
		{
			RenderableHash: 'PRSP_Renderable_Filter_Base',
			TemplateHash: 'PRSP-Filter-Base-Template',
			DestinationAddress: '#PRSP_Filter_Base_Container',
			RenderMethod: 'replace',
		}
	],
};

class ViewRecordSetSUBSETFilterBase extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_SUBSET_Filter, pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}

	/**
	 * Hook to prepare state on the render record before rendering.
	 *
	 * @param {Record<string, any>} pRecord - The record used for view rendering.
	 */
	prepareRecord(pRecord)
	{
		pRecord.ClauseValueAddress = pRecord.ClauseAddress + '.Value';
		pRecord.ClauseValuesAddress = pRecord.ClauseAddress + '.Values';

		pRecord.ClauseDescriptor =
		{
			Address: pRecord.ClauseValueAddress,
			Hash: this.fable.DataFormat.sanitizeObjectKey(pRecord.Hash),
			//TODO: figure out a nice pattern for extracting a name for the field from the filter - and allow the filter author to provide the label here
			Name: pRecord.Label || pRecord.ExternalFilterByColumn || pRecord.ExternalFilterByColumns?.[0] || pRecord.FilterByColumn || pRecord.FilterByColumns?.[0] || 'Value',
			DataType: pRecord.DataType || 'String',
			PictForm: pRecord.PictForm || {},
		};
	}

	getFilterFormTemplate()
	{
		return 'PRSP-Filter-Base-Form';
	}

	/**
	 * The template hash for the clause body that wraps getFilterFormTemplate(). A type whose own
	 * template contains a <form> overrides this to return 'PRSP-Filter-Base-Body'.
	 *
	 * @return {string}
	 */
	getClauseBodyTemplate()
	{
		return 'PRSP-Filter-Base-Body-Form';
	}

	/**
	 * Remove this filter clause from its record set and re-render the filter control.
	 *
	 * Lives on the base view so every filter type inherits a single, themeable remove
	 * affordance and no host application has to re-implement one. Delegates to the
	 * consolidated control view (the canonical re-render path) and falls back to the
	 * record-set provider directly if that view is somehow unavailable.
	 *
	 * @param {Event} pEvent - The DOM event that triggered the removal.
	 * @param {string} pRecordSet - The record set being filtered.
	 * @param {string} pViewContext - The view context for the filter (e.g. List, Dashboard).
	 * @param {string} pHash - The hash of the specific filter clause to remove.
	 */
	removeClause(pEvent, pRecordSet, pViewContext, pHash)
	{
		if (pEvent)
		{
			pEvent.preventDefault();
		}
		const tmpFiltersView = this.pict.views['PRSP-Filters'];
		if (tmpFiltersView && typeof tmpFiltersView.removeFilter === 'function')
		{
			return tmpFiltersView.removeFilter(pEvent, pRecordSet, pViewContext, pHash);
		}
		// Fallback: the consolidated control view isn't present, so remove directly.
		const tmpProvider = this.pict.providers[`RSP-Provider-${pRecordSet}`];
		if (tmpProvider && typeof tmpProvider.removeFilterClause === 'function')
		{
			tmpProvider.removeFilterClause(pHash);
		}
	}

	/**
	 * @return {string} - The prefix for the informary address.
	 */
	getInformaryAddressPrefix()
	{
		return this.pict.views['PRSP-Filters'].getInformaryAddressPrefix();
	}

	/**
	 * @param {string} pInformaryAddress - The address of the informary to get the value from.
	 *
	 * @return {any} - The value at the informary address.
	 */
	getInformaryScopedValue(pInformaryAddress)
	{
		return this.pict.views['PRSP-Filters'].getInformaryScopedValue(pInformaryAddress);
	}
}

module.exports = ViewRecordSetSUBSETFilterBase;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_SUBSET_Filter;
