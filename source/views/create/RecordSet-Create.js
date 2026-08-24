const libPictRecordSetRecordView = require('../RecordSet-RecordBaseView.js');

/** @type {Record<string, any>} */
const _DEFAULT_CONFIGURATION__Create =
{
	ViewIdentifier: 'PRSP-Create',

	DefaultRenderable: 'PRSP_Renderable_Create',
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
			Hash: 'PRSP-Create-Basic-Template',
			Template: /*html*/`
				<!-- DefaultPackage pict view template: [PRSP-Create-Basic-Template] -->
				<h1>{~D:Record.RecordSet~} Create</h1>
				<div>
					{~T:PRSP-Create-RecordCreate-Template~}
				</div>
				{~T:PRSP-Create-RecordButtonBar-Template~}
				<!-- DefaultPackage end view template:  [PRSP-Create-Basic-Template] -->
				`
		},
		{
			Hash: 'PRSP-Create-RecordButtonBar-Template',
			Template: /*html*/`
				<style>
					.record-button-bar-hidden
					{
						display: none;
					}
					.record-button-bar
					{
						display: flex;
						margin-top: 15px;
					}
					.record-button-bar > button
					{
						margin-right: 10px;
					}
				</style>
				<div class="record-button-bar">
					<button id="PRSP-Create-ClearButton" type="button" onclick="_Pict.views['RSP-RecordSet-Create'].clear()">Clear</button>
					<button id="PRSP-Create-SaveButton" type="button" onclick="_Pict.views['RSP-RecordSet-Create'].save()">Save</button>
				</div>
			`
		},
		{
			Hash: 'PRSP-Create-Link-Name-Template',
			Template: `Create`
		},
		{
			Hash: 'PRSP-Create-Link-URL-Template',
			Template: `#/PSRS/{~D:Record.Payload.Payload.RecordSet~}/Create`
		},
	],

	Renderables:
	[
		{
			RenderableHash: 'PRSP_Renderable_Create_Basic',
			TemplateHash: 'PRSP-Create-Basic-Template',
			DestinationAddress: '#PRSP_Container',
			RenderMethod: 'replace'
		}
	],

	Manifests: {},
};

class viewRecordSetCreate extends libPictRecordSetRecordView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DEFAULT_CONFIGURATION__Create, pOptions);

		super(pFable, tmpOptions, pServiceHash);
		this.RecordSet = null;
		this.providerHash = null;
		this.manifest = null;
		this.defaultManifest = null;
	}

	handleRecordSetCreateRoute(pRoutePayload)
	{
		if (typeof(pRoutePayload) != 'object')
		{
			throw new Error(`Pict RecordSet Create view route handler called with invalid route payload.`);
		}

		const tmpProviderConfiguration = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[pRoutePayload.data.RecordSet];
		const tmpProviderHash = `RSP-Provider-${pRoutePayload.data.RecordSet}`;

		tmpProviderConfiguration.RoutePayload = pRoutePayload;
		tmpProviderConfiguration.RecordSet = pRoutePayload.data.RecordSet;

		if (this.delegateToCustomView('Create', tmpProviderConfiguration, pRoutePayload)) { return true; }

		return this.renderCreate(tmpProviderConfiguration, tmpProviderHash);
	}

	async clear()
	{
		await this.onBeforeClear();
		this.renderCreate(this.pict.PictSectionRecordSet.recordSetProviderConfigurations[this.RecordSet], this.providerHash);
	}

	async save()
	{
		await this.onBeforeSave();
		const resultingRecord = await this.pict.providers[this.providerHash].createRecord(this.pict.AppData[`${ this.RecordSet }Details`]);

		this.fable.providers.RecordSetRouter.pictRouter.navigate(`/PSRS/${ this.RecordSet }/View/${ resultingRecord[this.pict.providers[this.providerHash].getGUIDField()] }`);
	}

	async onBeforeClear()
	{
		// Hook that gets called before clear.
	}

	async onBeforeSave()
	{
		// Hook that gets called before save.
	}

	async onBeforeRenderCreate(pRecordConfiguration, pProviderHash)
	{
		// Hook that gets called before "renderCreate".
	}

	async renderCreate(pRecordConfiguration, pProviderHash)
	{
		await this.onBeforeRenderCreate(pRecordConfiguration, pProviderHash);
		if (!(pProviderHash in this.pict.providers))
		{
			this.pict.log.error(`RecordSetCreate: No provider found for ${pProviderHash} in ${pRecordConfiguration.RecordSet}.  Create Render failed.`);
			return false;
		}

		let tmpRecordCreateData =
		{
			"RecordSet": pRecordConfiguration.RecordSet,

			"RecordConfiguration": pRecordConfiguration,

			"RenderDestination": this.options.DefaultDestinationAddress,
		};

		if (pRecordConfiguration.RecordSet !== this.RecordSet)
		{
			this.RecordSet = pRecordConfiguration.RecordSet;
		}

		this.pict.AppData[`${ this.RecordSet }Details`] = {};

		this.providerHash = pProviderHash;
		tmpRecordCreateData.RecordSchema = await this.pict.providers[pProviderHash].getRecordSchema();

		if (pRecordConfiguration.RecordSetCreateManifestOnly)
		{
			this.pict.TemplateProvider.addTemplate(`PRSP-Create-RecordCreate-Template`, /*html*/`
				<!-- Manifest dynamic pict template: [PRSP-Create-RecordCreate-Template] -->
				<div>${ this._generateManifestTemplate(pRecordConfiguration, 'RecordCreate') }</div>
				<!-- Manifest dynamic pict end template: [PRSP-Create-RecordCreate-Template] -->
			`);
		}
		else
		{
			// Construct a default manifest based on the RecordSchema:
			this.defaultManifest = 
			{
				"Form": "DefaultManifest",
				"Scope": "Default",
				"Descriptors": {},
				"Sections": 
				[
					{
						"Name": "",
						"Hash": "DefaultSection",
						"Solvers": [],
						"ShowTitle": false,
						"Groups": [
							{
								"Name": "",
								"Hash": "DefaultGroup",
								"Rows": [],
								"RecordSetSolvers": [],
								"ShowTitle": false
							}
						]
					}
				]
			}
			let rowCounter = 1;
			for (const p of Object.keys(tmpRecordCreateData.RecordSchema.properties))
			{
				const exclusionSet = [this.pict.providers[this.providerHash].getIDField(), this.pict.providers[this.providerHash].getGUIDField(), 'CreatingIDUser', 'UpdatingIDUser', 'DeletingIDUser', 'Deleted', 'CreateDate', 'UpdateDate', 'DeleteDate', 'Deleted', 'IDCustomer', 'ExternalSyncDate', 'ExternalSyncGUID']; // IDCustomer: meadow-endpoints/retold tenancy discriminator — server-managed, never settable via the API
				if (exclusionSet.includes(p))
				{
					continue;
				}
				const tmpDescriptor =
				{
					"Name": `${ this.pict.providers[pProviderHash].getHumanReadableFieldName?.(p) || p }`,
					"Hash": `${ tmpRecordCreateData.RecordSet }-${ p }`,
					"DataType": "String",
					"PictForm": 
					{
						"Row": `${ rowCounter }`,
						"Section": "DefaultSection",
						"Group": "DefaultGroup"
					}
				};
				rowCounter += 1;
				switch (tmpRecordCreateData.RecordSchema.properties[p].type)
				{
					case 'string':
					case 'autoguid':
						tmpDescriptor.DataType = 'String';
						break;
					case 'datetime':
					case 'date':
					case 'createdate':
					case 'updatedate':
						tmpDescriptor.DataType = 'String';
						tmpDescriptor.PictForm.InputType = 'DateTime'
						break;
					case 'boolean':
					case 'deleted':
						tmpDescriptor.DataType = 'Boolean';
					case 'integer':
					case 'decimal':
					case 'autoidentity':
					case 'createiduser':
					case 'updateiduser':
					case 'deleteiduser':
						tmpDescriptor.DataType = 'Number';
						break;
					default:
						tmpDescriptor.DataType = 'String';
				}

				const tmpForeignEntity = this.pict.PictSectionRecordSet.resolveForeignEntity(p, pRecordConfiguration, this.pict.providers[this.providerHash].getIDField());
				if (tmpForeignEntity && this.pict.providers['Pict-Section-Picker'])
				{
					// Foreign-key column → searchable entity Picker (edit) + resolved name (read).
					tmpDescriptor.PictForm.InputType = 'Picker';
					tmpDescriptor.PictForm.Entity = tmpForeignEntity;
					const tmpForeignConfig = this.pict.PictSectionRecordSet.recordSetProviderConfigurations[tmpForeignEntity];
					if (tmpForeignConfig && tmpForeignConfig.SearchFields) { tmpDescriptor.PictForm.SearchFields = tmpForeignConfig.SearchFields; }
				}
				// Per-record-set label override (e.g. Contract/Project IDOrganization → "Prime Contractor").
				if (pRecordConfiguration.FieldLabels && pRecordConfiguration.FieldLabels[p]) { tmpDescriptor.Name = pRecordConfiguration.FieldLabels[p]; }
				this.defaultManifest.Descriptors[`${ tmpRecordCreateData.RecordSet }Details.${ p }`] = tmpDescriptor;
			}
			this.pict.TemplateProvider.addTemplate(`PRSP-Create-RecordCreate-Template`, /*html*/`
				<!-- Manifest dynamic pict template: [PRSP-Create-RecordCreate-Template] -->
				<div>${ this._generateManifestTemplate(pRecordConfiguration, 'RecordCreate', true) }</div>
				<!-- Manifest dynamic pict end template: [PRSP-Create-RecordCreate-Template] -->
			`);
		}

		this.renderAsync(`PRSP_Renderable_Create_Basic`, tmpRecordCreateData.RenderDestination, tmpRecordCreateData,
			async function (pError)
			{
				if (pError)
				{
					this.pict.log.error(`RecordSetCreate: Error rendering create ${pError}`, tmpRecordCreateData);
					return false;
				}

				if (this.pict.LogNoisiness > 0)
				{
					this.pict.log.info(`RecordSetCreate: Rendered create ${tmpRecordCreateData.RecordSet}`, tmpRecordCreateData);
				}
				else
				{
					this.pict.log.info(`RecordSetCreate: Rendered create ${tmpRecordCreateData.RecordSet}`);
				}
				for (const s of this.manifest?.Sections || [])
				{
					this.pict.views[`PictSectionForm-${ s.Hash }`].render();
					this.pict.views[`PictSectionForm-${ s.Hash }`].marshalToView();
				}
				return true;
			}.bind(this));
	}

	_generateManifestTemplate(config, section, useDefaultManifest)
	{
		const tmpManifestHash = config.RecordSetCreateDefaultManifest || config.RecordSetCreateManifests?.[0];
		const tmpManifest = JSON.parse(JSON.stringify(useDefaultManifest ? this.defaultManifest : this.pict.PictSectionRecordSet.getManifest(tmpManifestHash)));
		if (!tmpManifest)
		{
			this.pict.log.error(`RecordSetCreate: No manifest found for ${ config.RecordSet }. Create Render failed.`);
			return '';
		}
		if (!tmpManifest.Descriptors)
		{
			this.pict.log.error(`RecordSetCreate: No manifest descriptors found for manifest ${ tmpManifestHash }. Create Render failed.`);
			return '';
		}

		this.manifest = tmpManifest;
		let sectionsTemplate = '';
		for (const s of tmpManifest?.Sections || [])
		{
			delete this.pict.views[`PictSectionForm-${ s.Hash }`]
		}
		this.pict.views.PictFormMetacontroller.bootstrapPictFormViewsFromManifest(tmpManifest);

		for (const pickList of tmpManifest?.PickLists || [])
		{
			this.pict.providers.DynamicMetaLists.rebuildListByHash(pickList.Hash);
		}

		for (const s of tmpManifest?.Sections || [])
		{
			const viewSectionID = `PSRS-Create-${ section }-Section-${ s.Hash }`;
			sectionsTemplate += /*html*/`<div id="${ viewSectionID }"></div>`;
			this.pict.views[`PictSectionForm-${ s.Hash }`].viewMarshalDestination = 'AppData';
			this.pict.views[`PictSectionForm-${ s.Hash }`].options.DefaultDestinationAddress = `#${ viewSectionID }`;
			this.pict.views[`PictSectionForm-${ s.Hash }`].rebuildCustomTemplate();
		}
		return sectionsTemplate
	}


	addRoutes(pPictRouter)
	{
		pPictRouter.addRoute('/PSRS/:RecordSet/Create', this.handleRecordSetCreateRoute.bind(this));
		return true;
	}
}

module.exports = viewRecordSetCreate;

module.exports.default_configuration = _DEFAULT_CONFIGURATION__Create;

