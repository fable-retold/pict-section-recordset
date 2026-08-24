const libPictView = require('pict-view');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION_Base_View = (
{
	ViewIdentifier: 'PRSP-RecordSet-View-Base',

	DefaultRenderable: 'PRSP_Base_Recordset',
	DefaultDestinationAddress: '#PictRecordSetContainer',
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
			Hash: 'PRSP-Base-View-Template',
			Template: /*html*/`
<!-- DefaultPackage pict view template: [PRSP-Base-View-Template] -->
<!--
	If this is being rendered, the RecordSet view has not taken control of its render function.
	While the view may not need custom templating it is strongly encouraged to still override 
	the template and put informative messaging into an HTML comment.

Record JSON:
\`\`\`json
{~DataJson:Record~}
\`\`\`
-->
<!-- DefaultPackage end view template:  [PRSP-Base-View-Template] -->
		`
			}
		],

		Renderables:
		[
			{
				RenderableHash: 'PRSP_Base_Recordset',
				TemplateHash: 'PRSP-Base-View-Template',
				DestinationAddress: '#PictRecordSetContainer',
				RenderMethod: 'replace'
			}
		],

	Manifests: {}
});

class viewPictSectionRecordSetViewBase extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION_Base_View, pOptions);
		super(pFable, tmpOptions, pServiceHash);
		/** @type {import('pict') & {
		 *   log: any,
		 *   instantiateServiceProviderWithoutRegistration: (hash: String) => any,
		 *   instantiateServiceProviderIfNotExists: (hash: string) => any,
		 *   TransactionTracking: import('pict/types/source/services/Fable-Service-TransactionTracking'),
		 *   PictSectionRecordSet: InstanceType<import('../Pict-Section-RecordSet.js')>,
		 * }} */
		this.pict;
	}

	addRoutes(pPictRouter)
	{
		this.pict.log.trace(`View [${this.options.ViewIdentifier}]::[${this.Hash}] addRoutes called.`);
		return true;
	}

	/**
	 * Custom-view override hook. A record set can replace the built-in List / View / Edit / Create
	 * screen with an entirely custom pict view by setting `RecordSetConfiguration.RecordSetCustomViews`,
	 * e.g. `{ View: 'MyViewHash', Edit: 'MyViewHash', Create: 'MyViewHash', List: 'MyViewHash' }`.
	 *
	 * When a route for `pAction` fires and a custom view is configured (and registered), the route
	 * context is stashed at `AppData.PictRecordSetCustomView` = `{ Action, RecordSet, GUIDRecord }` and
	 * the custom view is driven: its `onRecordSetCustomView(context)` is called if present, else it is
	 * `render()`ed. Returns true when it handled the route (the caller must then return without
	 * rendering the generic screen); false to fall through to the built-in rendering.
	 *
	 * @param {string} pAction - 'List' | 'View' | 'Edit' | 'Create'
	 * @param {Record<string, any>} pProviderConfiguration
	 * @param {Record<string, any>} [pRoutePayload]
	 * @return {boolean}
	 */
	delegateToCustomView(pAction, pProviderConfiguration, pRoutePayload)
	{
		const tmpCustomViews = pProviderConfiguration && pProviderConfiguration.RecordSetCustomViews;
		const tmpViewHash = tmpCustomViews && tmpCustomViews[pAction];
		if (!tmpViewHash || !this.pict.views[tmpViewHash])
		{
			if (tmpViewHash && !this.pict.views[tmpViewHash])
			{
				this.pict.log.warn(`RecordSet [${pProviderConfiguration && pProviderConfiguration.RecordSet}] configures a custom ${pAction} view [${tmpViewHash}] but no such view is registered; falling back to the built-in screen.`);
			}
			return false;
		}
		const tmpContext =
		{
			Action: pAction,
			RecordSet: (pRoutePayload && pRoutePayload.data && pRoutePayload.data.RecordSet) || (pProviderConfiguration && pProviderConfiguration.RecordSet) || '',
			GUIDRecord: (pRoutePayload && pRoutePayload.data && pRoutePayload.data.GUIDRecord) || '',
			RoutePayload: pRoutePayload || null,
		};
		this.pict.AppData.PictRecordSetCustomView = tmpContext;
		const tmpView = this.pict.views[tmpViewHash];
		if (typeof tmpView.onRecordSetCustomView === 'function')
		{
			tmpView.onRecordSetCustomView(tmpContext);
		}
		else
		{
			tmpView.render();
		}
		return true;
	}
}

module.exports = viewPictSectionRecordSetViewBase;

module.exports.default_configuration = _DEFAULT_CONFIGURATION_Base_View;
