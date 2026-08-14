/*
	Unit tests for the RecordSet field-decoration policy — the module-wide config that decides which of the
	entity pickers this module builds (the association editors, the entity quick-filters, the bulk-delete
	replacement picker) get the pict-section-picker "field decoration" affordance: the ⚙ that lets a user
	pin an extra record column (e.g. VendorCode) onto each dropdown row to tell same-named entities apart
	(the "six Volkerts" problem).

	The policy lives on the metacontroller (this.options.FieldDecoration, overridable by the app via
	fable.settings.FieldDecoration) and is resolved per entity by resolveFieldDecoration() into the two
	flags the picker widget consumes: AllowFieldDecoration + DecorationIgnoreFields. applyFieldDecoration()
	stamps those onto a picker config, and every picker-creation site in the module calls it through the
	singleton pict.PictSectionRecordSet. These tests pin (a) the resolver logic and (b) its integration
	through the AssociationManager's picker-config builders — the central site the three association editors
	share. No network; nothing but the policy math is exercised.
*/

const libBrowserEnv = require('browser-env');

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libMetaController = require('../source/services/RecordsSet-MetaController.js');
const libAssociationManager = require('../source/providers/RecordSet-AssociationManager.js');

suite
(
	'PictSectionRecordSet Field Decoration',
	() =>
	{
		let _Pict;
		let _MetaController;

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			_Pict = new libPict();
			_Pict.LogNoisiness = 0;
			// The metacontroller owns the policy + resolver; the picker-creation sites reach it as the
			// singleton pict.PictSectionRecordSet (exactly as they do in the running app).
			_MetaController = new libMetaController(_Pict, {}, 'PictSectionRecordSet');
			_Pict.PictSectionRecordSet = _MetaController;
		});

		const setPolicy = (pPolicy) => { _MetaController.options.FieldDecoration = pPolicy; };

		suite
		(
			'resolveFieldDecoration (policy -> flags)',
			() =>
			{
				test('opt-in: the shipped default leaves every entity undecorated', () =>
				{
					// _DEFAULT_CONFIGURATION ships { Global:false, Entities:{}, IgnoreFields:[] }.
					const tmpResolved = _MetaController.resolveFieldDecoration('Organization');
					Expect(tmpResolved.Enabled).to.equal(false, 'nothing is decorated until opted in');
					Expect(tmpResolved.IgnoreFields).to.deep.equal([]);
				});

				test('Global:true decorates every entity and auto-hides GUID<Entity>', () =>
				{
					setPolicy({ Global: true, Entities: {}, IgnoreFields: [] });
					const tmpResolved = _MetaController.resolveFieldDecoration('Organization');
					Expect(tmpResolved.Enabled).to.equal(true);
					Expect(tmpResolved.IgnoreFields).to.deep.equal([ 'GUIDOrganization' ], 'the GUID column the picker does not hide on its own');
				});

				test('per-entity true opts a single entity in and leaves its siblings off', () =>
				{
					setPolicy({ Global: false, Entities: { Organization: true }, IgnoreFields: [] });
					Expect(_MetaController.resolveFieldDecoration('Organization').Enabled).to.equal(true);
					Expect(_MetaController.resolveFieldDecoration('Contract').Enabled).to.equal(false, 'a sibling entity stays off');
				});

				test('per-entity false opts out even when Global is on', () =>
				{
					setPolicy({ Global: true, Entities: { Contract: false }, IgnoreFields: [] });
					Expect(_MetaController.resolveFieldDecoration('Organization').Enabled).to.equal(true, 'others still on');
					Expect(_MetaController.resolveFieldDecoration('Contract').Enabled).to.equal(false, 'explicit opt-out wins over Global');
				});

				test('a per-entity object opts in and contributes its own IgnoreFields', () =>
				{
					setPolicy({ Global: false, Entities: { Organization: { IgnoreFields: [ 'IDVendor' ] } }, IgnoreFields: [ 'IDCustomer' ] });
					const tmpResolved = _MetaController.resolveFieldDecoration('Organization');
					Expect(tmpResolved.Enabled).to.equal(true);
					Expect(tmpResolved.IgnoreFields).to.deep.equal([ 'IDCustomer', 'IDVendor', 'GUIDOrganization' ], 'policy + entity + GUID<Entity>, in order');
				});

				test('a disabled entity resolves to no ignore fields (nothing leaks)', () =>
				{
					setPolicy({ Global: false, Entities: { Organization: false }, IgnoreFields: [ 'IDCustomer' ] });
					Expect(_MetaController.resolveFieldDecoration('Organization')).to.deep.equal({ Enabled: false, IgnoreFields: [] });
				});
			});

		suite
		(
			'applyFieldDecoration (stamp a picker config in place)',
			() =>
			{
				test('stamps AllowFieldDecoration + DecorationIgnoreFields when enabled', () =>
				{
					setPolicy({ Global: false, Entities: { Organization: true }, IgnoreFields: [ 'IDCustomer' ] });
					const tmpConfig = { Entity: 'Organization', ValueField: 'IDOrganization' };
					_MetaController.applyFieldDecoration(tmpConfig, 'Organization');
					Expect(tmpConfig.AllowFieldDecoration).to.equal(true);
					Expect(tmpConfig.DecorationIgnoreFields).to.deep.equal([ 'IDCustomer', 'GUIDOrganization' ]);
				});

				test('leaves a config for a non-opted entity untouched', () =>
				{
					setPolicy({ Global: false, Entities: { Organization: true }, IgnoreFields: [] });
					const tmpConfig = { Entity: 'Contract' };
					_MetaController.applyFieldDecoration(tmpConfig, 'Contract');
					Expect(tmpConfig).to.not.have.property('AllowFieldDecoration');
					Expect(tmpConfig).to.not.have.property('DecorationIgnoreFields');
				});
			});

		suite
		(
			'integration: the association picker config picks up the policy',
			() =>
			{
				let _Manager;

				setup(() =>
				{
					_Manager = _Pict.addProvider('RecordSetAssociationManager', {}, libAssociationManager);
					_Manager.addAssociation('BookAuthor',
						{
							JoinEntity: 'BookAuthorJoin',
							SideA: { RecordSet: 'Book',   IDField: 'IDBook',   DisplayField: 'Title', SearchFields: [ 'Title' ] },
							SideB: { RecordSet: 'Author', IDField: 'IDAuthor', DisplayField: 'Name' },
						});
				});

				test('the opted-in other side (Author) comes back decorated, with GUIDAuthor hidden', () =>
				{
					setPolicy({ Global: false, Entities: { Author: true }, IgnoreFields: [ 'IDCustomer' ] });
					const tmpConfig = _Manager.buildOtherPickerConfig('BookAuthor', 'Book', () => [], {});
					Expect(tmpConfig.Entity).to.equal('Author');
					Expect(tmpConfig.AllowFieldDecoration).to.equal(true);
					Expect(tmpConfig.DecorationIgnoreFields).to.deep.equal([ 'IDCustomer', 'GUIDAuthor' ]);
				});

				test('a non-opted anchor side (Book) is left undecorated', () =>
				{
					setPolicy({ Global: false, Entities: { Author: true }, IgnoreFields: [] });
					const tmpConfig = _Manager.buildAnchorPickerConfig('BookAuthor', 'Book', {});
					Expect(tmpConfig.Entity).to.equal('Book');
					Expect(tmpConfig).to.not.have.property('AllowFieldDecoration');
				});

				test('caller overrides still win over the policy stamp', () =>
				{
					setPolicy({ Global: true, Entities: {}, IgnoreFields: [] });
					// Global would decorate Author, but an explicit override turns it back off for this one
					// call — pOverrides is assigned last in _pickerConfigForSide.
					const tmpConfig = _Manager.buildOtherPickerConfig('BookAuthor', 'Book', () => [], { AllowFieldDecoration: false });
					Expect(tmpConfig.AllowFieldDecoration).to.equal(false);
				});
			});
	}
);
