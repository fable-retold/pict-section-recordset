/*
	Unit tests for the PictSectionRecordSet list column chooser:
	- Column-Data-Provider persistence (key format, roundtrip, Bundle seeding, isolation)
	- Manifest DefaultHidden carry-through (generateManifestTableCells)
	- Candidate composition (_composeColumnCandidates: tiers, exclusions, overrides, clamp fallback)
	- Toggle orchestration (setColumnVisibility: repaint vs Lite refetch decision, last-column clamp)
	- Lite ExtraColumns union (_deriveLiteExtraColumns reads shown schema-tier overrides)
*/

const libBrowserEnv = require('browser-env');

const libPictView = require('pict-view');

const sinon = require('sinon');
const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libPictSectionRecordSet = require('../source/Pict-Section-RecordSet.js');

class DoNothingApplication extends libPictSectionRecordSet.PictRecordSetApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.pict.addView('DoNothingView', {}, DoNothingView);
	}

	/**
	 * @param {function} fDone - Callback that finishes the test
	 */
	set testDone(fDone)
	{
		this._testDone = fDone;
	}

	onAfterInitialize()
	{
		this.solve();
		this._testDone();
		return super.onAfterInitialize();
	}
}

class DoNothingView extends libPictView
{
	constructor(pPict, pOptions)
	{
		super(pPict, pOptions);
	}
}

/**
 * Build an initialized app harness, then hand the pict instance to the continuation.
 * @param {(pPict: any) => void} fReady - Receives the initialized pict instance.
 * @param {(pError?: Error) => void} fDone - Mocha completion callback.
 */
function buildHarness(fReady, fDone)
{
	let _Pict = new libPict();
	_Pict.LogNoisiness = 0;
	let _Application = new DoNothingApplication(_Pict, {});
	_Application.testDone = () =>
	{
		try
		{
			fReady(_Pict);
			fDone();
		}
		catch (pError)
		{
			fDone(pError);
		}
	};
	_Application.initialize();
}

/** Synthetic list data matching what renderList composes before onBeforeRenderList. */
function buildListData(pConfigOverrides)
{
	return {
		RecordSet: 'Book',
		RecordSetConfiguration: Object.assign(
			{
				RecordSet: 'Book',
				Entity: 'Book',
				RecordSetListColumnChooser: true,
			}, pConfigOverrides || {}),
		RecordSchema:
		{
			properties:
			{
				Title: { title: 'Title' },
				Genre: {},
				PageCount: {},
				FormData: {},
				IDAuthor: {},
				IDBook: {},
				CreateDate: {},
				Deleted: {},
			},
			MeadowSchema:
			{
				MeadowSchema:
				{
					Schema:
					[
						{ Column: 'Title', Type: 'String' },
						{ Column: 'Genre', Type: 'String' },
						{ Column: 'PageCount', Type: 'Integer' },
						{ Column: 'FormData', Type: 'JSON' },
						{ Column: 'IDAuthor', Type: 'Integer' },
						{ Column: 'IDBook', Type: 'AutoIdentity' },
						{ Column: 'CreateDate', Type: 'CreateDate' },
						{ Column: 'Deleted', Type: 'Deleted' },
					],
				},
			},
		},
		TableCells:
		[
			{ Key: 'Title', DisplayName: 'Title', ManifestHash: 'Default', PictDashboard: { ValueTemplate: '{~ProcessCell:Record.Data.Key~}' } },
			{ Key: 'Status', DisplayName: 'Status', ManifestHash: 'Default', PictDashboard: { ValueTemplate: '{~ProcessCell:Record.Data.Key~}' }, DefaultHidden: true },
		],
		Records: { Records: [ { IDBook: 1, Title: 'A Book', Genre: 'Fiction' } ] },
	};
}

suite
(
	'PictSectionRecordSet Column Chooser',
	() =>
	{
		setup(() =>
		{
			libBrowserEnv({
				url: "http://localhost/",
			});
		});

		teardown(() =>
		{
			sinon.restore();
		});

		suite
			(
				'Column Data Provider',
				() =>
				{
					test(
						'registers with the metacontroller and persists overrides per recordset',
						(fDone) =>
						{
							buildHarness((pPict) =>
							{
								const tmpProvider = pPict.providers.ColumnDataProvider;
								Expect(tmpProvider).to.be.an('object', 'ColumnDataProvider should be registered by metacontroller initialize.');
								// Force the in-memory keyCache so the test is hermetic.
								tmpProvider.storageProvider = tmpProvider;

								Expect(tmpProvider.getColumnStorageKey('Book', 'List')).to.equal('Column_Meta_Book_List');
								Expect(tmpProvider.getColumnStorageKey('Book')).to.equal('Column_Meta_Book_List', 'ViewContext should default to List.');

								// Empty read seeds the Bundle mirror.
								const tmpEmpty = tmpProvider.getColumnVisibilityOverrides('Book', 'List');
								Expect(tmpEmpty).to.deep.equal({});
								Expect(pPict.Bundle._ActiveColumnState.Book.Overrides).to.equal(tmpEmpty, 'Read should seed the Bundle mirror.');

								// Roundtrip.
								tmpProvider.setColumnVisibilityOverride('Book', 'List', 'Genre', true);
								tmpProvider.setColumnVisibilityOverride('Book', 'List', 'Title', false);
								Expect(tmpProvider.getColumnVisibilityOverrides('Book', 'List')).to.deep.equal({ Genre: true, Title: false });
								const tmpStored = JSON.parse(tmpProvider.storageProvider.getItem('Column_Meta_Book_List'));
								Expect(tmpStored.Overrides).to.deep.equal({ Genre: true, Title: false });
								Expect(tmpStored.RecordSet).to.equal('Book');
								Expect(tmpStored.ViewContext).to.equal('List');

								// Per-recordset isolation.
								tmpProvider.setColumnVisibilityOverride('Author', 'List', 'Name', false);
								Expect(tmpProvider.getColumnVisibilityOverrides('Book', 'List')).to.deep.equal({ Genre: true, Title: false });
								Expect(tmpProvider.getColumnVisibilityOverrides('Author', 'List')).to.deep.equal({ Name: false });

								// Clear removes storage + Bundle.
								tmpProvider.clearColumnVisibilityOverrides('Book', 'List');
								Expect(tmpProvider.storageProvider.getItem('Column_Meta_Book_List')).to.equal(null);
								Expect(pPict.Bundle._ActiveColumnState.Book).to.be.undefined;
								Expect(tmpProvider.getColumnVisibilityOverrides('Book', 'List')).to.deep.equal({});

								// Bundle-first: storage written behind the Bundle's back is ignored within a session.
								tmpProvider.setColumnVisibilityOverride('Book', 'List', 'Genre', true);
								tmpProvider.storageProvider.setItem('Column_Meta_Book_List', JSON.stringify({ Overrides: { Genre: false } }));
								Expect(tmpProvider.getColumnVisibilityOverrides('Book', 'List')).to.deep.equal({ Genre: true });
							}, fDone);
						});
				});

		suite
			(
				'Manifest DefaultHidden carry-through',
				() =>
				{
					test(
						'generateManifestTableCells carries DefaultHidden onto the generated cells',
						(fDone) =>
						{
							buildHarness((pPict) =>
							{
								const tmpMetaController = pPict.services.PictSectionRecordSet;
								const tmpManifest =
								{
									Scope: 'Book-List',
									Descriptors:
									{
										Title: { Name: 'Title', PictDashboard: {} },
										Notes: { Name: 'Notes', DefaultHidden: true, PictDashboard: {} },
									},
								};
								tmpMetaController.generateManifestTableCells(tmpManifest);
								Expect(tmpManifest.TableCells).to.be.an('array');
								Expect(tmpManifest.TableCells[0].Key).to.equal('Title');
								Expect(tmpManifest.TableCells[0].DefaultHidden).to.equal(false);
								Expect(tmpManifest.TableCells[1].Key).to.equal('Notes');
								Expect(tmpManifest.TableCells[1].DefaultHidden).to.equal(true);
							}, fDone);
						});
				});

		suite
			(
				'Candidate composition',
				() =>
				{
					test(
						'is a strict no-op when the chooser flag is off',
						(fDone) =>
						{
							buildHarness((pPict) =>
							{
								const tmpListView = pPict.views['RSP-RecordSet-List'];
								const tmpListData = buildListData({ RecordSetListColumnChooser: false });
								const tmpOriginalCells = tmpListData.TableCells;
								tmpListView._composeColumnCandidates(tmpListData);
								Expect(tmpListData.TableCells).to.equal(tmpOriginalCells, 'TableCells reference should be untouched.');
								Expect(tmpListData.ColumnCandidates).to.be.undefined;
								// Always an empty array when off — a missing address would make the chooser
								// button's {~TS:~} iterate the record object's keys.
								Expect(tmpListData.ColumnChooserSlot).to.deep.equal([]);
							}, fDone);
						});

					test(
						'composes curated + schema tiers with exclusions, defaults, and overrides',
						(fDone) =>
						{
							buildHarness((pPict) =>
							{
								pPict.providers.ColumnDataProvider.storageProvider = pPict.providers.ColumnDataProvider;
								const tmpListView = pPict.views['RSP-RecordSet-List'];
								const tmpListData = buildListData();
								const tmpOriginalFirstCell = tmpListData.TableCells[0];
								tmpListView._composeColumnCandidates(tmpListData);

								// Candidates: curated in declared order, then schema alphabetical, then the audit tier
								// (identity + audit stamps present in the schema, friendly labels).
								const tmpKeys = tmpListData.ColumnCandidates.map((pCell) => pCell.Key);
								Expect(tmpKeys).to.deep.equal([ 'Title', 'Status', 'Genre', 'IDAuthor', 'PageCount', 'IDBook', 'CreateDate', 'Deleted' ],
									'Curated order first; schema tier sorted (FormData blob + Title dupe excluded); audit tier trailing.');
								Expect(tmpListData.ColumnCandidates[0]).to.not.equal(tmpOriginalFirstCell, 'Curated candidates must be copies, not the shared cells.');
								Expect(tmpListData.ColumnCandidates[2].Source).to.equal('Schema');
								Expect(tmpListData.ColumnCandidates[2].DefaultHidden).to.equal(true);
								const tmpAuditCandidate = tmpListData.ColumnCandidates.find((pCell) => pCell.Key === 'CreateDate');
								Expect(tmpAuditCandidate.Source).to.equal('Audit');
								Expect(tmpAuditCandidate.DisplayName).to.equal('Created');
								Expect(tmpAuditCandidate.DefaultHidden).to.equal(true);
								Expect(tmpListData.ColumnCandidates.find((pCell) => pCell.Key === 'IDBook').DisplayName).to.equal('ID');

								// Default visibility: only the non-DefaultHidden curated column renders.
								Expect(tmpListData.TableCells.map((pCell) => pCell.Key)).to.deep.equal([ 'Title' ]);
								Expect(tmpListData.ColumnChooserSlot).to.deep.equal([ { RecordSet: 'Book' } ]);

								// Overrides: show Status (curated DefaultHidden) + Genre (schema), hide nothing else.
								pPict.providers.ColumnDataProvider.setColumnVisibilityOverride('Book', 'List', 'Status', true);
								pPict.providers.ColumnDataProvider.setColumnVisibilityOverride('Book', 'List', 'Genre', true);
								const tmpRepaintCells = tmpListView._computeVisibleTableCells(tmpListData.ColumnCandidates, 'Book');
								Expect(tmpRepaintCells.map((pCell) => pCell.Key)).to.deep.equal([ 'Title', 'Status', 'Genre' ]);

								// All-hidden overrides fall back to the default-visible set.
								pPict.providers.ColumnDataProvider.clearColumnVisibilityOverrides('Book', 'List');
								pPict.providers.ColumnDataProvider.setColumnVisibilityOverride('Book', 'List', 'Title', false);
								const tmpFallbackCells = tmpListView._computeVisibleTableCells(tmpListData.ColumnCandidates, 'Book');
								Expect(tmpFallbackCells.map((pCell) => pCell.Key)).to.deep.equal([ 'Title' ], 'Hiding every column falls back to default-visible.');
							}, fDone);
						});
				});

		suite
			(
				'Toggle orchestration',
				() =>
				{
					test(
						'repaints locally except when a Lite list is missing a shown schema column',
						(fDone) =>
						{
							buildHarness((pPict) =>
							{
								pPict.providers.ColumnDataProvider.storageProvider = pPict.providers.ColumnDataProvider;
								const tmpListView = pPict.views['RSP-RecordSet-List'];
								const tmpRepaintStub = sinon.stub(tmpListView, '_repaintWithColumnState');
								const tmpRerunStub = sinon.stub(tmpListView, '_rerunLastListRender');

								// Non-Lite list: any toggle is a local repaint.
								let tmpListData = buildListData();
								tmpListView._composeColumnCandidates(tmpListData);
								tmpListView._lastRecordListData = tmpListData;
								tmpListView.setColumnVisibility('Book', 'PageCount', true);
								Expect(tmpRepaintStub.callCount).to.equal(1);
								Expect(tmpRerunStub.callCount).to.equal(0);

								// Lite list: showing a schema column whose data is absent triggers a refetch...
								pPict.providers.ColumnDataProvider.clearColumnVisibilityOverrides('Book', 'List');
								tmpListData = buildListData({ RecordSetListLiteFetch: true });
								tmpListView._composeColumnCandidates(tmpListData);
								tmpListView._lastRecordListData = tmpListData;
								tmpListView.setColumnVisibility('Book', 'PageCount', true);
								Expect(tmpRerunStub.callCount).to.equal(1, 'Missing schema column under Lite should rerun the render.');

								// ...but a schema column already present in the records repaints locally...
								tmpListView.setColumnVisibility('Book', 'Genre', true);
								Expect(tmpRepaintStub.callCount).to.equal(2);
								Expect(tmpRerunStub.callCount).to.equal(1);

								// ...and a curated column always repaints locally (manifest columns are always fetched).
								tmpListView.setColumnVisibility('Book', 'Status', true);
								Expect(tmpRepaintStub.callCount).to.equal(3);
								Expect(tmpRerunStub.callCount).to.equal(1);

								// Clamp: refuse to hide the last visible column.
								pPict.providers.ColumnDataProvider.clearColumnVisibilityOverrides('Book', 'List');
								const tmpResult = tmpListView.setColumnVisibility('Book', 'Title', false);
								Expect(tmpResult).to.equal(true, 'Hiding the last visible column should be refused (stays visible).');
								Expect(pPict.providers.ColumnDataProvider.getColumnVisibilityOverrides('Book', 'List')).to.deep.equal({}, 'No override should be persisted by a refused toggle.');

								// Stale chooser: a toggle for a different recordset no-ops.
								const tmpRepaintCalls = tmpRepaintStub.callCount;
								tmpListView.setColumnVisibility('Author', 'Name', true);
								Expect(tmpRepaintStub.callCount).to.equal(tmpRepaintCalls, 'Stale-recordset toggle should not repaint.');
							}, fDone);
						});
				});

		suite
			(
				'Lite ExtraColumns union',
				() =>
				{
					test(
						'_deriveLiteExtraColumns unions shown schema-tier overrides, flag-gated',
						(fDone) =>
						{
							buildHarness((pPict) =>
							{
								pPict.providers.ColumnDataProvider.storageProvider = pPict.providers.ColumnDataProvider;
								const tmpProvider = pPict.addProvider('RSP-Provider-Book', { Entity: 'Book', RecordSet: 'Book' }, libPictSectionRecordSet.RecordSetProviderMeadowEndpoints);
								// Hand-set the entity schema (legacy flat MeadowSchema path, which _deriveLiteExtraColumns reads).
								tmpProvider._Schema =
								{
									MeadowSchema:
									{
										Schema:
										[
											{ Column: 'Title', Type: 'String' },
											{ Column: 'Genre', Type: 'String' },
											{ Column: 'PageCount', Type: 'Integer' },
											{ Column: 'FormData', Type: 'JSON' },
											{ Column: 'IDAuthor', Type: 'Integer' },
										],
									},
								};
								// A registered manifest drives the descriptor-derived columns.
								pPict.services.PictSectionRecordSet.manifestDefinitions['Book-List'] =
								{
									Scope: 'Book-List',
									Descriptors:
									{
										Title: { Name: 'Title', PictDashboard: {} },
										IDAuthor: { Name: 'Author', PictDashboard: {} },
									},
								};
								const tmpConfig =
								{
									RecordSet: 'Book',
									RecordSetListDefaultManifest: 'Book-List',
									RecordSetListColumnChooser: true,
								};

								// Overrides: PageCount shown (real scalar -> unioned), FormData shown (blob -> skipped),
								// IDAuthor shown (free in Lite -> skipped), Genre hidden (override false -> skipped).
								pPict.providers.ColumnDataProvider.setColumnVisibilityOverride('Book', 'List', 'PageCount', true);
								pPict.providers.ColumnDataProvider.setColumnVisibilityOverride('Book', 'List', 'FormData', true);
								pPict.providers.ColumnDataProvider.setColumnVisibilityOverride('Book', 'List', 'IDAuthor', true);
								pPict.providers.ColumnDataProvider.setColumnVisibilityOverride('Book', 'List', 'Genre', false);

								const tmpColumns = tmpProvider._deriveLiteExtraColumns('Book', { RecordSet: 'Book', RecordSetConfiguration: tmpConfig });
								Expect(tmpColumns).to.deep.equal([ 'Title', 'PageCount' ]);

								// Flag off: stale overrides must not widen the projection.
								const tmpUnflaggedConfig = Object.assign({}, tmpConfig, { RecordSetListColumnChooser: false });
								const tmpUnflaggedColumns = tmpProvider._deriveLiteExtraColumns('Book', { RecordSet: 'Book', RecordSetConfiguration: tmpUnflaggedConfig });
								Expect(tmpUnflaggedColumns).to.deep.equal([ 'Title' ]);
							}, fDone);
						});
				});

		suite
			(
				'Show-deleted filter clause',
				() =>
				{
					test(
						'setShowDeletedFilterValue manages a tagged RawFilter clause that rides the fetch state',
						(fDone) =>
						{
							buildHarness((pPict) =>
							{
								const tmpProvider = pPict.addProvider('RSP-Provider-DelBook', { Entity: 'Book', RecordSet: 'DelBook' }, libPictSectionRecordSet.RecordSetProviderMeadowEndpoints);

								// Off by default.
								Expect(tmpProvider.getShowDeletedFilterValue()).to.equal(false);

								// On: a single tagged RawFilter clause referencing the Deleted column.
								tmpProvider.setShowDeletedFilterValue(true);
								Expect(tmpProvider.getShowDeletedFilterValue()).to.equal(true);
								const tmpClauses = tmpProvider.getFilterClauses();
								Expect(tmpClauses.length).to.equal(1);
								Expect(tmpClauses[0].Type).to.equal('RawFilter');
								Expect(tmpClauses[0].ShowDeletedKey).to.equal('ShowDeleted');
								Expect(tmpClauses[0].Value).to.equal('FBL~Deleted~INN~0,1');

								// Idempotent on: no duplicate clause.
								tmpProvider.setShowDeletedFilterValue(true);
								Expect(tmpProvider.getFilterClauses().length).to.equal(1);

								// The clause rides _prepareFilterState (and so both records and count fetches).
								const [ tmpPrepared ] = tmpProvider._prepareFilterState('Book', { RecordSet: 'DelBook' });
								Expect(tmpPrepared.map((pClause) => `${pClause.Type}:${pClause.Value}`)).to.deep.equal([ 'RawFilter:FBL~Deleted~INN~0,1' ]);

								// Composes with a route FilterString.
								const [ tmpComposed ] = tmpProvider._prepareFilterState('Book', { RecordSet: 'DelBook', FilterString: 'FBV~Title~LK~%25Pretty%25' });
								Expect(tmpComposed.map((pClause) => `${pClause.Type}:${pClause.Value}`))
									.to.deep.equal([ 'RawFilter:FBL~Deleted~INN~0,1', 'RawFilter:FBV~Title~LK~%25Pretty%25' ]);

								// Off: the clause is removed.
								tmpProvider.setShowDeletedFilterValue(false);
								Expect(tmpProvider.getShowDeletedFilterValue()).to.equal(false);
								Expect(tmpProvider.getFilterClauses().length).to.equal(0);
							}, fDone);
						});
				});
	});
