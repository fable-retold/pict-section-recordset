const libPictProvider = require('pict-provider');
const libPictRouter = require('pict-router');

/** @type {Record<string, any>} */
const _DEFAULT_PROVIDER_CONFIGURATION =
{
	ProviderIdentifier: 'Pict-RecordSet-Router',

	AutoInitialize: true,
	AutoInitializeOrdinal: 0
}

class PictRecordSetRouter extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_PROVIDER_CONFIGURATION, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		/** @type {Record<string, any>} */
		this.options;
		/** @type {import('pict') & { PictSectionRecordSet: InstanceType<import('../Pict-Section-RecordSet.js')> }} */
		this.pict;

		this.pictRouter = null;
	}

	onInitialize()
	{
		if (!('PictRouter' in this.pict.providers))
		{
			this.pictRouter = this.pict.addProvider('PictRouter', { RouterMode: 'memory' }, libPictRouter);
		}
		else
		{
			this.pictRouter = this.pict.providers.PictRouter;
		}
		return super.onInitialize();
	}

	addRoutes(pRouter)
	{
		//FIXME: not working
		this.pictRouter.addRoute('/PSRS/404', '{~D:Pict.views[RSP-RecordSet-Error-NotFound].render()~}');
		// TODO: Create some kind of state tracking to see if these routes have already been added
		//this.pictRouter.addRoute('/PSRS/:RecordSet/List/:Begin/:Cap', "{~LV:Record~}");
		this.pict.views['RSP-RecordSet-List'].addRoutes(pRouter);
		this.pict.views['RSP-RecordSet-Read'].addRoutes(pRouter);
		this.pict.views['RSP-RecordSet-Create'].addRoutes(pRouter);
		this.pict.views['RSP-RecordSet-Dashboard'].addRoutes(pRouter);
		this.pict.views['RSP-RecordSet-Associate'].addRoutes(pRouter);
		this.pict.views['RSP-RecordSet-AssociateMatrix'].addRoutes(pRouter);
		this.pict.views['RSP-RecordSet-AssociateUnlink'].addRoutes(pRouter);
		this.pict.views['RSP-RecordSet-BulkDelete'].addRoutes(pRouter);

		this.pict.PictSectionRecordSet.addRoutes(pRouter);
	}

	/**
	 * Navigate to a given route (set the browser URL string, add to history, trigger router)
	 * 
	 * @param {string} pRoute - The route to navigate to
	 */
	navigate(pRoute)
	{
		this.pictRouter.navigate(pRoute);
	}
}

module.exports = PictRecordSetRouter;
module.exports.default_configuration = _DEFAULT_PROVIDER_CONFIGURATION;
