const libPictView = require('pict-view');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_SUBSET_Filter =
{
	ViewIdentifier: 'PRSP-SUBSET-Filters',

	DefaultRenderable: 'PRSP_Renderable_Filters',
	DefaultDestinationAddress: '#PRSP_Filters_Container',
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
.prsp-filters { width: 100%; }
.prsp-filters *, .prsp-filters *::before, .prsp-filters *::after { box-sizing: border-box; }
.prsp-filters-bar { display: flex; align-items: center; gap: 0.5rem; margin: 0; }
.prsp-filters-search { position: relative; flex: 1 1 auto; display: flex; align-items: center; min-width: 0; }
.prsp-filters-search-ic { position: absolute; left: 0.75rem; display: inline-flex; align-items: center; color: var(--theme-color-text-muted, #6b7686); pointer-events: none; font-size: 0.95rem; }
.prsp-filters-input { width: 100%; font: inherit; font-size: 0.95rem; padding: 0.5rem 0.85rem 0.5rem 2.2rem;
	border: 1px solid var(--theme-color-border-default, #d7dce3); border-radius: 8px;
	background: var(--theme-color-background-primary, #fff); color: var(--theme-color-text-primary, #1f2733); }
.prsp-filters-input:focus { outline: none; border-color: var(--theme-color-brand-primary, #156dd1);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 16%, transparent); }
.prsp-filters-toggle { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 0.4rem; font: inherit; cursor: pointer;
	padding: 0.45rem 0.7rem; border-radius: 8px; border: 1px solid var(--theme-color-border-default, #d7dce3);
	background: var(--theme-color-background-primary, #fff); color: var(--theme-color-text-secondary, #45505f); }
.prsp-filters-toggle:hover { border-color: var(--theme-color-brand-primary, #156dd1); }
.prsp-filters.has-filters .prsp-filters-toggle { border-color: var(--theme-color-brand-primary, #156dd1); color: var(--theme-color-brand-primary, #156dd1); }
.prsp-filters.drawer-open .prsp-filters-toggle { background: var(--theme-color-background-tertiary, #eceef2); }
.prsp-filters-toggle-ic { display: inline-flex; align-items: center; }
.prsp-filters-toggle-ic svg { width: 1.05em; height: 1.05em; display: block; }
.prsp-filters-toggle-count { display: none; align-items: center; justify-content: center; min-width: 1.3em; height: 1.3em;
	padding: 0 0.35em; border-radius: 999px; font-size: 0.74rem; font-weight: 700;
	background: var(--theme-color-brand-primary, #156dd1); color: var(--theme-color-text-on-brand, #fff); }
.prsp-filters.has-filters .prsp-filters-toggle-count { display: inline-flex; }
.prsp-filters-apply { flex: 0 0 auto; font: inherit; font-weight: 650; cursor: pointer; padding: 0.5rem 1.15rem; border-radius: 8px;
	border: 1px solid var(--theme-color-brand-primary, #156dd1); background: var(--theme-color-brand-primary, #156dd1); color: var(--theme-color-text-on-brand, #fff); }
.prsp-filters-apply:hover { background: color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 88%, #000); }
.prsp-filters-btn-text { font: inherit; cursor: pointer; padding: 0.4rem 0.85rem; border-radius: 8px;
	border: 1px solid var(--theme-color-border-default, #d7dce3); background: transparent; color: var(--theme-color-text-secondary, #45505f); }
.prsp-filters-btn-text:hover { background: var(--theme-color-background-tertiary, #eceef2); }

/* Slide-out drawer (CSS grid trick: 0fr -> 1fr animates height). The inner is a *pure* clip box; all the
   visible card chrome lives on .prsp-filters-drawer-card inside it. That way, on collapse the chrome shrinks
   *with* the animating height instead of vanishing instantly — the old rule gated padding/border/background
   on .drawer-open, so closing the drawer stripped the card in one frame while the height still animated for
   0.18s, making the quick-filters bar look like it popped out of the panel before disappearing. */
.prsp-filters-drawer { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.18s ease; }
.prsp-filters.drawer-open .prsp-filters-drawer { grid-template-rows: 1fr; }
.prsp-filters-drawer-inner { overflow: hidden; min-height: 0; }
.prsp-filters-drawer-card { margin-top: 0.6rem; padding: 0.95rem 1.1rem;
	border: 1px solid var(--theme-color-border-light, #e8ebf0); border-radius: 10px; background: var(--theme-color-background-panel, #fff); }
.prsp-filters-add { position: relative; margin: 0.4rem 0 0.2rem; }
.prsp-addfilter-trigger { display: inline-flex; align-items: center; gap: 0.35rem; }
/* Drawer footer: filter experience on the left, Clear/Reset/Apply on the right. */
.prsp-filters-footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;
	margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid var(--theme-color-border-light, #e8ebf0); }
.prsp-filters-experiences { flex: 0 1 auto; min-width: 0; }
.prsp-filters-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 0.5rem; }

/* Quick Filters — a curated, one-interaction bar at the top of the drawer (above the clause list).
   Painted post-render into #PRSP_QuickFilters; hidden via :empty when the record set has none. */
.prsp-quickfilters { display: flex; align-items: center; flex-wrap: wrap; gap: 0.55rem 0.9rem;
	margin-bottom: 0.7rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--theme-color-border-light, #e8ebf0); }
.prsp-quickfilters:empty { display: none; }
.prsp-quickfilters-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
	color: var(--theme-color-text-muted, #6b7686); }
.prsp-quickfilter { display: inline-flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.prsp-quickfilter-name { font-size: 0.72rem; font-weight: 600; color: var(--theme-color-text-secondary, #45505f); }
.prsp-quickfilter-input { font: inherit; font-size: 0.9rem; width: 13rem; max-width: 100%; padding: 0.4rem 0.7rem; border-radius: 8px;
	border: 1px solid var(--theme-color-border-default, #d7dce3); background: var(--theme-color-background-primary, #fff); color: var(--theme-color-text-primary, #1f2733); }
.prsp-quickfilter-input:focus { outline: none; border-color: var(--theme-color-brand-primary, #156dd1);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 16%, transparent); }
.prsp-quickfilter-daterange { display: inline-flex; align-items: center; gap: 0.35rem; }
.prsp-quickfilter-date { width: 9.5rem; }
.prsp-quickfilter-dash { color: var(--theme-color-text-muted, #6b7686); }
/* Entity quick control: the pict-section-picker mounts into this host (its own .pps chrome themes it). */
.prsp-quickfilter-entityhost { display: inline-block; width: 14rem; max-width: 100%; vertical-align: middle; }

/* Module-owned "Add filter" popover (replaces the old native <select> pickers). */
/* Fixed (viewport-anchored) + JS-positioned on open, so no ancestor overflow:hidden — the filter card,
   the slide-out drawer — can clip it, whatever the host's layout. */
.prsp-addfilter-pop { position: fixed; z-index: 30; min-width: 280px; max-width: 360px; display: none; }
.prsp-addfilter-pop.open { display: block; }
/* Transparent full-viewport backdrop: catches outside clicks to close (no document listener). */
.prsp-addfilter-backdrop { position: fixed; inset: 0; z-index: 0; }
.prsp-addfilter-panel { position: relative; z-index: 1; display: flex; flex-direction: column; max-height: min(70vh, 460px);
	background: var(--theme-color-background-panel, #fff); border: 1px solid var(--theme-color-border-default, #d7dce3);
	border-radius: 10px; box-shadow: 0 10px 28px rgba(17, 24, 39, 0.14); overflow: hidden; }
.prsp-addfilter-search { flex: 0 0 auto; display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--theme-color-border-light, #e8ebf0); }
.prsp-addfilter-search-ic { display: inline-flex; color: var(--theme-color-text-muted, #6b7686); font-size: 0.9rem; }
.prsp-addfilter-search input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 0.9rem; border: none; outline: none; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
.prsp-addfilter-list { flex: 1 1 auto; overflow-y: auto; }
.prsp-addfilter-empty { padding: 0.7rem 0.8rem; color: var(--theme-color-text-muted, #6b7686); font-size: 0.86rem; }
.prsp-addfilter-field { border-bottom: 1px solid var(--theme-color-border-light, #eef1f5); }
.prsp-addfilter-field:last-child { border-bottom: none; }
.prsp-addfilter-field-btn { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%;
	font: inherit; font-size: 0.9rem; text-align: left; cursor: pointer; padding: 0.5rem 0.75rem; border: none; background: transparent; color: var(--theme-color-text-primary, #1f2733); }
.prsp-addfilter-field-btn:hover { background: var(--theme-color-background-tertiary, #eceef2); }
.prsp-addfilter-chev { display: inline-flex; flex: 0 0 auto; color: var(--theme-color-text-muted, #6b7686); font-size: 0.85rem; transition: transform 0.15s ease; }
.prsp-addfilter-field.is-expanded .prsp-addfilter-chev { transform: rotate(90deg); }
.prsp-addfilter-clauses { display: flex; flex-direction: column; }
.prsp-addfilter-clause { display: flex; align-items: center; gap: 0.4rem; width: 100%; text-align: left; cursor: pointer;
	font: inherit; font-size: 0.85rem; padding: 0.4rem 0.8rem 0.4rem 1.6rem; border: none; background: transparent; color: var(--theme-color-text-secondary, #45505f); }
.prsp-addfilter-clause:hover { background: color-mix(in srgb, var(--theme-color-brand-primary, #156dd1) 10%, transparent); color: var(--theme-color-brand-primary, #156dd1); }
.prsp-addfilter-clause-ic { display: inline-flex; font-size: 0.8rem; }
`,
	CSSPriority: 500,

	Templates:
	[
		{
			// One coherent control: a search row (search input + a filters icon button that
			// shows the active-filter count and toggles the drawer + a Search button), and a
			// slide-out drawer beneath it holding the filter clauses, "add filter", the saved
			// Filter Experiences dropdown, and Clear / Reset / Apply. Search, Apply and Enter
			// all submit the form -> handleSearch (apply search + current filters).
			Hash: 'PRSP-SUBSET-Filters-Template',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-SUBSET-Filters-Template] -->
	<div class="prsp-filters" id="PRSP_FilterBar">
		<form id="PRSP_Filter_Form" class="prsp-filters-bar" onsubmit="_Pict.views['PRSP-Filters'].handleSearch(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}'); return false;">
			{~T:PRSP-SUBSET-Filters-Template-Input-Fieldset~}
			{~T:PRSP-SUBSET-Filters-Template-Button-Fieldset~}
		</form>
		<div class="prsp-filters-drawer" id="PRSP_Filter_Drawer">
			<div class="prsp-filters-drawer-inner">
				<!-- The card carries all the panel chrome and lives *inside* the clip box, so it collapses
				     together with the animating height (see .prsp-filters-drawer-card in CSS). -->
				<div class="prsp-filters-drawer-card">
					<!-- Quick Filters: a curated, one-interaction bar painted post-render into this host
					     (empty when the record set has no quick filters → CSS :empty hides it). -->
					<div class="prsp-quickfilters" id="PRSP_QuickFilters"></div>
					<div id="PRSP_Filter_Instances" class="prsp-filters-clauses" onkeydown="if (event.key === 'Enter' &amp;&amp; !event.target.closest('.pps')) { event.preventDefault(); _Pict.views['PRSP-Filters'].handleSearch(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}'); }">
						{~FIV:Record~}
					</div>
					{~T:PRSP-SUBSET-Filters-Template-AddFilter-Fieldset~}
					<div class="prsp-filters-footer">
						{~T:PRSP-SUBSET-Filters-Template-ManageFilters-Fieldset~}
						{~T:PRSP-SUBSET-Filters-Template-DrawerActions-Fieldset~}
					</div>
				</div>
			</div>
		</div>
	</div>
	<!-- DefaultPackage end view template:	[PRSP-SUBSET-Filters-Template] -->
`
		},
		{
			Hash: 'PRSP-SUBSET-Filters-Template-Input-Fieldset',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-SUBSET-Filters-Template-Input-Fieldset] -->
	<span class="prsp-filters-search">
		<span class="prsp-filters-search-ic">{~I:Search~}</span>
		<input id="search_filter" class="prsp-filters-input" type="text" name="filter" placeholder="Search…" autocomplete="off" aria-label="Search">
	</span>
	<!-- DefaultPackage end view template:	[PRSP-SUBSET-Filters-Template-Input-Fieldset] -->
`
		},
		{
			Hash: 'PRSP-SUBSET-Filters-Template-Button-Fieldset',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-SUBSET-Filters-Template-Button-Fieldset] -->
	<button type="button" class="prsp-filters-toggle" id="PRSP_Filter_Toggle" title="Filters" aria-label="Filters" onclick="_Pict.views['PRSP-Filters'].toggleFilterDrawer()">
		<span class="prsp-filters-toggle-ic" id="PRSP_Filter_Icon"></span>
		<span class="prsp-filters-toggle-count" id="PRSP_Filter_Count"></span>
	</button>
	<button type="submit" class="prsp-filters-apply prsp-filters-apply-search" id="PRSP_Filter_Button_Apply">Search</button>
	<!-- DefaultPackage end view template:	[PRSP-SUBSET-Filters-Template-Button-Fieldset] -->
`
		},
		{
			Hash: 'PRSP-SUBSET-Filters-Template-ManageFilters-Fieldset',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-SUBSET-Filters-Template-ManageFilters-Fieldset] -->
	<div class="prsp-filters-experiences">
		<div id="FilterPersistenceView-Container"></div>
	</div>
	<!-- DefaultPackage end view template:	[PRSP-SUBSET-Filters-Template-ManageFilters-Fieldset] -->
`
		},
		{
			Hash: 'PRSP-SUBSET-Filters-Template-DrawerActions-Fieldset',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-SUBSET-Filters-Template-DrawerActions-Fieldset] -->
	<div class="prsp-filters-actions">
		<button type="button" class="prsp-filters-btn-text" id="PRSP_Filter_Button_Clear" title="Clear all filters to a blank state" onclick="_Pict.views['PRSP-Filters'].handleClear(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}')">Clear</button>
		<button type="button" class="prsp-filters-btn-text" id="PRSP_Filter_Button_Reset" title="Reset all filters to the last saved/defaulted state" onclick="_Pict.views['PRSP-Filters'].handleReset(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}')">Reset</button>
		<button type="button" class="prsp-filters-apply" id="PRSP_Filter_Button_ApplyDrawer" onclick="_Pict.views['PRSP-Filters'].handleSearch(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}')">Apply</button>
	</div>
	<!-- DefaultPackage end view template:	[PRSP-SUBSET-Filters-Template-DrawerActions-Fieldset] -->
`
		},
		{
			Hash: 'PRSP-SUBSET-Filters-Template-AddFilter-Fieldset',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-SUBSET-Filters-Template-AddFilter-Fieldset] -->
	<div class="prsp-filters-add">
		<button type="button" class="prsp-filters-btn-text prsp-addfilter-trigger" id="PRSP_Filter_Button_Add" title="Add a new filter clause" onclick="_Pict.views['PRSP-Filters'].toggleAddFilterPopover(event, '{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}')">{~I:Plus~} Add filter</button>
		<div class="prsp-addfilter-pop" id="PRSP_AddFilter_Popover"></div>
	</div>
	<!-- DefaultPackage end view template:	[PRSP-SUBSET-Filters-Template-AddFilter-Fieldset] -->
`
		},
		{
			Hash: 'PRSP-AddFilter-Popover',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-AddFilter-Popover] -->
	<div class="prsp-addfilter-backdrop" onclick="_Pict.views['PRSP-Filters'].closeAddFilterPopover()"></div>
	<div class="prsp-addfilter-panel">
		<div class="prsp-addfilter-search">
			<span class="prsp-addfilter-search-ic">{~I:Search~}</span>
			<input type="text" id="PRSP_AddFilter_Search" placeholder="Search filters…" autocomplete="off" value="{~D:AppData.PRSPAddFilter.Search~}" oninput="_Pict.views['PRSP-Filters'].searchAddFilter(this.value)" onkeydown="if (event.key === 'Escape') { event.preventDefault(); _Pict.views['PRSP-Filters'].closeAddFilterPopover(); }">
		</div>
		<div class="prsp-addfilter-list" id="PRSP_AddFilter_List">
			{~T:PRSP-AddFilter-List~}
		</div>
	</div>
	<!-- DefaultPackage end view template: [PRSP-AddFilter-Popover] -->
`
		},
		{
			Hash: 'PRSP-AddFilter-List',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-AddFilter-List] -->
	{~TS:PRSP-AddFilter-Field:AppData.PRSPAddFilter.Fields~}
	{~NE:AppData.PRSPAddFilter.IsEmpty^<div class="prsp-addfilter-empty">No filters found.</div>~}
	<!-- DefaultPackage end view template: [PRSP-AddFilter-List] -->
`
		},
		{
			Hash: 'PRSP-AddFilter-Field',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-AddFilter-Field] -->
	<div class="prsp-addfilter-field {~D:Record.ExpandedClass~}">
		<button type="button" class="prsp-addfilter-field-btn" onclick="_Pict.views['PRSP-Filters'].toggleAddFilterField('{~D:Record.FilterKey~}')">
			<span class="prsp-addfilter-field-name">{~D:Record.DisplayName~}</span>
			<span class="prsp-addfilter-chev">{~I:ChevronRight~}</span>
		</button>
		<div class="prsp-addfilter-clauses">
			{~TS:PRSP-AddFilter-Clause:Record.ClausesToShow~}
		</div>
	</div>
	<!-- DefaultPackage end view template: [PRSP-AddFilter-Field] -->
`
		},
		{
			Hash: 'PRSP-AddFilter-Clause',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-AddFilter-Clause] -->
	<button type="button" class="prsp-addfilter-clause" onclick="_Pict.views['PRSP-Filters'].addFilter(event, '{~D:AppData.PRSPAddFilter.RecordSet~}', '{~D:AppData.PRSPAddFilter.ViewContext~}', '{~D:Record.FilterKey~}', '{~D:Record.ClauseKey~}')">
		<span class="prsp-addfilter-clause-ic">{~I:Plus~}</span>
		<span>{~D:Record.DisplayName~}</span>
	</button>
	<!-- DefaultPackage end view template: [PRSP-AddFilter-Clause] -->
`
		},
		{
			// Quick Filters bar contents (painted into #PRSP_QuickFilters post-render). A small label +
			// one compact control per definition; each control drives a real, tagged clause.
			Hash: 'PRSP-QuickFilters-Bar',
			Template: /*html*/`
		<span class="prsp-quickfilters-label">Quick filters</span>
		{~TS:PRSP-QuickFilter-Item:Record.Filters~}
`
		},
		{
			// One quick filter: a name + exactly one control, chosen by the single-element-array slot
			// (text / date range / entity picker) populated for this item's control type.
			Hash: 'PRSP-QuickFilter-Item',
			Template: /*html*/`
		<div class="prsp-quickfilter">
			<span class="prsp-quickfilter-name">{~D:Record.Label~}</span>
			{~TS:PRSP-QuickFilter-Text:Record.TextSlot~}
			{~TS:PRSP-QuickFilter-Date:Record.DateSlot~}
			{~TS:PRSP-QuickFilter-Entity:Record.EntitySlot~}
		</div>
`
		},
		{
			// Text control (fuzzy match) — commits on blur / Enter (never per-keystroke, so the
			// re-render that an apply triggers can't steal focus mid-type).
			Hash: 'PRSP-QuickFilter-Text',
			Template: /*html*/`
		<input class="prsp-quickfilter-input" type="text" value="{~D:Record.Value~}" placeholder="{~D:Record.Placeholder~}" autocomplete="off"
			onkeydown="if (event.key === 'Enter') { event.preventDefault(); this.blur(); }"
			onchange="_Pict.views['PRSP-Filters'].applyQuickFilterText('{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}', '{~D:Record.Field~}', '{~D:Record.ClauseKey~}', this.value)">
`
		},
		{
			// Date-range control — a from/to pair driving one DateRange clause (Values.Start / .End).
			Hash: 'PRSP-QuickFilter-Date',
			Template: /*html*/`
		<span class="prsp-quickfilter-daterange">
			<input type="date" class="prsp-quickfilter-input prsp-quickfilter-date" value="{~D:Record.StartValue~}" aria-label="{~D:Record.Label~} from"
				onchange="_Pict.views['PRSP-Filters'].applyQuickFilterDate('{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}', '{~D:Record.Field~}', '{~D:Record.ClauseKey~}', 'start', this.value)">
			<span class="prsp-quickfilter-dash">–</span>
			<input type="date" class="prsp-quickfilter-input prsp-quickfilter-date" value="{~D:Record.EndValue~}" aria-label="{~D:Record.Label~} to"
				onchange="_Pict.views['PRSP-Filters'].applyQuickFilterDate('{~D:Record.RecordSet~}', '{~D:Record.ViewContext~}', '{~D:Record.Field~}', '{~D:Record.ClauseKey~}', 'end', this.value)">
		</span>
`
		},
		{
			// Entity control — a pict-section-picker mounts into this host (post-render, in
			// _mountQuickFilterEntity), so the quick filter reuses the real entity picker.
			Hash: 'PRSP-QuickFilter-Entity',
			Template: /*html*/`
		<span class="prsp-quickfilter-entityhost" id="{~D:Record.HostID~}"></span>
`
		},
	],

	Renderables:
	[
		{
			RenderableHash: 'PRSP_Renderable_Filters',
			TemplateHash: 'PRSP-SUBSET-Filters-Template',
			DestinationAddress: '#PRSP_Filters_Container',
			RenderMethod: 'replace'
		},
		{
			RenderableHash: 'PRSP_AddFilter_Popover',
			TemplateHash: 'PRSP-AddFilter-Popover',
			ContentDestinationAddress: '#PRSP_AddFilter_Popover',
			RenderMethod: 'replace',
		},
		{
			RenderableHash: 'PRSP_AddFilter_List',
			TemplateHash: 'PRSP-AddFilter-List',
			ContentDestinationAddress: '#PRSP_AddFilter_List',
			RenderMethod: 'replace',
		},
	],

	Manifests: {},
};

//FIXME: export this from PSF?
const libPictViewDynamicForm = require('pict-section-form/source/views/Pict-View-DynamicForm.js');

const DynamicInputViewSectionDefinition = (
{
	"Hash": "PSRSDynamicInputs",
	"Name": "Custom Dynamic Inputs",
	"ViewHash": "PSRSFilterProxyView",

	"AutoMarshalDataOnSolve": true,
	"IncludeInMetatemplateSectionGeneration": false,

	"Manifests":
	{
		"Section":
		{
			"Scope": "PSRSDynamic",
			"Sections":
			[
				{
					"Hash": "PSRSDynamicInputs",
					"Name": "Dynamic Inputs"
				}
			],
			"Descriptors":
			{
				"PSRS.DynamicInputPlaceholder":
				{
					"Name": "DynamicInputPlaceholder",
					"Hash": "DynamicInputPlaceholder",
					"DataType": "String",
					"Macro":
					{
						"HTMLSelector": ""
					},
					"PictForm":
					{
						"Section": "PSRSDynamicInputs"
					}
				}
			}
		}
	}
});
class ViewRecordSetSUBSETFilters extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_SUBSET_Filter, pOptions);
		super(pFable, tmpOptions, pServiceHash);
		/** @type {import('fable') & import('pict') & { PictSectionRecordSet: import('../Pict-Section-RecordSet.js') }} */
		this.pict;

		if (!this.pict.views[DynamicInputViewSectionDefinition.ViewHash])
		{
			const tmpViewConfiguration = Object.assign({}, DynamicInputViewSectionDefinition);
			this.pict.addView(tmpViewConfiguration.ViewHash, tmpViewConfiguration, libPictViewDynamicForm);
			this.pict.views[DynamicInputViewSectionDefinition.ViewHash].viewMarshalDestination = 'Bundle';
		}
		for (const tmpView of Object.values(require('./filters')))
		{
			if (tmpView.default_configuration.ViewIdentifier && !this.pict.views[tmpView.default_configuration.ViewIdentifier])
			{
				this.pict.addView(tmpView.default_configuration.ViewIdentifier, {}, tmpView);
			}
		}
		this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

		// Use a lookup table to find the index.
		this.lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
		for (let i = 0; i < this.chars.length; i++)
		{
			this.lookup[this.chars.charCodeAt(i)] = i;
		}
		this.newFilterSearchApplied = false;
		this.addFilterCallback = null;
		this.removeFilterCallback = null;
		// Consolidated filter control state: drawer open/closed, and the last-applied search
		// string per record set (so a search no longer clears the search box on re-render).
		this._drawerOpen = false;
		this._searchString = {};
		// Render-epoch counter, bumped any time the filter list is re-rendered
		// or a new filter experience is applied. Deferred filter post-render
		// work (e.g. the setTimeout-scheduled transaction drain in
		// Pict-Template-FilterInstanceViews) captures the epoch at schedule
		// time and compares against the current value before running, so a
		// stale callback doesn't clobber DOM that now belongs to a different
		// filter experience.
		this._renderEpoch = 0;
		// Add-filter popover state (module-owned, replaces the old native <select> pickers).
		this._addFilterOpen = false;
		this._addFilterRecordSet = null;
		this._addFilterViewContext = null;
		this._addFilterSearch = '';
		this._addFilterExpandedKey = null;
		// FilterKeys to hide from the add-filter popover (e.g. internal/audit columns). Host apps
		// set this; it is merged with a per-record-set config `FilterFieldBlacklist`.
		this.filterFieldBlacklist = [];
	}

	/**
	 * Bump the render epoch. Call this whenever the active filter clauses are
	 * about to change in a way that would invalidate in-flight filter renders.
	 *
	 * @return {number} The new epoch value.
	 */
	bumpRenderEpoch()
	{
		this._renderEpoch++;
		return this._renderEpoch;
	}

	/**
	 * Sets a callback function to be executed after a filter is added.
	 * @param {function} pCallback - The callback function to be executed after a filter is added.
	 */
	setAddFilterCallback(pCallback)
	{
		this.addFilterCallback = pCallback;
	}

	/**
	 * Sets a callback function to be executed after a filter is removed.
	 * @param {function} pCallback - The callback function to be executed after a filter is removed.
	 */
	setRemoveFilterCallback(pCallback)
	{
		this.removeFilterCallback = pCallback;
	}

	/**
	 * Removes the callback function for adding a filter.
	 */
	removeAddFilterCallback()
	{
		this.addFilterCallback = null;
	}

	/**
	 * Removes the callback function for removing a filter.
	 */
	removeRemoveFilterCallback()
	{
		this.removeFilterCallback = null;
	}

	/**
	 * @return {string} - The marshalling prefix configured for filters. Usually 'Bundle.'
	 */
	getInformaryAddressPrefix()
	{
		return `${this.pict.views[DynamicInputViewSectionDefinition.ViewHash].viewMarshalDestination}.`;
	}

	/**
	 * @param {string} pAddress - The address of the informary to get the value from.
	 *
	 * @return {any} - The value at the given address, using the informary marshalling prefix.
	 */
	getInformaryScopedValue(pAddress)
	{
		const tmpCompositeAddress = `${this.getInformaryAddressPrefix()}${pAddress}`;
		return this.pict.resolveStateFromAddress(tmpCompositeAddress);
	}

	//NOTE: two methods below copied from the pict-section-form metacontroller
	//TODO: consider subclassing the dynamic view to somehow mark these as filter views so we can only operate on those views

	/**
	 * Marshals data from the view to the model, usually AppData (or configured data store).
	 * @returns {any} The result of the superclass's onMarshalFromView method.
	 */
	onMarshalFromView()
	{
		let tmpViewList = Object.keys(this.fable.views);
		for (let i = 0; i < tmpViewList.length; i++)
		{
			if (this.fable.views[tmpViewList[i]].isPictSectionForm)
			{
				this.fable.views[tmpViewList[i]].marshalFromView();
			}
		}
		return super.onMarshalFromView();
	}

	/**
	 * Marshals the data to the view from the model, usually AppData (or configured data store).
	 * @returns {any} The result of the super.onMarshalToView() method.
	 */
	onMarshalToView()
	{
		let tmpViewList = Object.keys(this.fable.views);
		for (let i = 0; i < tmpViewList.length; i++)
		{
			if (this.fable.views[tmpViewList[i]].isPictSectionForm)
			{
				this.fable.views[tmpViewList[i]].marshalToView();
			}
		}
		return super.onMarshalToView();
	}

	/** Toggle the slide-out filter drawer beneath the search bar. */
	toggleFilterDrawer()
	{
		this._drawerOpen = !this._drawerOpen;
		const tmpBar = document.getElementById('PRSP_FilterBar');
		if (tmpBar) { tmpBar.classList.toggle('drawer-open', this._drawerOpen); }
		return this._drawerOpen;
	}

	/**
	 * The current search term, read back from the active route URL (the source of truth) so
	 * the search box stays populated across re-renders and reflects bookmarked/filtered URLs.
	 * performSearch builds `.../FilteredTo/FBVOR~<field>~LK~<encoded %term%>~...` from the
	 * SearchFields, so the term is the first LK value in the FilteredTo segment.
	 *
	 * @return {string}
	 */
	_searchTermFromURL()
	{
		const tmpCurrent = this.pict.providers.PictRouter && this.pict.providers.PictRouter.router && this.pict.providers.PictRouter.router.current
			? this.pict.providers.PictRouter.router.current[0] : null;
		const tmpUrl = (tmpCurrent && (tmpCurrent.url || tmpCurrent.hashString)) || '';
		if (tmpUrl.indexOf('FilteredTo/') < 0) { return ''; }
		const tmpFilteredPart = (tmpUrl.split('FilteredTo/')[1] || '').split('/FilterExperience')[0];
		const tmpMatch = tmpFilteredPart.match(/LK~([^~]+)/);
		if (!tmpMatch) { return ''; }
		let tmpValue = tmpMatch[1];
		try { tmpValue = decodeURIComponent(tmpValue); } catch (pError) { /* leave raw */ }
		return tmpValue.replace(/^%+|%+$/g, '');
	}

	/** The number of active (structured) filter clauses for a record set. */
	getActiveFilterCount(pRecordSet)
	{
		const tmpClauses = this.pict && this.pict.Bundle && this.pict.Bundle._ActiveFilterState && this.pict.Bundle._ActiveFilterState[pRecordSet]
			? this.pict.Bundle._ActiveFilterState[pRecordSet].FilterClauses : null;
		return Array.isArray(tmpClauses) ? tmpClauses.length : 0;
	}

	/**
	 * Repaint the filter-bar chrome after a (re)render: the filters icon (outline vs filled
	 * + count badge), the active-filter highlight, the persisted drawer-open state, and the
	 * search input value (so applying a search no longer clears the search box).
	 *
	 * @param {string} pRecordSet
	 */
	_paintFilterControls(pRecordSet)
	{
		const tmpBar = document.getElementById('PRSP_FilterBar');
		if (!tmpBar) { return; }
		const tmpCount = this.getActiveFilterCount(pRecordSet);
		tmpBar.classList.toggle('has-filters', tmpCount > 0);
		tmpBar.classList.toggle('drawer-open', !!this._drawerOpen);
		const tmpIcon = document.getElementById('PRSP_Filter_Icon');
		if (tmpIcon) { tmpIcon.innerHTML = (tmpCount > 0) ? ViewRecordSetSUBSETFilters.FilterIconFilled : ViewRecordSetSUBSETFilters.FilterIconOutline; }
		const tmpCountEl = document.getElementById('PRSP_Filter_Count');
		if (tmpCountEl) { tmpCountEl.textContent = (tmpCount > 0) ? String(tmpCount) : ''; }
		const tmpInput = document.getElementById('search_filter');
		if (tmpInput) { tmpInput.value = this._searchTermFromURL(); }
	}

	/**
	 * Paint the Quick Filters bar into #PRSP_QuickFilters from the record set's quick-filter definitions
	 * (host config or clever defaults), each control seeded with its clause's current value. Phase 1
	 * renders the text controls; date/entity controls follow. Empty → the bar's :empty CSS hides it.
	 *
	 * @param {string} pRecordSet @param {string} pViewContext
	 */
	_renderQuickFilters(pRecordSet, pViewContext)
	{
		if (!document.getElementById('PRSP_QuickFilters')) { return; }
		const tmpProvider = this.pict.providers['RSP-Provider-' + pRecordSet];
		if (!tmpProvider || typeof tmpProvider.getQuickFilterDefinitions !== 'function')
		{
			this.pict.ContentAssignment.assignContent('#PRSP_QuickFilters', '');
			return;
		}
		// Build one item per definition, populating exactly one control slot (text / date / entity).
		// `quickFiltersAutoDefault` (host-settable, default on) gates the clever schema defaults: a host
		// can set it false to make quick filters opt-in (only record sets with an explicit config show).
		const tmpEntityMounts = [];
		const tmpItems = tmpProvider.getQuickFilterDefinitions(this.quickFiltersAutoDefault).map((pDefinition) =>
		{
			const tmpBase = { Field: pDefinition.Field, ClauseKey: pDefinition.ClauseKey, Label: pDefinition.Label, RecordSet: pRecordSet, ViewContext: pViewContext };
			const tmpItem = { Label: pDefinition.Label, TextSlot: [], DateSlot: [], EntitySlot: [] };
			if (pDefinition.Control === 'text')
			{
				tmpItem.TextSlot = [ Object.assign({}, tmpBase, { Value: tmpProvider.getQuickFilterClauseValue(pDefinition.Field), Placeholder: `Search ${pDefinition.Label}…` }) ];
			}
			else if (pDefinition.Control === 'daterange')
			{
				const tmpRange = tmpProvider.getQuickFilterDateRangeValue(pDefinition.Field);
				tmpItem.DateSlot = [ Object.assign({}, tmpBase, { StartValue: tmpRange.Start, EndValue: tmpRange.End }) ];
			}
			else if (pDefinition.Control === 'entity')
			{
				const tmpHostID = `PRSP_QuickEntity_${pRecordSet}_${pDefinition.Field}`;
				tmpItem.EntitySlot = [ Object.assign({}, tmpBase, { HostID: tmpHostID }) ];
				tmpEntityMounts.push(Object.assign({}, tmpBase, { HostID: tmpHostID }));
			}
			return tmpItem;
		});
		const tmpHTML = (tmpItems.length > 0) ? this.pict.parseTemplateByHash('PRSP-QuickFilters-Bar', { Filters: tmpItems }) : '';
		this.pict.ContentAssignment.assignContent('#PRSP_QuickFilters', tmpHTML);
		// Entity controls: mount (or re-mount) a picker into each host after the wholesale re-render.
		tmpEntityMounts.forEach((pMount) => this._mountQuickFilterEntity(pRecordSet, pViewContext, pMount));
	}

	/**
	 * Mount (idempotently) a pict-section-picker into a quick-filter entity host, configured from the
	 * field's entity clause descriptor (RemoteTable / search columns / value column), single-select.
	 * On change it upserts the clause + applies. Re-runs after each render (the bar repaints wholesale),
	 * mirroring the form adapter's re-mount pattern. No-op if the picker module isn't registered.
	 *
	 * @param {string} pRecordSet @param {string} pViewContext @param {Record<string, any>} pMount
	 */
	_mountQuickFilterEntity(pRecordSet, pViewContext, pMount)
	{
		if (!document.getElementById(pMount.HostID)) { return; }
		const tmpPickerProvider = this.pict.providers['Pict-Section-Picker'];
		const tmpProvider = this.pict.providers['RSP-Provider-' + pRecordSet];
		if (!tmpPickerProvider || typeof tmpPickerProvider.createEntityPicker !== 'function' || !tmpProvider) { return; }
		const tmpDescriptor = tmpProvider.getFilterClauseSchemaForKey(pMount.Field)?.AvailableClauses?.find?.((pClause) => pClause.ClauseKey === pMount.ClauseKey);
		if (!tmpDescriptor || !tmpDescriptor.RemoteTable) { return; }
		const tmpSearchFields = Array.isArray(tmpDescriptor.ExternalFilterByColumns) && tmpDescriptor.ExternalFilterByColumns.length > 0 ? tmpDescriptor.ExternalFilterByColumns : [ 'Name' ];
		const tmpView = tmpPickerProvider.createEntityPicker(`Quick-Picker-${pRecordSet}-${pMount.Field}`,
		{
			DestinationAddress: `#${pMount.HostID}`,
			// Quick filters stay single-select for a fast pick (the full drawer entity filter can be multi).
			Mode: 'single',
			Entity: tmpDescriptor.RemoteTable,
			ValueField: tmpDescriptor.JoinExternalConnectionColumn || `ID${tmpDescriptor.RemoteTable}`,
			SearchFields: tmpSearchFields,
			TextField: tmpSearchFields[0],
			// Composed, disambiguated option/chip label (e.g. "Brian Smith (brian@…)") — falls back to
			// TextField when the entity has no list-entry template.
			TextTemplate: tmpDescriptor.EntityListEntryTemplate || undefined,
			Placeholder: `Select ${pMount.Label}…`,
			OnChange: (pValue) => this.applyQuickFilterEntity(pRecordSet, pViewContext, pMount.Field, pMount.ClauseKey, pValue),
		});
		if (!tmpView) { return; }
		tmpView.render();
		const tmpCurrent = (typeof tmpProvider.getQuickFilterEntityValue === 'function') ? tmpProvider.getQuickFilterEntityValue(pMount.Field) : [];
		tmpView.setValue((Array.isArray(tmpCurrent) && tmpCurrent.length > 0) ? tmpCurrent[0] : '');
	}

	/**
	 * Apply a text quick filter: upsert (or clear) its tagged clause, then run the standard search +
	 * serialize path. Commits on blur / Enter (not per-keystroke) so the re-render never steals focus.
	 *
	 * @param {string} pRecordSet @param {string} pViewContext @param {string} pField @param {string} pClauseKey @param {string} pValue
	 */
	applyQuickFilterText(pRecordSet, pViewContext, pField, pClauseKey, pValue)
	{
		this.bumpRenderEpoch();
		const tmpProvider = this.pict.providers['RSP-Provider-' + pRecordSet];
		if (tmpProvider && typeof tmpProvider.upsertQuickFilterClauseValue === 'function')
		{
			tmpProvider.upsertQuickFilterClauseValue(pField, pClauseKey, (pValue === undefined || pValue === null) ? '' : String(pValue).trim());
		}
		// Stage the clause into the active filter state but DON'T fetch — the
		// user explicitly clicks Apply / Search to commit. Avoids two URL fetches
		// (one stale, one not) when adjacent inputs change in quick succession
		// (e.g. the From / To dates of a DateRange both fire `change` events
		// within ~50ms — the GE-only fetch finishes after the GE+LE fetch and
		// overwrites the recordset state with stale data).
	}

	/**
	 * Stage one bound (`start`/`end`) of a field's DateRange quick-filter clause.
	 * Doesn't fire the search — that waits for the user to click Apply / Search,
	 * so the From and To inputs change once each without racing the fetch.
	 *
	 * @param {string} pRecordSet @param {string} pViewContext @param {string} pField @param {string} pClauseKey @param {'start'|'end'} pWhich @param {string} pValue
	 */
	applyQuickFilterDate(pRecordSet, pViewContext, pField, pClauseKey, pWhich, pValue)
	{
		this.bumpRenderEpoch();
		const tmpProvider = this.pict.providers['RSP-Provider-' + pRecordSet];
		if (tmpProvider && typeof tmpProvider.upsertQuickFilterDateRange === 'function')
		{
			tmpProvider.upsertQuickFilterDateRange(pField, pClauseKey, pWhich, (pValue === undefined || pValue === null) ? '' : pValue);
		}
	}

	/**
	 * Stage a field's entity quick-filter selection. Doesn't fire the search —
	 * commit happens on Apply / Search.
	 *
	 * @param {string} pRecordSet @param {string} pViewContext @param {string} pField @param {string} pClauseKey @param {any} pValue
	 */
	applyQuickFilterEntity(pRecordSet, pViewContext, pField, pClauseKey, pValue)
	{
		this.bumpRenderEpoch();
		const tmpProvider = this.pict.providers['RSP-Provider-' + pRecordSet];
		if (tmpProvider && typeof tmpProvider.upsertQuickFilterEntity === 'function')
		{
			tmpProvider.upsertQuickFilterEntity(pField, pClauseKey, pValue);
		}
	}

	/**
	 * @param {Event} pEvent - The DOM event that triggered the search
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 */
	handleSearch(pEvent, pRecordSet, pViewContext)
	{
		if (pEvent) { pEvent.preventDefault(); pEvent.stopPropagation(); } // don't submit the form
		this.newFilterSearchApplied = true;
		const tmpSearchString = this.pict.ContentAssignment.readContent(`input[name="filter"]`);
		// Remember the applied search so the re-render below doesn't blank the search box.
		this._searchString[pRecordSet] = tmpSearchString ? String(tmpSearchString) : '';
		this.performSearch(pRecordSet, pViewContext, this._searchString[pRecordSet]);
	}

	/**
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 * @param {string} [pFilterString] - The filter string to apply, defaults to a single space if not provided
	 */
	performSearch(pRecordSet, pViewContext, pFilterString)
	{
		this.bumpRenderEpoch();
		const tmpPictRouter = this.pict.providers.PictRouter;
		const tmpProviderConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[pRecordSet];
		let filterExpr = '';
		if (pFilterString)
		{
			/** @type {Array<string>} */
			const searchFields = tmpProviderConfiguration?.SearchFields ?? [ 'Name' ];
			filterExpr = searchFields.map((filterField) => `FBVOR~${filterField}~LK~${encodeURIComponent(`%${pFilterString}%`)}`).join('~');
		}
		let tmpURLTemplate = tmpProviderConfiguration[`RecordSetFilterURLTemplate-${pViewContext}`] || tmpProviderConfiguration[`RecordSetFilterURLTemplate-Default`];
		if (!tmpURLTemplate)
		{
			if (pViewContext === 'Dashboard' || pViewContext === 'List')
			{
				tmpURLTemplate = `/PSRS/${pRecordSet}/${pViewContext}/FilteredTo/{~D:Record.FilterString~}`;
			}
		}
		let tmpURL;
		if (tmpURLTemplate)
		{
			tmpURL = this.pict.parseTemplate(tmpURLTemplate,
				{
					RecordSet: pRecordSet,
					FilterString: filterExpr,
				});
		}
		else
		{
			tmpURL = `/PSRS/${pRecordSet}/List/FilteredTo/${filterExpr}`;
		}
		if (tmpURL.endsWith('FilteredTo/') || tmpURL.includes('FilteredTo//'))
		{
			tmpURL = tmpURL.replace(/\/FilteredTo\//, '');
		}
		this.render(undefined, undefined, { RecordSet: pRecordSet, ViewContext: pViewContext });
		this.serializeFilterExperience(this.pict.Bundle._ActiveFilterState[pRecordSet]?.FilterClauses).then((pFilterExperienceSerialized) =>
		{
			if (pFilterExperienceSerialized)
			{
				tmpURL += `/FilterExperience/${encodeURIComponent(pFilterExperienceSerialized)}`;
			}
			//FIXME: this doesn't force a re-render if other filters have changes, but aren't in the URL - so we either need to put them in the URL, or force a re-render based on the filter states
			tmpPictRouter.router.navigate(tmpURL);
			// always store the last used filter experience search, even if they don't save it
			this.pict.providers.FilterDataProvider.setLastUsedFilterExperience(null, pRecordSet, pViewContext);
		});
		// new search means this can't be out of date anymore
		this.pict.providers.FilterDataProvider.filterExperienceModifiedFromURLHash = false;
		this.newFilterSearchApplied = false;
	}

	/**
	 * Clear all filter clauses for the given record set and view context.
	 * @param {Event} pEvent - The DOM event that triggered the search
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 */
	handleClear(pEvent, pRecordSet, pViewContext)
	{
		if (pEvent) pEvent.preventDefault();
		this.bumpRenderEpoch();
		this.pict.ContentAssignment.assignContent('input[name="filter"]', '');
		this._searchString[pRecordSet] = '';
		this.pict.Bundle._ActiveFilterState[pRecordSet].FilterClauses = [];
		this.pict.providers.FilterDataProvider.removeDefaultFilterExperience(pRecordSet, pViewContext);
		this.performSearch(pRecordSet, pViewContext, '');
	}

	// NOTE: Reset means to default state, Clear means to no filters at all
	/**
	 * Reset the filters to default state or fallback to to clear everything if no default exist for the given record set and view context.
	 * @param {Event} pEvent - The DOM event that triggered the search
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 */
	handleReset(pEvent, pRecordSet, pViewContext)
	{
		if (pEvent) pEvent.preventDefault();
		this.bumpRenderEpoch();
		this.pict.providers.FilterDataProvider.removeLastUsedFilterExperience(pRecordSet, pViewContext);
		this.pict.log.info(`Clearing filters for record set: ${pRecordSet} in view context: ${pViewContext}`);
		// Apply default filter experience if it exists, otherwise just clear
		const tmpDefaultFilterExperience = this.pict.providers.FilterDataProvider.getDefaultFilterExperience(pRecordSet, pViewContext);
		if (tmpDefaultFilterExperience)
		{
			this.pict.log.info(`Applying default filter experience for record set: ${pRecordSet} in view context: ${pViewContext}`);
			this.pict.providers.FilterDataProvider.applyExpectedFilterExperience(pRecordSet, pViewContext, tmpDefaultFilterExperience.FilterExperienceHash, false);
			this.pict.providers.FilterDataProvider.filterExperienceModifiedFromURLHash = false;
		}
		else 
		{
			this.handleClear(pEvent, pRecordSet, pViewContext);
		}
	}

	/**
	 * @param {Event} pEvent - The DOM event that triggered the search
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 * @returns {boolean} - Always returns false to prevent default action
	*/
	handleManage(pEvent, pRecordSet, pViewContext)
	{
		if (pEvent) pEvent.preventDefault();
		this.pict.log.info(`Managing filters for record set: ${pRecordSet} in view context: ${pViewContext}`);
		this.pict.views.FilterPersistenceView.openFilterPersistenceUI(pRecordSet, pViewContext);
		return false;
	}

	/**
	 * @param {Event} pEvent - The DOM event that triggered the search
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 */
	toggleAddFilterPopover(pEvent, pRecordSet, pViewContext)
	{
		if (pEvent) { pEvent.preventDefault(); }
		if (this._addFilterOpen)
		{
			return this.closeAddFilterPopover();
		}
		this._addFilterOpen = true;
		this._addFilterRecordSet = pRecordSet;
		this._addFilterViewContext = pViewContext;
		this._addFilterSearch = '';
		this._addFilterExpandedKey = null;
		this._buildAddFilterFields(pRecordSet);
		this.render('PRSP_AddFilter_Popover', undefined, { RecordSet: pRecordSet, ViewContext: pViewContext });
		this._paintAddFilterOpenState();
	}

	/** Close the add-filter popover. */
	closeAddFilterPopover()
	{
		this._addFilterOpen = false;
		this._addFilterExpandedKey = null;
		this._paintAddFilterOpenState();
	}

	/**
	 * Filter the add-filter field list by a search term, re-rendering only the list so the
	 * search input keeps focus.
	 * @param {string} pValue - The search term.
	 */
	searchAddFilter(pValue)
	{
		this._addFilterSearch = pValue || '';
		this._buildAddFilterFields(this._addFilterRecordSet);
		this.render('PRSP_AddFilter_List', undefined, { RecordSet: this._addFilterRecordSet, ViewContext: this._addFilterViewContext });
	}

	/**
	 * Expand or collapse a field's available clauses in the add-filter popover.
	 * @param {string} pFilterKey - The field whose clauses to toggle.
	 */
	toggleAddFilterField(pFilterKey)
	{
		this._addFilterExpandedKey = (this._addFilterExpandedKey === pFilterKey) ? null : pFilterKey;
		this._buildAddFilterFields(this._addFilterRecordSet);
		this.render('PRSP_AddFilter_List', undefined, { RecordSet: this._addFilterRecordSet, ViewContext: this._addFilterViewContext });
	}

	/**
	 * (Re)build the add-filter popover's field list into AppData from the record set's filter
	 * schema, honouring the current search term and the expanded field.
	 * @param {string} pRecordSet - The record set whose filter schema to read.
	 */
	_buildAddFilterFields(pRecordSet)
	{
		const tmpProvider = this.pict.providers[`RSP-Provider-${pRecordSet}`];
		const tmpSchema = (tmpProvider && typeof tmpProvider.getFilterSchema === 'function') ? tmpProvider.getFilterSchema() : {};
		const tmpRecordSetConfig = this.pict.PictSectionRecordSet?.recordSetProviderConfigurations?.[pRecordSet] || {};
		const tmpBlacklist = [].concat(this.filterFieldBlacklist || [], Array.isArray(tmpRecordSetConfig.FilterFieldBlacklist) ? tmpRecordSetConfig.FilterFieldBlacklist : []);
		const tmpSearch = (this._addFilterSearch || '').toLowerCase();
		const tmpFields = Object.values(tmpSchema)
			.filter((pField) => Array.isArray(pField.AvailableClauses) && pField.AvailableClauses.length > 0)
			.filter((pField) => !tmpBlacklist.includes(pField.FilterKey))
			.filter((pField) => !tmpSearch || String(pField.DisplayName || pField.FilterKey).toLowerCase().includes(tmpSearch))
			.sort((pA, pB) => String(pA.DisplayName || pA.FilterKey).localeCompare(String(pB.DisplayName || pB.FilterKey)))
			.map((pField) =>
			{
				const tmpExpanded = (pField.FilterKey === this._addFilterExpandedKey);
				return {
					FilterKey: pField.FilterKey,
					DisplayName: pField.DisplayName || pField.FilterKey,
					ExpandedClass: tmpExpanded ? 'is-expanded' : '',
					ClausesToShow: tmpExpanded ? pField.AvailableClauses : [],
				};
			});
		this.pict.AppData.PRSPAddFilter =
		{
			RecordSet: pRecordSet,
			ViewContext: this._addFilterViewContext,
			Search: this._addFilterSearch || '',
			IsEmpty: tmpFields.length === 0,
			Fields: tmpFields,
		};
	}

	/** Reflect the add-filter popover's open/closed state on its container element. */
	_paintAddFilterOpenState()
	{
		const tmpPopover = document.getElementById('PRSP_AddFilter_Popover');
		if (!tmpPopover) { return; }
		tmpPopover.classList.toggle('open', !!this._addFilterOpen);
		if (this._addFilterOpen) { this._positionAddFilterPopover(tmpPopover); }
	}

	/**
	 * Position the (fixed) add-filter popover against its trigger button, flipping above when there's
	 * more room there. Fixed positioning means no ancestor overflow:hidden (the host's filter card, the
	 * slide-out drawer) can clip it — the price is we set its top/left from the trigger's rect here.
	 *
	 * @param {HTMLElement} pPopover - the #PRSP_AddFilter_Popover element (already display:block).
	 */
	_positionAddFilterPopover(pPopover)
	{
		const tmpTrigger = document.getElementById('PRSP_Filter_Button_Add');
		if (!tmpTrigger) { return; }
		const tmpPanel = /** @type {HTMLElement} */ (pPopover.querySelector('.prsp-addfilter-panel'));
		const tmpRect = tmpTrigger.getBoundingClientRect();
		const tmpGap = 6;
		const tmpMargin = 8;
		const tmpVH = window.innerHeight;
		const tmpVW = window.innerWidth;
		const tmpWidth = pPopover.offsetWidth || 300;
		pPopover.style.left = `${Math.round(Math.max(tmpMargin, Math.min(tmpRect.left, tmpVW - tmpWidth - tmpMargin)))}px`;
		pPopover.style.right = 'auto';
		const tmpSpaceBelow = tmpVH - tmpRect.bottom - tmpGap - tmpMargin;
		const tmpSpaceAbove = tmpRect.top - tmpGap - tmpMargin;
		// Prefer the natural downward direction; only flip above when the room below is genuinely cramped.
		if (tmpSpaceBelow >= 220 || tmpSpaceBelow >= tmpSpaceAbove)
		{
			pPopover.style.top = `${Math.round(tmpRect.bottom + tmpGap)}px`;
			pPopover.style.bottom = 'auto';
			if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(160, Math.min(tmpSpaceBelow, 460))}px`; }
		}
		else
		{
			pPopover.style.top = 'auto';
			pPopover.style.bottom = `${Math.round(tmpVH - tmpRect.top + tmpGap)}px`;
			if (tmpPanel) { tmpPanel.style.maxHeight = `${Math.max(160, Math.min(tmpSpaceAbove, 460))}px`; }
		}
	}

	/**
	 * @param {Event} pEvent - The DOM event that triggered the search
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 * @param {string} pFilterKey - The key of the filter to add
	 * @param {string} pClauseKey - The key of the clause to add
	 */
	addFilter(pEvent, pRecordSet, pViewContext, pFilterKey, pClauseKey)
	{
		if (pEvent) pEvent.preventDefault();
		this.bumpRenderEpoch();
		this.pict.log.info(`Adding filter: ${pFilterKey} with clause: ${pClauseKey} to record set: ${pRecordSet} in view context: ${pViewContext}`);
		this.pict.providers[`RSP-Provider-${pRecordSet}`].addFilterClause(pFilterKey, pClauseKey);
		//FIXME: we need the record from the original render here but no longer have it...
		this.render(undefined, undefined, { RecordSet: pRecordSet, ViewContext: pViewContext });
		if (this.addFilterCallback) this.addFilterCallback();
	}

	/**
	 * @param {Event} pEvent - The DOM event that triggered the search
	 * @param {string} pRecordSet - The record set being filtered
	 * @param {string} pViewContext - The view context for the filter (ex. List, Dashboard)
	 * @param {string} pSpecificFilterKey - The key of the specific filter to remove
	 */
	removeFilter(pEvent, pRecordSet, pViewContext, pSpecificFilterKey)
	{
		if (pEvent) pEvent.preventDefault();
		this.bumpRenderEpoch();
		this.pict.log.info(`Removing filter: ${pSpecificFilterKey} from record set: ${pRecordSet} in view context: ${pViewContext}`);
		this.pict.providers[`RSP-Provider-${pRecordSet}`].removeFilterClause(pSpecificFilterKey);
		//FIXME: we need the record from the original render here but no longer have it...
		this.render(undefined, undefined, { RecordSet: pRecordSet, ViewContext: pViewContext });
		if (this.removeFilterCallback) this.removeFilterCallback();
	}

	/**
	 * Gets the filter schema for the given record set.
	 * @param {string} pRecordSet - The record set to get the filter schema for
	 * @return {Array<any>} - The filter schema for the given record set
	 */
	getFilterSchema(pRecordSet)
	{
		const tmpRecordsetProvider = this.pict.providers['RSP-Provider-' + pRecordSet];
		return Object.values(tmpRecordsetProvider.getFilterSchema()).flatMap((pFilter) => pFilter.AvailableClauses || []);
	}

	/**
	 * Lifecycle hook that triggers before the view is rendered. The consolidated filter
	 * control's markup is owned by this module now, so re-assert its templates here — this
	 * neutralizes any host/server template override that previously replaced the filter UI,
	 * letting apps brand the control via CSS (theme tokens) rather than by swapping markup.
	 *
	 * @param {import('pict-view').Renderable} pRenderable - The renderable about to be rendered.
	 */
	onBeforeRender(pRenderable)
	{
		// Re-assert ONLY the consolidated-control chrome (the wrapper, search row, filter toggle +
		// Search button, the Filter Experiences container, and Clear/Reset/Apply) so the module owns
		// that markup. Deliberately NOT the add-filter dropdown or per-clause templates: host apps
		// (e.g. Headlight) layer their own styled add-filter popover and clause UI on top, and
		// re-asserting those clobbers them — re-exposing bare native <select> dropdowns and a dead
		// remove button. Those host overrides register at init and must survive each re-render.
		const tmpChromeTemplateHashes =
		[
			'PRSP-SUBSET-Filters-Template',
			'PRSP-SUBSET-Filters-Template-Input-Fieldset',
			'PRSP-SUBSET-Filters-Template-Button-Fieldset',
			'PRSP-SUBSET-Filters-Template-ManageFilters-Fieldset',
			'PRSP-SUBSET-Filters-Template-DrawerActions-Fieldset'
		];
		if (this.pict.TemplateProvider && Array.isArray(_DEFAULT_CONFIGURATION_SUBSET_Filter.Templates))
		{
			for (const tmpTemplateHash of tmpChromeTemplateHashes)
			{
				const tmpTemplate = _DEFAULT_CONFIGURATION_SUBSET_Filter.Templates.find((pTemplate) => pTemplate.Hash === tmpTemplateHash);
				if (tmpTemplate)
				{
					this.pict.TemplateProvider.addTemplate(tmpTemplate.Hash, tmpTemplate.Template);
				}
			}
		}
		return super.onBeforeRender(pRenderable);
	}

	/**
	 * Lifecycle hook that triggers after the view is rendered.
	 * @param {import('pict-view').Renderable} pRenderable - The renderable that was rendered.
	 */
	onAfterRender(pRenderable)
	{
		const res = super.onAfterRender(pRenderable);
		// Add-filter popover sub-renders (the panel + its list) only repaint that widget — skip the
		// heavy post-render pass below and just keep the open/closed class in sync.
		if (pRenderable?.RenderableHash === 'PRSP_AddFilter_Popover' || pRenderable?.RenderableHash === 'PRSP_AddFilter_List')
		{
			this._paintAddFilterOpenState();
			return res;
		}
		// Any full re-render rebuilds the add-filter slot, so the popover is closed — reset its state.
		this._addFilterOpen = false;
		this.onMarshalToView();

		// NOTE: This is where we ensure the filter experience is applied after a render.
		const tmpRouteUrl = this.pict.providers.PictRouter?.router?.current[0]?.url || this.pict.providers.PictRouter?.router?.current[0]?.hashString;
		const tmpRecordSet = tmpRouteUrl?.split?.('PSRS/')?.[1]?.split?.('/')?.[0];
		const tmpViewContext = tmpRouteUrl?.split?.('PSRS/')?.[1]?.split?.('/')?.[1];
		if (tmpRecordSet && tmpViewContext)
		{
			this.pict.providers.FilterDataProvider.applyExpectedFilterExperience(tmpRecordSet, tmpViewContext);
		}

		// Consolidated filter control: whenever the search row is in the DOM, refresh the
		// search box, the filters icon/count + drawer state, and surface the saved Filter
		// Experiences dropdown in the drawer. (Guarded on the DOM element rather than the
		// renderable hash because the list embeds this view via {~FV:~}.)
		if (document.getElementById('PRSP_Filter_Icon'))
		{
			let tmpFilterRecordSet = tmpRecordSet;
			let tmpFilterViewContext = tmpViewContext || 'List';
			if (!tmpFilterRecordSet && this.pict.Bundle && this.pict.Bundle._ActiveFilterState)
			{
				tmpFilterRecordSet = Object.keys(this.pict.Bundle._ActiveFilterState)[0];
			}
			if (tmpFilterRecordSet)
			{
				this._paintFilterControls(tmpFilterRecordSet);
					this._renderQuickFilters(tmpFilterRecordSet, tmpFilterViewContext);
				// (Re)render the experiences dropdown only when its container is empty — i.e. on
				// a fresh filter render — not on every sub-render (add-filter dropdown, etc.).
				const tmpExpContainer = document.getElementById('FilterPersistenceView-Container');
				if (this.pict.views.FilterPersistenceView && tmpExpContainer && !tmpExpContainer.querySelector('#FilterPersistenceView-Content'))
				{
					this.pict.views.FilterPersistenceView.initializeFilterPersistenceViewUI(tmpFilterRecordSet, tmpFilterViewContext);
				}
			}
			if (this.pict.CSSMap && typeof this.pict.CSSMap.injectCSS === 'function') { this.pict.CSSMap.injectCSS(); }
		}

		return res;
	}

	/**
	 * Encodes the filter experience to a string.
	 * @param {Record<string, any>} pExperience - The filter experience to serialize.
	 * @return {Promise<string>} - The serialized filter experience as a string.
	 */
	async serializeFilterExperience(pExperience)
	{
		if (!pExperience || typeof pExperience !== 'object')
		{
			return '';
		}
		const tmpExperience = JSON.parse(JSON.stringify(pExperience));
		for (const tmpClause of tmpExperience)
		{
			//FIXME: avoiding saving search results to the URL but this pattern isn't ideal
			delete tmpClause.SearchResults;
			delete tmpClause.SearchResultsOffset;
			delete tmpClause.LoadMoreEnabled;
		}
		return this.encode(await this.compress(JSON.stringify(tmpExperience)));
	}

	/**
	 * Decodes the filter experience from a string.
	 * @param {string} pExperience - The serialized filter experience as a string.
	 * @return {Promise<Record<string, any>>} - The serialized filter experience as a string.
	 */
	async deserializeFilterExperience(pExperience)
	{
		if (!pExperience || typeof pExperience !== 'string')
		{
			//TODO: if the default filters expand, how we wanna handle that?
			return null;
		}
		return JSON.parse(await this.decompress(new Uint8Array(this.decode(pExperience))));
	}

	/**
	 * @param {string} string - The string to compress.
	 * @param {CompressionFormat} [encoding='gzip'] - The encoding to use for compression, defaults to 'gzip'.
	 * @return {Promise<ArrayBuffer>} - The compressed byte array.
	 */
	async compress(string, encoding = 'gzip')
	{
		const byteArray = new TextEncoder().encode(string);
		const cs = new CompressionStream(encoding);
		const writer = cs.writable.getWriter();
		writer.write(byteArray);
		writer.close();
		return new Response(cs.readable).arrayBuffer();
	}

	/**
	 * @param {Uint8Array} byteArray - The byte array to decompress.
	 * @param {CompressionFormat} [encoding='gzip'] - The encoding to use for compression, defaults to 'gzip'.
	 */
	async decompress(byteArray, encoding = 'gzip')
	{
		const cs = new DecompressionStream(encoding);
		const writer = cs.writable.getWriter();
		// @ts-ignore
		writer.write(byteArray);
		writer.close();
		return new Response(cs.readable).arrayBuffer().then((arrayBuffer) =>
		{
			return new TextDecoder().decode(arrayBuffer);
		});
	}

	/**
	 * @param {ArrayBuffer} arraybuffer - The ArrayBuffer to encode to Base64.
	 * @return {string} - The Base64 encoded string.
	 */
	encode(arraybuffer)
	{
		let bytes = new Uint8Array(arraybuffer),
			i,
			len = bytes.length,
			base64 = '';

		for (i = 0; i < len; i += 3)
		{
			base64 += this.chars[bytes[i] >> 2];
			base64 += this.chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
			base64 += this.chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
			base64 += this.chars[bytes[i + 2] & 63];
		}

		if (len % 3 === 2)
		{
			base64 = base64.substring(0, base64.length - 1) + '=';
		}
		else if (len % 3 === 1)
		{
			base64 = base64.substring(0, base64.length - 2) + '==';
		}

		return base64;
	};

	/**
	 * @param {string} base64 - The Base64 encoded string to decode to an ArrayBuffer.
	 * @return {ArrayBuffer} - The decoded ArrayBuffer.
	 */
	decode(base64)
	{
		let bufferLength = base64.length * 0.75,
			len = base64.length,
			i,
			p = 0,
			encoded1,
			encoded2,
			encoded3,
			encoded4;

		if (base64[base64.length - 1] === '=')
		{
			bufferLength--;
			if (base64[base64.length - 2] === '=')
			{
				bufferLength--;
			}
		}

		const arraybuffer = new ArrayBuffer(bufferLength),
			bytes = new Uint8Array(arraybuffer);

		for (i = 0; i < len; i += 4)
		{
			encoded1 = this.lookup[base64.charCodeAt(i)];
			encoded2 = this.lookup[base64.charCodeAt(i + 1)];
			encoded3 = this.lookup[base64.charCodeAt(i + 2)];
			encoded4 = this.lookup[base64.charCodeAt(i + 3)];

			bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
			bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
			bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
		}

		return arraybuffer;
	};
}

// Funnel icons for the filters toggle — outline when no filters are set, filled when set.
// currentColor so they follow the (themeable) toggle text color.
ViewRecordSetSUBSETFilters.FilterIconOutline = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.5h17l-6.6 7.8v4.7l-3.8 2v-6.7z"/></svg>';
ViewRecordSetSUBSETFilters.FilterIconFilled = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 5.5h17l-6.6 7.8v4.7l-3.8 2v-6.7z"/></svg>';

module.exports = ViewRecordSetSUBSETFilters;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_SUBSET_Filter;

