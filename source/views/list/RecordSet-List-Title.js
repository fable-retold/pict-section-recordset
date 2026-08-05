const libPictView = require('pict-view');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_List_Title =
{
	ViewIdentifier: 'PRSP-List-Title',

	DefaultRenderable: 'PRSP_Renderable_Title',
	DefaultDestinationAddress: '#PRSP_Title_Container',
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
			Hash: 'PRSP-List-Title-Template',
			Template: /*html*/`
	<!-- DefaultPackage pict view template: [PRSP-List-Title-Template] -->
	<header id="PRSP_Title_Container">
		<h1 id="PRSP_Title">{~D:Record.Title~}</h1>
		<h2 id="PRSP_Subtitle">{~D:Record.Subtitle~}</h2>
		{~TIfAbs:PRSP-List-Title-CreateButton-Template:Record:Record.RecordSetConfiguration.RecordSetListShowCreateButton^TRUE^~}
		{~TIfAbs:PRSP-List-Title-BulkDeleteButton-Template:Record:Record.RecordSetConfiguration.RecordSetAllowBulkDelete^TRUE^~}
	</header>
	<!-- DefaultPackage end view template:	[PRSP-List-Title-Template] -->
`
		},
		{
			Hash: 'PRSP-List-Title-CreateButton-Template',
			Template: /*html*/`
	<!-- Optional list "New" action; opt in per record set via RecordSetConfiguration.RecordSetListShowCreateButton. -->
	<button type="button" class="prsp-list-title-create" title="Create a new record" onclick="_Pict.views['RSP-RecordSet-List'].createNew('{~D:Record.RecordSet~}')">{~I:Plus~} New</button>
`
		},
		{
			Hash: 'PRSP-List-Title-BulkDeleteButton-Template',
			Template: /*html*/`
	<!-- Optional list "Delete records" action; opt in per record set via RecordSetConfiguration.RecordSetAllowBulkDelete. -->
	<button type="button" class="prsp-list-title-bulkdelete" title="Select and delete a batch of records" onclick="_Pict.views['RSP-RecordSet-List'].openBulkDelete('{~D:Record.RecordSet~}')">{~I:Trash~} Delete records</button>
`
		},
	],

	Renderables:
	[
		{
			RenderableHash: 'PRSP_Renderable_Title',
			TemplateHash: 'PRSP-List-Title-Template',
			DestinationAddress: '#PRSP_Title_Container',
			RenderMethod: 'replace'
		},
	],

	Manifests: {},
};

class viewRecordSetListTitle extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_List_Title, pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = viewRecordSetListTitle;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_List_Title;
