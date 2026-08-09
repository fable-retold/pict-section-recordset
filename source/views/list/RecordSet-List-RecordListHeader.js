const libPictView = require('pict-view');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_List_RecordListHeader = (
	{
		ViewIdentifier: 'PRSP-List-RecordListHeader',

		DefaultRenderable: 'PRSP_Renderable_RecordListHeader',
		DefaultDestinationAddress: '#PRSP_RecordListHeader_Container',
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
					Hash: 'PRSP-List-RecordListHeader-Template',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-RecordListHeader-Template] -->
	<tr>
		{~TS:PRSP-List-RecordListHeader-Template-Header:Record.TableCells~}
		{~T:PRSP-List-RecordListHeader-Template-Extra-Header~}
		{~T:PRSP-List-RecordListActions-Template-Header~}
	</tr>
	<!-- DefaultPackage end view template:  [PRSP-List-RecordListHeader-Template] -->
	`
				},
				{
					// Per-column header dispatch: a sortable column (opt in via RecordSetListSortable / column
					// Sortable) renders a clickable, indicator-bearing header; otherwise the plain header. Exactly
					// one slot is populated per cell in RecordSet-List._stampSortState, so this stays a no-op change
					// for every list that has not opted into sorting.
					Hash: 'PRSP-List-RecordListHeader-Template-Header',
					Template: /*html*/`{~TS:PRSP-List-RecordListHeader-Header-Sortable:Record.SortableSlot~}{~TS:PRSP-List-RecordListHeader-Header-Plain:Record.PlainSlot~}`
				},
				{
					Hash: 'PRSP-List-RecordListHeader-Header-Plain',
					Template: /*html*/`
	<th style="border-bottom: 1px solid var(--theme-color-border-default, #ccc); padding: 5px; background-color: var(--theme-color-background-tertiary, #f2f2f2); color: var(--theme-color-text-primary, #333);">
		{~D:Record.DisplayName~}
	</th>
	`
				},
				{
					Hash: 'PRSP-List-RecordListHeader-Header-Sortable',
					Template: /*html*/`
	<th style="border-bottom: 1px solid var(--theme-color-border-default, #ccc); padding: 5px; background-color: var(--theme-color-background-tertiary, #f2f2f2); color: var(--theme-color-text-primary, #333); cursor: pointer; user-select: none; white-space: nowrap;" title="Sort by {~D:Record.DisplayName~}" onclick="_Pict.views['RSP-RecordSet-List'].sortByColumn('{~D:Record.RecordSet~}', '{~D:Record.Key~}')">
		{~D:Record.DisplayName~}{~TS:PRSP-List-RecordListHeader-Header-ChevronUp:Record.AscendingSlot~}{~TS:PRSP-List-RecordListHeader-Header-ChevronDown:Record.DescendingSlot~}
	</th>
	`
				},
				{
					Hash: 'PRSP-List-RecordListHeader-Header-ChevronUp',
					Template: /*html*/`<span style="margin-left: 4px; opacity: 0.85;">{~I:ChevronUp~}</span>`
				},
				{
					Hash: 'PRSP-List-RecordListHeader-Header-ChevronDown',
					Template: /*html*/`<span style="margin-left: 4px; opacity: 0.85;">{~I:ChevronDown~}</span>`
				},
				{
					Hash: 'PRSP-List-RecordListHeader-Template-Extra-Header',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-RecordListHeader-Template-Extra-Header] -->
{~TBR:Record.RecordSetConfiguration.RecordSetListExtraColumnsHeaderTemplateHash~}
	<!-- DefaultPackage end view template:  [PRSP-List-RecordListHeader-Extra-Header] -->
	`
//	{~TBR:Record.RecordSetConfiguration.RecordSetListExtraColumnsHeaderTemplateHash~}

				},
				{
					Hash: 'PRSP-List-RecordListActions-Template-Header',
					// Unlabeled, shrink-to-fit actions column: width:1% + nowrap collapses it to the width of the
					// row's action control (the hover "⋯" trigger), and the other columns absorb the slack.
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-RecordListActions-Template-Header] -->
	<th style="border-bottom: 1px solid var(--theme-color-border-default, #ccc); padding: 5px; width: 1%; white-space: nowrap; background-color: var(--theme-color-background-tertiary, #f2f2f2);"></th>
	<!-- DefaultPackage end view template:  [PRSP-List-RecordListActions-Template-Header] -->
	`
				},
			],

		Renderables:
			[
				{
					RenderableHash: 'PRSP_Renderable_RecordListHeader',
					TemplateHash: 'PRSP-List-RecordListHeader-Template',
					DestinationAddress: '#PRSP_RecordListHeader_Container',
					RenderMethod: 'replace'
				}
			],

		Manifests: {}
	});

class viewRecordSetListRecordListHeader extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_List_RecordListHeader, pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = viewRecordSetListRecordListHeader;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_List_RecordListHeader;
