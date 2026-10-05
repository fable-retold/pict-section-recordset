const libPictView = require('pict-view');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_List_PaginationTop = (
	{
		ViewIdentifier: 'PRSP-List-PaginationTop',

		DefaultRenderable: 'PRSP_Renderable_PaginationTop',
		DefaultDestinationAddress: '#PRSP_PaginationTop_Container',
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
					Hash: 'PRSP-List-PaginationTop-Template',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-PaginationTop-Template] -->
	<nav id="RSP_Upper_Pagination_Container" role="navigation" aria-label="pagination">
		{~T:PRSP-List-Pagination-Template-Description~}
		{~T:PRSP-List-Pagination-Template-Buttons~}
	</nav>
	<div>
		{~TS:PRSP-List-Pagination-Template-Pages:Record.PageLinksLimited~}
	</div>
	<!-- DefaultPackage end view template:  [PRSP-List-PaginationTop-Template] -->
	`
				},
				{
					Hash: 'PRSP-List-Pagination-Template-Description',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Pagination-Template-Description] -->
	<div>
		Showing
		<span id="PRSP_Pagination_Description_Records_Start">{~D:Record.PageStart~}</span> to
		<span id="PRSP_Pagination_Description_Records_End">{~D:Record.PageEnd~}</span> of
		<span id="PRSP_Pagination_Description_Records_Total">{~D:Record.TotalRecordCount.Count~}</span> total records.
	</div>
	<!-- DefaultPackage end view template:  [PRSP-List-Pagination-Template-Description] -->
	`
				},
				{
					Hash: 'PRSP-List-Pagination-Template-Buttons',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Pagination-Template-Buttons] -->
	<ul style="list-style-type: none; padding: 0; display: flex; justify-content: center;">
		{~TIfAbs:PRSP-List-Pagination-Template-Button-Previous:Record:Record.PageLinkBookmarks.ShowPreviousLink^TRUE^true~}
		{~TS:PRSP-List-Pagination-Template-Button-Page~}
		{~TIfAbs:PRSP-List-Pagination-Template-Button-Next:Record:Record.PageLinkBookmarks.ShowNextLink^TRUE^true~}
	</ul>
	<!-- DefaultPackage end view template:  [PRSP-List-Pagination-Template-Buttons] -->
	`
				},
				{
					Hash: 'PRSP-List-Pagination-Template-Button-Previous',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Pagination-Template-Button-Previous] -->
	<li><a href="{~D:Record.PageLinkBookmarks.PreviousLink.URL~}" aria-label="Previous page">&laquo; Previous</a></li>
	<!-- DefaultPackage end view template:  [PRSP-List-Pagination-Template-Button-Previous] -->
	`
				},
				{
					Hash: 'PRSP-List-Pagination-Template-Button-Next',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Pagination-Template-Button-Next] -->
	<li style="margin-left: 15px;"><a href="{~D:Record.PageLinkBookmarks.NextLink.URL~}" aria-label="Next page">Next &raquo;</a></li>
	<!-- DefaultPackage end view template:  [PRSP-List-Pagination-Template-Button-Next] -->
	`
				},
				{
					Hash: 'PRSP-List-Pagination-Template-Button-Page',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Pagination-Template-Button-Page] -->
	<li><a href="#" aria-label="Go to page {~D:Record.Page~}">{~D:Record.Page~}</a></li>
	<!-- DefaultPackage end view template:  [PRSP-List-Pagination-Template-Button-Page] -->
	`
				},
				{
					Hash: 'PRSP-List-Pagination-Template-Pages',
					Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Pagination-Template-Button-Pages] -->
	<a href="{~D:Record.URL~}" aria-label="Go to page {~D:Record.Page~}" class="page-offset_{~D:Record.RelativeOffset~}">{~D:Record.Page~}</a>
	<!-- DefaultPackage end view template:  [PRSP-List-Pagination-Template-Button-Pages] -->
	`
				}
			],

		Renderables:
			[
				{
					RenderableHash: 'PRSP_Renderable_PaginationTop',
					TemplateHash: 'PRSP-List-PaginationTop-Template',
					DestinationAddress: '#PRSP_PaginationTop_Container',
					RenderMethod: 'replace'
				}
			],

		Manifests: {}
	});

class viewRecordSetListPaginationTop extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_List_PaginationTop, pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = viewRecordSetListPaginationTop;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_List_PaginationTop;

