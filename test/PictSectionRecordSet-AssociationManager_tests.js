/*
	Unit tests for the RecordSet AssociationManager — the registry + data layer behind the Association
	read-tab editor and the Bulk Associate screen. The shared EntityProvider is stubbed so these tests
	exercise the pure association logic (side resolution, defaults, picker-cull filters, join CRUD
	payloads, list decoration) with no network.
*/

const libBrowserEnv = require('browser-env');

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libAssociationManager = require('../source/providers/RecordSet-AssociationManager.js');

suite
(
	'PictSectionRecordSet AssociationManager',
	() =>
	{
		let _Pict;
		let _Manager;
		let _Stub;

		setup(() =>
		{
			libBrowserEnv({ url: 'http://localhost/' });
			_Pict = new libPict();
			_Pict.LogNoisiness = 0;

			_Manager = _Pict.addProvider('RecordSetAssociationManager', {}, libAssociationManager);

			// Stub the EntityProvider: capture every call, and return canned data keyed by entity.
			_Stub =
			{
				calls: [],
				JoinRows: [],
				OtherRows: [],
				getEntitySet: (pEntity, pFilter, fCallback, pPostfix, pOptions) =>
				{
					_Stub.calls.push([ 'getEntitySet', pEntity, pFilter, pOptions ]);
					if (pEntity === 'BookAuthorJoin' || pEntity === 'BookStoreCatalogJoin') { return fCallback(null, _Stub.JoinRows); }
					return fCallback(null, _Stub.OtherRows);
				},
				createEntity: (pEntity, pRecord, fCallback) =>
				{
					_Stub.calls.push([ 'createEntity', pEntity, pRecord ]);
					return fCallback(null, Object.assign({ [`ID${pEntity}`]: 999 }, pRecord));
				},
				deleteEntity: (pEntity, pID, fCallback) =>
				{
					_Stub.calls.push([ 'deleteEntity', pEntity, pID ]);
					return fCallback(null, {});
				},
				updateEntity: (pEntity, pRecord, fCallback) =>
				{
					_Stub.calls.push([ 'updateEntity', pEntity, pRecord ]);
					return fCallback(null, pRecord);
				},
				clearScope: (pScope) =>
				{
					_Stub.calls.push([ 'clearScope', pScope ]);
				},
			};
			// Every prefix resolves to the stub for these tests.
			_Manager._entityProvider = () => _Stub;

			_Manager.addAssociation('BookAuthor',
				{
					JoinEntity: 'BookAuthorJoin',
					SideA: { RecordSet: 'Book',   IDField: 'IDBook',   DisplayField: 'Title', SearchFields: [ 'Title' ] },
					SideB: { RecordSet: 'Author', IDField: 'IDAuthor', DisplayField: 'Name' },
				});
		});

		suite
		(
			'Definition + side resolution',
			() =>
			{
				test('normalizes the light-config side defaults', () =>
				{
					_Manager.addAssociation('Sparse', { JoinEntity: 'WidgetGadgetJoin', SideA: { Entity: 'Widget' }, SideB: { RecordSet: 'Gadget' } });
					const tmpAssociation = _Manager.getAssociation('Sparse');
					Expect(tmpAssociation.SideA.IDField).to.equal('IDWidget', 'IDField defaults to ID<Entity>.');
					Expect(tmpAssociation.SideA.DisplayField).to.equal('Name', 'DisplayField defaults to Name.');
					Expect(tmpAssociation.SideA.SearchFields).to.deep.equal([ 'Name' ], 'SearchFields defaults to [DisplayField].');
					Expect(tmpAssociation.SideB.Entity).to.equal('Gadget', 'Entity defaults to RecordSet.');
					Expect(tmpAssociation.SideB.IDField).to.equal('IDGadget', 'IDField derives from the defaulted Entity.');
				});

				test('rejects an invalid definition', () =>
				{
					Expect(_Manager.addAssociation('Bad', { SideA: {}, SideB: {} })).to.equal(false, 'missing JoinEntity is rejected.');
					Expect(_Manager.getAssociation('Bad')).to.equal(undefined);
				});

				test('resolves "this side" from each recordset', () =>
				{
					const tmpFromBook = _Manager.resolveSides('BookAuthor', 'Book');
					Expect(tmpFromBook.thisSide.Entity).to.equal('Book');
					Expect(tmpFromBook.otherSide.Entity).to.equal('Author');
					Expect(tmpFromBook.otherSide.IDField).to.equal('IDAuthor');

					const tmpFromAuthor = _Manager.resolveSides('BookAuthor', 'Author');
					Expect(tmpFromAuthor.thisSide.Entity).to.equal('Author');
					Expect(tmpFromAuthor.otherSide.Entity).to.equal('Book');
					Expect(tmpFromAuthor.otherSide.IDField).to.equal('IDBook');
				});

				test('returns false for a recordset that is neither side', () =>
				{
					Expect(_Manager.resolveSides('BookAuthor', 'Banana')).to.equal(false);
					Expect(_Manager.resolveSides('NopeAssociation', 'Book')).to.equal(false);
				});
			});

		suite
		(
			'Picker config (cull)',
			() =>
			{
				test('the other-side picker culls the currently-associated ids', () =>
				{
					const tmpConfig = _Manager.buildOtherPickerConfig('BookAuthor', 'Book', () => [ 3, 4, 5 ], { Mode: 'multi' });
					Expect(tmpConfig.Entity).to.equal('Author');
					Expect(tmpConfig.ValueField).to.equal('IDAuthor');
					Expect(tmpConfig.TextField).to.equal('Name');
					Expect(tmpConfig.Mode).to.equal('multi', 'overrides are merged in.');
					Expect(tmpConfig.BaseFilter()).to.equal('FBL~IDAuthor~NIN~3,4,5', 'the cull is a NIN over the excluded ids.');
				});

				test('the cull filter is empty when nothing is associated', () =>
				{
					const tmpConfig = _Manager.buildOtherPickerConfig('BookAuthor', 'Book', () => []);
					Expect(tmpConfig.BaseFilter()).to.equal('', 'no excluded ids -> no filter (matches everything).');
				});

				test('the anchor picker has no cull', () =>
				{
					const tmpConfig = _Manager.buildAnchorPickerConfig('BookAuthor', 'Book');
					Expect(tmpConfig.Entity).to.equal('Book');
					Expect(tmpConfig.ValueField).to.equal('IDBook');
					Expect(tmpConfig.BaseFilter).to.equal(undefined, 'the anchor side is not culled.');
				});

				test('ChipFields ride through to the picker config as EntityTags (TagLast)', () =>
				{
					_Manager.addAssociation('Chips',
						{
							JoinEntity: 'BookAuthorJoin',
							SideA: { RecordSet: 'Book',   IDField: 'IDBook',   ChipFields: [ 'ISBN', { Field: 'PublicationYear', Label: 'Year' } ] },
							SideB: { RecordSet: 'Author', IDField: 'IDAuthor' },
						});
					// From the Author side, the OTHER side is Book — so its ChipFields drive the picker.
					const tmpConfig = _Manager.buildOtherPickerConfig('Chips', 'Author', () => []);
					Expect(tmpConfig.EntityTags).to.deep.equal([ 'ISBN', { Field: 'PublicationYear', Label: 'Year' } ]);
					Expect(tmpConfig.TagLast).to.equal(true, 'chips sit after the label.');
					// No ChipFields -> no EntityTags.
					Expect(_Manager.buildAnchorPickerConfig('Chips', 'Author').EntityTags).to.equal(undefined);
				});
			});

		suite
		(
			'Chip composition',
			() =>
			{
				test('composeChips renders string fields and labeled fields, dropping blanks', () =>
				{
					const tmpRecord = { ISBN: '1416524797', PublicationYear: 2000, Genre: '' };
					const tmpChips = _Manager.composeChips([ 'ISBN', { Field: 'PublicationYear', Label: 'Year' }, 'Genre' ], tmpRecord);
					Expect(tmpChips).to.deep.equal([ '1416524797', 'Year: 2000' ], 'a string spec is the raw value; an object spec is "Label: value"; the empty Genre is dropped.');
				});

				test('composeChips returns [] for no fields or no record', () =>
				{
					Expect(_Manager.composeChips([], { ISBN: 'x' })).to.deep.equal([]);
					Expect(_Manager.composeChips([ 'ISBN' ], null)).to.deep.equal([]);
				});
			});

		suite
		(
			'Join CRUD',
			() =>
			{
				test('createJoin posts the join with both ids and any default values', async () =>
				{
					_Manager.addAssociation('TenantBookAuthor',
						{
							JoinEntity: 'BookAuthorJoin',
							DefaultJoinValues: { IDCustomer: 5 },
							SideA: { RecordSet: 'Book',   IDField: 'IDBook' },
							SideB: { RecordSet: 'Author', IDField: 'IDAuthor' },
						});
					await _Manager.createJoin('TenantBookAuthor', 'Book', 1, 7);
					const tmpCall = _Stub.calls.find((pCall) => pCall[0] === 'createEntity');
					Expect(tmpCall[1]).to.equal('BookAuthorJoin');
					Expect(tmpCall[2]).to.deep.equal({ IDCustomer: 5, IDBook: 1, IDAuthor: 7 }, 'this id, other id, and the default tenant id are all stamped.');
				});

				test('removeJoin deletes by the join record id', async () =>
				{
					await _Manager.removeJoin('BookAuthor', { IDBookAuthorJoin: 42, IDBook: 1, IDAuthor: 7 });
					const tmpCall = _Stub.calls.find((pCall) => pCall[0] === 'deleteEntity');
					Expect(tmpCall[1]).to.equal('BookAuthorJoin');
					Expect(tmpCall[2]).to.equal(42, 'the ID<JoinEntity> drives the delete.');
				});

				test('listJoinRecords reads the join entity under the association cache scope with NoCount', async () =>
				{
					_Stub.JoinRows = [ { IDBookAuthorJoin: 11, IDBook: 1, IDAuthor: 7 } ];
					await _Manager.listJoinRecords('BookAuthor', 'Book', 1);
					const tmpCall = _Stub.calls.find((pCall) => pCall[0] === 'getEntitySet' && pCall[1] === 'BookAuthorJoin');
					Expect(tmpCall[3]).to.be.an('object', 'join reads pass an options object.');
					Expect(tmpCall[3].Scope).to.equal('RecordSetAssociation', 'join reads run under a dedicated cache scope so a write can clear them.');
					Expect(tmpCall[3].NoCount).to.equal(true, 'NoCount avoids the separately-cached record count returning a stale zero after a write.');
				});

				test('createJoin clears the association cache scope after the write', async () =>
				{
					await _Manager.createJoin('BookAuthor', 'Book', 1, 7);
					const tmpCreateIndex = _Stub.calls.findIndex((pCall) => pCall[0] === 'createEntity');
					const tmpClearIndex = _Stub.calls.findIndex((pCall) => pCall[0] === 'clearScope' && pCall[1] === 'RecordSetAssociation');
					Expect(tmpClearIndex).to.be.greaterThan(-1, 'the association cache scope is cleared after a create.');
					Expect(tmpClearIndex).to.be.greaterThan(tmpCreateIndex, 'the cache is cleared AFTER the join is written, not before.');
				});

				test('removeJoin clears the association cache scope after the write', async () =>
				{
					await _Manager.removeJoin('BookAuthor', { IDBookAuthorJoin: 42, IDBook: 1, IDAuthor: 7 });
					const tmpDeleteIndex = _Stub.calls.findIndex((pCall) => pCall[0] === 'deleteEntity');
					const tmpClearIndex = _Stub.calls.findIndex((pCall) => pCall[0] === 'clearScope' && pCall[1] === 'RecordSetAssociation');
					Expect(tmpClearIndex).to.be.greaterThan(-1, 'the association cache scope is cleared after a remove.');
					Expect(tmpClearIndex).to.be.greaterThan(tmpDeleteIndex, 'the cache is cleared AFTER the join is deleted.');
				});

				test('listAssociatedRecords resolves and decorates each join row', async () =>
				{
					// From the Book side: join rows carry IDAuthor; the other-side fetch returns Author rows.
					_Stub.JoinRows = [ { IDBookAuthorJoin: 11, IDBook: 1, IDAuthor: 7 }, { IDBookAuthorJoin: 12, IDBook: 1, IDAuthor: 8 } ];
					_Stub.OtherRows = [ { IDAuthor: 7, Name: 'Ursula' }, { IDAuthor: 8, Name: 'Octavia' } ];

					const tmpItems = await _Manager.listAssociatedRecords('BookAuthor', 'Book', 1);
					Expect(tmpItems.length).to.equal(2);
					Expect(tmpItems[0]).to.include({ JoinID: 11, OtherID: 7, Display: 'Ursula' });
					Expect(tmpItems[1]).to.include({ JoinID: 12, OtherID: 8, Display: 'Octavia' });

					// The join list was filtered to this anchor; the other-side fetch was an INN over the ids.
					const tmpJoinFetch = _Stub.calls.find((pCall) => pCall[0] === 'getEntitySet' && pCall[1] === 'BookAuthorJoin');
					Expect(tmpJoinFetch[2]).to.equal('FBV~IDBook~EQ~1');
					const tmpOtherFetch = _Stub.calls.find((pCall) => pCall[0] === 'getEntitySet' && pCall[1] === 'Author');
					Expect(tmpOtherFetch[2]).to.equal('FBL~IDAuthor~INN~7,8');
				});

				test('listAssociatedRecords falls back to a #id display when the other record is missing', async () =>
				{
					_Stub.JoinRows = [ { IDBookAuthorJoin: 11, IDBook: 1, IDAuthor: 7 } ];
					_Stub.OtherRows = []; // the author row could not be resolved
					const tmpItems = await _Manager.listAssociatedRecords('BookAuthor', 'Book', 1);
					Expect(tmpItems[0].Display).to.equal('#7', 'a dangling reference still renders its id.');
				});

				test('listAssociatedRecords + listAssociatedIDs skip a sentinel row whose id-keyed other reference is 0', async () =>
				{
					// An IDAuthor=0 row is a sentinel (no author 0) — e.g. a host's "default set" marker
					// parked in the join table — not a real association, so it never surfaces as a "#0" row.
					_Stub.JoinRows = [ { IDBookAuthorJoin: 10, IDBook: 1, IDAuthor: 0 }, { IDBookAuthorJoin: 11, IDBook: 1, IDAuthor: 7 } ];
					_Stub.OtherRows = [ { IDAuthor: 7, Name: 'Ursula' } ];
					const tmpItems = await _Manager.listAssociatedRecords('BookAuthor', 'Book', 1);
					Expect(tmpItems.length).to.equal(1, 'the IDAuthor=0 sentinel row is dropped.');
					Expect(tmpItems[0]).to.include({ JoinID: 11, OtherID: 7, Display: 'Ursula' });
					const tmpOtherFetch = _Stub.calls.find((pCall) => pCall[0] === 'getEntitySet' && pCall[1] === 'Author');
					Expect(tmpOtherFetch[2]).to.equal('FBL~IDAuthor~INN~7', 'the 0 sentinel is excluded from the other-side fetch.');
					const tmpIDs = await _Manager.listAssociatedIDs('BookAuthor', 'Book', 1);
					Expect(tmpIDs).to.deep.equal([ 7 ], 'listAssociatedIDs drops it too.');
				});

				test('listJoinRecordsForIDs filters the join entity by an IN over the this-side ids (matrix dedup)', async () =>
				{
					_Stub.JoinRows = [ { IDBookAuthorJoin: 11, IDBook: 1, IDAuthor: 7 }, { IDBookAuthorJoin: 12, IDBook: 2, IDAuthor: 8 } ];
					const tmpRows = await _Manager.listJoinRecordsForIDs('BookAuthor', 'Book', [ 1, 2, 3 ]);
					Expect(tmpRows.length).to.equal(2);
					const tmpCall = _Stub.calls.find((pCall) => pCall[0] === 'getEntitySet' && pCall[1] === 'BookAuthorJoin');
					Expect(tmpCall[2]).to.equal('FBL~IDBook~INN~1,2,3', 'the join entity is filtered by the this-side ids.');
					Expect(await _Manager.listJoinRecordsForIDs('BookAuthor', 'Book', [])).to.deep.equal([], 'empty id list short-circuits to [].');
				});
			});

		suite
		(
			'Name-keyed sides, rich joins, and defaults synthesis',
			() =>
			{
				// Project ↔ ObservationManifest: the project side is keyed by IDProject, but the manifest
				// side is keyed by its NAME on the join (ObservationManifestName), and the join carries
				// per-association config (Journal/Ordinal).
				const registerProjectManifest = (pOverrides) =>
				{
					_Manager.addAssociation('ProjectObservationManifest', Object.assign(
						{
							JoinEntity: 'ProjectObservationManifestJoin',
							JoinEditableFields: [ { Field: 'Journal', Type: 'checkbox' }, { Field: 'Ordinal', Type: 'number' } ],
							SideA: { RecordSet: 'Project', IDField: 'IDProject', DisplayField: 'Name' },
							SideB: { RecordSet: 'ObservationManifest', IDField: 'Name', JoinField: 'ObservationManifestName', DisplayField: 'DisplayName' },
						}, pOverrides || {}));
				};

				test('JoinField defaults to IDField, and a side can override it', () =>
				{
					registerProjectManifest();
					const tmpAssoc = _Manager.getAssociation('ProjectObservationManifest');
					Expect(tmpAssoc.SideA.JoinField).to.equal('IDProject', 'JoinField defaults to IDField.');
					Expect(tmpAssoc.SideB.IDField).to.equal('Name', 'the manifest side is keyed by Name.');
					Expect(tmpAssoc.SideB.JoinField).to.equal('ObservationManifestName', 'its join column is ObservationManifestName.');
				});

				test('listJoinRecords filters the join by the this-side JoinField (url-encoded for string keys)', async () =>
				{
					registerProjectManifest();
					_Stub.getEntitySet = (pEntity, pFilter, fCallback) => { _Stub.calls.push([ 'getEntitySet', pEntity, pFilter ]); return fCallback(null, []); };
					_Stub.calls = [];
					await _Manager.listJoinRecords('ProjectObservationManifest', 'Project', 42);
					Expect(_Stub.calls.find((pCall) => pCall[1] === 'ProjectObservationManifestJoin')[2]).to.equal('FBV~IDProject~EQ~42');
					_Stub.calls = [];
					await _Manager.listJoinRecords('ProjectObservationManifest', 'ObservationManifest', 'Legacy Personnel');
					Expect(_Stub.calls.find((pCall) => pCall[1] === 'ProjectObservationManifestJoin')[2]).to.equal(`FBV~ObservationManifestName~EQ~${encodeURIComponent('Legacy Personnel')}`);
				});

				test('a name-keyed other reference of "0" is NOT treated as a sentinel (only id-keyed 0 is)', async () =>
				{
					// The 0-guard applies only to id-keyed sides (where 0 is never a real auto-increment id).
					// A name-keyed other side whose key happens to be the string "0" is a legitimate record.
					registerProjectManifest();
					const tmpJoins = [ { IDProjectObservationManifestJoin: 5, IDProject: 42, ObservationManifestName: '0' }, { IDProjectObservationManifestJoin: 6, IDProject: 42, ObservationManifestName: 'Legacy Weather' } ];
					const tmpManifests = [ { Name: '0', DisplayName: 'Zero' }, { Name: 'Legacy Weather', DisplayName: 'Weather' } ];
					_Stub.getEntitySet = (pEntity, pFilter, fCallback) =>
					{
						_Stub.calls.push([ 'getEntitySet', pEntity, pFilter ]);
						return fCallback(null, (pEntity === 'ProjectObservationManifestJoin') ? tmpJoins : tmpManifests);
					};
					const tmpItems = await _Manager.listAssociatedRecords('ProjectObservationManifest', 'Project', 42);
					Expect(tmpItems.length).to.equal(2, 'the manifest legitimately named "0" survives — name-keyed sides are never 0-guarded.');
					Expect(tmpItems.map((pItem) => pItem.OtherID)).to.deep.equal([ '0', 'Legacy Weather' ]);
				});

				test('createJoin writes the JoinField columns + optional per-join values', async () =>
				{
					registerProjectManifest();
					_Stub.calls = [];
					await _Manager.createJoin('ProjectObservationManifest', 'Project', 42, 'Legacy Weather', { Journal: 1, Ordinal: 3 });
					const tmpRecord = _Stub.calls.find((pCall) => pCall[0] === 'createEntity')[2];
					Expect(tmpRecord.IDProject).to.equal(42, 'this side keyed by IDProject.');
					Expect(tmpRecord.ObservationManifestName).to.equal('Legacy Weather', 'other side keyed by the name column.');
					Expect(tmpRecord.Journal).to.equal(1, 'per-join value stamped.');
					Expect(tmpRecord.Ordinal).to.equal(3);
				});

				test('updateJoin merges values, PUTs the join, and clears the cache', async () =>
				{
					registerProjectManifest();
					_Stub.calls = [];
					const tmpJoin = { IDProjectObservationManifestJoin: 7, IDProject: 42, ObservationManifestName: 'Legacy Weather', Journal: 0, Spreadsheet: 0 };
					await _Manager.updateJoin('ProjectObservationManifest', tmpJoin, { Journal: 1, Spreadsheet: 1 });
					const tmpUpdate = _Stub.calls.find((pCall) => pCall[0] === 'updateEntity');
					Expect(tmpUpdate[1]).to.equal('ProjectObservationManifestJoin');
					Expect(tmpUpdate[2].IDProjectObservationManifestJoin).to.equal(7, 'the join id is preserved for the PUT.');
					Expect(tmpUpdate[2].Journal).to.equal(1);
					Expect(tmpUpdate[2].Spreadsheet).to.equal(1);
					Expect(_Stub.calls.some((pCall) => pCall[0] === 'clearScope')).to.equal(true, 'cache cleared after the write.');
				});

				test('getJoinEditableFields + hasDefaultSynthesizer reflect the config', () =>
				{
					registerProjectManifest({ SynthesizeDefaults: async () => [] });
					Expect(_Manager.getJoinEditableFields('ProjectObservationManifest').length).to.equal(2);
					Expect(_Manager.hasDefaultSynthesizer('ProjectObservationManifest')).to.equal(true);
					registerProjectManifest();
					Expect(_Manager.hasDefaultSynthesizer('ProjectObservationManifest')).to.equal(false, 're-registering without a hook clears it.');
				});

				test('synthesizeDefaults applies the host hook, dedup vs existing, with per-join config', async () =>
				{
					_Stub.getEntitySet = (pEntity, pFilter, fCallback) =>
						fCallback(null, (pEntity === 'ProjectObservationManifestJoin') ? [ { IDProjectObservationManifestJoin: 1, IDProject: 42, ObservationManifestName: 'Legacy Weather' } ] : []);
					registerProjectManifest(
						{
							SynthesizeDefaults: async (pContext) =>
							{
								Expect(pContext.thisID).to.equal(42);
								Expect(pContext.otherSide.JoinField).to.equal('ObservationManifestName');
								Expect(pContext.existingJoins.length).to.equal(1, 'the hook sees the current joins.');
								return [
									{ value: 'Legacy Weather', joinValues: { Journal: 1 } },
									{ value: 'Legacy Personnel', joinValues: { Spreadsheet: 1, Ordinal: 0 } },
									{ value: 'Legacy Temperature', joinValues: { Journal: 1, Ordinal: 1 } },
								];
							},
						});
					_Stub.calls = [];
					const tmpResult = await _Manager.synthesizeDefaults('ProjectObservationManifest', 'Project', 42);
					Expect(tmpResult.created).to.equal(2, 'two new defaults created.');
					Expect(tmpResult.skipped).to.equal(1, 'the already-linked one is skipped.');
					const tmpCreates = _Stub.calls.filter((pCall) => pCall[0] === 'createEntity');
					Expect(tmpCreates.length).to.equal(2);
					Expect(tmpCreates[0][2].ObservationManifestName).to.equal('Legacy Personnel');
					Expect(tmpCreates[0][2].Spreadsheet).to.equal(1, 'per-join config from the hook is stamped.');
					Expect(tmpCreates[1][2].ObservationManifestName).to.equal('Legacy Temperature');
				});

				test('synthesizeDefaults is a no-op with no hook', async () =>
				{
					registerProjectManifest();
					Expect(await _Manager.synthesizeDefaults('ProjectObservationManifest', 'Project', 42)).to.deep.equal({ created: 0, skipped: 0 });
				});
			});

		suite
		(
			'Reassociation-on-delete (repointJoins + getAssociationsForRecordSet)',
			() =>
			{
				// A join-read stub that branches on the anchor id in the filter so fromID and toID can return
				// different existing joins (repointJoins snapshots both up front for the dedup).
				const stubJoinsByAnchor = (pField, pByID) =>
				{
					_Stub.getEntitySet = (pEntity, pFilter, fCallback) =>
					{
						_Stub.calls.push([ 'getEntitySet', pEntity, pFilter ]);
						const tmpMatch = pFilter.match(new RegExp(`FBV~${pField}~EQ~([^~]+)`));
						const tmpKey = tmpMatch ? tmpMatch[1] : '';
						return fCallback(null, (pByID[tmpKey] || []).slice());
					};
				};

				test('repoints non-colliding joins onto the replacement (this-side column updated)', async () =>
				{
					// Delete author 1, move his books to author 2. Neither book is already on author 2.
					stubJoinsByAnchor('IDAuthor',
						{
							'1': [ { IDBookAuthorJoin: 11, IDAuthor: 1, IDBook: 7 }, { IDBookAuthorJoin: 12, IDAuthor: 1, IDBook: 8 } ],
							'2': [],
						});
					_Stub.calls = [];
					const tmpResult = await _Manager.repointJoins('BookAuthor', 'Author', 1, 2);
					Expect(tmpResult).to.deep.equal({ repointed: 2, deletedDuplicate: 0, failed: 0 });
					const tmpUpdates = _Stub.calls.filter((pCall) => pCall[0] === 'updateEntity');
					Expect(tmpUpdates.length).to.equal(2, 'each join is repointed via a minimal update.');
					Expect(tmpUpdates[0][2]).to.deep.equal({ IDBookAuthorJoin: 11, IDAuthor: 2 }, 'the this-side column is repointed to the replacement.');
					Expect(tmpUpdates[1][2]).to.deep.equal({ IDBookAuthorJoin: 12, IDAuthor: 2 });
					Expect(_Stub.calls.some((pCall) => pCall[0] === 'deleteEntity')).to.equal(false, 'no duplicates -> nothing deleted.');
				});

				test('drops a from-join that would duplicate an existing to-join (dedup by other-side id)', async () =>
				{
					// Author 2 already has book 7; moving author 1's books [7,8] must drop the 7 join, repoint 8.
					stubJoinsByAnchor('IDAuthor',
						{
							'1': [ { IDBookAuthorJoin: 11, IDAuthor: 1, IDBook: 7 }, { IDBookAuthorJoin: 12, IDAuthor: 1, IDBook: 8 } ],
							'2': [ { IDBookAuthorJoin: 20, IDAuthor: 2, IDBook: 7 } ],
						});
					_Stub.calls = [];
					const tmpResult = await _Manager.repointJoins('BookAuthor', 'Author', 1, 2);
					Expect(tmpResult).to.deep.equal({ repointed: 1, deletedDuplicate: 1, failed: 0 });
					const tmpDeletes = _Stub.calls.filter((pCall) => pCall[0] === 'deleteEntity');
					Expect(tmpDeletes.length).to.equal(1, 'the colliding from-join is deleted, not repointed.');
					Expect(tmpDeletes[0][2]).to.equal(11, 'the join to the already-linked book 7 is dropped.');
					const tmpUpdates = _Stub.calls.filter((pCall) => pCall[0] === 'updateEntity');
					Expect(tmpUpdates.length).to.equal(1);
					Expect(tmpUpdates[0][2]).to.deep.equal({ IDBookAuthorJoin: 12, IDAuthor: 2 }, 'only the non-colliding book 8 is repointed.');
				});

				test('is a no-op when the replacement is the record being deleted (self-repoint guard)', async () =>
				{
					stubJoinsByAnchor('IDAuthor', { '5': [ { IDBookAuthorJoin: 55, IDAuthor: 5, IDBook: 7 } ] });
					_Stub.calls = [];
					const tmpResult = await _Manager.repointJoins('BookAuthor', 'Author', 5, 5);
					Expect(tmpResult).to.deep.equal({ repointed: 0, deletedDuplicate: 0, failed: 0 });
					Expect(_Stub.calls.some((pCall) => pCall[0] === 'updateEntity' || pCall[0] === 'deleteEntity')).to.equal(false, 'nothing is written for a self-repoint.');
				});

				test('repoints a name-keyed this-side join column', async () =>
				{
					// Delete a manifest (keyed by ObservationManifestName), move its projects to another manifest.
					_Manager.addAssociation('ProjectObservationManifest',
						{
							JoinEntity: 'ProjectObservationManifestJoin',
							SideA: { RecordSet: 'Project', IDField: 'IDProject', DisplayField: 'Name' },
							SideB: { RecordSet: 'ObservationManifest', IDField: 'Name', JoinField: 'ObservationManifestName', DisplayField: 'DisplayName' },
						});
					stubJoinsByAnchor('ObservationManifestName',
						{
							'Old': [ { IDProjectObservationManifestJoin: 3, IDProject: 42, ObservationManifestName: 'Old' } ],
							'New': [],
						});
					_Stub.calls = [];
					const tmpResult = await _Manager.repointJoins('ProjectObservationManifest', 'ObservationManifest', 'Old', 'New');
					Expect(tmpResult.repointed).to.equal(1);
					const tmpUpdate = _Stub.calls.find((pCall) => pCall[0] === 'updateEntity');
					Expect(tmpUpdate[2]).to.deep.equal({ IDProjectObservationManifestJoin: 3, ObservationManifestName: 'New' }, 'the name-keyed this-side column is repointed.');
				});

				test('getAssociationsForRecordSet returns every association a recordset participates in', () =>
				{
					_Manager.addAssociation('BookStoreCatalog',
						{
							JoinEntity: 'BookStoreCatalogJoin',
							SideA: { RecordSet: 'BookStore', IDField: 'IDBookStore' },
							SideB: { RecordSet: 'Book', IDField: 'IDBook' },
						});
					Expect(_Manager.getAssociationsForRecordSet('Book')).to.have.members([ 'BookAuthor', 'BookStoreCatalog' ], 'Book is a side of both.');
					Expect(_Manager.getAssociationsForRecordSet('Author')).to.deep.equal([ 'BookAuthor' ]);
					Expect(_Manager.getAssociationsForRecordSet('BookStore')).to.deep.equal([ 'BookStoreCatalog' ]);
					Expect(_Manager.getAssociationsForRecordSet('Nonexistent')).to.deep.equal([]);
				});
			});
	}
);
